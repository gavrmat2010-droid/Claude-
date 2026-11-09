import { T_MIN } from './time';

export type SunPhase = 'protostar' | 'main' | 'subgiant' | 'rgb' | 'helium' | 'agb' | 'nebula' | 'wd';

export interface SunState {
  phase: SunPhase;
  phaseName: string;
  /** Solar radii */
  radius: number;
  /** Solar luminosities */
  luminosity: number;
  /** Surface temperature, K */
  temp: number;
  /** Solar masses — mass loss pushes the planets outward */
  mass: number;
}

export const SUN_T = {
  zams: -4.5e9,
  msEnd: 5.4e9,
  rgb: 7.0e9,
  tip: 7.59e9,
  helium: 7.6e9,
  agb: 7.7e9,
  nebula: 7.9e9,
  wd: 7.95e9,
} as const;

export const AU_PER_SOLAR_RADIUS = 0.00465;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const surfaceTemp = (L: number, R: number) => 5772 * Math.pow(L / (R * R), 0.25);

export function sunAt(t: number): SunState {
  if (t < SUN_T.zams) {
    const s = clamp01((t - T_MIN) / (SUN_T.zams - T_MIN));
    const radius = lerp(2.6, 0.9, s);
    const luminosity = lerp(1.3, 0.7, s);
    return { phase: 'protostar', phaseName: 'Протозвезда', radius, luminosity, temp: surfaceTemp(luminosity, radius), mass: 1 };
  }
  if (t < SUN_T.msEnd) {
    // Gough (1981): the Sun brightens ~10% per billion years on the main sequence
    const age = t + 4.57e9;
    const luminosity = 1 / (1 + 0.4 * (1 - age / 4.57e9));
    const radius = t <= 0 ? lerp(0.9, 1, age / 4.57e9) : 1 + 0.5 * Math.pow(t / SUN_T.msEnd, 1.5);
    return { phase: 'main', phaseName: 'Главная последовательность', radius, luminosity, temp: surfaceTemp(luminosity, radius), mass: 1 };
  }
  if (t < SUN_T.rgb) {
    const s = (t - SUN_T.msEnd) / (SUN_T.rgb - SUN_T.msEnd);
    const radius = lerp(1.5, 2.3, s);
    const luminosity = lerp(1.9, 3, s);
    return { phase: 'subgiant', phaseName: 'Субгигант', radius, luminosity, temp: surfaceTemp(luminosity, radius), mass: 1 };
  }
  if (t < SUN_T.helium) {
    const s = clamp01((t - SUN_T.rgb) / (SUN_T.tip - SUN_T.rgb));
    const k = s * s; // growth accelerates toward the tip
    const radius = 2.3 * Math.pow(256 / 2.3, k);
    const luminosity = 3 * Math.pow(2700 / 3, k);
    const mass = lerp(1, 0.9, s * s * s);
    return {
      phase: 'rgb',
      phaseName: s >= 1 ? 'Вершина ветви гигантов' : 'Красный гигант',
      radius,
      luminosity,
      temp: surfaceTemp(luminosity, radius),
      mass,
    };
  }
  if (t < SUN_T.agb) {
    return { phase: 'helium', phaseName: 'Горение гелия в ядре', radius: 10, luminosity: 50, temp: surfaceTemp(50, 10), mass: 0.9 };
  }
  if (t < SUN_T.nebula) {
    const s = (t - SUN_T.agb) / (SUN_T.nebula - SUN_T.agb);
    const radius = 10 * Math.pow(22, s);
    const luminosity = 50 * Math.pow(80, s);
    const mass = lerp(0.9, 0.54, s);
    return { phase: 'agb', phaseName: 'Асимптотическая ветвь гигантов', radius, luminosity, temp: surfaceTemp(luminosity, radius), mass };
  }
  if (t < SUN_T.wd) {
    const s = (t - SUN_T.nebula) / (SUN_T.wd - SUN_T.nebula);
    const radius = lerp(1, 0.013, Math.pow(s, 0.3));
    const luminosity = lerp(3000, 10, s);
    return { phase: 'nebula', phaseName: 'Планетарная туманность', radius, luminosity, temp: surfaceTemp(luminosity, radius), mass: 0.54 };
  }
  const dt = t - SUN_T.wd;
  const luminosity = 0.01 * Math.pow(1 + dt / 5e7, -1.2);
  const radius = 0.013;
  return { phase: 'wd', phaseName: 'Белый карлик', radius, luminosity, temp: surfaceTemp(luminosity, radius), mass: 0.54 };
}

export function sunRadiusAU(sun: SunState): number {
  return sun.radius * AU_PER_SOLAR_RADIUS;
}
