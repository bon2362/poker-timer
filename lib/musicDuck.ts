import type { TimerState } from '@/types/timer';

/** How loud background music (Spotify, the break song) should be while the timer speaks. */
export type MusicDuck = { gain: number; rampMs: number };

export const DUCK_GAIN = 0.25;
// The longest phrase ("break starts") lasts about 2.3 s.
export const PHRASE_SECONDS = 3;
const FADE_OUT_SECONDS = 5;

const FULL: MusicDuck = { gain: 1, rampMs: 2500 };
const DUCKED: MusicDuck = { gain: DUCK_GAIN, rampMs: 800 };
const SILENT_NOW: MusicDuck = { gain: 0, rampMs: 300 };
const FADING_OUT: MusicDuck = { gain: 0, rampMs: 3000 };

type DuckInput = Pick<TimerState, 'stages' | 'currentStage' | 'timeLeft' | 'isPaused' | 'isOver'>;

export function musicDuck({ stages, currentStage, timeLeft, isPaused, isOver }: DuckInput): MusicDuck {
  if (isOver || isPaused) return FULL;
  const cur = stages[currentStage];
  if (!cur) return FULL;
  const prev = stages[currentStage - 1];
  const next = stages[currentStage + 1];
  const touchesBreak = (other: typeof cur | undefined) => cur.type === 'break' || other?.type === 'break';

  // The phrase that opened this stage: "break starts" / "break is over" alone, "blinds up" over quiet music.
  if (prev && cur.duration - timeLeft < PHRASE_SECONDS) return touchesBreak(prev) ? SILENT_NOW : DUCKED;

  if (next) {
    // The phrase that will open the next stage.
    if (touchesBreak(next)) {
      if (timeLeft <= FADE_OUT_SECONDS) return FADING_OUT;
    } else if (timeLeft <= 1) {
      return DUCKED;
    }
    // The one-minute warning (none before the tractor moment, which has its own sound).
    if (timeLeft <= 61 && timeLeft >= 58 && !isTractorAhead(stages, currentStage)) return DUCKED;
  }
  return FULL;
}

function isTractorAhead(stages: TimerState['stages'], currentStage: number): boolean {
  if (stages[currentStage].type !== 'level') return false;
  const nextLevel = stages.slice(currentStage + 1).find(s => s.type === 'level');
  return nextLevel?.type === 'level' && nextLevel.bb === 300;
}
