import { currentPosition, formatTrackTime } from '@/lib/spotify/progress';

describe('spotify track progress', () => {
  const progress = { position: 60_000, duration: 125_000, at: 1_000 };

  it('moves with the clock while playing, stands still on pause and stops at the end', () => {
    expect(currentPosition(progress, true, 11_000)).toBe(70_000);
    expect(currentPosition(progress, false, 11_000)).toBe(60_000);
    expect(currentPosition(progress, true, 500_000)).toBe(125_000);
    expect(formatTrackTime(currentPosition(progress, true, 11_000))).toBe('1:10');
  });
});
