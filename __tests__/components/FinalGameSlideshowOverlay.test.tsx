import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  FinalGameSlideshowOverlay,
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

  test('starts the final song loop', () => {
    render(
      <FinalGameSlideshowOverlay
        urls={['https://example.com/a.jpg']}
        controlsVisible
        onFinish={jest.fn()}
      />
    );

    expect(MockAudio.instances).toHaveLength(1);
    expect(MockAudio.instances[0].src).toBe('/audio/sweaty-hand.mp3');
    expect(MockAudio.instances[0].loop).toBe(true);
    expect(MockAudio.instances[0].play).toHaveBeenCalledTimes(1);
  });

  test('shows fallback background when urls is empty', () => {
    render(
      <FinalGameSlideshowOverlay urls={[]} controlsVisible={false} onFinish={jest.fn()} />
    );
    expect(document.querySelectorAll('img')).toHaveLength(0);
  });

  test('renders custom finishLabel on the button', () => {
    render(
      <FinalGameSlideshowOverlay
        urls={['https://example.com/a.jpg']}
        controlsVisible
        onFinish={jest.fn()}
        finishLabel="Выход"
      />
    );
    expect(screen.getByRole('button', { name: 'Выход' })).toBeInTheDocument();
  });

  test('shows tap-to-resume hint when audio.play() is blocked', async () => {
    const blockedPlay = jest.fn(() => Promise.reject(new Error('NotAllowedError')));
    class BlockedAudio {
      src: string;
      loop = false;
      currentTime = 0;
      play = blockedPlay;
      pause = jest.fn();
      constructor(src: string) { this.src = src; }
    }
    global.Audio = BlockedAudio as unknown as typeof Audio;

    render(
      <FinalGameSlideshowOverlay
        urls={['https://example.com/a.jpg']}
        controlsVisible
        onFinish={jest.fn()}
      />
    );
    await act(async () => {});
    expect(screen.getByText(/Нажмите на экран/)).toBeInTheDocument();
  });

  test('cycles to second image after 5 seconds when multiple URLs provided', () => {
    const urls = [
      'https://example.com/a.jpg',
      'https://example.com/b.jpg',
      'https://example.com/c.jpg',
    ];
    render(
      <FinalGameSlideshowOverlay urls={urls} controlsVisible={false} onFinish={jest.fn()} />
    );

    // Initially only slot A renders (2 imgs: blur + main)
    expect(document.querySelectorAll('img')).toHaveLength(2);

    act(() => { jest.advanceTimersByTime(5000); });

    // Slot B is now set and rendered (4 imgs total)
    expect(document.querySelectorAll('img')).toHaveLength(4);
  });

  test('finish button follows control visibility and calls onFinish', () => {
    const onFinish = jest.fn();
    const { rerender } = render(
      <FinalGameSlideshowOverlay
        urls={['https://example.com/a.jpg']}
        controlsVisible={false}
        onFinish={onFinish}
      />
    );

    const button = screen.getByRole('button', { name: 'Завершить' });
    expect(button).toHaveClass('opacity-0');

    rerender(
      <FinalGameSlideshowOverlay
        urls={['https://example.com/a.jpg']}
        controlsVisible
        onFinish={onFinish}
      />
    );

    expect(button).toHaveClass('opacity-100');
    fireEvent.click(button);
    expect(onFinish).toHaveBeenCalledTimes(1);
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
