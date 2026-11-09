import { Suspense, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { PLANETS } from '../data/bodies';
import { registry } from '../three/scale';
import { useSim } from '../store';
import Belts from '../three/Belts';
import CameraRig from '../three/CameraRig';
import Effects from '../three/Effects';
import { Ticker } from '../three/frame';
import Orbits from '../three/Orbits';
import Planet from '../three/Planet';
import Starfield from '../three/Starfield';
import Sun from '../three/Sun';

interface Props {
  /** UI chrome that overlaps the canvas; the camera centre is shifted away from it */
  panelWidth: number;
  headerHeight: number;
  footerHeight: number;
}

export default function Scene3D({ panelWidth, headerHeight, footerHeight }: Props) {
  const select = useSim((s) => s.select);
  const offset = useMemo(() => ({ x: Math.round(panelWidth / 2), y: Math.round((footerHeight - headerHeight) / 2) }), [panelWidth, headerHeight, footerHeight]);

  return (
    <div className="absolute inset-0">
      {/* labels render here instead of next to the canvas, so their mount target never changes */}
      <div
        ref={(el) => {
          registry.htmlPortal.current = el;
        }}
        className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
      />
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 88, 215], fov: 45, near: 0.1, far: 6000 }}
        gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
        onPointerMissed={(e) => {
          if (e.type === 'click') select(null);
        }}
        aria-label="Интерактивная 3D-модель Солнечной системы"
      >
        <color attach="background" args={['#02040a']} />
        <Ticker />
        <ambientLight intensity={0.06} />
        <Suspense fallback={null}>
          <Starfield />
          <Orbits />
          <Belts />
          <Sun />
          {PLANETS.map((p) => (
            <Planet key={p.id} body={p} />
          ))}
          <CameraRig offset={offset} />
          <Effects />
        </Suspense>
      </Canvas>
    </div>
  );
}
