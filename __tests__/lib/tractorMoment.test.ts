import * as timer from '@/lib/timer';

const shouldShowSidePanels = (timer as Record<string, unknown>).shouldShowSidePanels as
  | ((tractorMomentActive: boolean) => boolean)
  | undefined;

describe('shouldShowSidePanels', () => {
  test('hides both side panels while the blind 300 video is playing', () => {
    expect(shouldShowSidePanels).toEqual(expect.any(Function));
    expect(shouldShowSidePanels?.(true)).toBe(false);
  });

  test('restores side panels after the blind 300 video ends', () => {
    expect(shouldShowSidePanels).toEqual(expect.any(Function));
    expect(shouldShowSidePanels?.(false)).toBe(true);
  });
});
