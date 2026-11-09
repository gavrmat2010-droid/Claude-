import { EffectComposer, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

export default function Effects() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom mipmapBlur intensity={1.6} luminanceThreshold={0.7} luminanceSmoothing={0.3} radius={0.75} levels={8} />
      <Vignette eskil={false} offset={0.22} darkness={0.8} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
