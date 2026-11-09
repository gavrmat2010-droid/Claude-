import type { BodyState } from '../lib/state';

interface Props {
  states: BodyState[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function BodyStrip({ states, selectedId, onSelect }: Props) {
  return (
    <nav className="thin-scroll flex gap-1.5 overflow-x-auto pb-1" aria-label="Выбор тела">
      {states.map((st) => {
        const active = st.body.id === selectedId;
        return (
          <button
            key={st.body.id}
            type="button"
            onClick={() => onSelect(st.body.id)}
            title={st.gone ? `${st.body.name} — поглощена Солнцем` : st.body.name}
            className={`group flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium backdrop-blur-md transition ${
              active
                ? 'border-white/40 bg-white/15 text-white'
                : 'border-white/8 bg-black/30 text-white/65 hover:border-white/20 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span
              className="h-2.5 w-2.5 rounded-full transition"
              style={{
                background: st.gone
                  ? 'transparent'
                  : `radial-gradient(circle at 35% 35%, ${st.look.color2}, ${st.look.color} 60%)`,
                boxShadow: st.gone ? 'inset 0 0 0 1.5px rgba(255,255,255,0.3)' : `0 0 8px ${st.look.color}88`,
              }}
            />
            <span className={st.gone ? 'line-through decoration-white/40' : ''}>{st.body.name}</span>
          </button>
        );
      })}
    </nav>
  );
}
