import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BodyStrip from './components/BodyStrip';
import InfoPanel from './components/InfoPanel';
import Scene, { type SceneInsets } from './components/Scene';
import TimeBar from './components/TimeBar';
import { BODIES, SUN } from './data/bodies';
import { bodyStateAt, eraAt } from './lib/state';
import { sunAt } from './lib/sun';
import { sliderToYears, T_MAX, yearsToSlider } from './lib/time';

const PLAY_SPEED = 0.012; // slider units per second
const MAX_WARP = 10;

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

// callback ref so conditionally rendered elements are measured too
function useHeight() {
  const [height, setHeight] = useState(0);
  const roRef = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el) {
      setHeight(0);
      return;
    }
    const ro = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height));
    ro.observe(el);
    setHeight(el.getBoundingClientRect().height);
    roRef.current = ro;
  }, []);
  return [ref, height] as const;
}

export default function App() {
  const [years, setYears] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const warpRef = useRef(0);
  const yearsRef = useRef(0);
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [headerRef, headerH] = useHeight();
  const [timebarRef, timebarH] = useHeight();
  const [mobilePanelRef, mobilePanelH] = useHeight();

  useEffect(() => {
    yearsRef.current = years;
  }, [years]);

  const sun = useMemo(() => sunAt(years), [years]);
  const states = useMemo(() => BODIES.map((b) => bodyStateAt(b, years, sun)), [years, sun]);
  const selected = selectedId ? (states.find((s) => s.body.id === selectedId) ?? null) : null;

  const headline = useMemo(() => {
    const parts = [eraAt(SUN, years).title];
    const gone = states.filter((s) => s.gone).map((s) => s.body.name);
    const earth = states.find((s) => s.body.id === 'earth');
    if (earth && !earth.gone) parts.push(`Земля: ${earth.era.title.toLowerCase()}`);
    if (gone.length) parts.push(`${gone.length === 1 ? 'Поглощена Солнцем' : 'Поглощены Солнцем'}: ${gone.join(', ')}`);
    return parts.join(' · ');
  }, [states, years]);

  const changeYears = useCallback((next: number) => {
    const dv = Math.abs(yearsToSlider(next) - yearsToSlider(yearsRef.current));
    warpRef.current = Math.min(MAX_WARP, warpRef.current + dv * 120);
    setYears(next);
  }, []);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const v = yearsToSlider(yearsRef.current) + dt * PLAY_SPEED;
      warpRef.current = Math.min(MAX_WARP, warpRef.current + dt * 12);
      if (v >= 1) {
        setYears(T_MAX);
        setPlaying(false);
        return;
      }
      setYears(sliderToYears(v));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null);
      if (e.key === ' ' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const togglePlay = useCallback(() => {
    if (!playing && yearsToSlider(yearsRef.current) >= 1) setYears(0);
    setPlaying((p) => !p);
  }, [playing]);

  const insets: SceneInsets = useMemo(
    () => ({
      top: headerH + 24,
      right: isDesktop ? 420 : 0,
      bottom: timebarH + 32 + (!isDesktop && selected ? mobilePanelH + 12 : 0),
      left: 0,
    }),
    [headerH, timebarH, mobilePanelH, isDesktop, selected],
  );

  const planetStates = states.filter((s) => s.body.id !== 'sun');
  const sunState = states[0];

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Scene years={years} selectedId={selectedId} onSelect={setSelectedId} insets={insets} warpRef={warpRef} />

      <header ref={headerRef} className="pointer-events-none absolute top-4 right-4 left-4 z-10 flex flex-col gap-3 sm:top-6 sm:left-7 md:right-[420px]">
        <div className="pointer-events-auto">
          <h1 className="text-gradient text-2xl font-extrabold tracking-tight sm:text-3xl">Солнечная система</h1>
          <p className="mt-0.5 text-xs text-white/55 sm:text-sm">Нажмите на планету и перемотайте время — узнайте, что с ней было и что будет</p>
        </div>
        <div className="pointer-events-auto">
          <BodyStrip states={[sunState, ...planetStates]} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      </header>

      {isDesktop && (
        <div className="absolute top-4 right-4 bottom-4 z-10 flex w-[396px] flex-col justify-start" style={{ bottom: timebarH + 32 }}>
          <InfoPanel state={selected} sun={sun} years={years} onJump={changeYears} onClose={() => setSelectedId(null)} />
        </div>
      )}

      {!isDesktop && selected && (
        <div ref={mobilePanelRef} className="absolute inset-x-3 z-10 flex max-h-[36vh] flex-col" style={{ bottom: timebarH + 28 }}>
          <InfoPanel state={selected} sun={sun} years={years} onJump={changeYears} onClose={() => setSelectedId(null)} />
        </div>
      )}

      <div ref={timebarRef} className="absolute right-4 bottom-4 left-4 z-10 sm:right-7 sm:left-7">
        <TimeBar years={years} onChange={changeYears} playing={playing} onTogglePlay={togglePlay} sun={sun} headline={headline} />
      </div>
    </div>
  );
}
