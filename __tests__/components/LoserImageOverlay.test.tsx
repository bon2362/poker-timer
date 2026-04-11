import { act, fireEvent, render, screen } from '@testing-library/react';
import { LoserImageOverlay } from '@/components/LoserImageOverlay';
import type { LevelStage } from '@/types/timer';

const stage: LevelStage = {
  type: 'level',
  levelNum: 1,
  sb: 25,
  bb: 50,
  duration: 1200,
};

function renderOverlay(onClose = jest.fn()) {
  render(
    <LoserImageOverlay
      imageUrl="https://example.com/loser.jpg"
      playerName="Alice"
      timeLeft={600}
      stage={stage}
      isPaused={false}
      onClose={onClose}
    />
  );
  return { onClose };
}

describe('LoserImageOverlay', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('closes after 30 seconds', () => {
    const onClose = jest.fn();
    renderOverlay(onClose);

    act(() => { jest.advanceTimersByTime(29999); });
    expect(onClose).not.toHaveBeenCalled();

    act(() => { jest.advanceTimersByTime(1); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('shows skip button on mouse movement and hides it after inactivity', () => {
    renderOverlay();
    const skipButton = screen.getByRole('button', { name: 'Пропустить' });

    expect(skipButton).toHaveClass('opacity-0');

    fireEvent.mouseMove(document);
    expect(skipButton).toHaveClass('opacity-100');

    act(() => { jest.advanceTimersByTime(2500); });
    expect(skipButton).toHaveClass('opacity-0');
  });

  test('clicking skip closes immediately', () => {
    const onClose = jest.fn();
    renderOverlay(onClose);

    fireEvent.mouseMove(document);
    fireEvent.click(screen.getByRole('button', { name: 'Пропустить' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
