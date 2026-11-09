import * as THREE from 'three';
import type { Body, Look } from '../data/bodies';
import { hexToRgb, mix, shade } from '../lib/color';

export interface Profile {
  type: 'rocky' | 'gas';
  /** noise frequency on the unit sphere */
  freq: number;
  seed: number;
  /** 0..1 fraction of surface under water (rocky only) */
  ocean: number;
  oceanLevel: number;
  ice: number;
  clouds: number;
  cloudColor: string;
  /** atmosphere glow colour; empty = airless */
  atmo: string;
  atmoStrength: number;
  nightLights: number;
  /** axial tilt, degrees */
  tilt: number;
  spin: number;
}

const BASE: Profile = {
  type: 'rocky',
  freq: 2.4,
  seed: 1,
  ocean: 0,
  oceanLevel: 0.5,
  ice: 0,
  clouds: 0,
  cloudColor: '#ffffff',
  atmo: '',
  atmoStrength: 0,
  nightLights: 0,
  tilt: 0,
  spin: 0.12,
};

export const PROFILES: Record<string, Profile> = {
  mercury: { ...BASE, freq: 3.6, seed: 3.1, spin: 0.05 },
  venus: { ...BASE, freq: 2.2, seed: 7.7, clouds: 1, cloudColor: '#f4dfae', atmo: '#ffd9a0', atmoStrength: 0.9, tilt: 177, spin: 0.03 },
  earth: {
    ...BASE,
    freq: 2.0,
    seed: 12.5,
    ocean: 1,
    oceanLevel: 0.6,
    ice: 0.55,
    clouds: 0.85,
    atmo: '#6fb6ff',
    atmoStrength: 1,
    nightLights: 1,
    tilt: 23.4,
    spin: 0.15,
  },
  mars: { ...BASE, freq: 2.8, seed: 21.3, ice: 0.45, atmo: '#f0a070', atmoStrength: 0.25, tilt: 25, spin: 0.14 },
  jupiter: { ...BASE, type: 'gas', freq: 3.0, seed: 33.2, atmo: '#f3d8b0', atmoStrength: 0.45, tilt: 3, spin: 0.3 },
  saturn: { ...BASE, type: 'gas', freq: 2.6, seed: 44.8, atmo: '#f7e6b8', atmoStrength: 0.4, tilt: 26.7, spin: 0.28 },
  uranus: { ...BASE, type: 'gas', freq: 1.6, seed: 56.1, atmo: '#bdf2ff', atmoStrength: 0.6, tilt: 97.8, spin: 0.2 },
  neptune: { ...BASE, type: 'gas', freq: 2.0, seed: 61.9, atmo: '#7fa6ff', atmoStrength: 0.7, tilt: 28.3, spin: 0.22 },
  pluto: { ...BASE, freq: 2.6, seed: 73.4, ice: 0.5, atmo: '#c9d8ff', atmoStrength: 0.12, tilt: 120, spin: 0.08 },
  moon: { ...BASE, freq: 3.8, seed: 90.2, spin: 0.05 },
};

function stops(list: Array<[number, string]>): Uint8Array {
  const w = 256;
  const data = new Uint8Array(w * 4);
  for (let i = 0; i < w; i++) {
    const t = i / (w - 1);
    let a = list[0];
    let b = list[list.length - 1];
    for (let j = 1; j < list.length; j++) {
      if (t <= list[j][0]) {
        a = list[j - 1];
        b = list[j];
        break;
      }
    }
    const k = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);
    const [r, g, bl] = hexToRgb(mix(a[1], b[1], k));
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = bl;
    data[i * 4 + 3] = 255;
  }
  return data;
}

/** 1-D colour ramp sampled by the planet shader (height for rocky worlds, latitude for gas giants) */
export function makePalette(body: Body, look: Look, profile: Profile): THREE.DataTexture {
  let data: Uint8Array;
  if (profile.type === 'gas') {
    const bands = look.bands && look.bands.length >= 2 ? look.bands : [shade(look.color, -0.2), look.color2, look.color, shade(look.color2, -0.1)];
    const n = bands.length;
    const list: Array<[number, string]> = [];
    // each band is a soft plateau with a slightly darker edge
    for (let i = 0; i < n; i++) {
      const c = bands[i];
      const t0 = i / n;
      const t1 = (i + 1) / n;
      list.push([t0, shade(c, -0.18)], [t0 + (t1 - t0) * 0.3, c], [t0 + (t1 - t0) * 0.75, shade(c, 0.05)]);
    }
    list.push([1, shade(bands[0], -0.18)]);
    data = stops(list);
  } else if (profile.ocean > 0 && !look.molten) {
    const land = look.spots ?? shade(look.color, -0.2);
    // sampled only above sea level (≈0.5): coast → lowlands → highlands → snow
    data = stops([
      [0, shade(land, -0.4)],
      [0.5, shade(land, -0.3)],
      [0.55, mix(land, '#c9b98a', 0.35)],
      [0.6, land],
      [0.7, mix(land, '#8a7a45', 0.55)],
      [0.8, mix(land, '#a89068', 0.7)],
      [0.9, '#d9d2c6'],
      [1, '#ffffff'],
    ]);
  } else {
    const low = look.spots ?? shade(look.color, -0.3);
    data = stops([
      [0, shade(low, -0.4)],
      [0.3, low],
      [0.55, look.color],
      [0.8, mix(look.color, look.color2, 0.6)],
      [1, look.color2],
    ]);
  }
  const tex = new THREE.DataTexture(data, 256, 1, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  tex.name = `${body.id}-palette`;
  return tex;
}
