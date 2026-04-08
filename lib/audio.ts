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

/** Синтезированные фанфары победителя: восходящая мелодия + аккорд + крещендо */
export function playWinnerFanfare(): void {
  try {
    const ctx = getAudioCtx();

    function playNote(freq: number, startTime: number, duration: number, volume = 0.4, type: OscillatorType = 'sine') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume, startTime + 0.03);
      gain.gain.setValueAtTime(volume, startTime + duration - 0.05);
      gain.gain.linearRampToValueAtTime(0, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    }

    const t = ctx.currentTime;

    // Восходящая фанфара (C4 E4 G4 C5)
    playNote(261.6, t + 0.0,  0.15, 0.5, 'triangle');
    playNote(329.6, t + 0.15, 0.15, 0.5, 'triangle');
    playNote(392.0, t + 0.30, 0.15, 0.5, 'triangle');
    playNote(523.3, t + 0.45, 0.40, 0.6, 'triangle');

    // Аккорд (C5 E5 G5) — торжественный
    playNote(523.3, t + 0.90, 0.8, 0.35, 'sine');
    playNote(659.3, t + 0.90, 0.8, 0.30, 'sine');
    playNote(784.0, t + 0.90, 0.8, 0.25, 'sine');

    // Аплодисменты — белый шум
    const bufferSize = ctx.sampleRate * 1.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.15;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = ctx.createGain();
    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseGain.gain.setValueAtTime(0, t + 0.8);
    noiseGain.gain.linearRampToValueAtTime(0.3, t + 1.1);
    noiseGain.gain.linearRampToValueAtTime(0, t + 2.3);
    noise.start(t + 0.8);
    noise.stop(t + 2.3);
  } catch {}
}
