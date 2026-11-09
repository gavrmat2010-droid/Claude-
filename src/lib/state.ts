import type { Body, Era, Look } from '../data/bodies';
import { sunRadiusAU, type SunState } from './sun';

export interface BodyState {
  body: Body;
  era: Era;
  look: Look;
  gone: boolean;
  /** current semi-major axis, AU (grows as the Sun sheds mass) */
  orbitAU: number;
  /** current orbital period, years */
  periodYears: number;
  /** equilibrium-scaled estimate, °C */
  tempC: number | null;
}

export function eraAt(body: Body, t: number): Era {
  let era = body.eras[0];
  for (const e of body.eras) {
    if (e.from <= t) era = e;
    else break;
  }
  return era;
}

export function bodyStateAt(body: Body, t: number, sun: SunState): BodyState {
  const era = eraAt(body, t);
  const look: Look = { ...body.look, ...(era.look ?? {}) };
  const isSun = body.id === 'sun';
  const orbitAU = isSun ? 0 : body.orbitAU / sun.mass;
  // Kepler: P ∝ a^1.5 / sqrt(M), with a ∝ 1/M → P ∝ M^-2
  const periodYears = isSun ? 0 : body.periodYears / (sun.mass * sun.mass);
  const gone = !isSun && (!!era.gone || sunRadiusAU(sun) >= orbitAU);
  let tempC: number | null;
  if (isSun) tempC = sun.temp - 273.15;
  else if (gone) tempC = null;
  else tempC = body.tempK * Math.pow(sun.luminosity, 0.25) * Math.sqrt(body.orbitAU / orbitAU) - 273.15;
  return { body, era, look, gone, orbitAU, periodYears, tempC };
}
