import { NOISE_GLSL } from './noise';

export const SUN_VERT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vObj;
void main() {
  vObj = position;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const SUN_FRAG = /* glsl */ `
precision highp float;
${NOISE_GLSL}
uniform float uTime;
uniform vec3 uCore;
uniform vec3 uMid;
uniform vec3 uDark;
uniform float uIntensity;
uniform float uTurbulence;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vObj;
void main() {
  vec3 p = normalize(vObj);
  float n1 = fbm(p * 2.6 + vec3(uTime * 0.04, uTime * 0.02, 0.0), 5) * 0.5 + 0.5;
  float n2 = fbm(p * 7.5 - vec3(0.0, uTime * 0.07, uTime * 0.03), 4) * 0.5 + 0.5;
  float gran = ridged(p * 18.0 + vec3(uTime * 0.05), 3);
  float t = n1 * 0.55 + n2 * 0.3 + gran * 0.15 * uTurbulence;
  vec3 col = mix(uDark, uMid, smoothstep(0.18, 0.62, t));
  col = mix(col, uCore, smoothstep(0.6, 0.92, t) * (0.35 + 0.65 * uTurbulence));
  vec3 V = normalize(cameraPosition - vWorldPos);
  float mu = max(dot(normalize(vNormal), V), 0.0);
  col *= 0.5 + 0.5 * pow(mu, 0.55);
  // bright hot limb for a crisp silhouette against the corona
  col += uMid * pow(1.0 - mu, 3.0) * 0.6;
  gl_FragColor = vec4(col * uIntensity, 1.0);
}
`;

export const CORONA_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const CORONA_FRAG = /* glsl */ `
precision highp float;
${NOISE_GLSL}
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uHot;
uniform float uIntensity;
uniform float uSpread;
uniform float uLimb; // sphere radius as a fraction of the half-size of the quad
varying vec2 vUv;
void main() {
  vec2 c = (vUv - 0.5) * 2.0;
  float d = length(c);
  if (d > 1.0) discard;
  float a = atan(c.y, c.x);
  float rays = fbm(vec3(cos(a) * 3.0, sin(a) * 3.0, uTime * 0.12), 4) * 0.5 + 0.5;
  float rays2 = fbm(vec3(cos(a) * 9.0, sin(a) * 9.0, -uTime * 0.2 + 7.0), 3) * 0.5 + 0.5;
  // distance outside the photosphere, 0 at the limb → 1 at the quad edge
  float x = clamp((d - uLimb) / (1.0 - uLimb), 0.0, 1.0);
  float halo = pow(1.0 - x, 2.4 / uSpread);
  float streamers = pow(1.0 - x, 5.0) * (0.5 + rays * 1.1 + rays2 * 0.4);
  float glow = halo * 0.9 + streamers * 1.1;
  // fade in just inside the limb so the sphere edge is not a hard cut
  float coreMask = smoothstep(uLimb * 0.9, uLimb * 1.02, d);
  vec3 col = mix(uHot, uColor, smoothstep(0.0, 0.5, x));
  gl_FragColor = vec4(col * glow * uIntensity * coreMask, 1.0);
}
`;

export const DISK_VERT = /* glsl */ `
varying vec2 vLocal;
void main() {
  vLocal = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** Protoplanetary disk: hot inner rim, dusty spiral arms, dark gaps where planets form */
export const DISK_FRAG = /* glsl */ `
precision highp float;
${NOISE_GLSL}
uniform float uTime;
uniform float uInner;
uniform float uOuter;
uniform float uStrength;
varying vec2 vLocal;
void main() {
  float r = length(vLocal);
  float t = (r - uInner) / (uOuter - uInner);
  if (t < 0.0 || t > 1.0) discard;
  float a = atan(vLocal.y, vLocal.x);
  float spiral = a * 2.0 + log(r) * 5.0 - uTime * 0.08;
  float arms = 0.5 + 0.5 * sin(spiral);
  float n = fbm(vec3(cos(a) * 3.0, sin(a) * 3.0, t * 9.0 + uTime * 0.03), 5) * 0.5 + 0.5;
  float dust = smoothstep(0.2, 0.8, n * 0.7 + arms * 0.4);
  float radial = smoothstep(0.0, 0.06, t) * pow(1.0 - t, 1.6);
  float gaps = 1.0 - 0.6 * (1.0 - smoothstep(0.0, 0.02, abs(t - 0.23) - 0.01)) - 0.6 * (1.0 - smoothstep(0.0, 0.03, abs(t - 0.52) - 0.012));
  vec3 hot = vec3(1.0, 0.55, 0.2);
  vec3 warm = vec3(0.85, 0.5, 0.35);
  vec3 cold = vec3(0.35, 0.3, 0.6);
  vec3 col = mix(hot, warm, smoothstep(0.0, 0.25, t));
  col = mix(col, cold, smoothstep(0.3, 1.0, t));
  float alpha = dust * radial * gaps * uStrength;
  gl_FragColor = vec4(col * (0.6 + dust * 0.8) * (1.0 + 1.5 * (1.0 - smoothstep(0.0, 0.2, t))), alpha);
}
`;

export const NEBULA_VERT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vObj;
void main() {
  vObj = position;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

/** Expanding planetary-nebula shell: teal oxygen inside, magenta hydrogen filaments outside */
export const NEBULA_FRAG = /* glsl */ `
precision highp float;
${NOISE_GLSL}
uniform float uTime;
uniform float uProgress;
uniform float uOpacity;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vObj;
void main() {
  vec3 p = normalize(vObj);
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  // hollow shell: bright filaments at the limb, almost transparent through the middle
  float fres = pow(1.0 - abs(dot(N, V)), 2.2);
  float fil = fbm(p * 4.0 + vec3(uTime * 0.02, 0.0, uProgress * 2.0), 5) * 0.5 + 0.5;
  float fil2 = ridged(p * 9.0 - vec3(0.0, uTime * 0.01, 0.0), 4);
  float density = smoothstep(0.35, 0.85, fil * 0.65 + fil2 * 0.45);
  vec3 teal = vec3(0.25, 0.85, 0.85);
  vec3 magenta = vec3(0.95, 0.35, 0.85);
  vec3 col = mix(teal, magenta, smoothstep(0.35, 0.85, fil));
  float alpha = (fres * 0.9 + 0.04) * (0.35 + 0.65 * density) * uOpacity;
  gl_FragColor = vec4(col * 1.3, alpha);
}
`;
