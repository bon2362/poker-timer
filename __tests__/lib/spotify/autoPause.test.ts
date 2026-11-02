import { AutoPauseController } from '@/lib/spotify/autoPause';

function setup(initial: { playing: boolean; active: boolean }) {
  const env = { ...initial };
  const deps = {
    isPlayingHere: () => env.playing,
    isActiveHere: () => env.active,
    pause: jest.fn(async () => { env.playing = false; }),
    resume: jest.fn(async () => { env.playing = true; }),
  };
  return { env, deps, controller: new AutoPauseController(deps) };
}

describe('AutoPauseController', () => {
  test('pauses once for overlapping site sounds and resumes after the last one ends', () => {
    const { deps, controller } = setup({ playing: true, active: true });

    controller.hold('breakSong');
    controller.hold('winnerFanfare');
    expect(deps.pause).toHaveBeenCalledTimes(1);

    controller.release('breakSong');
    expect(deps.resume).not.toHaveBeenCalled();

    controller.release('winnerFanfare');
    expect(deps.resume).toHaveBeenCalledTimes(1);
  });

  test('does not resume music the user had paused or that moved to another device', () => {
    const paused = setup({ playing: false, active: true });
    paused.controller.hold('tractor');
    paused.controller.release('tractor');
    expect(paused.deps.pause).not.toHaveBeenCalled();
    expect(paused.deps.resume).not.toHaveBeenCalled();

    const moved = setup({ playing: true, active: true });
    moved.controller.hold('tractor');
    moved.env.active = false;
    moved.controller.release('tractor');
    expect(moved.deps.resume).not.toHaveBeenCalled();
  });
});
