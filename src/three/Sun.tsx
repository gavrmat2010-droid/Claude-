import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import { sunColors } from '../lib/color';
import { SUN_T } from '../lib/sun';
import { T_MIN } from '../lib/time';
import { useSim } from '../store';
import { frame } from './frame';
import { ORBIT_OUTER, registry, setBody } from './scale';
import { useShaderMaterial } from './useShaderMaterial';
import { CORONA_FRAG, CORONA_VERT, DISK_FRAG, DISK_VERT, NEBULA_FRAG, NEBULA_VERT, SUN_FRAG, SUN_VERT } from './shaders/sun';

const ORIGIN = new THREE.Vector3();
const approach = (cur: number, target: number, dt: number, speed: number) => cur + (target - cur) * (1 - Math.exp(-dt * speed));

export default function Sun() {
  const select = useSim((s) => s.select);
  const hover = useSim((s) => s.hover);
  const selected = useSim((s) => s.selectedId === 'sun');
  const hovered = useSim((s) => s.hoveredId === 'sun');

  const sphereRef = useRef<THREE.Mesh>(null);
  const coronaRef = useRef<THREE.Mesh>(null);
  const diskRef = useRef<THREE.Mesh>(null);
  const nebulaRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const selRef = useRef<THREE.Mesh>(null);
  const sizeRef = useRef(frame.sunUnits);

  const sunUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCore: { value: new THREE.Color('#fff8e6') },
      uMid: { value: new THREE.Color('#ffd36b') },
      uDark: { value: new THREE.Color('#ff9a1a') },
      uIntensity: { value: 2.4 },
      uTurbulence: { value: 1 },
    }),
    [],
  );
  const coronaUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#ffb020') },
      uHot: { value: new THREE.Color('#fff2cc') },
      uIntensity: { value: 1.4 },
      uSpread: { value: 1 },
      uLimb: { value: 0.6 },
    }),
    [],
  );
  const diskUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uInner: { value: 7 },
      uOuter: { value: ORBIT_OUTER * 1.05 },
      uStrength: { value: 0 },
    }),
    [],
  );
  const nebulaUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uOpacity: { value: 0 },
    }),
    [],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(0.1, rawDt);
    const { sun, years, time } = frame;
    // the white dwarf reads as a searing blue-white point rather than a warm star
    const c = sun.phase === 'wd' ? { core: '#ffffff', mid: '#dfeaff', glow: '#86b4ff' } : sunColors(sun.temp);

    // size eases so that the red-giant swell reads as motion, not a jump cut
    sizeRef.current = approach(sizeRef.current, frame.sunUnits, dt, 4);
    const R = sizeRef.current;
    if (sphereRef.current) {
      sphereRef.current.scale.setScalar(R);
      sphereRef.current.rotation.y += dt * 0.02;
    }

    sunUniforms.uTime.value = time;
    sunUniforms.uCore.value.set(c.core);
    sunUniforms.uMid.value.set(c.mid);
    sunUniforms.uDark.value.set(c.glow).multiplyScalar(0.75);
    // big cool giants are calmer and dimmer per unit area; the white dwarf is a tiny searing point
    const giant = THREE.MathUtils.smoothstep(sun.radius, 3, 60);
    sunUniforms.uTurbulence.value = 1 - giant * 0.7;
    sunUniforms.uIntensity.value = sun.phase === 'wd' ? 2.0 : sun.phase === 'protostar' ? 1.9 : 2.4 - giant * 0.9;

    if (coronaRef.current) {
      const wd = sun.phase === 'wd';
      const spread = wd ? 1.0 : sun.phase === 'protostar' ? 1.5 : sun.radius > 50 ? 0.9 : 1.15;
      // quad size relative to the photosphere; the white dwarf is a pinpoint with a huge glare
      const k = wd ? 7 : sun.radius > 50 ? 2.2 : 3.4;
      coronaRef.current.scale.setScalar(R * k);
      coronaUniforms.uLimb.value = 2 / k;
      coronaUniforms.uTime.value = time;
      coronaUniforms.uColor.value.set(c.glow);
      coronaUniforms.uHot.value.set(c.core);
      coronaUniforms.uSpread.value = spread;
      coronaUniforms.uIntensity.value = wd ? 1.6 : sun.phase === 'nebula' ? 2.4 : 1.7 + 0.5 * Math.min(1, Math.log10(Math.max(1, sun.luminosity)) / 3.5);
    }

    if (lightRef.current) {
      lightRef.current.color.copy(frame.lightColor);
      lightRef.current.intensity = 2.6 * frame.lightIntensity;
    }

    if (diskRef.current) {
      const s = sun.phase === 'protostar' ? 1 - THREE.MathUtils.clamp((years - T_MIN) / (SUN_T.zams - T_MIN), 0, 1) * 0.7 : 0;
      diskUniforms.uStrength.value = approach(diskUniforms.uStrength.value, s, dt, 3);
      diskUniforms.uTime.value = time;
      diskRef.current.visible = diskUniforms.uStrength.value > 0.01;
      diskRef.current.rotation.z -= dt * 0.01;
    }

    if (nebulaRef.current) {
      const span = 1.6e8;
      const active = years >= SUN_T.nebula && years < SUN_T.nebula + span;
      const p = active ? (years - SUN_T.nebula) / span : 1;
      nebulaUniforms.uProgress.value = p;
      nebulaUniforms.uTime.value = time;
      const target = active ? Math.pow(1 - p, 1.4) * 0.9 : 0;
      nebulaUniforms.uOpacity.value = approach(nebulaUniforms.uOpacity.value, target, dt, 3);
      nebulaRef.current.visible = nebulaUniforms.uOpacity.value > 0.01;
      nebulaRef.current.scale.setScalar(12 + p * 260);
      nebulaRef.current.rotation.y += dt * 0.01;
    }

    if (selRef.current) {
      selRef.current.scale.setScalar(Math.max(R * 1.35, 3));
      const mat = selRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = approach(mat.opacity, hovered && !selected ? 0.3 : 0, dt, 8);
      selRef.current.visible = mat.opacity > 0.01;
    }

    setBody('sun', ORIGIN, R);
    registry.sunRef.current = sphereRef.current;
  });

  const sunMat = useShaderMaterial({ vertexShader: SUN_VERT, fragmentShader: SUN_FRAG, uniforms: sunUniforms });
  const coronaMat = useShaderMaterial({
    vertexShader: CORONA_VERT,
    fragmentShader: CORONA_FRAG,
    uniforms: coronaUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const diskMat = useShaderMaterial({ vertexShader: DISK_VERT, fragmentShader: DISK_FRAG, uniforms: diskUniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const nebulaMat = useShaderMaterial({
    vertexShader: NEBULA_VERT,
    fragmentShader: NEBULA_FRAG,
    uniforms: nebulaUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  return (
    <group>
      <pointLight ref={lightRef} position={[0, 0, 0]} intensity={2.6} decay={0} distance={0} />
      <mesh
        ref={sphereRef}
        material={sunMat}
        onClick={(e) => {
          e.stopPropagation();
          select('sun');
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          hover('sun');
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          hover(null);
          document.body.style.cursor = 'default';
        }}
      >
        <sphereGeometry args={[1, 96, 64]} />
      </mesh>
      <Billboard>
        <mesh ref={coronaRef} renderOrder={5} material={coronaMat}>
          <planeGeometry args={[1, 1]} />
        </mesh>
      </Billboard>
      <mesh ref={diskRef} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={-1} material={diskMat}>
        <planeGeometry args={[ORBIT_OUTER * 2.2, ORBIT_OUTER * 2.2]} />
      </mesh>
      <mesh ref={nebulaRef} visible={false} material={nebulaMat}>
        <sphereGeometry args={[1, 64, 48]} />
      </mesh>
      <Billboard>
        <mesh ref={selRef} visible={false}>
          <ringGeometry args={[0.975, 1, 96]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </Billboard>
    </group>
  );
}
