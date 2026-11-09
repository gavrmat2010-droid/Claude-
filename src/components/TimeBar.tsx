import type { SunState } from '../lib/sun';
import { formatNumber, formatYears, formatYearsShort, sliderToYears, yearsToSlider } from '../lib/time';

interface Props {
  years: number;
  onChange: (years: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
  sun: SunState;
  /** one-line summary of what is happening in the system right now */
  headline: string;
}

const TICKS = [-4.6e9, -2.5e9, -6e8, 0, 1e8, 1e9, 5e9, 7e9, 1e10];
const MOBILE_TICKS = new Set([-4.6e9, 0, 1e9, 1e10]);
const STEPS = 1000;

function fmtSolar(v: number, unit: string): string {
  if (v < 0.01) return `<0,01 ${unit}`;
  return `${formatNumber(v, v < 10 ? 2 : 0)} ${unit}`;
}

const PHASE_COLOR: Record<SunState['phase'], string> = {
  protostar: '#ffb070',
  main: '#ffd36b',
  subgiant: '#ffb347',
  rgb: '#ff5a1a',
  helium: '#ffd36b',
  agb: '#ff3b2e',
  nebula: '#d946ef',
  wd: '#bcd3ff',
};

export default function TimeBar({ years, onChange, playing, onTogglePlay, sun, headline }: Props) {
  const sliderValue = Math.round(yearsToSlider(years) * STEPS);
  const isNow = Math.abs(years) < 5e3;

  return (
    <div className="glass px-4 pt-3 pb-4 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold tracking-[0.18em] text-white/45 uppercase">Время</div>
          <div className="truncate text-2xl leading-tight font-extrabold tracking-tight text-white sm:text-3xl">{formatYears(years)}</div>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-white/70 sm:justify-center">
          <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: PHASE_COLOR[sun.phase], boxShadow: `0 0 10px ${PHASE_COLOR[sun.phase]}` }} />
          <span className="truncate">
            <span className="font-semibold text-white/90">{sun.phaseName}</span>
            <span className="hidden text-white/50 sm:inline">
              {' '}
              · {fmtSolar(sun.radius, 'R☉')} · {fmtSolar(sun.luminosity, 'L☉')}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange(0)}
            disabled={isNow && !playing}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/12 disabled:cursor-default disabled:opacity-40"
          >
            Сейчас
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              playing
                ? 'border-amber-300/40 bg-amber-300/15 text-amber-100 hover:bg-amber-300/25'
                : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/12'
            }`}
          >
            {playing ? (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <rect x="1" y="1" width="3" height="8" rx="0.5" />
                <rect x="6" y="1" width="3" height="8" rx="0.5" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <path d="M2 1.2v7.6a.5.5 0 0 0 .76.43l6-3.8a.5.5 0 0 0 0-.86l-6-3.8A.5.5 0 0 0 2 1.2z" />
              </svg>
            )}
            {playing ? 'Пауза' : 'Запустить время'}
          </button>
        </div>
      </div>

      <div className="mt-3">
        <input
          type="range"
          className="time-slider"
          min={-STEPS}
          max={STEPS}
          step={1}
          value={sliderValue}
          aria-label="Шкала времени"
          aria-valuetext={formatYears(years)}
          onChange={(e) => onChange(sliderToYears(Number(e.target.value) / STEPS))}
        />
        <div className="relative mt-1.5 h-4 text-[10px] text-white/45">
          {TICKS.map((t, i) => {
            const pos = ((yearsToSlider(t) + 1) / 2) * 100;
            const isZero = t === 0;
            const edge = i === 0 ? 'translate-x-0' : i === TICKS.length - 1 ? '-translate-x-full' : '-translate-x-1/2';
            return (
              <span
                key={t}
                className={`absolute whitespace-nowrap ${edge} ${isZero ? 'font-semibold text-white/80' : ''} ${
                  MOBILE_TICKS.has(t) ? '' : 'hidden sm:inline'
                }`}
                style={{ left: `${pos}%` }}
              >
                {formatYearsShort(t)}
              </span>
            );
          })}
        </div>
      </div>

      <p key={headline} className="fade-up mt-2 truncate text-xs text-white/60" title={headline}>
        {headline}
      </p>
    </div>
  );
}
