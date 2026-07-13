// Client-side birth chart calculations: Sun/Moon/planet ecliptic longitudes,
// Ascendant & Midheaven, and Whole Sign houses.
//
// Planetary positions use the classic Paul Schlyter low-precision orbital
// elements method (2-body Kepler orbits + linear secular rates), which is
// accurate to roughly 1 arcminute for the 19th–21st centuries — plenty for
// sign/degree display in a birth chart tool, though not ephemeris-grade.
// Ascendant/Midheaven formulas were verified against a worked numeric
// example (RAMC 8.8485°, lat 52.2167°, obliquity 23.4371° → Asc 123.508°,
// MC 9.630°).

export interface BirthChartInput {
  name: string;
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23, local time
  minute: number; // 0-59
  utcOffsetHours: number; // e.g. -5 for Jamaica
  latitude: number; // degrees, + = North
  longitude: number; // degrees, + = East, so West is negative
  timeUnknown?: boolean;
  locationLabel?: string; // display string, e.g. "Kingston, Jamaica" — not used in calculations
}

export interface ChartPoint {
  name: string;
  longitude: number; // 0-360 ecliptic longitude
  signIndex: number; // 0-11
  sign: string;
  symbol: string;
  degreeInSign: number; // 0-30
  minuteInSign: number; // 0-59
  retrograde: boolean;
  house: number; // 1-12, 0 if birth time unknown
}

export interface BirthChartResult {
  input: BirthChartInput;
  julianDay: number;
  points: ChartPoint[]; // Sun, Moon, Mercury..Pluto, North Node, South Node
  ascendant: ChartPoint | null;
  midheaven: ChartPoint | null;
  houseCusps: number[] | null; // 12 whole-sign cusp longitudes
  sunSign: string;
  moonSign: string;
  risingSign: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────

export const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

export const ZODIAC_SYMBOLS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];

export const ZODIAC_ELEMENT = ["Fire", "Earth", "Air", "Water", "Fire", "Earth", "Air", "Water", "Fire", "Earth", "Air", "Water"];

export const PLANET_SYMBOLS: Record<string, string> = {
  Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂",
  Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇",
  "North Node": "☊", "South Node": "☋", Ascendant: "AC", Midheaven: "MC",
};

const SIGN_KEYWORDS: Record<string, string> = {
  Aries: "bold, direct, and quick to act",
  Taurus: "steady, sensual, and grounded",
  Gemini: "curious, chatty, and quick-witted",
  Cancer: "nurturing, intuitive, and protective",
  Leo: "warm, expressive, and proud",
  Virgo: "precise, thoughtful, and helpful",
  Libra: "diplomatic, charming, and fair-minded",
  Scorpio: "intense, perceptive, and passionate",
  Sagittarius: "adventurous, optimistic, and honest",
  Capricorn: "disciplined, ambitious, and patient",
  Aquarius: "independent, inventive, and idealistic",
  Pisces: "dreamy, empathetic, and imaginative",
};

// ─── Math helpers ───────────────────────────────────────────────────────────

function rad(d: number) { return (d * Math.PI) / 180; }
function deg(r: number) { return (r * 180) / Math.PI; }
function norm360(x: number) { const m = x % 360; return m < 0 ? m + 360 : m; }

/** Julian Day for a Gregorian calendar date + UT hour (fractional). */
function julianDay(year: number, month: number, day: number, utHour: number): number {
  let y = year;
  let m = month;
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  const jd0 = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524.5;
  return jd0 + utHour / 24;
}

function solveKeplerRad(Mrad: number, e: number): number {
  let E = Mrad + e * Math.sin(Mrad) * (1 + e * Math.cos(Mrad));
  for (let i = 0; i < 12; i++) {
    const dE = (E - e * Math.sin(E) - Mrad) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-9) break;
  }
  return E;
}

// ─── Orbital elements (Paul Schlyter, epoch 2000 Jan 0.0 = JD 2451543.5) ───

interface ElBase { N0: number; Nd: number; i0: number; id: number; w0: number; wd: number; a0: number; ad: number; e0: number; ed: number; M0: number; Md: number; }
interface Elements { N: number; i: number; w: number; a: number; e: number; M: number; }

const EPOCH_JD = 2451543.5;

const ELEMENTS: Record<string, ElBase> = {
  Sun:     { N0: 0,        Nd: 0,           i0: 0,      id: 0,             w0: 282.9404,  wd: 4.70935e-5,  a0: 1,        ad: 0,           e0: 0.016709,  ed: -1.151e-9,  M0: 356.0470,  Md: 0.9856002585 },
  Moon:    { N0: 125.1228, Nd: -0.0529538083, i0: 5.1454, id: 0,           w0: 318.0634,  wd: 0.1643573223, a0: 60.2666,  ad: 0,           e0: 0.054900,  ed: 0,          M0: 115.3654,  Md: 13.0649929509 },
  Mercury: { N0: 48.3313,  Nd: 3.24587e-5,  i0: 7.0047, id: 5.00e-8,       w0: 29.1241,   wd: 1.01444e-5,  a0: 0.387098, ad: 0,           e0: 0.205635,  ed: 5.59e-10,   M0: 168.6562,  Md: 4.0923344368 },
  Venus:   { N0: 76.6799,  Nd: 2.46590e-5,  i0: 3.3946, id: 2.75e-8,       w0: 54.8910,   wd: 1.38374e-5,  a0: 0.723330, ad: 0,           e0: 0.006773,  ed: -1.302e-9,  M0: 48.0052,   Md: 1.6021302244 },
  Mars:    { N0: 49.5574,  Nd: 2.11081e-5,  i0: 1.8497, id: -1.78e-8,      w0: 286.5016,  wd: 2.92961e-5,  a0: 1.523688, ad: 0,           e0: 0.093405,  ed: 2.516e-9,   M0: 18.6021,   Md: 0.5240207766 },
  Jupiter: { N0: 100.4542, Nd: 2.76854e-5,  i0: 1.3030, id: -1.557e-7,     w0: 273.8777,  wd: 1.64505e-5,  a0: 5.20256,  ad: 0,           e0: 0.048498,  ed: 4.469e-9,   M0: 19.8950,   Md: 0.0830853001 },
  Saturn:  { N0: 113.6634, Nd: 2.38980e-5,  i0: 2.4886, id: -1.081e-7,     w0: 339.3939,  wd: 2.97661e-5,  a0: 9.55475,  ad: 0,           e0: 0.055546,  ed: -9.499e-9,  M0: 316.9670,  Md: 0.0334442282 },
  Uranus:  { N0: 74.0005,  Nd: 1.3978e-5,   i0: 0.7733, id: 1.9e-8,        w0: 96.6612,   wd: 3.0565e-5,   a0: 19.18171, ad: -1.55e-8,    e0: 0.047318,  ed: 7.45e-9,    M0: 142.5905,  Md: 0.011725806 },
  Neptune: { N0: 131.7806, Nd: 3.0173e-5,   i0: 1.7700, id: -2.55e-7,      w0: 272.8461,  wd: -6.027e-6,   a0: 30.05826, ad: 3.313e-8,    e0: 0.008606,  ed: 2.15e-9,    M0: 260.2471,  Md: 0.005995147 },
  Pluto:   { N0: 110.30347, Nd: 0,          i0: 17.14175, id: 0,          w0: 113.76329, wd: 0,           a0: 39.48168677, ad: 0,        e0: 0.24880766, ed: 0,          M0: 14.53440,  Md: 0.003968789 },
};

function elementsAt(base: ElBase, d: number): Elements {
  return {
    N: base.N0 + base.Nd * d,
    i: base.i0 + base.id * d,
    w: base.w0 + base.wd * d,
    a: base.a0 + base.ad * d,
    e: base.e0 + base.ed * d,
    M: norm360(base.M0 + base.Md * d),
  };
}

function obliquity(d: number): number {
  return 23.4393 - 3.563e-7 * d;
}

/** Sun's geocentric position: true ecliptic longitude + rectangular coords (r, xs, ys). */
function sunPosition(d: number) {
  const el = elementsAt(ELEMENTS.Sun, d);
  const Mrad = rad(el.M);
  const E = solveKeplerRad(Mrad, el.e);
  const xv = el.a * (Math.cos(E) - el.e);
  const yv = el.a * (Math.sqrt(1 - el.e * el.e) * Math.sin(E));
  const r = Math.sqrt(xv * xv + yv * yv);
  const v = deg(Math.atan2(yv, xv));
  const lon = norm360(v + el.w);
  return { lon, r, xs: r * Math.cos(rad(lon)), ys: r * Math.sin(rad(lon)) };
}

/** Heliocentric (or, for the Moon, geocentric) rectangular ecliptic coords for one body. */
function orbitPosition(base: ElBase, d: number) {
  const el = elementsAt(base, d);
  const Mrad = rad(el.M);
  const E = solveKeplerRad(Mrad, el.e);
  const xv = el.a * (Math.cos(E) - el.e);
  const yv = el.a * (Math.sqrt(1 - el.e * el.e) * Math.sin(E));
  const v = Math.atan2(yv, xv);
  const r = Math.sqrt(xv * xv + yv * yv);
  const Nrad = rad(el.N), irad = rad(el.i), wrad = rad(el.w);
  const vw = v + wrad;
  const xh = r * (Math.cos(Nrad) * Math.cos(vw) - Math.sin(Nrad) * Math.sin(vw) * Math.cos(irad));
  const yh = r * (Math.sin(Nrad) * Math.cos(vw) + Math.cos(Nrad) * Math.sin(vw) * Math.cos(irad));
  const zh = r * (Math.sin(vw) * Math.sin(irad));
  return { xh, yh, zh, r, N: el.N };
}

/** Moon's main longitude perturbation terms (Schlyter), bringing accuracy to ~1'. */
function moonPerturbation(d: number, moonLon: number, moonN: number): number {
  const sun = elementsAt(ELEMENTS.Sun, d);
  const moon = elementsAt(ELEMENTS.Moon, d);
  const Ms = rad(sun.M);
  const Mm = rad(moon.M);
  const Ls = norm360(sun.w + sun.M);
  const Lm = norm360(moon.N + moon.w + moon.M);
  const D = rad(Lm - Ls);
  const F = rad(Lm - moonN);

  let corr = 0;
  corr += -1.274 * Math.sin(Mm - 2 * D);
  corr += 0.658 * Math.sin(2 * D);
  corr += -0.186 * Math.sin(Ms);
  corr += -0.059 * Math.sin(2 * Mm - 2 * D);
  corr += -0.057 * Math.sin(Mm - 2 * D + Ms);
  corr += 0.053 * Math.sin(Mm + 2 * D);
  corr += 0.046 * Math.sin(2 * D - Ms);
  corr += 0.041 * Math.sin(Mm - Ms);
  corr += -0.035 * Math.sin(D);
  corr += -0.031 * Math.sin(Mm + Ms);
  corr += -0.015 * Math.sin(2 * F - 2 * D);
  corr += 0.011 * Math.sin(Mm - 4 * D);
  return norm360(moonLon + corr);
}

function moonLongitude(d: number): number {
  const pos = orbitPosition(ELEMENTS.Moon, d);
  const lon = norm360(deg(Math.atan2(pos.yh, pos.xh)));
  return moonPerturbation(d, lon, pos.N);
}

function planetLongitude(name: string, d: number): number {
  if (name === "Sun") return sunPosition(d).lon;
  if (name === "Moon") return moonLongitude(d);
  const sun = sunPosition(d);
  const pos = orbitPosition(ELEMENTS[name], d);
  const xg = pos.xh + sun.xs;
  const yg = pos.yh + sun.ys;
  return norm360(deg(Math.atan2(yg, xg)));
}

// ─── Sign / degree formatting ───────────────────────────────────────────────

function toPoint(name: string, longitude: number, retrograde: boolean, ascSignIndex: number | null): ChartPoint {
  const lon = norm360(longitude);
  const signIndex = Math.floor(lon / 30);
  const inSign = lon - signIndex * 30;
  const degreeInSign = Math.floor(inSign);
  const minuteInSign = Math.round((inSign - degreeInSign) * 60);
  const house = ascSignIndex === null ? 0 : ((signIndex - ascSignIndex + 12) % 12) + 1;
  return {
    name, longitude: lon, signIndex, sign: ZODIAC_SIGNS[signIndex], symbol: ZODIAC_SYMBOLS[signIndex],
    degreeInSign, minuteInSign, retrograde, house,
  };
}

// ─── Ascendant / Midheaven ──────────────────────────────────────────────────

function computeAngles(d: number, utHour: number, latDeg: number, lonDeg: number, eclDeg: number) {
  const sun = sunPosition(d);
  const gmst0 = norm360(sun.lon + 180) / 15; // hours
  const gmst = gmst0 + utHour;
  const lst = gmst + lonDeg / 15; // hours
  const ramcDeg = norm360(lst * 15);

  const ramc = rad(ramcDeg);
  const ecl = rad(eclDeg);
  const lat = rad(latDeg);

  const mc = norm360(deg(Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(ecl))));

  const ascY = -Math.cos(ramc);
  const ascX = Math.sin(ecl) * Math.tan(lat) + Math.cos(ecl) * Math.sin(ramc);
  const asc = norm360(deg(Math.atan2(ascY, ascX)) + 180);

  return { asc, mc };
}

// ─── Main entry point ───────────────────────────────────────────────────────

const PLANET_ORDER = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];

export function computeBirthChart(input: BirthChartInput): BirthChartResult {
  const utHour = input.hour + input.minute / 60 - input.utcOffsetHours;
  const jd = julianDay(input.year, input.month, input.day, utHour);
  const d = jd - EPOCH_JD;
  const ecl = obliquity(d);

  let ascSignIndex: number | null = null;
  let ascendant: ChartPoint | null = null;
  let midheaven: ChartPoint | null = null;
  let houseCusps: number[] | null = null;

  if (!input.timeUnknown) {
    const { asc, mc } = computeAngles(d, utHour, input.latitude, input.longitude, ecl);
    ascendant = toPoint("Ascendant", asc, false, null);
    midheaven = toPoint("Midheaven", mc, false, null);
    ascSignIndex = ascendant.signIndex;
    houseCusps = Array.from({ length: 12 }, (_, i) => norm360(ascSignIndex! * 30 + i * 30));
  }

  const points: ChartPoint[] = PLANET_ORDER.map(name => {
    const lon = planetLongitude(name, d);
    const lonFwd = planetLongitude(name, d + 1);
    let delta = lonFwd - lon;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    const retrograde = name !== "Sun" && name !== "Moon" && delta < 0;
    return toPoint(name, lon, retrograde, ascSignIndex);
  });

  const moonNode = elementsAt(ELEMENTS.Moon, d).N;
  const northNode = norm360(moonNode);
  points.push(toPoint("North Node", northNode, false, ascSignIndex));
  points.push(toPoint("South Node", norm360(northNode + 180), false, ascSignIndex));

  const sunPoint = points.find(p => p.name === "Sun")!;
  const moonPoint = points.find(p => p.name === "Moon")!;

  return {
    input,
    julianDay: jd,
    points,
    ascendant,
    midheaven,
    houseCusps,
    sunSign: sunPoint.sign,
    moonSign: moonPoint.sign,
    risingSign: ascendant ? ascendant.sign : null,
  };
}

export function formatDegree(p: ChartPoint): string {
  return `${p.degreeInSign}°${String(p.minuteInSign).padStart(2, "0")}' ${p.sign}`;
}

export function signBlurb(sign: string): string {
  return SIGN_KEYWORDS[sign] ?? "";
}

export function planetSymbol(name: string): string {
  return PLANET_SYMBOLS[name] ?? name;
}

export interface Aspect {
  a: string;
  b: string;
  type: "Conjunction" | "Sextile" | "Square" | "Trine" | "Opposition";
  angle: number;
  orb: number;
}

const ASPECT_DEFS: { type: Aspect["type"]; angle: number; orb: number }[] = [
  { type: "Conjunction", angle: 0, orb: 7 },
  { type: "Sextile", angle: 60, orb: 4 },
  { type: "Square", angle: 90, orb: 6 },
  { type: "Trine", angle: 120, orb: 6 },
  { type: "Opposition", angle: 180, orb: 7 },
];

/** Major aspects between the classical points (Sun–Pluto), excluding nodes/angles. */
export function computeAspects(points: ChartPoint[]): Aspect[] {
  const bodies = points.filter(p => p.name !== "North Node" && p.name !== "South Node");
  const aspects: Aspect[] = [];
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      let diff = Math.abs(bodies[i].longitude - bodies[j].longitude);
      if (diff > 180) diff = 360 - diff;
      for (const def of ASPECT_DEFS) {
        const orb = Math.abs(diff - def.angle);
        if (orb <= def.orb) {
          aspects.push({ a: bodies[i].name, b: bodies[j].name, type: def.type, angle: def.angle, orb });
          break;
        }
      }
    }
  }
  return aspects;
}
