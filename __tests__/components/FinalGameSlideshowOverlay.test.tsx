import { fireEvent, render, screen } from '@testing-library/react';
import {
  FinalGameSlideshowOverlay,
  getCurrentFinalSongLyric,
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
