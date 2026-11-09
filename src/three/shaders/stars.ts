import { NOISE_GLSL } from './noise';

export const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vTwinkle;
void main() {
  vColor = aColor;
  vTwinkle = 0.75 + 0.25 * sin(uTime * (0.6 + aPhase * 0.7) + aPhase * 40.0);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPixelRatio;
  gl_Position = projectionMatrix * mv;
}
`;

export const STAR_FRAG = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying float vTwinkle;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  float core = pow(max(1.0 - d, 0.0), 1.8);
  float glow = pow(max(1.0 - d, 0.0), 6.0);
  gl_FragColor = vec4(vColor * (core * 0.9 + glow * 0.8) * vTwinkle, 1.0);
}
`;

export const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** Faint Milky Way band with dust lanes and a few nebulous clouds */
export const SKY_FRAG = /* glsl */ `
precision highp float;
${NOISE_GLSL}
uniform float uTime;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  // tilt the galactic plane relative to the ecliptic
  mat3 tilt = mat3(1.0, 0.0, 0.0, 0.0, 0.5, -0.866, 0.0, 0.866, 0.5);
  vec3 g = tilt * d;
  float band = exp(-pow(g.y * 3.2, 2.0));
  float n = fbm(g * 3.0 + 11.0, 5) * 0.5 + 0.5;
  float lanes = smoothstep(0.35, 0.75, fbm(g * 6.5 + 3.0, 4) * 0.5 + 0.5);
  float glow = band * (0.35 + 0.65 * n) * (1.0 - lanes * 0.7);
  vec3 warm = vec3(0.95, 0.85, 0.7);
  vec3 cool = vec3(0.45, 0.55, 0.9);
  vec3 col = mix(cool, warm, n) * glow * 0.32;
  // scattered nebulae
  float neb = smoothstep(0.62, 0.9, fbm(d * 2.2 - 5.0, 4) * 0.5 + 0.5);
  col += mix(vec3(0.5, 0.2, 0.6), vec3(0.15, 0.4, 0.6), n) * neb * 0.16;
  // deep space base
  col += vec3(0.012, 0.016, 0.03);
  gl_FragColor = vec4(col, 1.0);
}
`;
