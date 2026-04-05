import { buildStages, formatTime, getNextInfo } from '@/lib/timer';
import { DEFAULT_CONFIG } from '@/lib/storage';
import type { Config } from '@/types/timer';

describe('buildStages', () => {
  test('returns 20 stages for default config (14 levels + 6 breaks)', () => {
    const stages = buildStages(DEFAULT_CONFIG);
    expect(stages).toHaveLength(20);
  });

  test('first stage is level 1 with correct blinds', () => {
    const stages = buildStages(DEFAULT_CONFIG);
    expect(stages[0]).toEqual({
      type: 'level',
      levelNum: 1,
      sb: 10,
      bb: 20,
      duration: 1200,
    });
  });

  test('break appears after every breakEvery levels', () => {
    const stages = buildStages(DEFAULT_CONFIG);
    // Level 1 at index 0, Level 2 at index 1, Break at index 2
    expect(stages[1].type).toBe('level');
    expect(stages[2].type).toBe('break');
  });

  test('no break after the last level', () => {
    const stages = buildStages(DEFAULT_CONFIG);
    expect(stages[stages.length - 1].type).toBe('level');
  });

  test('break duration uses config.breakDuration in seconds', () => {
    const cfg: Config = { ...DEFAULT_CONFIG, breakDuration: 5 };
    const stages = buildStages(cfg);
    const breakStage = stages.find(s => s.type === 'break')!;
    expect(breakStage.duration).toBe(300);
  });

  test('level duration uses config.levelDuration in seconds', () => {
    const cfg: Config = { ...DEFAULT_CONFIG, levelDuration: 15 };
    const stages = buildStages(cfg);
    expect(stages[0].duration).toBe(900);
  });
});

describe('formatTime', () => {
  test('formats 0 seconds as 00:00', () => {
    expect(formatTime(0)).toBe('00:00');
  });

  test('formats 1200 seconds as 20:00', () => {
    expect(formatTime(1200)).toBe('20:00');
  });

  test('formats 65 seconds as 01:05', () => {
    expect(formatTime(65)).toBe('01:05');
  });

  test('formats negative seconds with minus sign (overtime)', () => {
    expect(formatTime(-5)).toBe('\u221200:05');
    expect(formatTime(-70)).toBe('\u221201:10');
  });
});

describe('getNextInfo', () => {
  const stages = buildStages(DEFAULT_CONFIG);

  test('returns next blind levels when next stage is a level', () => {
    // After a break (index 2) comes level 3 (index 3): currentStage=2 → next is level
    const result = getNextInfo(stages, 2);
    expect(result).toBe('30 / 60');
  });

  test('returns break info when next stage is a break', () => {
    // currentStage=1 (level 2) → next is break (index 2)
    const result = getNextInfo(stages, 1);
    expect(result).toContain('Break');
    expect(result).toContain('30 / 60');
  });

  test('returns finale string when there is no next stage', () => {
    const result = getNextInfo(stages, stages.length - 1);
    expect(result).toBe('Tournament finale');
  });
});
