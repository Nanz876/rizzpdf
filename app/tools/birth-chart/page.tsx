"use client";
import { logTool } from "@/lib/logTool";
import { useState, useRef, useEffect, useCallback } from "react";
import ToolShell from "@/components/ToolShell";
import WorkspaceBar from "@/components/pdf/WorkspaceBar";
import PaywallModal from "@/components/PaywallModal";
import { useProStatus } from "@/lib/useProStatus";
import { CITIES } from "@/lib/locations";
import {
  computeBirthChart, formatDegree, signBlurb, planetSymbol,
  computeAspects, BirthChartResult,
} from "@/lib/astrology";
import { drawChartWheel, renderChartWheelToDataUrl } from "@/lib/chart-wheel";
import { generateBirthChartPdf, downloadBlob } from "@/lib/pdf-tools";

type Status = "form" | "result" | "generating";

const CUSTOM_LOCATION = "__custom__";

export default function BirthChartPage() {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("12:00");
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [cityKey, setCityKey] = useState(CITIES[0].name + CITIES[0].country);
  const [customLabel, setCustomLabel] = useState("");
  const [customLat, setCustomLat] = useState("");
  const [customLon, setCustomLon] = useState("");
  const [customUtc, setCustomUtc] = useState("0");
  const [status, setStatus] = useState<Status>("form");
  const [chart, setChart] = useState<BirthChartResult | null>(null);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { isPro, loading: proLoading } = useProStatus();
  const [showPaywall, setShowPaywall] = useState(false);
  const [freeCount, setFreeCount] = useState(0);
  const FREE_LIMIT = 3;

  useEffect(() => {
    const count = parseInt(localStorage.getItem("rizzpdf_birthchart_count") ?? "0", 10);
    setFreeCount(count);
  }, []);

  useEffect(() => {
    if (chart && canvasRef.current) {
      const size = 640;
      canvasRef.current.width = size;
      canvasRef.current.height = size;
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) drawChartWheel(ctx, chart, size);
    }
  }, [chart]);

  const isCustom = cityKey === CUSTOM_LOCATION;
  const selectedCity = CITIES.find(c => c.name + c.country === cityKey);

  const handleGenerate = () => {
    if (!proLoading && !isPro && freeCount >= FREE_LIMIT) { setShowPaywall(true); return; }
    setError("");
    if (!name.trim()) { setError("Enter a name."); return; }
    if (!date) { setError("Enter a birth date."); return; }
    const [year, month, day] = date.split("-").map(Number);
    if (!year || !month || !day) { setError("Invalid date."); return; }

    let latitude: number, longitude: number, utcOffsetHours: number, locationLabel: string;
    if (isCustom) {
      latitude = parseFloat(customLat);
      longitude = parseFloat(customLon);
      utcOffsetHours = parseFloat(customUtc);
      locationLabel = customLabel.trim() || "Custom location";
      if (Number.isNaN(latitude) || Number.isNaN(longitude) || Number.isNaN(utcOffsetHours)) {
        setError("Enter valid latitude, longitude, and UTC offset."); return;
      }
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        setError("Latitude must be -90..90 and longitude -180..180."); return;
      }
    } else if (selectedCity) {
      latitude = selectedCity.latitude;
      longitude = selectedCity.longitude;
      utcOffsetHours = selectedCity.utcOffsetHours;
      locationLabel = `${selectedCity.name}, ${selectedCity.country}`;
    } else {
      setError("Choose a location."); return;
    }

    const [hourStr, minuteStr] = timeUnknown ? ["12", "0"] : time.split(":");
    const hour = parseInt(hourStr, 10) || 0;
    const minute = parseInt(minuteStr, 10) || 0;

    logTool("birth-chart");
    setStatus("generating");
    const result = computeBirthChart({
      name: name.trim(), year, month, day, hour, minute,
      utcOffsetHours, latitude, longitude, timeUnknown, locationLabel,
    });
    setChart(result);
    setStatus("result");
    if (!isPro) {
      const next = freeCount + 1;
      localStorage.setItem("rizzpdf_birthchart_count", String(next));
      setFreeCount(next);
    }
  };

  const handleDownload = useCallback(async () => {
    if (!chart) return;
    const wheelDataUrl = renderChartWheelToDataUrl(chart, 1000);
    const result = await generateBirthChartPdf(chart, wheelDataUrl);
    if (result.success && result.blob) {
      downloadBlob(result.blob, result.filename ?? "birth-chart.pdf");
    } else {
      setError(result.error ?? "Failed to generate PDF.");
    }
  }, [chart]);

  const reset = () => { setChart(null); setStatus("form"); setError(""); };

  const bigThree = chart ? [
    { label: "Sun", sign: chart.sunSign },
    { label: "Moon", sign: chart.moonSign },
    ...(chart.risingSign ? [{ label: "Rising", sign: chart.risingSign }] : []),
  ] : [];

  const aspects = chart ? computeAspects(chart.points) : [];
  const rows = chart ? [...chart.points, ...(chart.ascendant ? [chart.ascendant] : []), ...(chart.midheaven ? [chart.midheaven] : [])] : [];

  return (
    <ToolShell name="Birth Chart Calculator" description="Generate a natal chart — Sun, Moon, Rising, planets, houses & aspects — and download it as a PDF." icon="🔮"
      svgIcon={<svg width="28" height="28" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.6"/><path d="M12 3v18M3 12h18" stroke="white" strokeWidth="1.2" opacity=".6"/><circle cx="12" cy="12" r="2.6" fill="white" opacity=".9"/></svg>}
      steps={status === "form" ? ["Enter birth details", "Generate your chart", "Download PDF report"] : undefined}>

      {status === "form" && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5 max-w-xl">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Full name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Najah-Lee Nanan"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-red-400" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Birth date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-red-400" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Birth time</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} disabled={timeUnknown}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-red-400 disabled:bg-gray-50 disabled:text-gray-300" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
            <input type="checkbox" checked={timeUnknown} onChange={e => setTimeUnknown(e.target.checked)} className="accent-red-600" />
            I don&apos;t know the exact birth time (Sun &amp; Moon only — no Rising sign or houses)
          </label>

          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Birth location</label>
            <select value={cityKey} onChange={e => setCityKey(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-red-400 bg-white">
              {CITIES.map(c => (
                <option key={c.name + c.country} value={c.name + c.country}>{c.name}, {c.country}</option>
              ))}
              <option value={CUSTOM_LOCATION}>Custom location…</option>
            </select>
          </div>

          {isCustom && (
            <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-lg p-3 border border-gray-100">
              <div className="col-span-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Location name</label>
                <input value={customLabel} onChange={e => setCustomLabel(e.target.value)} placeholder="e.g. Spanish Town, Jamaica"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Latitude</label>
                <input value={customLat} onChange={e => setCustomLat(e.target.value)} placeholder="17.9712"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Longitude</label>
                <input value={customLon} onChange={e => setCustomLon(e.target.value)} placeholder="-76.7936"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">UTC offset (hours)</label>
                <input value={customUtc} onChange={e => setCustomUtc(e.target.value)} placeholder="-5"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
              </div>
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button onClick={handleGenerate}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold text-sm transition-colors">
            Generate Birth Chart →
          </button>
          {!isPro && (
            <p className="text-xs text-gray-400 text-center">{Math.max(FREE_LIMIT - freeCount, 0)} free chart{FREE_LIMIT - freeCount !== 1 ? "s" : ""} remaining</p>
          )}
        </div>
      )}

      {status === "generating" && <div className="text-center py-12 text-gray-400">Calculating planetary positions…</div>}

      {status === "result" && chart && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <WorkspaceBar
            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.8"/></svg>}
            title="Birth Chart" subtitle={chart.input.name}
            onReset={reset}
            secondaryLabel="New chart" onSecondary={reset}
            primaryLabel="Download PDF Report →"
            onPrimary={handleDownload} />
          {error && <p className="text-red-500 text-sm px-5 py-2">{error}</p>}

          <div className="p-6 grid md:grid-cols-2 gap-8">
            <div className="flex flex-col items-center">
              <canvas ref={canvasRef} className="w-full max-w-md aspect-square" />
              <p className="text-xs text-gray-400 mt-3 text-center max-w-md">
                {chart.input.locationLabel} · {chart.input.month}/{chart.input.day}/{chart.input.year}
                {chart.input.timeUnknown ? " · time unknown" : ` · ${String(chart.input.hour).padStart(2, "0")}:${String(chart.input.minute).padStart(2, "0")}`}
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Big three</h3>
                <div className="space-y-2">
                  {bigThree.map(b => (
                    <div key={b.label} className="flex items-baseline gap-2">
                      <span className="text-red-600 font-black text-sm">{b.label} in {b.sign}</span>
                      <span className="text-gray-500 text-xs">— {signBlurb(b.sign)}</span>
                    </div>
                  ))}
                </div>
                {chart.input.timeUnknown && (
                  <p className="text-xs text-gray-400 mt-2">Add an exact birth time for Rising sign &amp; houses.</p>
                )}
              </div>

              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Placements</h3>
                <div className="max-h-64 overflow-y-auto pr-1 space-y-1">
                  {rows.map(p => (
                    <div key={p.name} className="flex items-center justify-between text-sm border-b border-gray-50 py-1">
                      <span className="text-gray-700">{planetSymbol(p.name)} {p.name}</span>
                      <span className="text-gray-500">
                        {formatDegree(p)} {p.retrograde && <span className="text-red-500">℞</span>} {p.house ? <span className="text-gray-300">· H{p.house}</span> : null}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {aspects.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Major aspects</h3>
                  <div className="max-h-32 overflow-y-auto pr-1 space-y-1">
                    {aspects.map((a, i) => (
                      <div key={i} className="text-xs text-gray-500 flex justify-between">
                        <span>{a.a} {a.type} {a.b}</span>
                        <span className="text-gray-300">orb {a.orb.toFixed(1)}°</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showPaywall && (
        <PaywallModal onClose={() => setShowPaywall(false)} onPay={() => setShowPaywall(false)} />
      )}
    </ToolShell>
  );
}
