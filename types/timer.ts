export type BlindLevel = {
  sb: number;
  bb: number;
};

export type Config = {
  levelDuration: number;   // минуты
  breakDuration: number;   // минуты
  breakEvery: number;
  showCombos: boolean;
  blindLevels: BlindLevel[];
};

export type LevelStage = {
  type: 'level';
  levelNum: number;
  sb: number;
  bb: number;
  duration: number;        // секунды
};

export type BreakStage = {
  type: 'break';
  duration: number;        // секунды
};

export type Stage = LevelStage | BreakStage;

export type SoundEvent =
  | 'warnBlinds'
  | 'blindsUp'
  | 'warnBreak'
  | 'breakStart'
  | 'warnEndBreak'
  | 'breakOver'
  | 'tick';

export type Screen = 'timer' | 'settings';

export type TimerState = {
  stages: Stage[];
  currentStage: number;
  timeLeft: number;        // секунды, может быть отрицательным (overtime)
  isPaused: boolean;
  isOver: boolean;
  warnedOneMin: boolean;
  config: Config;
  screen: Screen;
  pendingSound: SoundEvent | null;
};

export type Action =
  | { type: 'TICK' }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'NEXT_STAGE' }
  | { type: 'PREV_STAGE' }
  | { type: 'RESET_STAGE' }
  | { type: 'GO_TO_LAST' }
  | { type: 'RESTART' }
  | { type: 'OPEN_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; config: Config }
  | { type: 'CLOSE_SETTINGS' }
  | { type: 'CLEAR_SOUND' }
  | { type: 'TOGGLE_COMBOS' }
  | { type: 'JUMP_TO_END' }
  | { type: 'RESTORE_STATE'; payload: { currentStage: number; timeLeft: number; isPaused: boolean; isOver: boolean; warnedOneMin: boolean } };
