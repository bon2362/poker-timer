const STEP_MS = 100;

/** Moves a volume (0..1) to a target in small steps. A newer fade replaces the running one. */
export class Fader {
  private timer: ReturnType<typeof setInterval> | null = null;
  private finish: ((completed: boolean) => void) | null = null;

  constructor(private apply: (value: number) => void, public value = 1) {}

  /** Resolves true when the target is reached, false when another fade took over. */
  rampTo(target: number, ms: number): Promise<boolean> {
    this.stop(false);
    if (ms <= 0 || target === this.value) {
      this.set(target);
      return Promise.resolve(true);
    }
    const from = this.value;
    const steps = Math.max(1, Math.round(ms / STEP_MS));
    let step = 0;
    return new Promise(resolve => {
      this.finish = resolve;
      this.timer = setInterval(() => {
        step += 1;
        this.set(step >= steps ? target : from + ((target - from) * step) / steps);
        if (step >= steps) this.stop(true);
      }, STEP_MS);
    });
  }

  /** Jumps straight to a value, cancelling any fade. */
  setNow(value: number): void {
    this.stop(false);
    this.set(value);
  }

  dispose(): void {
    this.stop(false);
  }

  private set(value: number): void {
    this.value = value;
    this.apply(value);
  }

  private stop(completed: boolean): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const finish = this.finish;
    this.finish = null;
    finish?.(completed);
  }
}
