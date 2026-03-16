"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import ToolShell from "@/components/ToolShell";
import UploadZone from "@/components/UploadZone";
import { signPDF, downloadBlob } from "@/lib/pdf-tools";

type Position = "bl" | "bc" | "br" | "ml" | "mc" | "mr" | "tl" | "tc" | "tr";
type Status = "idle" | "processing" | "done" | "error";

const POSITIONS: { id: Position; x: number; y: number }[] = [
  { id: "tl", x: 0.05, y: 0.75 }, { id: "tc", x: 0.35, y: 0.75 }, { id: "tr", x: 0.65, y: 0.75 },
  { id: "ml", x: 0.05, y: 0.45 }, { id: "mc", x: 0.35, y: 0.45 }, { id: "mr", x: 0.65, y: 0.45 },
  { id: "bl", x: 0.05, y: 0.10 }, { id: "bc", x: 0.35, y: 0.10 }, { id: "br", x: 0.65, y: 0.10 },
];

export default function SignPage() {
  const [file, setFile] = useState<File | null>(null);
  const [position, setPosition] = useState<Position>("br");
  const [pageNum, setPageNum] = useState<number>(0); // 0 = last page
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize canvas with white background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = getCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleFilesAdded = useCallback((files: File[]) => {
    setFile(files[0]);
    setStatus("idle");
    setErrorMsg("");
  }, []);

  const handleSign = async () => {
    if (!file || !hasSignature) return;
    const canvas = canvasRef.current!;
    const signatureDataUrl = canvas.toDataURL("image/png");
    const pos = POSITIONS.find((p) => p.id === position)!;

    setStatus("processing");
    setErrorMsg("");

    const result = await signPDF(file, {
      signatureDataUrl,
      page: pageNum === 0 ? undefined : pageNum,
      x: pos.x,
      y: pos.y,
      widthRatio: 0.3,
    });

    if (result.success && result.blob && result.filename) {
      downloadBlob(result.blob, result.filename);
      setStatus("done");
    } else {
      setErrorMsg(result.error || "Failed to sign PDF.");
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null);
    setStatus("idle");
    setErrorMsg("");
    setPageNum(0);
    setPosition("br");
    clearCanvas();
  };

  return (
    <ToolShell
      name="Sign PDF"
      description="Draw your signature and embed it into your PDF document."
      icon="✍️"
    >
      <div className="space-y-5">
        <UploadZone onFilesAdded={handleFilesAdded} disabled={status === "processing"} />

        {file && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
            {/* File */}
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
              <button onClick={reset} className="text-sm text-gray-400 hover:text-red-500 transition-colors ml-4">
                Remove
              </button>
            </div>

            {/* Signature pad */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-700">Draw your signature</p>
                <button onClick={clearCanvas} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                  Clear
                </button>
              </div>
              <canvas
                ref={canvasRef}
                width={500}
                height={150}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl cursor-crosshair touch-none"
                style={{ background: "#fff" }}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={stopDraw}
              />
              <p className="text-xs text-gray-400 mt-1">Draw with your mouse or finger</p>
            </div>

            {/* Placement */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Position</p>
                <div className="grid grid-cols-3 gap-1 w-28">
                  {POSITIONS.map((pos) => (
                    <button
                      key={pos.id}
                      onClick={() => setPosition(pos.id)}
                      title={pos.id}
                      className={`h-8 w-8 rounded-md border text-xs transition-all ${
                        position === pos.id
                          ? "bg-purple-600 border-purple-600"
                          : "bg-white border-gray-200 hover:border-purple-300"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Page</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={pageNum}
                    onChange={(e) => setPageNum(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                  />
                  <span className="text-xs text-gray-400">(0 = last page)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {status === "done" ? (
          <div className="space-y-3">
            <p className="text-center text-green-600 font-semibold">Signed PDF downloaded!</p>
            <button onClick={reset} className="w-full bg-purple-600 text-white py-3 px-6 rounded-2xl font-bold hover:bg-purple-700 transition-colors">
              Sign another PDF
            </button>
          </div>
        ) : (
          <>
            {status === "error" && <p className="text-center text-red-500 text-sm">{errorMsg}</p>}
            <button
              onClick={handleSign}
              disabled={!file || !hasSignature || status === "processing"}
              className="w-full bg-purple-600 text-white py-3 px-6 rounded-2xl font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {status === "processing" ? "Signing..." : "Add Signature"}
            </button>
          </>
        )}
      </div>
    </ToolShell>
  );
}
