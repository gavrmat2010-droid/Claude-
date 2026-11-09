import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useSim } from '../store';
import { registry } from './scale';

const ORIGIN = new THREE.Vector3();
const OVERVIEW_DISTANCE = 235;
const tmp = new THREE.Vector3();
const dir = new THREE.Vector3();

interface Props {
  /** horizontal/vertical pixel offset of the visual centre, to keep the scene clear of UI panels */
  offset: { x: number; y: number };
}

/** Camera distance at which a body of radius r fills ~40% of the narrower screen dimension */
function fitDistance(camera: THREE.PerspectiveCamera, r: number, ringed: boolean): number {
  const vHalf = THREE.MathUtils.degToRad(camera.fov) / 2;
  const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
  const half = Math.min(vHalf, hHalf);
  const span = r * (ringed ? 2.6 : 1);
  return Math.max(span / (Math.tan(half) * 0.42), 4.5);
}

/**
 * OrbitControls plus a follow rig: the controls' target glides to the selected body and
 * tracks it along its orbit; the camera eases to a distance that fits the body on screen.
 */
export default function CameraRig({ offset }: Props) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const selectedId = useSim((s) => s.selectedId);
  const zoom = useRef<{ distance: number; active: boolean }>({ distance: OVERVIEW_DISTANCE, active: false });
  const prevSelected = useRef<string | null>(null);

  useEffect(() => {
    camera.setViewOffset(size.width, size.height, offset.x, offset.y, size.width, size.height);
    camera.updateProjectionMatrix();
    return () => {
      camera.clearViewOffset();
    };
  }, [camera, size.width, size.height, offset.x, offset.y]);

  useEffect(() => {
    if (selectedId === prevSelected.current) return;
    prevSelected.current = selectedId;
    if (selectedId) {
      const r = registry.radii[selectedId] ?? 1;
      zoom.current = { distance: fitDistance(camera, r, selectedId === 'saturn'), active: true };
    } else {
      zoom.current = { distance: OVERVIEW_DISTANCE, active: true };
    }
  }, [selectedId, camera]);

  useFrame((_, rawDt) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const dt = Math.min(0.2, rawDt);
    const target = selectedId ? (registry.positions[selectedId] ?? ORIGIN) : ORIGIN;

    // glide the pivot toward the body and carry the camera with it
    tmp.copy(target).sub(controls.target);
    const follow = 1 - Math.exp(-dt * (selectedId ? 8 : 4));
    tmp.multiplyScalar(follow);
    controls.target.add(tmp);
    camera.position.add(tmp);

    if (zoom.current.active) {
      dir.copy(camera.position).sub(controls.target);
      const cur = dir.length() || 1;
      const want = zoom.current.distance;
      const next = cur + (want - cur) * (1 - Math.exp(-dt * 3.5));
      dir.multiplyScalar(next / cur);
      camera.position.copy(controls.target).add(dir);
      if (Math.abs(next - want) < Math.max(0.05, want * 0.004)) zoom.current.active = false;
    }

    if (selectedId) {
      const r = registry.radii[selectedId] ?? 1;
      controls.minDistance = Math.max(r * 1.6, 1.2);
    } else {
      controls.minDistance = 6;
    }
    controls.update();
  }); // subscribed after the planets so the pivot tracks this frame's positions

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.55}
      zoomSpeed={0.9}
      enablePan={false}
      minDistance={6}
      maxDistance={700}
      minPolarAngle={0.08}
      maxPolarAngle={Math.PI - 0.08}
      onStart={() => {
        zoom.current.active = false;
      }}
    />
  );
}
