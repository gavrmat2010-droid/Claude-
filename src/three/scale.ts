import * as THREE from 'three';
import { AU_PER_SOLAR_RADIUS, type SunState } from '../lib/sun';

export const ORBIT_INNER = 14;
export const ORBIT_OUTER = 150;
export const AU_MIN = 0.3;
export const AU_MAX = 39.48;
export const EARTH_REV_SECONDS = 14;
export const SUN_BASE_RADIUS = 6;
export const TAU = Math.PI * 2;

/** Logarithmic orbit scale keeps every planet on screen at once */
export function orbitUnits(au: number): number {
  return ORBIT_INNER + ((ORBIT_OUTER - ORBIT_INNER) * Math.log(au / AU_MIN)) / Math.log(AU_MAX / AU_MIN);
}

/** displayRadius (2D px) → scene units */
export function bodyUnits(displayRadius: number): number {
  return displayRadius * 0.22;
}

/** Sun size follows the orbit scale once it swells, so engulfment is literal */
export function sunUnits(sun: SunState): number {
  const base = sun.radius >= 1 ? SUN_BASE_RADIUS * Math.pow(sun.radius, 0.3) : SUN_BASE_RADIUS * Math.pow(sun.radius, 0.5);
  const byOrbit = orbitUnits(Math.max(AU_MIN * 0.5, sun.radius * AU_PER_SOLAR_RADIUS));
  return Math.max(0.6, base, byOrbit);
}

/** World-space positions and radii shared with the camera rig — mutated by the render loop */
export const registry = {
  positions: {} as Record<string, THREE.Vector3>,
  radii: {} as Record<string, number>,
  /** the Sun's mesh, used to occlude labels of bodies passing behind it */
  sunRef: { current: null } as { current: THREE.Object3D | null },
};

export function setBody(id: string, pos: THREE.Vector3, radius: number) {
  const p = registry.positions[id] ?? (registry.positions[id] = new THREE.Vector3());
  p.copy(pos);
  registry.radii[id] = radius;
}
