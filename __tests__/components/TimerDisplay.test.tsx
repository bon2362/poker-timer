import { render } from '@testing-library/react';
import { TimerDisplay } from '@/components/TimerDisplay';
import type { LevelStage, BreakStage } from '@/types/timer';

const levelStage: LevelStage = {
  type: 'level',
  levelNum: 1,
  sb: 25,
  bb: 50,
  duration: 1200,
};

const breakStage: BreakStage = {
  type: 'break',
  duration: 600,
};

describe('TimerDisplay', () => {
  test('renders formatted time for a level stage (1200s → "20:00")', () => {
    const { getByText } = render(
      <TimerDisplay timeLeft={1200} stage={levelStage} isPaused={false} />
    );
    expect(getByText('20:00')).toBeInTheDocument();
  });

  test('applies text-red-500 when timeLeft < 0 (overtime)', () => {
    const { getByText } = render(
      <TimerDisplay timeLeft={-30} stage={levelStage} isPaused={false} />
    );
    // formatTime(-30) → "−00:30"
    const timerEl = getByText('−00:30');
    expect(timerEl).toHaveClass('text-red-500');
  });

  test('applies text-orange-400 when timeLeft <= 60 and stage is level (warning)', () => {
    const { getByText } = render(
      <TimerDisplay timeLeft={45} stage={levelStage} isPaused={false} />
    );
    const timerEl = getByText('00:45');
    expect(timerEl).toHaveClass('text-orange-400');
  });

  test('applies text-blue-400 when stage is break', () => {
    const { getByText } = render(
      <TimerDisplay timeLeft={300} stage={breakStage} isPaused={false} />
    );
    const timerEl = getByText('05:00');
    expect(timerEl).toHaveClass('text-blue-400');
  });

  test('applies text-white when timeLeft > 60 and stage is level (normal)', () => {
    const { getByText } = render(
      <TimerDisplay timeLeft={900} stage={levelStage} isPaused={false} />
    );
    const timerEl = getByText('15:00');
    expect(timerEl).toHaveClass('text-white');
  });

  test('shows "PAUSE" text when isPaused=true', () => {
    const { getByText } = render(
      <TimerDisplay timeLeft={1200} stage={levelStage} isPaused={true} />
    );
    expect(getByText('PAUSE')).toBeInTheDocument();
  });

  test('does not show "PAUSE" text when isPaused=false', () => {
    const { queryByText } = render(
      <TimerDisplay timeLeft={1200} stage={levelStage} isPaused={false} />
    );
    expect(queryByText('PAUSE')).not.toBeInTheDocument();
  });

  test('applies opacity-25 to timer when paused', () => {
    const { getByText } = render(
      <TimerDisplay timeLeft={1200} stage={levelStage} isPaused={true} />
    );
    const timerEl = getByText('20:00');
    expect(timerEl).toHaveClass('opacity-25');
  });

  test('applies opacity-100 to timer when not paused', () => {
    const { getByText } = render(
      <TimerDisplay timeLeft={1200} stage={levelStage} isPaused={false} />
    );
    const timerEl = getByText('20:00');
    expect(timerEl).toHaveClass('opacity-100');
  });

  test('progress bar uses bg-blue-600 for break stage', () => {
    const { container } = render(
      <TimerDisplay timeLeft={300} stage={breakStage} isPaused={false} />
    );
    const progressBar = container.querySelector('.bg-blue-600');
    expect(progressBar).toBeInTheDocument();
  });

  test('progress bar uses bg-orange-400 for warning state', () => {
    const { container } = render(
      <TimerDisplay timeLeft={45} stage={levelStage} isPaused={false} />
    );
    const progressBar = container.querySelector('.bg-orange-400');
    expect(progressBar).toBeInTheDocument();
  });

  test('progress bar uses bg-violet-700 for normal state', () => {
    const { container } = render(
      <TimerDisplay timeLeft={900} stage={levelStage} isPaused={false} />
    );
    const progressBar = container.querySelector('.bg-violet-700');
    expect(progressBar).toBeInTheDocument();
  });

  test('progress bar width is 50% when elapsed is half of duration', () => {
    // duration=1200, timeLeft=600 → elapsed=600, pct=50%
    const { container } = render(
      <TimerDisplay timeLeft={600} stage={levelStage} isPaused={false} />
    );
    const progressBar = container.querySelector('.bg-violet-700');
    expect(progressBar).toHaveStyle({ width: '50%' });
  });

  test('shows active players label when provided', () => {
    const { getByText } = render(
      <TimerDisplay timeLeft={1200} stage={levelStage} isPaused={false} activePlayersLabel="3 / 2" />
    );
    expect(getByText('В игре 3 / 2')).toBeInTheDocument();
  });
});
