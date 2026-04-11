import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Controls } from '@/components/Controls';

const defaultProps = {
  isPaused: false,
  isOver: false,
  visible: true,
  onPrev: jest.fn(),
  onTogglePause: jest.fn(),
  onNext: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Controls', () => {
  test('renders play button (▶) when isPaused=true', () => {
    render(<Controls {...defaultProps} isPaused={true} />);
    // The pause/play button has no title — find by checking buttons
    const buttons = screen.getAllByRole('button');
    const playPauseBtn = buttons.find(
      btn => !btn.getAttribute('title')
    )!;
    expect(playPauseBtn.textContent).toContain('▶');
  });

  test('renders pause button (⏸) when isPaused=false', () => {
    render(<Controls {...defaultProps} isPaused={false} />);
    const buttons = screen.getAllByRole('button');
    const playPauseBtn = buttons.find(
      btn => !btn.getAttribute('title')
    )!;
    expect(playPauseBtn.textContent).toContain('⏸');
  });

  test('clicking prev button calls onPrev', async () => {
    const onPrev = jest.fn();
    render(<Controls {...defaultProps} onPrev={onPrev} />);
    await userEvent.click(screen.getByTitle('Предыдущий уровень'));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  test('clicking pause/play button calls onTogglePause', async () => {
    const onTogglePause = jest.fn();
    render(<Controls {...defaultProps} onTogglePause={onTogglePause} />);
    const buttons = screen.getAllByRole('button');
    const playPauseBtn = buttons.find(btn => !btn.getAttribute('title'))!;
    await userEvent.click(playPauseBtn);
    expect(onTogglePause).toHaveBeenCalledTimes(1);
  });

  test('clicking next button calls onNext', async () => {
    const onNext = jest.fn();
    render(<Controls {...defaultProps} onNext={onNext} />);
    await userEvent.click(screen.getByTitle('Следующий уровень'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  test('play/pause button is disabled when isOver=true', () => {
    render(<Controls {...defaultProps} isOver={true} />);
    const buttons = screen.getAllByRole('button');
    const playPauseBtn = buttons.find(btn => !btn.getAttribute('title'))!;
    expect(playPauseBtn).toBeDisabled();
  });

  test('play/pause button is enabled when isOver=false', () => {
    render(<Controls {...defaultProps} isOver={false} />);
    const buttons = screen.getAllByRole('button');
    const playPauseBtn = buttons.find(btn => !btn.getAttribute('title'))!;
    expect(playPauseBtn).not.toBeDisabled();
  });

  test('container has opacity-100 when visible=true', () => {
    const { container } = render(<Controls {...defaultProps} visible={true} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('opacity-100');
  });

  test('container has opacity-0 when visible=false', () => {
    const { container } = render(<Controls {...defaultProps} visible={false} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('opacity-0');
  });
});
