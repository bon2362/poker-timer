import { Fader } from '@/lib/fader';

describe('Fader', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('moves the volume step by step and gives way to a newer fade', async () => {
    const applied: number[] = [];
    const fader = new Fader(v => applied.push(v), 1);

    const fadeOut = fader.rampTo(0, 1000);
    jest.advanceTimersByTime(500);
    expect(fader.value).toBeCloseTo(0.5);

    const fadeIn = fader.rampTo(1, 500);
    jest.advanceTimersByTime(500);
    await expect(fadeOut).resolves.toBe(false);
    await expect(fadeIn).resolves.toBe(true);
    expect(fader.value).toBe(1);
    expect(applied.at(-1)).toBe(1);
  });
});
