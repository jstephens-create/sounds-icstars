// One place that decides how much the interface may move, plus the shared composition clock.
//
// Three timing systems are kept apart (see docs/technical-architecture.md §9):
//   1. scene.tau   — ambient clock: wall-clock seconds × motion scale. Drives all autonomous motion.
//   2. audio.currentTime — playback clock: identity events only (main.ts, timeline).
//   3. interaction state — hovered / selected member (main.ts).

export type MotionLevel = 'still' | 'low' | 'normal' | 'high';
export const MOTION_LEVELS: MotionLevel[] = ['still', 'low', 'normal', 'high'];
const SCALE: Record<MotionLevel, number> = { still: 0, low: 0.45, normal: 1, high: 1.6 };

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

let chosen: MotionLevel | null = null; // the visitor's explicit choice beats the system setting

export const motion = {
  /** System "reduce motion" → STILL unless the visitor picks a level in the controls. */
  level(): MotionLevel {
    return chosen ?? (reducedMotion.matches ? 'still' : 'normal');
  },
  scale(): number {
    return SCALE[this.level()];
  },
  still(): boolean {
    return this.level() === 'still';
  },
  set(level: MotionLevel | null): void {
    chosen = level;
  },
};

/** Fraction to move toward a target this frame for an ease with time constant tauMs (1 = jump, when still). */
export function easeStep(dtMs: number, tauMs: number): number {
  return motion.still() ? 1 : 1 - Math.exp(-dtMs / tauMs);
}

/** Shared composition state, updated once per frame in main.ts and read by every system. */
export interface Scene {
  tau: number; // ambient clock (s): wall time × motion scale, so changing level never jumps
  perf: number; // 0 = ambient composition, 1 = performance (song playing); eased, never a hard cut
  pulse: number; // 1 at an identity change, decays to 0 in ~0.6 s
}
