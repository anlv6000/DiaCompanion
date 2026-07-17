export type LesionType = "MA" | "HE" | "EX" | "SE";

export interface Lesion {
  id: number;
  type: LesionType;
  cx: number; // image-space x
  cy: number; // image-space y
  r: number; // radius in image-space px
}

export const LESION_META: Record<LesionType, { label: string; varName: string }> = {
  MA: { label: "Vi phình mạch (MA)", varName: "--lesion-ma" },
  HE: { label: "Xuất huyết (HE)", varName: "--lesion-he" },
  EX: { label: "Xuất tiết cứng (EX)", varName: "--lesion-ex" },
  SE: { label: "Xuất tiết mềm (SE)", varName: "--lesion-se" },
};

export const LESION_TYPES: LesionType[] = ["MA", "HE", "EX", "SE"];

export function lesionColor(t: LesionType): string {
  return `var(${LESION_META[t].varName})`;
}

// Deterministic PRNG so a given seed always yields the same lesions.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Generate mock lesions inside the retinal disc. In production these are replaced
// by the model's segmentation output (mask images or polygons per lesion type).
export function mockLesions(seed: number, size: number): Lesion[] {
  const rnd = mulberry32(seed);
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.46; // retina radius
  const out: Lesion[] = [];
  let id = 1;

  const counts: Record<LesionType, [number, number]> = {
    MA: [8, 3],
    HE: [4, 6],
    EX: [5, 5],
    SE: [2, 8],
  };

  (Object.keys(counts) as LesionType[]).forEach((type) => {
    const [n, baseR] = counts[type];
    for (let i = 0; i < n; i++) {
      // random point inside the disc (rejection-free polar sampling)
      const ang = rnd() * Math.PI * 2;
      const rad = Math.sqrt(rnd()) * R * 0.9;
      out.push({
        id: id++,
        type,
        cx: cx + Math.cos(ang) * rad,
        cy: cy + Math.sin(ang) * rad,
        r: baseR + rnd() * baseR,
      });
    }
  });

  return out;
}

// Synthetic fundus image as a data URI so the demo runs with no external assets.
// `eye` mirrors the optic disc to the nasal side (OD = disc on left, OS on right).
export function syntheticFundus(size: number, eye: "OD" | "OS"): string {
  const c = size / 2;
  const discX = eye === "OD" ? c - size * 0.22 : c + size * 0.22;
  const discY = c - size * 0.02;
  const vessel = (dx: number, dy: number, curve: number) =>
    `M ${discX} ${discY} q ${dx * 0.4} ${dy * 0.4 + curve} ${dx} ${dy}`;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="retina" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#7a1f14"/>
      <stop offset="55%" stop-color="#611109"/>
      <stop offset="100%" stop-color="#2c0704"/>
    </radialGradient>
    <radialGradient id="disc" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f6d98a"/>
      <stop offset="70%" stop-color="#e2ad4e"/>
      <stop offset="100%" stop-color="#b9822e"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="#14171c"/>
  <circle cx="${c}" cy="${c}" r="${size * 0.47}" fill="url(#retina)"/>
  <g stroke="#8a1e12" stroke-width="${size * 0.006}" fill="none" opacity="0.8" stroke-linecap="round">
    <path d="${vessel(size * 0.35, -size * 0.3, -size * 0.05)}"/>
    <path d="${vessel(size * 0.38, size * 0.28, size * 0.05)}"/>
    <path d="${vessel(size * 0.42, -size * 0.05, 0)}"/>
    <path d="${vessel(size * 0.3, size * 0.36, size * 0.02)}"/>
  </g>
  <g stroke="#961f12" stroke-width="${size * 0.003}" fill="none" opacity="0.6" stroke-linecap="round">
    <path d="${vessel(size * 0.2, -size * 0.18, -size * 0.03)}"/>
    <path d="${vessel(size * 0.24, size * 0.16, size * 0.03)}"/>
  </g>
  <circle cx="${discX}" cy="${discY}" r="${size * 0.055}" fill="url(#disc)"/>
</svg>`.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
