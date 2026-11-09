import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { frame } from './frame';
import { EARTH_REV_SECONDS, orbitUnits, TAU } from './scale';
import { STAR_FRAG, STAR_VERT } from './shaders/stars';
import { useShaderMaterial } from './useShaderMaterial';

const ASTEROIDS = 5000;
const KUIPER = 5000;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gauss = (rnd: () => number) => (rnd() + rnd() + rnd() - 1.5) / 1.5;

function makeBelt(count: number, seed: number, au0: number, au1: number, spread: number, tint: THREE.Color, brightness: number, sizeBase: number) {
  const rnd = mulberry32(seed);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const r0 = orbitUnits(au0);
  const r1 = orbitUnits(au1);
  for (let i = 0; i < count; i++) {
    const r = r0 + (r1 - r0) * THREE.MathUtils.clamp(0.5 + gauss(rnd) * 0.5, 0, 1);
    const a = rnd() * TAU;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = gauss(rnd) * spread;
    pos[i * 3 + 2] = Math.sin(a) * r;
    const b = brightness * (0.5 + rnd() * 0.8);
    col[i * 3] = tint.r * b;
    col[i * 3 + 1] = tint.g * b;
    col[i * 3 + 2] = tint.b * b;
    size[i] = sizeBase * (0.6 + Math.pow(rnd(), 2) * 1.6);
    phase[i] = rnd();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  return g;
}

/** Main asteroid belt and a faint Kuiper belt beyond Neptune, both as soft point sprites */
export default function Belts() {
  const groupRef = useRef<THREE.Group>(null);
  const beltRef = useRef<THREE.Points>(null);
  const kuiperRef = useRef<THREE.Points>(null);
  const angleRef = useRef(0);
  const dpr = useThree((s) => s.viewport.dpr);

  const belt = useMemo(() => makeBelt(ASTEROIDS, 777, 2.1, 3.35, 1.4, new THREE.Color('#c9b8a4'), 0.7, 1.4), []);
  const kuiper = useMemo(() => makeBelt(KUIPER, 999, 33, 50, 4, new THREE.Color('#9fb8e0'), 0.45, 1.3), []);
  const beltUniforms = useMemo(() => ({ uTime: { value: 0 }, uPixelRatio: { value: 1 } }), []);
  const kuiperUniforms = useMemo(() => ({ uTime: { value: 0 }, uPixelRatio: { value: 1 } }), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(0.1, rawDt);
    const g = groupRef.current;
    if (!g) return;
    const mass = frame.sun.mass;
    const period = 4.6 / (mass * mass);
    angleRef.current = (angleRef.current - (dt * TAU * frame.speed) / (EARTH_REV_SECONDS * period)) % TAU;
    g.rotation.y = angleRef.current;
    // orbits swell as the Sun sheds mass
    const k = orbitUnits(2.7 / mass) / orbitUnits(2.7);
    g.scale.set(k, 1, k);
    // the belts only exist once the disk has settled
    const forming = frame.sun.phase === 'protostar';
    if (beltRef.current) beltRef.current.visible = !forming;
    if (kuiperRef.current) {
      kuiperRef.current.visible = !forming;
      kuiperRef.current.rotation.y = -angleRef.current * 0.9;
    }
    beltUniforms.uTime.value = frame.time;
    beltUniforms.uPixelRatio.value = dpr;
    kuiperUniforms.uTime.value = frame.time;
    kuiperUniforms.uPixelRatio.value = dpr;
  });

  const beltMat = useShaderMaterial({ vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, uniforms: beltUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const kuiperMat = useShaderMaterial({ vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, uniforms: kuiperUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });

  return (
    <group ref={groupRef}>
      <points ref={beltRef} geometry={belt} frustumCulled={false} material={beltMat} />
      <points ref={kuiperRef} geometry={kuiper} frustumCulled={false} material={kuiperMat} />
    </group>
  );
}
