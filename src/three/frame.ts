import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { sunAt, sunRadiusAU, type SunState } from '../lib/sun';
import { sunColors } from '../lib/color';
import { sim, useSim } from '../store';
import { sunUnits } from './scale';

/** Per-frame simulation snapshot shared by every object in the scene (filled by <Ticker/> before anything else runs) */
export const frame = {
  years: 0,
  sun: sunAt(0) as SunState,
  sunRadiusAU: sunRadiusAU(sunAt(0)),
  sunUnits: sunUnits(sunAt(0)),
  lightColor: new THREE.Color('#fff4e0'),
  lightIntensity: 1,
  /** orbital speed multiplier (1 = idle, up to 1 + MAX_WARP while scrubbing) */
  speed: 1,
  time: 0,
};

const tmp = new THREE.Color();

export function Ticker() {
  useFrame((_, dt) => {
    const d = Math.min(0.1, dt);
    sim.warp = sim.warp < 0.01 ? 0 : sim.warp * Math.exp(-d * 2.2);
    frame.speed = 1 + sim.warp;
    frame.time += d;
    const years = useSim.getState().years;
    frame.years = years;
    const sun = sunAt(years);
    frame.sun = sun;
    frame.sunRadiusAU = sunRadiusAU(sun);
    frame.sunUnits = sunUnits(sun);
    const c = sunColors(sun.temp);
    tmp.set(c.mid);
    // normalise so that the Sun's hue tints the planets without changing brightness
    const m = Math.max(tmp.r, tmp.g, tmp.b) || 1;
    frame.lightColor.setRGB(tmp.r / m, tmp.g / m, tmp.b / m);
    frame.lightIntensity = THREE.MathUtils.clamp(Math.pow(sun.luminosity, 0.25), 0.28, 2.1);
  }, -100);
  return null;
}
