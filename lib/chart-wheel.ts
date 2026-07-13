import {
  BirthChartResult, ChartPoint, ZODIAC_SYMBOLS, ZODIAC_ELEMENT,
  planetSymbol, computeAspects,
} from "./astrology";

const ELEMENT_COLOR: Record<string, string> = {
  Fire: "#fef2f2",
  Earth: "#f0fdf4",
  Air: "#eff6ff",
  Water: "#f5f3ff",
};

const ASPECT_COLOR: Record<string, string> = {
  Conjunction: "transparent", // same point, no line needed
  Sextile: "#3b82f6",
  Square: "#dc2626",
  Trine: "#16a34a",
  Opposition: "#dc2626",
};

function rad(d: number) { return (d * Math.PI) / 180; }

/** Screen angle (radians) for an ecliptic longitude, given the reference (left/9 o'clock) longitude. */
function screenAngle(longitude: number, referenceLon: number): number {
  const offset = ((longitude - referenceLon) % 360 + 360) % 360;
  return rad(180 + offset);
}

function polar(cx: number, cy: number, r: number, theta: number) {
  return { x: cx + r * Math.cos(theta), y: cy - r * Math.sin(theta) };
}

export function drawChartWheel(ctx: CanvasRenderingContext2D, chart: BirthChartResult, size: number) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.42;
  const zodiacInnerR = size * 0.35;
  const planetR = size * 0.27;
  const centerR = size * 0.12;
  const referenceLon = chart.ascendant ? chart.ascendant.longitude : 0;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  // Outer + inner background
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // Zodiac ring: 12 sectors, colored by element
  for (let s = 0; s < 12; s++) {
    const lonStart = s * 30;
    const a0 = screenAngle(lonStart, referenceLon);
    const a1 = screenAngle(lonStart + 30, referenceLon);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    // canvas arc direction: our screenAngle increases counterclockwise visually,
    // which in canvas's clockwise-positive arc() convention means drawing from a1 to a0.
    ctx.arc(cx, cy, outerR, -a1, -a0);
    ctx.closePath();
    ctx.fillStyle = ELEMENT_COLOR[ZODIAC_ELEMENT[s]];
    ctx.fill();
  }

  // mask inner circle (zodiac ring is an annulus)
  ctx.beginPath();
  ctx.arc(cx, cy, zodiacInnerR, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // Sign boundary lines + symbols
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = Math.max(1, size * 0.0016);
  for (let s = 0; s < 12; s++) {
    const a0 = screenAngle(s * 30, referenceLon);
    const p0 = polar(cx, cy, zodiacInnerR, a0);
    const p1 = polar(cx, cy, outerR, a0);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();

    const mid = screenAngle(s * 30 + 15, referenceLon);
    const labelPos = polar(cx, cy, (outerR + zodiacInnerR) / 2, mid);
    ctx.fillStyle = "#374151";
    ctx.font = `${Math.round(size * 0.038)}px sans-serif`;
    ctx.fillText(ZODIAC_SYMBOLS[s], labelPos.x, labelPos.y);
  }

  // Outer + inner ring strokes
  ctx.strokeStyle = "#9ca3af";
  ctx.lineWidth = Math.max(1.5, size * 0.002);
  ctx.beginPath(); ctx.arc(cx, cy, outerR, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, zodiacInnerR, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, centerR, 0, Math.PI * 2); ctx.stroke();

  // House cusp lines (whole sign) + numbers
  if (chart.houseCusps) {
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = Math.max(0.75, size * 0.0012);
    chart.houseCusps.forEach((cuspLon, i) => {
      const a = screenAngle(cuspLon, referenceLon);
      const p0 = polar(cx, cy, centerR, a);
      const p1 = polar(cx, cy, zodiacInnerR, a);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();

      const nextLon = chart.houseCusps![(i + 1) % 12];
      const span = ((nextLon - cuspLon) % 360 + 360) % 360 || 30;
      const midA = screenAngle(cuspLon + span / 2, referenceLon);
      const numPos = polar(cx, cy, centerR * 0.7, midA);
      ctx.fillStyle = "#9ca3af";
      ctx.font = `${Math.round(size * 0.022)}px sans-serif`;
      ctx.fillText(String(i + 1), numPos.x, numPos.y);
    });
  }

  // Aspect lines (between planet ring points, through the center area)
  const aspects = computeAspects(chart.points);
  const lonOf = (name: string) => chart.points.find(p => p.name === name)?.longitude ?? 0;
  ctx.lineWidth = Math.max(0.75, size * 0.0013);
  for (const asp of aspects) {
    const color = ASPECT_COLOR[asp.type];
    if (color === "transparent") continue;
    const pA = polar(cx, cy, centerR, screenAngle(lonOf(asp.a), referenceLon));
    const pB = polar(cx, cy, centerR, screenAngle(lonOf(asp.b), referenceLon));
    ctx.strokeStyle = color;
    ctx.globalAlpha = asp.type === "Trine" || asp.type === "Sextile" ? 0.35 : 0.3;
    ctx.beginPath();
    ctx.moveTo(pA.x, pA.y);
    ctx.lineTo(pB.x, pB.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Angles (ASC / DESC / MC / IC) — bold axis lines
  if (chart.ascendant && chart.midheaven) {
    const drawAxis = (lon: number, label: string) => {
      const a = screenAngle(lon, referenceLon);
      const p0 = polar(cx, cy, centerR, a);
      const p1 = polar(cx, cy, outerR, a);
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = Math.max(1.5, size * 0.0025);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
      const lp = polar(cx, cy, outerR + size * 0.035, a);
      ctx.fillStyle = "#dc2626";
      ctx.font = `bold ${Math.round(size * 0.026)}px sans-serif`;
      ctx.fillText(label, lp.x, lp.y);
    };
    drawAxis(chart.ascendant.longitude, "AC");
    drawAxis((chart.ascendant.longitude + 180) % 360, "DC");
    drawAxis(chart.midheaven.longitude, "MC");
    drawAxis((chart.midheaven.longitude + 180) % 360, "IC");
  }

  // Planet glyphs with simple anti-overlap radial stacking
  const sorted = [...chart.points]
    .filter(p => p.name !== "South Node")
    .sort((a, b) => a.longitude - b.longitude);
  let lastAngleDeg = -999;
  let stack = 0;
  const placed: { p: ChartPoint; r: number }[] = [];
  for (const p of sorted) {
    const angleDeg = ((p.longitude - referenceLon) % 360 + 360) % 360;
    if (Math.abs(angleDeg - lastAngleDeg) < 7) stack++; else stack = 0;
    lastAngleDeg = angleDeg;
    const r = planetR - stack * size * 0.045;
    placed.push({ p, r });
  }

  for (const { p, r } of placed) {
    const a = screenAngle(p.longitude, referenceLon);
    const tickOuter = polar(cx, cy, zodiacInnerR, a);
    const tickInner = polar(cx, cy, r + size * 0.02, a);
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = Math.max(0.5, size * 0.001);
    ctx.beginPath();
    ctx.moveTo(tickOuter.x, tickOuter.y);
    ctx.lineTo(tickInner.x, tickInner.y);
    ctx.stroke();

    const pos = polar(cx, cy, r, a);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, size * 0.022, 0, Math.PI * 2);
    ctx.fillStyle = p.name === "Sun" || p.name === "Moon" ? "#dc2626" : "#111827";
    ctx.globalAlpha = 0.08;
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = p.name === "Sun" || p.name === "Moon" ? "#dc2626" : "#1f2937";
    ctx.font = `${Math.round(size * 0.034)}px sans-serif`;
    ctx.fillText(planetSymbol(p.name), pos.x, pos.y);

    if (p.retrograde) {
      ctx.font = `${Math.round(size * 0.016)}px sans-serif`;
      ctx.fillStyle = "#dc2626";
      ctx.fillText("℞", pos.x + size * 0.026, pos.y - size * 0.02);
    }
  }

  ctx.restore();
}

export function renderChartWheelToDataUrl(chart: BirthChartResult, pixelSize = 1000): string {
  const canvas = document.createElement("canvas");
  canvas.width = pixelSize;
  canvas.height = pixelSize;
  const ctx = canvas.getContext("2d")!;
  drawChartWheel(ctx, chart, pixelSize);
  return canvas.toDataURL("image/png");
}
