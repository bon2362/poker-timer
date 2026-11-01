import { render, screen } from '@testing-library/react';
import { SlideshowOverlay } from '@/components/SlideshowOverlay';

test('shows the supplied date instead of the date in the filename', () => {
  render(<SlideshowOverlay url="https://example.com/01-01-2020.jpg" date="01.11.2026" timeLeft={60} />);
  expect(screen.getByText('01.11.2026')).toBeInTheDocument();
  expect(screen.queryByText('1 января 2020')).not.toBeInTheDocument();
  expect(screen.getByText('01:00')).toBeInTheDocument();
});

test('changes the displayed date with the photo and clears it for an undated photo', () => {
  const { rerender } = render(<SlideshowOverlay url="https://example.com/a.jpg" date="01.11.2026" timeLeft={60} />);
  rerender(<SlideshowOverlay url="https://example.com/b.jpg" date="10.05.2026" timeLeft={60} />);
  expect(screen.queryByText('01.11.2026')).not.toBeInTheDocument();
  expect(screen.getByText('10.05.2026')).toBeInTheDocument();
  rerender(<SlideshowOverlay url="https://example.com/01-01-2020.jpg" date={null} timeLeft={60} />);
  expect(screen.queryByText('10.05.2026')).not.toBeInTheDocument();
  expect(screen.queryByText('1 января 2020')).not.toBeInTheDocument();
});

test('does not display a photo date when showing lyrics without a photo', () => {
  render(<SlideshowOverlay date="01.11.2026" timeLeft={60} showLyrics songTime={44} />);
  expect(screen.queryByText('01.11.2026')).not.toBeInTheDocument();
  expect(document.querySelectorAll('img')).toHaveLength(0);
});
