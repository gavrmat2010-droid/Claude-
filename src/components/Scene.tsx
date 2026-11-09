import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { PLANETS, SUN, type Body, type Look, type RingLook } from '../data/bodies';
import { rgba, shade, sunColors } from '../lib/color';
import { sunAt, AU_PER_SOLAR_RADIUS, SUN_T, type SunState } from '../lib/sun';
import { bodyStateAt, type BodyState } from '../lib/state';
import { T_MIN } from '../lib/time';

export interface SceneInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface Props {
  years: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  insets: SceneInsets;
  /** transient speed-up of orbital motion while time is being scrubbed */
  warpRef: RefObject<number>;
}

const TAU = Math.PI * 2;
const SQUASH = 0.5; // viewing angle of the ecliptic
const RING_SQUASH = 0.36;
const AU_MIN = 0.3;
const AU_MAX = 39.48;
const EARTH_REV_SECONDS = 14;

interface Star {
  x: number;
  y: number;
  r: number;
  a: number;
  p: number;
}

interface Hit {
  id: string;
  x: number;
  y: number;
  r: number;
}

interface Item {
  state: BodyState;
  x: number;
  y: number;
  r: number;
  depth: number;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeStars(n: number, seed: number): Star[] {
  const rnd = mulberry32(seed);
  return Array.from({ length: n }, () => {
    const big = rnd() > 0.93;
    return { x: rnd(), y: rnd(), r: big ? 1.3 + rnd() * 1.2 : 0.4 + rnd() * 0.8, a: 0.25 + rnd() * 0.75, p: rnd() * TAU };
  });
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

function drawRingHalf(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, ring: RingLook, half: 'back' | 'front') {
  const outer = r * ring.outer;
  const inner = r * ring.inner;
  const width = outer - inner;
  const mid = (outer + inner) / 2;
  ctx.save();
  ctx.beginPath();
  if (half === 'back') ctx.rect(x - outer - 4, y - outer - 4, outer * 2 + 8, outer + 4);
  else ctx.rect(x - outer - 4, y, outer * 2 + 8, outer + 4);
  ctx.clip();
  ctx.beginPath();
  ctx.ellipse(x, y, mid, mid * RING_SQUASH, 0, 0, TAU);
  ctx.lineWidth = width;
  ctx.strokeStyle = rgba(ring.color, ring.opacity);
  ctx.stroke();
  const gap = inner + width * 0.62;
  ctx.beginPath();
  ctx.ellipse(x, y, gap, gap * RING_SQUASH, 0, 0, TAU);
  ctx.lineWidth = Math.max(0.8, width * 0.1);
  ctx.strokeStyle = rgba('#000000', 0.4 * ring.opacity);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, y, outer - width * 0.15, (outer - width * 0.15) * RING_SQUASH, 0, 0, TAU);
  ctx.lineWidth = Math.max(0.8, width * 0.18);
  ctx.strokeStyle = rgba(shade(ring.color, 0.3), 0.35 * ring.opacity);
  ctx.stroke();
  ctx.restore();
}

function drawPlanet(ctx: CanvasRenderingContext2D, it: Item, cx: number, cy: number, now: number, selected: boolean, hovered: boolean) {
  const { x, y, r } = it;
  const look: Look = it.state.look;
  const body: Body = it.state.body;
  const toSun = Math.atan2(cy - y, cx - x);
  const seed = hashId(body.id);

  ctx.save();
  ctx.globalAlpha = look.alpha ?? 1;

  if (selected || hovered) {
    const haloR = r * (look.rings ? look.rings.outer : 1) + 7;
    const g = ctx.createRadialGradient(x, y, r * 0.8, x, y, haloR + 14);
    g.addColorStop(0, rgba(look.color2, selected ? 0.35 : 0.2));
    g.addColorStop(1, rgba(look.color2, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, haloR + 14, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, haloR, 0, TAU);
    ctx.lineWidth = selected ? 1.5 : 1;
    ctx.strokeStyle = rgba('#ffffff', selected ? 0.75 : 0.4);
    ctx.stroke();
  }

  if (look.forming) {
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.9, r * 1.9 * 0.55, 0, 0, TAU);
    ctx.lineWidth = r * 0.9;
    ctx.strokeStyle = rgba(look.color2, 0.22);
    ctx.stroke();
  }

  if (look.molten) {
    const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.4);
    g.addColorStop(0, rgba('#ff6a1a', 0.45));
    g.addColorStop(1, rgba('#ff3000', 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.4, 0, TAU);
    ctx.fill();
  }

  if (look.rings) drawRingHalf(ctx, x, y, r, look.rings, 'back');

  // lit sphere, light coming from the Sun
  const g = ctx.createRadialGradient(x + Math.cos(toSun) * r * 0.45, y + Math.sin(toSun) * r * 0.45, r * 0.08, x, y, r * 1.02);
  g.addColorStop(0, shade(look.color2, 0.15));
  g.addColorStop(0.5, look.color);
  g.addColorStop(1, shade(look.color, look.frozen ? -0.55 : -0.75));
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = g;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();

  if (look.bands) {
    const n = look.bands.length;
    const bh = (r * 2) / n;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = rgba(look.bands[i], 0.5);
      ctx.fillRect(x - r, y - r + i * bh, r * 2, bh + 0.5);
    }
  }
  if (look.spots) {
    const rnd = mulberry32(seed);
    const spin = (now / 1000) * 0.25;
    for (let i = 0; i < 4; i++) {
      const a = rnd() * TAU + spin;
      const d = r * (0.2 + rnd() * 0.55);
      const sx = x + Math.cos(a) * d;
      const sy = y + Math.sin(a) * d * 0.7;
      ctx.beginPath();
      ctx.ellipse(sx, sy, r * (0.3 + rnd() * 0.3), r * (0.16 + rnd() * 0.2), rnd() * Math.PI, 0, TAU);
      ctx.fillStyle = rgba(look.spots, 0.85);
      ctx.fill();
    }
  }
  if (look.storm) {
    ctx.beginPath();
    ctx.ellipse(x + r * 0.3, y + r * 0.3, r * 0.24, r * 0.13, 0, 0, TAU);
    ctx.fillStyle = rgba(look.storm, 0.9);
    ctx.fill();
  }
  // terminator: darken the side facing away from the Sun
  const tg = ctx.createLinearGradient(x + Math.cos(toSun) * r, y + Math.sin(toSun) * r, x - Math.cos(toSun) * r, y - Math.sin(toSun) * r);
  tg.addColorStop(0, 'rgba(0,0,0,0)');
  tg.addColorStop(0.55, 'rgba(0,0,0,0.05)');
  tg.addColorStop(1, look.molten ? 'rgba(60,0,0,0.35)' : 'rgba(0,0,10,0.6)');
  ctx.fillStyle = tg;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();

  if (look.frozen) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(200,220,255,0.35)';
    ctx.stroke();
  }

  if (look.rings) drawRingHalf(ctx, x, y, r, look.rings, 'front');
  ctx.restore();
}

function drawSun(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, sun: SunState, now: number, selected: boolean) {
  const c = sunColors(sun.temp);
  const pulse = 1 + 0.012 * Math.sin(now / 700);
  const glowMul = sun.phase === 'wd' ? 9 : sun.phase === 'nebula' ? 6 : sun.phase === 'protostar' ? 3.4 : r > 80 ? 1.9 : 2.8;
  const gr = r * glowMul * pulse;

  const glow = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, gr);
  glow.addColorStop(0, rgba(c.glow, 0.55));
  glow.addColorStop(0.3, rgba(c.glow, 0.18));
  glow.addColorStop(1, rgba(c.glow, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, gr, 0, TAU);
  ctx.fill();

  const body = ctx.createRadialGradient(cx - r * 0.18, cy - r * 0.18, r * 0.05, cx, cy, r);
  body.addColorStop(0, c.core);
  body.addColorStop(0.55, c.mid);
  body.addColorStop(0.9, c.glow);
  body.addColorStop(1, rgba(c.glow, r > 60 ? 0.55 : 0.95));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();

  if (r > 60) {
    // red giants have fuzzy limbs
    const rim = ctx.createRadialGradient(cx, cy, r * 0.92, cx, cy, r * 1.12);
    rim.addColorStop(0, rgba(c.glow, 0.5));
    rim.addColorStop(1, rgba(c.glow, 0));
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.12, 0, TAU);
    ctx.fill();
  }

  if (selected) {
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(r, 10) + 8, 0, TAU);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.stroke();
  }
}

function drawProtoDisk(ctx: CanvasRenderingContext2D, cx: number, cy: number, innerR: number, outerR: number, strength: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, SQUASH);
  const g = ctx.createRadialGradient(0, 0, innerR * 0.4, 0, 0, outerR * 0.8);
  g.addColorStop(0, rgba('#ffb070', 0.05 * strength));
  g.addColorStop(0.2, rgba('#ff9a4a', 0.42 * strength));
  g.addColorStop(0.55, rgba('#c07ad8', 0.22 * strength));
  g.addColorStop(1, rgba('#6060c0', 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, outerR * 0.8, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawNebula(ctx: CanvasRenderingContext2D, cx: number, cy: number, outerR: number, s: number) {
  const radius = outerR * (0.2 + 1.1 * s);
  const alpha = Math.pow(1 - s, 1.6);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, SQUASH * 1.35);
  const g = ctx.createRadialGradient(0, 0, radius * 0.45, 0, 0, radius * 1.3);
  g.addColorStop(0, rgba('#3fd1c5', 0));
  g.addColorStop(0.45, rgba('#3fd1c5', 0.35 * alpha));
  g.addColorStop(0.75, rgba('#d946ef', 0.3 * alpha));
  g.addColorStop(1, rgba('#d946ef', 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.3, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export default function Scene({ years, selectedId, onSelect, insets, warpRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const yearsRef = useRef(years);
  const selectedRef = useRef(selectedId);
  const insetsRef = useRef(insets);
  const hoverRef = useRef<string | null>(null);
  const hitsRef = useRef<Hit[]>([]);
  const anglesRef = useRef<number[]>(PLANETS.map((p) => (hashId(p.id) % 6283) / 1000));
  const stars = useMemo(() => makeStars(700, 1337), []);

  useEffect(() => {
    yearsRef.current = years;
  }, [years]);
  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);
  useEffect(() => {
    insetsRef.current = insets;
  }, [insets]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const warp = warpRef.current;
      warpRef.current = warp < 0.01 ? 0 : warp * Math.exp(-dt * 2.2);

      const t = yearsRef.current;
      const sun = sunAt(t);
      const states = PLANETS.map((p) => bodyStateAt(p, t, sun));
      const ins = insetsRef.current;
      const selected = selectedRef.current;
      const hovered = hoverRef.current;

      const availW = Math.max(200, w - ins.left - ins.right);
      const availH = Math.max(200, h - ins.top - ins.bottom);
      const cx = ins.left + availW / 2;
      const cy = ins.top + availH / 2;
      // leave room for orbits that expand ~1.85× once the Sun sheds mass
      const outerR = Math.max(110, Math.min(availW / 2 - 96, (availH / 2 - 44) / SQUASH));
      const innerR = Math.max(36, outerR * 0.15);
      const orbitPx = (au: number) => innerR + ((outerR - innerR) * Math.log(au / AU_MIN)) / Math.log(AU_MAX / AU_MIN);
      const sizeScale = Math.min(1.25, Math.max(0.55, outerR / 400));

      // orbital motion
      const angles = anglesRef.current;
      const speed = 1 + warp;
      for (let i = 0; i < states.length; i++) {
        angles[i] = (angles[i] + (dt * TAU * speed) / (EARTH_REV_SECONDS * states[i].periodYears)) % TAU;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // background
      ctx.fillStyle = '#03050d';
      ctx.fillRect(0, 0, w, h);
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.75);
      bg.addColorStop(0, 'rgba(38,52,110,0.32)');
      bg.addColorStop(0.5, 'rgba(14,20,50,0.18)');
      bg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      for (const s of stars) {
        const tw = 0.7 + 0.3 * Math.sin(now / 900 + s.p);
        ctx.fillStyle = `rgba(255,255,255,${(s.a * tw).toFixed(3)})`;
        ctx.fillRect(s.x * w, s.y * h, s.r, s.r);
      }

      // ambient tint from a red giant
      if (sun.luminosity > 5) {
        const k = Math.min(0.2, 0.045 * Math.log10(sun.luminosity));
        ctx.fillStyle = rgba('#ff5a1a', k);
        ctx.fillRect(0, 0, w, h);
      }

      if (sun.phase === 'protostar') {
        const s = (t - T_MIN) / (SUN_T.zams - T_MIN);
        drawProtoDisk(ctx, cx, cy, innerR, outerR, 1 - s * 0.75);
      }
      if (t >= SUN_T.nebula && t < SUN_T.nebula + 1.5e8) {
        drawNebula(ctx, cx, cy, outerR, (t - SUN_T.nebula) / 1.5e8);
      }

      // Sun size: consistent with the orbit scale so that engulfment is literal
      const sunBase = SUN.displayRadius * sizeScale;
      const sunR = Math.max(sunBase * Math.pow(sun.radius, 0.3), orbitPx(Math.max(AU_MIN * 0.5, sun.radius * AU_PER_SOLAR_RADIUS)), 3.5);

      // orbits
      for (const st of states) {
        const r = orbitPx(st.orbitAU);
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * SQUASH, 0, 0, TAU);
        if (st.gone) {
          ctx.setLineDash([3, 7]);
          ctx.strokeStyle = 'rgba(255,255,255,0.08)';
          ctx.lineWidth = 1;
        } else if (st.body.id === selected) {
          ctx.setLineDash([]);
          ctx.strokeStyle = rgba(st.look.color2, 0.55);
          ctx.lineWidth = 1.4;
        } else {
          ctx.setLineDash([]);
          ctx.strokeStyle = `rgba(255,255,255,${st.body.id === hovered ? 0.28 : 0.11})`;
          ctx.lineWidth = 1;
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);

      const items: Item[] = [];
      states.forEach((st, i) => {
        if (st.gone) return;
        const a = angles[i];
        const r = orbitPx(st.orbitAU);
        const depth = Math.sin(a);
        items.push({
          state: st,
          x: cx + Math.cos(a) * r,
          y: cy + depth * r * SQUASH,
          r: st.body.displayRadius * sizeScale * (st.look.scale ?? 1) * (1 + 0.16 * depth),
          depth,
        });
      });
      items.sort((p, q) => p.depth - q.depth);

      const back = items.filter((it) => it.depth < 0);
      const front = items.filter((it) => it.depth >= 0);
      for (const it of back) drawPlanet(ctx, it, cx, cy, now, it.state.body.id === selected, it.state.body.id === hovered);
      drawSun(ctx, cx, cy, sunR, sun, now, selected === 'sun');
      for (const it of front) drawPlanet(ctx, it, cx, cy, now, it.state.body.id === selected, it.state.body.id === hovered);

      // labels (only the highlighted one on cramped screens)
      const fontPx = Math.round(12 * Math.min(1, Math.max(0.85, sizeScale)));
      ctx.font = `500 ${fontPx}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const cramped = sizeScale < 0.7;
      for (const it of items) {
        const id = it.state.body.id;
        const emph = id === selected || id === hovered;
        if (cramped && !emph) continue;
        const alpha = (it.state.look.alpha ?? 1) * (emph ? 1 : 0.62 + 0.18 * it.depth);
        ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
        ctx.fillText(it.state.body.name, it.x, it.y + it.r + 6);
      }

      hitsRef.current = [
        { id: 'sun', x: cx, y: cy, r: Math.max(sunR, 14) },
        ...items.map((it) => ({ id: it.state.body.id, x: it.x, y: it.y, r: Math.max(it.r + 6, 13) })),
      ];

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [stars, warpRef]);

  const findHit = (e: ReactPointerEvent<HTMLCanvasElement>): Hit | null => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let best: Hit | null = null;
    let bestD = Infinity;
    for (const hit of hitsRef.current) {
      const d = Math.hypot(hit.x - x, hit.y - y);
      if (d <= hit.r && d < bestD) {
        best = hit;
        bestD = d;
      }
    }
    return best;
  };

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none select-none"
        aria-label="Интерактивная модель Солнечной системы"
        onPointerMove={(e) => {
          const hit = findHit(e);
          hoverRef.current = hit?.id ?? null;
          e.currentTarget.style.cursor = hit ? 'pointer' : 'default';
        }}
        onPointerLeave={(e) => {
          hoverRef.current = null;
          e.currentTarget.style.cursor = 'default';
        }}
        onPointerUp={(e) => {
          const hit = findHit(e);
          onSelect(hit ? hit.id : null);
        }}
      />
    </div>
  );
}
