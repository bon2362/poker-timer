import { musicDuck, DUCK_GAIN } from '@/lib/musicDuck';
import type { Stage } from '@/types/timer';

const level = (bb: number): Stage => ({ type: 'level', sb: bb / 2, bb, duration: 600 }) as Stage;
const pause: Stage = { type: 'break', duration: 300 } as Stage;
const stages = [level(20), level(40), pause, level(60)];

const at = (currentStage: number, timeLeft: number, isPaused = false) =>
  musicDuck({ stages, currentStage, timeLeft, isPaused, isOver: false }).gain;

describe('musicDuck', () => {
  it('silences music around break phrases and lowers it around other phrases', () => {
    expect(at(1, 300)).toBe(1);
    expect(at(1, 5)).toBe(0);          // level → break: fade out before "break starts"
    expect(at(2, 299)).toBe(0);        // the "break starts" phrase plays clean
    expect(at(2, 200)).toBe(1);
    expect(at(2, 4)).toBe(0);          // break → level: fade out before "break is over"
    expect(at(3, 599)).toBe(0);
    expect(at(0, 1)).toBe(DUCK_GAIN);  // level → level: lowered for "blinds up"
    expect(at(1, 599)).toBe(DUCK_GAIN);
    expect(at(0, 60)).toBe(DUCK_GAIN); // one-minute warning
    expect(at(1, 5, true)).toBe(1);    // a paused timer says nothing
  });
});
