import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/**
 * Builds a ShaderMaterial imperatively. R3F copies the `uniforms` prop into its own objects,
 * which silently detaches scalar uniforms from the objects we mutate every frame — so materials
 * are created here and handed to meshes via `material={...}` instead.
 */
export function useShaderMaterial(params: THREE.ShaderMaterialParameters): THREE.ShaderMaterial {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const material = useMemo(() => new THREE.ShaderMaterial(params), []);
  useEffect(() => () => material.dispose(), [material]);
  return material;
}
