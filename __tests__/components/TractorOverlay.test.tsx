import { render } from '@testing-library/react';
import TractorOverlay from '@/components/TractorOverlay';

describe('TractorOverlay', () => {
  beforeAll(() => {
    jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test('plays the full tractor sequence with its own audio from the start of the warning', () => {
    const { container } = render(
      <TractorOverlay timeLeft={60} isPaused={false} />
    );

    const video = container.querySelector('video');

    expect(video).toHaveAttribute('src', '/video/blind-300.mp4');
    expect(video).not.toHaveAttribute('muted');
    expect(video).not.toHaveAttribute('loop');
    expect(container.querySelector('audio')).not.toBeInTheDocument();
  });
});
