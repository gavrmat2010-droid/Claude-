import { NOISE_GLSL } from './noise';

export const PLANET_VERT = /* glsl */ `
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

export const PLANET_FRAG = /* glsl */ `
precision highp float;
${NOISE_GLSL}
uniform sampler2D uPalA;
uniform sampler2D uPalB;
uniform float uMix;
uniform float uType;      // 0 rocky, 1 gas giant
uniform float uSeed;
uniform float uFreq;
uniform float uTime;
uniform float uOcean;
uniform vec3 uOceanDeep;
uniform vec3 uOceanShallow;
uniform float uOceanLevel;
uniform float uIce;
uniform float uMolten;
uniform float uFrozen;
uniform float uAlpha;
uniform float uHighlight;
uniform vec3 uAtmo;
uniform float uAtmoStrength;
uniform vec3 uStormColor;
uniform float uStorm;
uniform vec3 uSunPos;
uniform vec3 uLightColor;
uniform float uLightIntensity;
uniform float uNightLights;

varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vObj;

vec3 palette(float t) {
  return mix(texture2D(uPalA, vec2(t, 0.5)).rgb, texture2D(uPalB, vec2(t, 0.5)).rgb, uMix);
}

void main() {
  vec3 p = normalize(vObj);
  vec3 N = normalize(vNormal);
  vec3 L = normalize(uSunPos - vWorldPos);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float ndl = dot(N, L);
  float diff = clamp(ndl * 0.82 + 0.18, 0.0, 1.0);

  vec3 albedo;
  float spec = 0.0;
  float h = 0.5;
  float night = 0.0;

  if (uType < 0.5) {
    float base = fbm(p * uFreq + uSeed, 6);
    float r = ridged(p * uFreq * 1.7 + uSeed * 1.3, 4);
    h = clamp(base * 0.5 + 0.5, 0.0, 1.0);
    h = mix(h, r * 0.9, 0.3);
    float detail = fbm(p * uFreq * 6.0 + uSeed * 2.0, 3) * 0.5 + 0.5;
    h = clamp(mix(h, detail, 0.18), 0.0, 1.0);
    vec3 land = palette(h);
    albedo = land;
    if (uOcean > 0.0) {
      float landMask = smoothstep(uOceanLevel, uOceanLevel + 0.025, h);
      float depth = clamp((uOceanLevel - h) / 0.22, 0.0, 1.0);
      vec3 ocean = mix(uOceanShallow, uOceanDeep, depth);
      albedo = mix(mix(albedo, ocean, uOcean), albedo, landMask);
      spec = (1.0 - landMask) * uOcean;
      night = landMask * smoothstep(0.35, 0.6, fbm(p * uFreq * 5.0 + uSeed * 3.0, 3) * 0.5 + 0.5);
    }
    float lat = abs(p.y);
    // caps reach ~55° at uIce≈0.55 and cover the globe at uIce=1 (snowball)
    float capStart = 0.97 - 0.72 * pow(uIce, 3.0);
    float cap = smoothstep(capStart, capStart + 0.07, lat + (h - 0.5) * 0.12);
    albedo = mix(albedo, vec3(0.93, 0.96, 1.0), cap * min(uIce * 1.6, 1.0));
    spec *= 1.0 - cap;
  } else {
    float lat = p.y;
    float turb = fbm(vec3(p.x * uFreq * 0.5, p.y * uFreq * 2.2, p.z * uFreq * 0.5) + uSeed + vec3(uTime * 0.012, 0.0, 0.0), 5);
    float band = lat * 0.5 + 0.5 + turb * 0.07;
    h = band;
    albedo = palette(fract(band));
    float det = fbm(vec3(p.x * uFreq * 1.4, p.y * uFreq * 6.0, p.z * uFreq * 1.4) + uSeed * 2.0 - vec3(uTime * 0.02, 0.0, 0.0), 4);
    albedo *= 1.0 + det * 0.16;
    vec3 sp = normalize(vec3(0.55, -0.32, 0.77));
    float sd = distance(p, sp) + fbm(p * 24.0 + uSeed, 2) * 0.025;
    float storm = (1.0 - smoothstep(0.07, 0.17, sd)) * uStorm;
    vec3 stormCol = mix(uStormColor, uStormColor * 1.4, 1.0 - smoothstep(0.03, 0.1, sd));
    albedo = mix(albedo, stormCol, storm);
  }

  // frost: desaturate and brighten toward pale ice
  float lum = dot(albedo, vec3(0.299, 0.587, 0.114));
  vec3 frosted = mix(vec3(lum), vec3(0.72, 0.82, 0.92), 0.55);
  albedo = mix(albedo, frosted, uFrozen * 0.85);

  // lava: dark crust with glowing cracks (HDR → bloom)
  float lava = fbm(p * uFreq * 2.2 + uSeed * 0.7 + vec3(0.0, uTime * 0.03, 0.0), 5) * 0.5 + 0.5;
  float cracks = pow(smoothstep(0.42, 0.78, lava), 1.6);
  vec3 crust = vec3(0.10, 0.045, 0.03);
  vec3 lavaCol = mix(vec3(1.0, 0.22, 0.02), vec3(1.0, 0.85, 0.35), cracks) * 2.6;
  albedo = mix(albedo, mix(crust, vec3(0.0), cracks), uMolten);
  vec3 emissive = lavaCol * cracks * uMolten;

  // faint camera fill keeps the night side legible from any angle
  float fill = max(dot(N, V), 0.0) * 0.1;
  vec3 color = albedo * (diff * uLightColor * uLightIntensity + vec3(0.02, 0.022, 0.03) + fill);

  vec3 H = normalize(L + V);
  float s = pow(max(dot(N, H), 0.0), 70.0) * spec * 0.9 * smoothstep(0.0, 0.1, ndl);
  color += s * uLightColor * uLightIntensity;

  // city lights on the night side
  float dark = 1.0 - smoothstep(-0.15, 0.08, ndl);
  color += vec3(1.0, 0.78, 0.45) * night * dark * uNightLights * 0.9;

  // limb glow
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.2);
  color += uAtmo * fres * uAtmoStrength * (diff * 0.85 + 0.15) * 0.45;
  color += vec3(1.0) * fres * uHighlight * 0.6;

  color += emissive;
  gl_FragColor = vec4(color, uAlpha);
}
`;

export const ATMO_VERT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorldPos;
void main() {
  vNormal = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

/** Thin bright rim rendered on a slightly larger sphere (front faces) */
export const ATMO_RIM_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uStrength;
uniform vec3 uSunPos;
varying vec3 vNormal;
varying vec3 vWorldPos;
void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 L = normalize(uSunPos - vWorldPos);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 4.5);
  float lit = clamp(dot(N, L) * 1.3 + 0.45, 0.0, 1.0);
  gl_FragColor = vec4(uColor * rim * lit * uStrength * 1.6, 1.0);
}
`;

/** Soft outer halo rendered on the back faces of a larger sphere */
export const ATMO_HALO_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uStrength;
uniform vec3 uSunPos;
varying vec3 vNormal;
varying vec3 vWorldPos;
void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 L = normalize(uSunPos - vWorldPos);
  float glow = pow(abs(dot(N, V)), 2.4);
  float lit = clamp(dot(N, L) * 1.1 + 0.55, 0.0, 1.0);
  gl_FragColor = vec4(uColor * glow * lit * uStrength * 0.55, 1.0);
}
`;

export const CLOUD_FRAG = /* glsl */ `
precision highp float;
${NOISE_GLSL}
uniform float uTime;
uniform float uSeed;
uniform float uAmount;
uniform vec3 uColor;
uniform vec3 uSunPos;
uniform vec3 uLightColor;
uniform float uLightIntensity;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vObj;
void main() {
  vec3 p = normalize(vObj);
  vec3 N = normalize(vNormal);
  vec3 L = normalize(uSunPos - vWorldPos);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float n = fbm(p * 3.2 + uSeed + vec3(uTime * 0.015, 0.0, uTime * 0.01), 5) * 0.5 + 0.5;
  float swirl = fbm(p * 7.0 - uSeed + vec3(0.0, uTime * 0.01, 0.0), 3) * 0.5 + 0.5;
  n = mix(n, swirl, 0.35);
  float a = smoothstep(0.58, 0.8, n) * min(uAmount, 1.0) * (0.9 + 0.1 * uAmount);
  a *= a;
  float diff = clamp(dot(N, L) * 0.95 + 0.05, 0.0, 1.0);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.0);
  vec3 col = uColor * (diff * uLightColor * uLightIntensity + 0.02) + uColor * rim * 0.1;
  gl_FragColor = vec4(col, a);
}
`;

export const RING_VERT = /* glsl */ `
varying vec3 vWorldPos;
varying vec2 vLocal;
void main() {
  vLocal = position.xy;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const RING_FRAG = /* glsl */ `
precision highp float;
${NOISE_GLSL}
uniform float uInner;
uniform float uOuter;
uniform float uPlanetRadius;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uSeed;
uniform vec3 uSunPos;
uniform vec3 uPlanetPos;
uniform vec3 uNormal;
uniform vec3 uLightColor;
uniform float uLightIntensity;
varying vec3 vWorldPos;
varying vec2 vLocal;
void main() {
  float r = length(vLocal);
  float t = (r - uInner) / (uOuter - uInner);
  if (t < 0.0 || t > 1.0) discard;
  float n = fbm(vec3(t * 22.0, uSeed, 0.0), 4) * 0.5 + 0.5;
  float fine = snoise(vec3(t * 140.0, uSeed * 2.0, 1.0)) * 0.5 + 0.5;
  float density = smoothstep(0.25, 0.75, n) * (0.7 + 0.3 * fine);
  float gap = smoothstep(0.0, 0.035, abs(t - 0.64) - 0.012);
  float gap2 = smoothstep(0.0, 0.012, abs(t - 0.88) - 0.004);
  density *= gap * gap2;
  float edge = smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.85, 1.0, t));
  float alpha = density * edge * uOpacity;

  vec3 L = normalize(uSunPos - vWorldPos);
  float lit = abs(dot(normalize(uNormal), L)) * 0.75 + 0.25;
  // planet shadow across the ring
  vec3 w = vWorldPos - uPlanetPos;
  float along = dot(w, L);
  vec3 perp = w - L * along;
  float shadow = (along < 0.0) ? smoothstep(uPlanetRadius * 0.92, uPlanetRadius * 1.08, length(perp)) : 1.0;
  float scatter = pow(max(dot(normalize(cameraPosition - vWorldPos), -L), 0.0), 6.0) * 0.5;

  vec3 col = uColor * (0.55 + 0.6 * density) * (lit * shadow * uLightColor * uLightIntensity + 0.03) + uColor * scatter * shadow;
  gl_FragColor = vec4(col, alpha);
}
`;

/** Dusty accretion disk around a forming planet */
export const DUST_FRAG = /* glsl */ `
precision highp float;
${NOISE_GLSL}
uniform float uTime;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uSeed;
varying vec2 vLocal;
varying vec3 vWorldPos;
void main() {
  float r = length(vLocal);
  float t = (r - 1.3) / 2.4;
  if (t < 0.0 || t > 1.0) discard;
  float a = atan(vLocal.y, vLocal.x);
  float n = fbm(vec3(cos(a) * 2.0, sin(a) * 2.0, t * 5.0 + uTime * 0.1 + uSeed), 4) * 0.5 + 0.5;
  float edge = smoothstep(0.0, 0.15, t) * (1.0 - smoothstep(0.6, 1.0, t));
  gl_FragColor = vec4(uColor * (0.6 + n), n * edge * uOpacity);
}
`;
