import { cleanTrackName, currentLineIndex, parseLrc } from '@/lib/spotify/lyrics';

describe('spotify lyrics', () => {
  it('parses LRC into timed lines, skipping empty gaps and repeating multi-stamp lines', () => {
    const lines = parseLrc('[ar: someone]\n[00:12.50] First\n[00:20.00] \n[00:30.00][01:00.00] Chorus\n[00:25.10] Second');
    expect(lines).toEqual([
      { time: 12_500, text: 'First' },
      { time: 25_100, text: 'Second' },
      { time: 30_000, text: 'Chorus' },
      { time: 60_000, text: 'Chorus' },
    ]);
  });

  it('picks the line sounding at the playback position', () => {
    const lines = parseLrc('[00:10.00] A\n[00:20.00] B\n[00:30.00] C');
    expect(currentLineIndex(lines, 5_000)).toBe(-1);
    expect(currentLineIndex(lines, 10_000)).toBe(0);
    expect(currentLineIndex(lines, 29_999)).toBe(1);
    expect(currentLineIndex(lines, 300_000)).toBe(2);
  });

  it('strips Spotify title suffixes but keeps meaningful ones', () => {
    expect(cleanTrackName('Where the Wild Roses Grow - 2011 Remaster')).toBe('Where the Wild Roses Grow');
    expect(cleanTrackName('Song (feat. Someone) - Radio Edit')).toBe('Song');
    expect(cleanTrackName('Part One - Intro (Interlude)')).toBe('Part One - Intro (Interlude)');
  });
});
