import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Billboard, Html } from '@react-three/drei';
import type { Body, Look } from '../data/bodies';
import { bodyStateAt, eraAt } from '../lib/state';
import { sunAt } from '../lib/sun';
import { mix, shade } from '../lib/color';
import { useSim } from '../store';
import { frame } from './frame';
import { makePalette, PROFILES, type Profile } from './palette';
import { bodyUnits, EARTH_REV_SECONDS, orbitUnits, registry, setBody, TAU } from './scale';
import { useShaderMaterial } from './useShaderMaterial';
import { ATMO_HALO_FRAG, ATMO_RIM_FRAG, ATMO_VERT, CLOUD_FRAG, DUST_FRAG, PLANET_FRAG, PLANET_VERT, RING_FRAG, RING_VERT } from './shaders/planet';

const ORIGIN = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const tmpV = new THREE.Vector3();
const tmpC = new THREE.Color();
const tmpQ = new THREE.Quaternion();
const LAVA_GLOW = new THREE.Color('#ff7a2a');
const tmpC2 = new THREE.Color();

const approach = (cur: number, target: number, dt: number, speed: number) => cur + (target - cur) * (1 - Math.exp(-dt * speed));

function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

interface Props {
  body: Body;
}

export default function Planet({ body }: Props) {
  const profile: Profile = PROFILES[body.id] ?? PROFILES.mercury;
  const radius = bodyUnits(body.displayRadius);
  const isGas = profile.type === 'gas';

  const eraFrom = useSim((s) => eraAt(body, s.years).from);
  const era = body.eras.find((e) => e.from === eraFrom) ?? body.eras[0];
  const look: Look = useMemo(() => ({ ...body.look, ...(era.look ?? {}) }), [body, era]);
  const selected = useSim((s) => s.selectedId === body.id);
  const hovered = useSim((s) => s.hoveredId === body.id);
  const gone = useSim((s) => bodyStateAt(body, s.years, sunAt(s.years)).gone);
  const select = useSim((s) => s.select);
  const hover = useSim((s) => s.hover);

  const orbitRef = useRef<THREE.Group>(null);
  const tiltRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const surfaceRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const dustRef = useRef<THREE.Mesh>(null);
  const labelRef = useRef<THREE.Group>(null);
  const selRef = useRef<THREE.Mesh>(null);
  const moonRef = useRef<THREE.Group>(null);

  const angleRef = useRef(hash(body.id) * TAU);
  const moonAngle = useRef(0);
  const vis = useRef({ scale: 1, molten: 0, frozen: 0, forming: 0, highlight: 0, ring: 0, clouds: profile.clouds, atmo: profile.atmoStrength });

  const palette = useMemo(() => makePalette(body, look, profile), [body, look, profile]);

  const uniforms = useMemo(
    () => ({
      uPalA: { value: palette },
      uPalB: { value: palette },
      uMix: { value: 1 },
      uType: { value: isGas ? 1 : 0 },
      uSeed: { value: profile.seed },
      uFreq: { value: profile.freq },
      uTime: { value: 0 },
      uOcean: { value: profile.ocean },
      uOceanDeep: { value: new THREE.Color(shade(body.look.color, -0.62)) },
      uOceanShallow: { value: new THREE.Color(mix(body.look.color, body.look.color2, 0.15)) },
      uOceanLevel: { value: profile.oceanLevel },
      uIce: { value: profile.ice },
      uMolten: { value: 0 },
      uFrozen: { value: 0 },
      uAlpha: { value: 1 },
      uHighlight: { value: 0 },
      uAtmo: { value: new THREE.Color(profile.atmo || '#000000') },
      uAtmoStrength: { value: profile.atmoStrength },
      uStormColor: { value: new THREE.Color(body.look.storm ?? '#ffffff') },
      uStorm: { value: body.look.storm ? 1 : 0 },
      uSunPos: { value: ORIGIN },
      uLightColor: { value: frame.lightColor },
      uLightIntensity: { value: 1 },
      uNightLights: { value: profile.nightLights },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const atmoUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(profile.atmo || '#000000') },
      uStrength: { value: profile.atmoStrength },
      uSunPos: { value: ORIGIN },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const cloudUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSeed: { value: profile.seed * 1.7 },
      uAmount: { value: profile.clouds },
      uColor: { value: new THREE.Color(profile.cloudColor) },
      uSunPos: { value: ORIGIN },
      uLightColor: { value: frame.lightColor },
      uLightIntensity: { value: 1 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const ringUniforms = useMemo(
    () => ({
      uInner: { value: radius * 1.35 },
      uOuter: { value: radius * 2.3 },
      uPlanetRadius: { value: radius },
      uColor: { value: new THREE.Color('#d9cba3') },
      uOpacity: { value: 0 },
      uSeed: { value: profile.seed },
      uSunPos: { value: ORIGIN },
      uPlanetPos: { value: new THREE.Vector3() },
      uNormal: { value: new THREE.Vector3(0, 1, 0) },
      uLightColor: { value: frame.lightColor },
      uLightIntensity: { value: 1 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const dustUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(body.look.color2) },
      uOpacity: { value: 0 },
      uSeed: { value: profile.seed },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // cross-fade to the new palette whenever the era changes the planet's look
  useEffect(() => {
    const prev = uniforms.uPalB.value;
    if (prev === palette) return;
    const old = uniforms.uPalA.value;
    uniforms.uPalA.value = prev;
    uniforms.uPalB.value = palette;
    uniforms.uMix.value = 0;
    if (old !== prev && old !== palette) old.dispose();
  }, [palette, uniforms]);

  useEffect(() => () => palette.dispose(), [palette]);

  const ringLook = look.rings;
  useEffect(() => {
    if (ringLook) {
      ringUniforms.uInner.value = radius * ringLook.inner;
      ringUniforms.uOuter.value = radius * ringLook.outer;
      ringUniforms.uColor.value.set(ringLook.color);
    }
  }, [ringLook, radius, ringUniforms]);

  useEffect(() => {
    uniforms.uOceanDeep.value.set(shade(look.color, -0.62));
    uniforms.uOceanShallow.value.set(mix(look.color, look.color2, 0.15));
    uniforms.uStormColor.value.set(look.storm ?? body.look.storm ?? '#ffffff');
    dustUniforms.uColor.value.set(look.color2);
  }, [look, body, uniforms, dustUniforms]);

  const isMoonHost = body.id === 'earth';
  const moonPalette = useMemo(
    () => (isMoonHost ? makePalette(body, { color: '#9a948c', color2: '#d8d4cc', spots: '#5e5a56' }, PROFILES.moon) : null),
    [body, isMoonHost],
  );
  const moonUniforms = useMemo(
    () =>
      moonPalette
        ? {
            ...Object.fromEntries(Object.entries(uniforms).map(([k, u]) => [k, { value: u.value }])),
            uPalA: { value: moonPalette },
            uPalB: { value: moonPalette },
            uMix: { value: 1 },
            uSeed: { value: PROFILES.moon.seed },
            uFreq: { value: PROFILES.moon.freq },
            uOcean: { value: 0 },
            uIce: { value: 0 },
            uAtmoStrength: { value: 0 },
            uNightLights: { value: 0 },
            uStorm: { value: 0 },
            uMolten: { value: 0 },
            uFrozen: { value: 0 },
            uHighlight: { value: 0 },
            uAlpha: { value: 1 },
            uTime: { value: 0 },
            uLightIntensity: { value: 1 },
          }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [moonPalette],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(0.1, rawDt);
    const orbit = orbitRef.current;
    const tilt = tiltRef.current;
    const bodyG = bodyRef.current;
    if (!orbit || !tilt || !bodyG) return;
    const { sun, years } = frame;

    // orbit
    const mass = sun.mass;
    const orbitAU = body.orbitAU / mass;
    const period = body.periodYears / (mass * mass);
    angleRef.current = (angleRef.current + (dt * TAU * frame.speed) / (EARTH_REV_SECONDS * period)) % TAU;
    const r = orbitUnits(orbitAU);
    orbit.position.set(Math.cos(angleRef.current) * r, 0, -Math.sin(angleRef.current) * r);

    const currentEra = eraAt(body, years);
    const gone = !!currentEra.gone || frame.sunRadiusAU >= orbitAU;
    const lookNow: Look = { ...body.look, ...(currentEra.look ?? {}) };

    // smooth state
    const v = vis.current;
    v.scale = approach(v.scale, gone ? 0 : (lookNow.scale ?? 1) * (lookNow.forming ? 0.8 : 1), dt, gone ? 3 : 2.5);
    v.molten = approach(v.molten, lookNow.molten ? 1 : lookNow.forming ? 0.55 : 0, dt, 1.8);
    v.frozen = approach(v.frozen, lookNow.frozen ? 1 : 0, dt, 1.8);
    v.forming = approach(v.forming, lookNow.forming ? 1 : 0, dt, 2);
    v.highlight = approach(v.highlight, selected ? 0.9 : hovered ? 0.5 : 0, dt, 8);
    v.ring = approach(v.ring, lookNow.rings ? lookNow.rings.opacity : 0, dt, 1.5);
    const cloudTarget = (lookNow.clouds ?? profile.clouds) * (1 - v.molten) * (1 - 0.8 * v.frozen);
    v.clouds = approach(v.clouds, cloudTarget, dt, 1.5);
    v.atmo = approach(v.atmo, profile.atmoStrength * (1 - 0.7 * v.frozen) * (1 - v.forming * 0.6), dt, 1.5);
    const alpha = 1 - v.forming * 0.25;

    const scale = radius * v.scale;
    bodyG.scale.setScalar(Math.max(1e-4, scale));
    orbit.visible = v.scale > 0.004;

    if (surfaceRef.current) surfaceRef.current.rotation.y += dt * profile.spin * (isGas ? 1 : 1);
    if (cloudsRef.current) cloudsRef.current.rotation.y += dt * profile.spin * 1.25;

    uniforms.uTime.value = frame.time;
    uniforms.uMix.value = approach(uniforms.uMix.value, 1, dt, 2.5);
    uniforms.uMolten.value = v.molten;
    uniforms.uFrozen.value = v.frozen;
    uniforms.uAlpha.value = alpha;
    uniforms.uHighlight.value = v.highlight;
    uniforms.uLightIntensity.value = frame.lightIntensity;
    uniforms.uOcean.value = approach(uniforms.uOcean.value, (lookNow.ocean ?? profile.ocean) * (1 - v.molten), dt, 1.5);
    uniforms.uIce.value = approach(uniforms.uIce.value, (lookNow.ice ?? profile.ice) * (1 - v.molten), dt, 1.5);
    uniforms.uStorm.value = approach(uniforms.uStorm.value, lookNow.storm ? 1 : 0, dt, 1.5);
    uniforms.uAtmoStrength.value = v.atmo + v.molten * 0.6;
    tmpC.set(profile.atmo || lookNow.color2).lerp(LAVA_GLOW, v.molten);
    uniforms.uAtmo.value.copy(tmpC);
    atmoUniforms.uColor.value.copy(tmpC);
    atmoUniforms.uStrength.value = (v.atmo + v.molten * 0.9) * alpha;
    cloudUniforms.uTime.value = frame.time;
    cloudUniforms.uAmount.value = v.clouds;
    cloudUniforms.uLightIntensity.value = frame.lightIntensity;
    cloudUniforms.uColor.value.set(profile.cloudColor).lerp(tmpC2.set(lookNow.color2), uniforms.uOcean.value < 0.5 && profile.ocean > 0 ? 0.6 : 0);

    // rings follow the axial tilt; the shader needs their world-space normal
    if (ringRef.current) {
      ringRef.current.visible = v.ring > 0.01;
      ringUniforms.uOpacity.value = v.ring;
      ringUniforms.uPlanetRadius.value = scale;
      ringUniforms.uLightIntensity.value = frame.lightIntensity;
      bodyG.getWorldPosition(ringUniforms.uPlanetPos.value);
      tmpV.copy(UP).applyQuaternion(tilt.getWorldQuaternion(tmpQ));
      ringUniforms.uNormal.value.copy(tmpV);
      const ringScale = Math.max(1e-4, v.scale);
      ringRef.current.scale.setScalar(ringScale);
    }

    if (dustRef.current) {
      dustRef.current.visible = v.forming > 0.01;
      dustUniforms.uOpacity.value = v.forming * 0.75;
      dustUniforms.uTime.value = frame.time;
      dustRef.current.rotation.z += dt * 0.15;
    }

    if (labelRef.current) labelRef.current.position.set(0, scale * (lookNow.rings ? 1.1 : 1) + 0.45 + scale * 0.25, 0);
    if (selRef.current) {
      const s = scale * (lookNow.rings ? 2.45 : 1.55);
      selRef.current.scale.setScalar(Math.max(1e-4, s));
      const mat = selRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = approach(mat.opacity, hovered && !selected ? 0.35 : 0, dt, 8);
      selRef.current.visible = mat.opacity > 0.01;
    }

    if (moonRef.current && moonUniforms) {
      const hasMoon = years >= -4.5e9 && !gone;
      moonRef.current.visible = hasMoon && v.scale > 0.2;
      moonAngle.current = (moonAngle.current + dt * frame.speed * 1.4) % TAU;
      const d = scale * 2.6;
      moonRef.current.position.set(Math.cos(moonAngle.current) * d, Math.sin(moonAngle.current) * d * 0.12, -Math.sin(moonAngle.current) * d);
      moonRef.current.scale.setScalar(Math.max(1e-4, scale * 0.27));
      moonUniforms.uTime.value = frame.time;
      moonUniforms.uLightIntensity.value = frame.lightIntensity;
      moonUniforms.uMolten.value = v.molten * 0.6;
      moonUniforms.uFrozen.value = v.frozen;
    }

    setBody(body.id, orbit.position, Math.max(scale, 0.01));
  });

  const tiltRad = THREE.MathUtils.degToRad(profile.tilt);
  const ringSize = radius * 2.6 * 2;

  const surfaceMat = useShaderMaterial({ vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG, uniforms });
  const cloudMat = useShaderMaterial({ vertexShader: PLANET_VERT, fragmentShader: CLOUD_FRAG, uniforms: cloudUniforms, transparent: true, depthWrite: false });
  const rimMat = useShaderMaterial({
    vertexShader: ATMO_VERT,
    fragmentShader: ATMO_RIM_FRAG,
    uniforms: atmoUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const haloMat = useShaderMaterial({
    vertexShader: ATMO_VERT,
    fragmentShader: ATMO_HALO_FRAG,
    uniforms: atmoUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  });
  const ringMat = useShaderMaterial({ vertexShader: RING_VERT, fragmentShader: RING_FRAG, uniforms: ringUniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const dustMat = useShaderMaterial({
    vertexShader: RING_VERT,
    fragmentShader: DUST_FRAG,
    uniforms: dustUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const moonMat = useMemo(() => (moonUniforms ? new THREE.ShaderMaterial({ vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG, uniforms: moonUniforms }) : null), [moonUniforms]);
  useEffect(() => () => moonMat?.dispose(), [moonMat]);

  const pointerProps = {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (vis.current.scale < 0.05) return;
      e.stopPropagation();
      select(body.id);
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      if (vis.current.scale < 0.05) return;
      e.stopPropagation();
      hover(body.id);
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      hover(null);
      document.body.style.cursor = 'default';
    },
  };

  return (
    <group ref={orbitRef}>
      <group ref={tiltRef} rotation={[0, 0, tiltRad]}>
        <group ref={bodyRef}>
          <mesh ref={surfaceRef} material={surfaceMat} {...pointerProps}>
            <sphereGeometry args={[1, 96, 64]} />
          </mesh>
          {/* larger invisible hit target so small, far planets are still clickable */}
          <mesh visible={false} {...pointerProps}>
            <sphereGeometry args={[2.4, 12, 8]} />
            <meshBasicMaterial />
          </mesh>
          {profile.clouds > 0 && (
            <mesh ref={cloudsRef} scale={1.012} material={cloudMat}>
              <sphereGeometry args={[1, 72, 48]} />
            </mesh>
          )}
          <mesh scale={1.035} material={rimMat}>
            <sphereGeometry args={[1, 64, 48]} />
          </mesh>
          <mesh scale={1.28} material={haloMat}>
            <sphereGeometry args={[1, 48, 32]} />
          </mesh>
        </group>
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} visible={false} material={ringMat}>
          <planeGeometry args={[ringSize, ringSize]} />
        </mesh>
      </group>
      <mesh ref={dustRef} rotation={[-Math.PI / 2, 0, 0]} scale={radius} visible={false} material={dustMat}>
        <planeGeometry args={[7.6, 7.6]} />
      </mesh>
      {moonMat && (
        <group ref={moonRef} visible={false}>
          <mesh material={moonMat}>
            <sphereGeometry args={[1, 32, 24]} />
          </mesh>
        </group>
      )}
      <Billboard>
        <mesh ref={selRef} visible={false}>
          <ringGeometry args={[0.975, 1, 96]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </Billboard>
      {/* kept mounted: unmounting drei <Html> conditionally throws on removeChild, so the label is hidden instead */}
      <group ref={labelRef}>
        <Html
          center
          zIndexRange={[5, 0]}
          style={{ pointerEvents: 'none' }}
          occlude={[registry.sunRef as RefObject<THREE.Object3D>]}
          portal={registry.htmlPortal as RefObject<HTMLElement>}
        >
          <button
            type="button"
            onClick={() => select(body.id)}
            onPointerEnter={() => hover(body.id)}
            onPointerLeave={() => hover(null)}
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap backdrop-blur-sm transition select-none ${gone ? 'invisible pointer-events-none' : 'pointer-events-auto'} ${
              selected ? 'bg-white/15 text-white ring-1 ring-white/40' : hovered ? 'bg-white/10 text-white' : 'bg-black/25 text-white/70 hover:text-white'
            }`}
          >
            {body.name}
          </button>
        </Html>
      </group>
    </group>
  );
}
