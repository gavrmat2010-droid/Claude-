import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { PLANETS, type Body } from '../data/bodies';
import { eraAt } from '../lib/state';
import { useSim } from '../store';
import { frame } from './frame';
import { orbitUnits, TAU } from './scale';

const SEGMENTS = 360;

function Orbit({ body }: { body: Body }) {
  const selected = useSim((s) => s.selectedId === body.id);
  const hovered = useSim((s) => s.hoveredId === body.id);
  const base = orbitUnits(body.orbitAU);

  const line = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i <= SEGMENTS; i++) {
      const a = (i / SEGMENTS) * TAU;
      pts.push(Math.cos(a) * base, 0, Math.sin(a) * base);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const material = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.13, depthWrite: false });
    const obj = new THREE.Line(geometry, material);
    obj.frustumCulled = false;
    return obj;
  }, [base]);

  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line],
  );

  useFrame(() => {
    const orbitAU = body.orbitAU / frame.sun.mass;
    const k = orbitUnits(orbitAU) / base;
    line.scale.set(k, 1, k);
    const gone = !!eraAt(body, frame.years).gone || frame.sunRadiusAU >= orbitAU;
    const mat = line.material as THREE.LineBasicMaterial;
    const target = gone ? 0.05 : selected ? 0.6 : hovered ? 0.32 : 0.13;
    mat.opacity += (target - mat.opacity) * 0.12;
    mat.color.set(selected ? body.look.color2 : '#ffffff');
  });

  return <primitive object={line} />;
}

export default function Orbits() {
  return (
    <group>
      {PLANETS.map((p) => (
        <Orbit key={p.id} body={p} />
      ))}
    </group>
  );
}
