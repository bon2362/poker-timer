import type { Config, Stage } from '@/types/timer';

export function buildStages(config: Config): Stage[] {
  const levelDuration = config.levelDuration * 60;
  const breakDuration = config.breakDuration * 60;
  const result: Stage[] = [];

  for (let i = 0; i < config.blindLevels.length; i++) {
    const levelNum = i + 1;
    result.push({
      type: 'level',
      levelNum,
      sb: config.blindLevels[i].sb,
      bb: config.blindLevels[i].bb,
      duration: levelDuration,
    });
    const isLast = levelNum === config.blindLevels.length;
    if (levelNum % config.breakEvery === 0 && !isLast) {
      result.push({ type: 'break', duration: breakDuration });
    }
  }

  return result;
}

export function formatTime(seconds: number): string {
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const str = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return seconds < 0 ? `\u2212${str}` : str;
}

export function getNextInfo(stages: Stage[], currentStage: number): string {
  const next = stages[currentStage + 1];
  if (!next) return 'Tournament finale';

  if (next.type === 'break') {
    const afterBreak = stages[currentStage + 2];
    const afterStr = afterBreak && afterBreak.type === 'level'
      ? ` \u2192 then ${afterBreak.sb} / ${afterBreak.bb}`
      : '';
    const breakStage = stages[currentStage + 1];
    const breakMin = breakStage.type === 'break'
      ? breakStage.duration / 60
      : 10;
    return `\u2615 Break ${breakMin} min${afterStr}`;
  }

  if (next.type === 'level') {
    return `${next.sb} / ${next.bb}`;
  }

  return '';
}
