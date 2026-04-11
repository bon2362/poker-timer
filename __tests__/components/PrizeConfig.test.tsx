import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PrizeConfig } from '@/components/SessionSetup/PrizeConfig';

const DEFAULT_PCTS: Record<number, number[]> = {
  1: [100],
  2: [65, 35],
  3: [50, 30, 20],
  4: [45, 27, 18, 10],
  5: [40, 25, 17, 11, 7],
};

function setup(overrides: Partial<Parameters<typeof PrizeConfig>[0]> = {}) {
  const props = {
    spots: 3,
    pcts: [50, 30, 20],
    onSpotsChange: jest.fn(),
    onPctsChange: jest.fn(),
    ...overrides,
  };
  const result = render(<PrizeConfig {...props} />);
  return { ...result, props };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PrizeConfig', () => {
  test('renders correct number of spots', () => {
    setup({ spots: 3 });
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  test('renders correct number of pct inputs', () => {
    setup({ spots: 3, pcts: [50, 30, 20] });
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(3);
    expect((inputs[0] as HTMLInputElement).value).toBe('50');
    expect((inputs[1] as HTMLInputElement).value).toBe('30');
    expect((inputs[2] as HTMLInputElement).value).toBe('20');
  });

  test('clicking + increases spots and calls onSpotsChange and onPctsChange with DEFAULT_PCTS', async () => {
    const onSpotsChange = jest.fn();
    const onPctsChange = jest.fn();
    setup({ spots: 3, pcts: [50, 30, 20], onSpotsChange, onPctsChange });
    await userEvent.click(screen.getByRole('button', { name: '+' }));
    expect(onSpotsChange).toHaveBeenCalledWith(4);
    expect(onPctsChange).toHaveBeenCalledWith(DEFAULT_PCTS[4]);
  });

  test('clicking − decreases spots and calls onSpotsChange', async () => {
    const onSpotsChange = jest.fn();
    const onPctsChange = jest.fn();
    setup({ spots: 3, pcts: [50, 30, 20], onSpotsChange, onPctsChange });
    await userEvent.click(screen.getByRole('button', { name: '−' }));
    expect(onSpotsChange).toHaveBeenCalledWith(2);
    expect(onPctsChange).toHaveBeenCalledWith(DEFAULT_PCTS[2]);
  });

  test('clicking − when spots=1 does nothing', async () => {
    const onSpotsChange = jest.fn();
    setup({ spots: 1, pcts: [100], onSpotsChange });
    await userEvent.click(screen.getByRole('button', { name: '−' }));
    expect(onSpotsChange).not.toHaveBeenCalled();
  });

  test('clicking + when spots=8 does nothing', async () => {
    const onSpotsChange = jest.fn();
    setup({ spots: 8, pcts: [20, 15, 14, 13, 12, 11, 10, 5], onSpotsChange });
    await userEvent.click(screen.getByRole('button', { name: '+' }));
    expect(onSpotsChange).not.toHaveBeenCalled();
  });

  test('changing pct input calls onPctsChange with updated array', () => {
    const onPctsChange = jest.fn();
    setup({ spots: 3, pcts: [50, 30, 20], onPctsChange });
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '60' } });
    expect(onPctsChange).toHaveBeenCalledWith([60, 30, 20]);
  });

  test('shows ✓ when sum is 100', () => {
    setup({ spots: 3, pcts: [50, 30, 20] });
    expect(screen.getByText(/✓/)).toBeInTheDocument();
  });

  test('shows (нужно 100%) when sum is not 100', () => {
    setup({ spots: 3, pcts: [50, 30, 10] });
    expect(screen.getByText(/нужно 100%/)).toBeInTheDocument();
  });

  test('shows correct total sum', () => {
    setup({ spots: 3, pcts: [50, 30, 20] });
    expect(screen.getByText(/Итого: 100%/)).toBeInTheDocument();
  });
});
