import { useEffect, useRef } from 'react';
import type { Body } from '../data/bodies';
import type { BodyState } from '../lib/state';
import type { SunState } from '../lib/sun';
import { formatNumber, formatYears } from '../lib/time';

interface Props {
  state: BodyState | null;
  sun: SunState;
  years: number;
  onJump: (years: number) => void;
  onClose: () => void;
}

function plural(n: number, one: string, few: string, many: string): string {
  const i = Math.round(n);
  if (Math.abs(n - i) > 1e-9) return few; // "1,9 года"
  const m10 = i % 10;
  const m100 = i % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function fmtDays(years: number): string {
  if (years < 1) {
    const d = Math.round(years * 365.25);
    return `${formatNumber(d, 0)} ${plural(d, 'день', 'дня', 'дней')}`;
  }
  const y = years < 10 ? Math.round(years * 10) / 10 : Math.round(years);
  return `${formatNumber(y, 1)} ${plural(y, 'год', 'года', 'лет')}`;
}

function fmtDay(hours: number): string {
  if (hours < 48) return `${formatNumber(hours, 1)} ч`;
  return `${formatNumber(hours / 24, 0)} земных суток`;
}

function fmtMass(m: number): string {
  if (m === 1) return '1 земная';
  if (m >= 1000) return `${formatNumber(m, 0)} земных`;
  if (m >= 1) return `${formatNumber(m, 1)} земных`;
  return `${formatNumber(m, 3)} земной`;
}

function fmtTemp(c: number | null): string {
  if (c === null) return '—';
  const sign = c < 0 ? '−' : c > 0 ? '+' : '';
  return `${sign}${formatNumber(Math.abs(c), 0)} °C`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/6 bg-white/4 px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/45">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-white/90">{value}</div>
      {hint && <div className="text-[10px] text-white/40">{hint}</div>}
    </div>
  );
}

function statusChip(state: BodyState) {
  if (state.gone) return { text: 'Поглощена Солнцем', cls: 'bg-red-500/15 text-red-300 border-red-400/30' };
  if (state.look.forming) return { text: 'Формируется', cls: 'bg-amber-400/15 text-amber-200 border-amber-300/30' };
  if (state.look.molten) return { text: 'Расплавлена', cls: 'bg-orange-500/15 text-orange-200 border-orange-400/30' };
  if (state.look.frozen) return { text: 'Замёрзла', cls: 'bg-sky-400/15 text-sky-200 border-sky-300/30' };
  return null;
}

function Welcome() {
  return (
    <div className="fade-up space-y-4 p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Как это работает</div>
      <ol className="space-y-3 text-sm leading-relaxed text-white/80">
        <li className="flex gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">1</span>
          <span>
            <b className="text-white">Нажмите на планету</b> или на Солнце — откроется карточка с фактами и историей этого мира.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">2</span>
          <span>
            <b className="text-white">Перематывайте время</b> ползунком внизу — от рождения Солнечной системы до её конца через миллиарды лет.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">3</span>
          <span>
            <b className="text-white">Смотрите, что происходит</b>: Солнце раздувается в красного гиганта, океаны Земли испаряются, кольца Сатурна тают, а Плутон оттаивает.
          </span>
        </li>
      </ol>
      <p className="text-xs leading-relaxed text-white/45">
        Сроки событий — оценки по современным астрофизическим моделям; орбиты и размеры показаны в условном масштабе, чтобы все планеты были видны.
      </p>
    </div>
  );
}

export default function InfoPanel({ state, sun, years, onJump, onClose }: Props) {
  const scrollRef = useRef<HTMLElement>(null);
  const chronicleRef = useRef<HTMLOListElement>(null);
  const activeEraRef = useRef<HTMLButtonElement>(null);

  // a new body: start from the top of its card
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [state?.body.id]);

  // keep the active era visible inside the chronicle without scrolling the whole panel
  useEffect(() => {
    const list = chronicleRef.current;
    const el = activeEraRef.current;
    if (!list || !el) return;
    const listRect = list.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const target = list.scrollTop + (elRect.top - listRect.top) - list.clientHeight / 2 + elRect.height / 2;
    list.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [state?.era.from, state?.body.id]);

  if (!state) {
    return (
      <aside className="glass thin-scroll max-h-full overflow-y-auto">
        <Welcome />
      </aside>
    );
  }

  const body: Body = state.body;
  const isSun = body.id === 'sun';
  const chip = statusChip(state);
  const orbitChanged = !isSun && Math.abs(state.orbitAU / body.orbitAU - 1) > 0.01;

  return (
    <aside ref={scrollRef} className="glass thin-scroll max-h-full overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 rounded-t-[18px] border-b border-white/6 bg-[#0a0f1f]/80 px-5 pt-4 pb-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <span
            className="h-9 w-9 shrink-0 rounded-full shadow-lg"
            style={{
              background: `radial-gradient(circle at 35% 35%, ${state.look.color2}, ${state.look.color} 55%, #000 130%)`,
              boxShadow: `0 0 18px ${state.look.color}66`,
              opacity: state.gone ? 0.35 : 1,
            }}
          />
          <div>
            <h2 className="text-lg leading-tight font-bold text-white">{body.name}</h2>
            <div className="text-xs text-white/50">{body.kind}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
          aria-label="Закрыть"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      </div>

      <div className="space-y-5 px-5 pt-4 pb-5">
        <section
          key={`${body.id}-${state.era.from}`}
          className="fade-up rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 to-white/2 p-4"
        >
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-white/50 uppercase">
            <span className="pulse-soft inline-block h-1.5 w-1.5 rounded-full bg-amber-300" />
            {formatYears(years)}
            {chip && <span className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] tracking-normal normal-case ${chip.cls}`}>{chip.text}</span>}
          </div>
          <h3 className="mt-2 text-base leading-snug font-bold text-white">{state.era.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-white/80">{state.era.text}</p>
        </section>

        <section className="grid grid-cols-2 gap-2">
          {isSun ? (
            <>
              <Stat label="Фаза" value={sun.phaseName} />
              <Stat label="Радиус" value={`${formatNumber(sun.radius, sun.radius < 10 ? 2 : 0)} R☉`} hint="в современных радиусах" />
              <Stat label="Светимость" value={sun.luminosity < 0.01 ? '<0,01 L☉' : `${formatNumber(sun.luminosity, sun.luminosity < 10 ? 2 : 0)} L☉`} hint="относительно сегодняшней" />
              <Stat label="Температура поверхности" value={`${formatNumber(sun.temp, 0)} K`} />
              <Stat label="Масса" value={`${formatNumber(sun.mass, 2)} M☉`} />
              <Stat label="Диаметр сегодня" value={`${formatNumber(body.diameterKm, 0)} км`} />
            </>
          ) : (
            <>
              <Stat
                label="Расстояние от Солнца"
                value={`${formatNumber(state.orbitAU, state.orbitAU < 10 ? 2 : 1)} а.е.`}
                hint={orbitChanged ? `сегодня ${formatNumber(body.orbitAU, 2)} а.е.` : undefined}
              />
              <Stat label="Температура" value={fmtTemp(state.tempC)} hint="средняя, оценка" />
              <Stat label="Год" value={fmtDays(state.periodYears)} />
              <Stat label="Сутки" value={fmtDay(body.dayHours)} />
              <Stat label="Диаметр" value={`${formatNumber(body.diameterKm, 0)} км`} />
              <Stat label="Масса" value={fmtMass(body.massEarth)} />
              <Stat label="Гравитация" value={`${formatNumber(body.gravityG, 2)} g`} />
              <Stat label="Спутники" value={`${body.moons}`} hint="известных сегодня" />
            </>
          )}
        </section>

        <section>
          <p className="text-sm leading-relaxed text-white/75">{body.description}</p>
          <ul className="mt-3 space-y-1.5">
            {body.facts.map((f) => (
              <li key={f} className="flex gap-2 text-xs leading-relaxed text-white/60">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-white/40" />
                {f}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <div className="mb-2 text-[11px] font-semibold tracking-[0.18em] text-white/45 uppercase">Хроника</div>
          <ol ref={chronicleRef} className="thin-scroll relative ml-1.5 max-h-64 overflow-y-auto border-l border-white/10">
            {body.eras.map((era) => {
              const active = era.from === state.era.from;
              return (
                <li key={era.from} className="relative pl-4">
                  <span
                    className={`absolute top-[11px] -left-[4.5px] h-2 w-2 rounded-full ${active ? 'bg-amber-300 shadow-[0_0_10px_#fcd34d]' : era.gone ? 'bg-red-400/60' : 'bg-white/25'}`}
                  />
                  <button
                    ref={active ? activeEraRef : undefined}
                    type="button"
                    onClick={() => onJump(era.from)}
                    className={`w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-white/6 ${active ? 'bg-white/6' : ''}`}
                  >
                    <div className={`text-[10px] font-medium ${active ? 'text-amber-200' : 'text-white/40'}`}>{formatYears(era.from)}</div>
                    <div className={`text-sm ${active ? 'font-semibold text-white' : 'text-white/70'}`}>{era.title}</div>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </aside>
  );
}
