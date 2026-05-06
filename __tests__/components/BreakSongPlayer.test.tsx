import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useBreakSong } from '@/components/BreakSongPlayer';

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

function TestHarness({ enabled }: { enabled: boolean }) {
  const { songPaused, toggleSong } = useBreakSong(enabled);
  return (
    <div>
      <div data-testid="paused">{String(songPaused)}</div>
      <button onClick={toggleSong}>toggle-song</button>
    </div>
  );
}

describe('useBreakSong', () => {
  const OriginalAudio = global.Audio;

  beforeEach(() => {
    MockAudio.instances = [];
    global.Audio = MockAudio as unknown as typeof Audio;
    localStorage.clear();
  });

  afterEach(() => {
    global.Audio = OriginalAudio;
  });

  test('persists paused preference between break song mounts', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<TestHarness enabled />);

    await waitFor(() => expect(MockAudio.instances[0].play).toHaveBeenCalledTimes(1));

    await user.click(screen.getByText('toggle-song'));

    expect(screen.getByTestId('paused')).toHaveTextContent('true');
    expect(localStorage.getItem('pokerTimerBreakSongPaused')).toBe('true');

    unmount();
    MockAudio.instances = [];

    render(<TestHarness enabled />);

    expect(screen.getByTestId('paused')).toHaveTextContent('true');
    expect(MockAudio.instances[0].play).not.toHaveBeenCalled();
  });

  test('resuming clears paused preference', async () => {
    localStorage.setItem('pokerTimerBreakSongPaused', 'true');
    const user = userEvent.setup();
    render(<TestHarness enabled />);

    await user.click(screen.getByText('toggle-song'));
    await act(async () => {});

    expect(screen.getByTestId('paused')).toHaveTextContent('false');
    expect(localStorage.getItem('pokerTimerBreakSongPaused')).toBe('false');
  });
});
