import { create } from 'zustand';
import { sliderToYears, yearsToSlider, T_MAX } from './lib/time';

export const MAX_WARP = 10;

/** Non-reactive scratch shared with the render loop */
export const sim = {
  /** transient speed-up of orbital motion while time is being scrubbed */
  warp: 0,
};

interface SimState {
  years: number;
  selectedId: string | null;
  hoveredId: string | null;
  playing: boolean;
  setYears: (y: number) => void;
  /** user-driven change: also kicks the orbital warp */
  scrub: (y: number) => void;
  select: (id: string | null) => void;
  hover: (id: string | null) => void;
  setPlaying: (p: boolean) => void;
  togglePlay: () => void;
}

export const useSim = create<SimState>((set, get) => ({
  years: 0,
  selectedId: null,
  hoveredId: null,
  playing: false,
  setYears: (years) => set({ years }),
  scrub: (years) => {
    const dv = Math.abs(yearsToSlider(years) - yearsToSlider(get().years));
    sim.warp = Math.min(MAX_WARP, sim.warp + dv * 120);
    set({ years });
  },
  select: (selectedId) => set({ selectedId }),
  hover: (hoveredId) => set({ hoveredId }),
  setPlaying: (playing) => set({ playing }),
  togglePlay: () => {
    const { playing, years } = get();
    if (!playing && yearsToSlider(years) >= 1) set({ years: 0 });
    set({ playing: !playing });
  },
}));

export { sliderToYears, yearsToSlider, T_MAX };
