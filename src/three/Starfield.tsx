import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { SKY_FRAG, SKY_VERT, STAR_FRAG, STAR_VERT } from './shaders/stars';
import { useShaderMaterial } from './useShaderMaterial';

const STAR_COUNT = 9000;
const RADIUS = 1600;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// star colours by spectral class, warm to hot
const PALETTE = ['#ffb46b', '#ffd2a1', '#fff4e8', '#ffffff', '#dfe9ff', '#b9ccff'];

export default function Starfield() {
  const pointsRef = useRef<THREE.Points>(null);
  const dpr = useThree((s) => s.viewport.dpr);

  const { geometry, uniforms } = useMemo(() => {
    const rnd = mulberry32(4242);
    const pos = new Float32Array(STAR_COUNT * 3);
    const col = new Float32Array(STAR_COUNT * 3);
    const size = new Float32Array(STAR_COUNT);
    const phase = new Float32Array(STAR_COUNT);
    const tmp = new THREE.Color();
    for (let i = 0; i < STAR_COUNT; i++) {
      // uniform on sphere, with a denser band along the (tilted) galactic plane
      const u = rnd();
      const vv = rnd();
      const theta = u * Math.PI * 2;
      let phi = Math.acos(2 * vv - 1);
      if (rnd() < 0.35) phi = Math.PI / 2 + (rnd() - 0.5) * 0.5;
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.sin(phi) * Math.sin(theta);
      const z = Math.cos(phi);
      // tilt the dense band to match the Milky Way shader
      const ty = y * 0.5 - z * 0.866;
      const tz = y * 0.866 + z * 0.5;
      pos[i * 3] = x * RADIUS;
      pos[i * 3 + 1] = ty * RADIUS;
      pos[i * 3 + 2] = tz * RADIUS;
      const k = rnd();
      tmp.set(PALETTE[Math.floor(Math.pow(k, 0.8) * PALETTE.length)]);
      const bright = rnd() > 0.96 ? 1.6 + rnd() * 1.6 : 0.35 + rnd() * 0.6;
      col[i * 3] = tmp.r * bright;
      col[i * 3 + 1] = tmp.g * bright;
      col[i * 3 + 2] = tmp.b * bright;
      size[i] = bright > 1.5 ? 2.6 + rnd() * 2.2 : 1.1 + rnd() * 1.6;
      phase[i] = rnd();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    const uniforms = { uTime: { value: 0 }, uPixelRatio: { value: 1 } };
    return { geometry, uniforms };
  }, []);

  const skyUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
    uniforms.uPixelRatio.value = dpr;
    skyUniforms.uTime.value = clock.elapsedTime;
  });

  const skyMat = useShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: skyUniforms, side: THREE.BackSide, depthWrite: false });
  const starMat = useShaderMaterial({
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return (
    <group>
      <mesh renderOrder={-10} frustumCulled={false} material={skyMat}>
        <sphereGeometry args={[RADIUS * 1.2, 48, 32]} />
      </mesh>
      <points ref={pointsRef} geometry={geometry} renderOrder={-9} frustumCulled={false} material={starMat} />
    </group>
  );
}
