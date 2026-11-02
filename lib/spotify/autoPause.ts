export type SiteAudioId = 'breakSong' | 'tractor' | 'finalSlideshow' | 'winnerFanfare';

export type AutoPauseDeps = {
  isPlayingHere(): boolean;
  isActiveHere(): boolean;
  pause(): Promise<void>;
  resume(): Promise<void>;
};

/** Pauses Spotify while site sounds play and resumes it after the last one ends. */
export class AutoPauseController {
  private holds = new Set<SiteAudioId>();
  private pausedByUs = false;

  constructor(private deps: AutoPauseDeps) {}

  hold(id: SiteAudioId): void {
    if (this.holds.has(id)) return;
    this.holds.add(id);
    if (this.holds.size === 1 && this.deps.isPlayingHere()) {
      this.pausedByUs = true;
      this.deps.pause().catch(() => {});
    }
  }

  release(id: SiteAudioId): void {
    if (!this.holds.delete(id)) return;
    if (this.holds.size > 0 || !this.pausedByUs) return;
    this.pausedByUs = false;
    if (this.deps.isActiveHere()) this.deps.resume().catch(() => {});
  }

  /** The user took over playback while site sounds play — don't resume on their behalf. */
  forgetPause(): void {
    this.pausedByUs = false;
  }

  activeHolds(): SiteAudioId[] {
    return Array.from(this.holds);
  }
}
