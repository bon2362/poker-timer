import type { SoundEvent } from '@/types/timer';

const SOUND_FILES: Record<Exclude<SoundEvent, 'tick'>, string> = {
  warnBlinds:   '/audio/warn-blinds.mp3',
  blindsUp:     '/audio/blinds-up.mp3',
  warnBreak:    '/audio/warn-break.mp3',
  breakStart:   '/audio/break-start.mp3',
  warnEndBreak: '/audio/warn-end-break.mp3',
  breakOver:    '/audio/break-over.mp3',
};

let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

export function playSound(event: SoundEvent): void {
  if (event === 'tick') {
    playTick();
    return;
  }
  const src = SOUND_FILES[event];
  const audio = new Audio(src);
  audio.play().catch(() => {});
}

export function playTick(): void {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 1000;
    const start = ctx.currentTime;
    gain.gain.setValueAtTime(0.3, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.08);
    osc.start(start);
    osc.stop(start + 0.08);
  } catch {}
}
