export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

const toHex = (c: number[]) =>
  `#${c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;

export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return toHex(ca.map((v, i) => v + (cb[i] - v) * t));
}

/** k > 0 lightens toward white, k < 0 darkens toward black */
export function shade(hex: string, k: number): string {
  return k >= 0 ? mix(hex, '#ffffff', k) : mix(hex, '#000000', -k);
}

export interface SunColors {
  core: string;
  mid: string;
  glow: string;
}

// Blackbody-ish palette keyed by surface temperature (K)
const SUN_PALETTE: Array<[number, SunColors]> = [
  [2800, { core: '#ff8a4a', mid: '#ff5a1a', glow: '#ff2a00' }],
  [3500, { core: '#ffa263', mid: '#ff6a24', glow: '#ff4400' }],
  [4500, { core: '#ffd3a0', mid: '#ff9a3c', glow: '#ff7a00' }],
  [5800, { core: '#fff8e6', mid: '#ffd36b', glow: '#ffb020' }],
  [7500, { core: '#ffffff', mid: '#fff3d6', glow: '#ffe2a8' }],
  [10000, { core: '#ffffff', mid: '#e6efff', glow: '#bcd3ff' }],
  [30000, { core: '#f2f7ff', mid: '#cfe0ff', glow: '#7fb0ff' }],
  [120000, { core: '#eef4ff', mid: '#bcd4ff', glow: '#5b93ff' }],
];

export function sunColors(temp: number): SunColors {
  if (temp <= SUN_PALETTE[0][0]) return SUN_PALETTE[0][1];
  for (let i = 1; i < SUN_PALETTE.length; i++) {
    const [t0, c0] = SUN_PALETTE[i - 1];
    const [t1, c1] = SUN_PALETTE[i];
    if (temp <= t1) {
      const k = (Math.log(temp) - Math.log(t0)) / (Math.log(t1) - Math.log(t0));
      return { core: mix(c0.core, c1.core, k), mid: mix(c0.mid, c1.mid, k), glow: mix(c0.glow, c1.glow, k) };
    }
  }
  return SUN_PALETTE[SUN_PALETTE.length - 1][1];
}
