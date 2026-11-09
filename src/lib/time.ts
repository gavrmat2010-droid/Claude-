export const T_MIN = -4.6e9;
export const T_MAX = 10e9;

/**
 * Slider position (−1…1) ↔ years relative to today.
 * Piecewise-linear so that eventful eras (red giant phase, Earth's last billion years)
 * get enough room on the slider while billions of quiet years are compressed.
 */
const STOPS: Array<[number, number]> = [
  [-1, -4.6e9],
  [-0.9, -4.45e9],
  [-0.8, -4.0e9],
  [-0.6, -2.5e9],
  [-0.4, -0.6e9],
  [-0.25, -1e8],
  [-0.1, -1e7],
  [0, 0],
  [0.1, 1e7],
  [0.25, 1e8],
  [0.4, 5e8],
  [0.55, 1.5e9],
  [0.7, 5e9],
  [0.8, 7e9],
  [0.9, 7.7e9],
  [0.95, 8e9],
  [1, 1e10],
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function sliderToYears(v: number): number {
  v = clamp(v, -1, 1);
  for (let i = 1; i < STOPS.length; i++) {
    const [v0, y0] = STOPS[i - 1];
    const [v1, y1] = STOPS[i];
    if (v <= v1) return y0 + ((v - v0) / (v1 - v0)) * (y1 - y0);
  }
  return T_MAX;
}

export function yearsToSlider(y: number): number {
  y = clamp(y, T_MIN, T_MAX);
  for (let i = 1; i < STOPS.length; i++) {
    const [v0, y0] = STOPS[i - 1];
    const [v1, y1] = STOPS[i];
    if (y <= y1) return v0 + ((y - y0) / (y1 - y0)) * (v1 - v0);
  }
  return 1;
}

const nf = (digits: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

function magnitude(abs: number): string {
  if (abs >= 1e9) return `${nf(abs < 1e10 ? 2 : 1).format(abs / 1e9)} млрд`;
  if (abs >= 1e6) return `${nf(abs < 1e7 ? 1 : 0).format(abs / 1e6)} млн`;
  if (abs >= 1e3) return `${nf(0).format(abs / 1e3)} тыс.`;
  return nf(0).format(abs);
}

/** "Сейчас" · "Через 1,2 млрд лет" · "4,6 млрд лет назад" */
export function formatYears(y: number): string {
  if (Math.abs(y) < 5e3) return 'Сейчас';
  const m = magnitude(Math.abs(y));
  return y > 0 ? `Через ${m} лет` : `${m} лет назад`;
}

/** Compact tick label: "−4,6 млрд" · "сейчас" · "+100 млн" */
export function formatYearsShort(y: number): string {
  if (Math.abs(y) < 5e3) return 'сейчас';
  const m = magnitude(Math.abs(y));
  return y > 0 ? `+${m}` : `−${m}`;
}

export function formatNumber(n: number, digits = 1): string {
  return nf(digits).format(n);
}
