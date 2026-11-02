import {
  getCurrentFinalSongLyric,
  getNextFinalSongLyric,
} from '@/components/FinalGameSlideshowOverlay';

class MockAudio {
  static instances: MockAudio[] = [];
  currentTime = 0;
  loop = false;
  src: string;
  pause = jest.fn();
  play = jest.fn(() => Promise.resolve());

  constructor(src: string) {
    this.src = src;
    MockAudio.instances.push(this);
  }
}

describe('FinalGameSlideshowOverlay', () => {
  const OriginalAudio = global.Audio;

  beforeEach(() => {
    jest.useFakeTimers();
    MockAudio.instances = [];
    global.Audio = MockAudio as unknown as typeof Audio;
  });

  afterEach(() => {
    jest.useRealTimers();
    global.Audio = OriginalAudio;
  });

  test('uses the current lyric cue for song time', () => {
    expect(getCurrentFinalSongLyric(0).text).toBe('Тусклый свет кухни');       // before first cue → returns first
    expect(getCurrentFinalSongLyric(44).text).toBe('Потная раздача, бьётся в тишине'); // chorus 1 starts at 43.3
    expect(getCurrentFinalSongLyric(218).text).toBe('А сегодня решает только флаг в картах'); // last cue at 215.4
  });
});

describe('getNextFinalSongLyric', () => {
  test('returns null before the first lyric cue', () => {
    expect(getNextFinalSongLyric(15)).toBeNull();
  });

  test('returns next cue when sitting on the first cue', () => {
    const next = getNextFinalSongLyric(16.1);
    expect(next?.text).toBe('Карты липнут к рукам');
  });

  test('returns null at the last lyric cue (no next exists)', () => {
    expect(getNextFinalSongLyric(215.4)).toBeNull();
  });
});
