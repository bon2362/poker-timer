'use client';
import { useEffect, useState } from 'react';
import { useSpotify } from '@/context/SpotifyContext';
import { SpotifySearchDialog } from './SpotifySearchDialog';
import { SpotifyEqualizer } from './SpotifyEqualizer';
import type { SpotifyPlaylistItem } from '@/lib/spotify/api';
import { currentPosition, formatTrackTime } from '@/lib/spotify/progress';

type Props = {
  canControl: boolean;
  controlsVisible: boolean;
  // The game panel covers the left 360px; the player then starts right of it.
  panelOpen: boolean;
  onPlayDuringBreakSong: () => void;
};

const iconButton = 'flex h-8 w-8 shrink-0 items-center justify-center border-none bg-transparent p-0 text-[#999] cursor-pointer transition-colors hover:text-[#ddd] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-[#999]';
const textButton = 'border-none bg-transparent p-0 text-[15px] text-[#ccc] cursor-pointer transition-colors hover:text-white';

// The native range thumb travels between its half-widths: 7px from each end of the 96px track.
const VOLUME_TRACK = 96;
const THUMB_HALF = 7;

export function SpotifyMiniPlayer({ canControl, controlsVisible, panelOpen, onPlayDuringBreakSong }: Props) {
  const spotify = useSpotify();
  const [searchOpen, setSearchOpen] = useState(false);
  // Hovering keeps the player open and adds the track time and the next track.
  const [hovered, setHovered] = useState(false);
  const [scrubMs, setScrubMs] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const ticking = Boolean(hovered && spotify?.isPlaying && spotify.progress);
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [ticking]);

  if (!spotify || spotify.status === 'disabled') return null;

  const { status, track, nextTrack, progress, isPlaying, isActiveHere, playingElsewhere, activeHolds, lastPlaylist, volume, errorMessage, notice } = spotify;
  const scrubbing = scrubMs !== null;
  const showControls = canControl && (controlsVisible || hovered || scrubbing);
  const onlyBreakSong = activeHolds.length > 0 && activeHolds.every(id => id === 'breakSong');
  const playBlocked = activeHolds.length > 0 && !onlyBreakSong;
  const hereTrack = track && isActiveHere ? track : null;

  const handlePlayPause = () => {
    if (!isPlaying && onlyBreakSong) onPlayDuringBreakSong();
    spotify.togglePlay();
  };

  // Same rule as ▶: the break song gives way, other site sounds block playback.
  const handlePick = (item: SpotifyPlaylistItem) => {
    if (playBlocked) return;
    if (onlyBreakSong) onPlayDuringBreakSong();
    spotify.playPlaylist(item);
  };

  const nowPlaying = hereTrack
    ? `${hereTrack.artists} — ${hereTrack.name}`
    : playingElsewhere ? 'Музыка играет на другом устройстве' : null;

  // Idle with nothing to show: no empty box on screen.
  if (!showControls && !nowPlaying) return null;

  const position = `fixed bottom-7 z-[70] flex flex-col items-start gap-1.5 transition-[left] duration-500 ${panelOpen ? 'left-[388px]' : 'left-7'}`;
  const strip = 'flex max-w-[calc(100vw-56px)] rounded-xl bg-black/40 pr-[18px] animate-fade-in';

  if (!showControls) {
    return (
      <div className={position}>
        <div className="flex max-w-[45vw] items-center gap-2.5 p-1 text-[17px] text-[#5a5a5a]">
          <SpotifyEqualizer playing={isPlaying && isActiveHere} />
          <span className="truncate">{nowPlaying}</span>
        </div>
      </div>
    );
  }

  const title = hereTrack?.name ?? (playingElsewhere ? 'Музыка играет на другом устройстве' : lastPlaylist?.name ?? 'Spotify');
  const subtitle = hereTrack?.artists ?? (playingElsewhere ? null : lastPlaylist ? 'Плейлист' : 'Выберите музыку в поиске');
  const volumeFill = THUMB_HALF + volume * (VOLUME_TRACK - 2 * THUMB_HALF);
  const expanded = (hovered || scrubbing) && Boolean(hereTrack && progress);
  const shownPosition = scrubMs ?? (progress ? currentPosition(progress, isPlaying, now) : 0);
  const progressPercent = progress && progress.duration > 0 ? (shownPosition / progress.duration) * 100 : 0;

  const commitScrub = () => {
    if (scrubMs === null) return;
    spotify.seek(scrubMs);
    setScrubMs(null);
  };

  return (
    <>
      <div className={position} onMouseEnter={() => { setNow(Date.now()); setHovered(true); }} onMouseLeave={() => setHovered(false)}>
        {status === 'ready' ? (
          <div className={`${strip} flex-col gap-2.5 pl-2 pt-2 ${expanded ? 'pb-3 outline outline-[#2e2e2e]' : 'pb-2'}`}>
          <div className="flex items-center gap-4">
            {hereTrack?.imageUrl
              ? <img src={hereTrack.imageUrl} alt="" className="h-[52px] w-[52px] shrink-0 rounded-md object-cover" />
              : <div className="h-[52px] w-[52px] shrink-0 rounded-md bg-[#2a2a2a]" />}
            <div className="flex min-w-0 max-w-[260px] flex-col gap-0.5">
              <span className="truncate text-[17px] font-semibold text-[#eee]">{title}</span>
              {subtitle && <span className="truncate text-[14px] text-[#888]">{subtitle}</span>}
            </div>
            <div className="mx-1 h-8 w-px shrink-0 bg-[#333]" />
            <div className="flex shrink-0 items-center gap-4">
              <button className={iconButton} onClick={() => spotify.previous()} disabled={!isActiveHere} title="Предыдущий трек">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor"><rect x="2" y="3" width="2.5" height="12" /><polygon points="16,3 16,15 6,9" /></svg>
              </button>
              <button
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-none bg-[#eee] p-0 text-[#1a1a1a] cursor-pointer transition-colors hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-[#eee]"
                onClick={handlePlayPause}
                disabled={!isPlaying && (playBlocked || (!isActiveHere && !lastPlaylist))}
                title={isPlaying ? 'Пауза' : 'Играть'}
              >
                {isPlaying
                  ? <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="3.5" height="12" /><rect x="9.5" y="2" width="3.5" height="12" /></svg>
                  : <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><polygon points="4,2 14,8 4,14" /></svg>}
              </button>
              <button className={iconButton} onClick={() => spotify.next()} disabled={!isActiveHere} title="Следующий трек">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor"><polygon points="2,3 2,15 12,9" /><rect x="13.5" y="3" width="2.5" height="12" /></svg>
              </button>
              <div className="relative ml-1 h-8 w-24 shrink-0">
                <svg width={VOLUME_TRACK} height="4" className="pointer-events-none absolute left-0 top-[14px]" aria-hidden="true">
                  <rect width={VOLUME_TRACK} height="4" rx="2" fill="#333" />
                  <rect width={volumeFill} height="4" rx="2" fill="#999" />
                </svg>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={e => spotify.setVolume(Number(e.target.value))}
                  aria-label="Громкость"
                  className="absolute left-0 top-[9px] m-0 h-3.5 w-24 cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:bg-[#ddd] [&::-moz-range-track]:bg-transparent [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#ddd]"
                />
              </div>
              <button className={iconButton} onClick={() => setSearchOpen(true)} disabled={playBlocked} title="Найти музыку">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8.5" cy="8.5" r="6" /><line x1="13" y1="13" x2="18" y2="18" /></svg>
              </button>
              {playBlocked && !isPlaying && <span className="text-[13px] text-[#777]">Музыка продолжится сама</span>}
            </div>
          </div>

          {expanded && progress && (
            <div className="flex items-center gap-3 pl-1 animate-fade-in">
              <span className={`w-9 shrink-0 text-right text-[13px] tabular-nums ${scrubbing ? 'text-[#eee]' : 'text-[#888]'}`}>{formatTrackTime(shownPosition)}</span>
              <div className="relative h-4 flex-1">
                <div className={`pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full bg-[#333] ${scrubbing ? 'h-1.5' : 'h-1'}`} />
                {/* The thumb's centre runs from 8px to width − 8px, so the fill is an 8px cap plus a share of the middle. */}
                <div className={`pointer-events-none absolute left-0 top-1/2 w-2 -translate-y-1/2 rounded-l-full ${scrubbing ? 'h-1.5 bg-[#1db954]' : 'h-1 bg-[#999]'}`} />
                <svg className={`pointer-events-none absolute inset-x-2 top-1/2 w-[calc(100%-16px)] -translate-y-1/2 ${scrubbing ? 'h-1.5 fill-[#1db954]' : 'h-1 fill-[#999]'}`} aria-hidden="true">
                  <rect width={`${progressPercent}%`} height="100%" />
                </svg>
                <input
                  type="range"
                  min={0}
                  max={progress.duration}
                  step={1000}
                  value={shownPosition}
                  onChange={e => setScrubMs(Number(e.target.value))}
                  onPointerUp={commitScrub}
                  onKeyUp={commitScrub}
                  onBlur={commitScrub}
                  aria-label="Перемотка трека"
                  className="absolute inset-0 m-0 h-4 w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:opacity-0 active:[&::-moz-range-thumb]:opacity-100 hover:[&::-moz-range-thumb]:opacity-100 [&::-moz-range-track]:bg-transparent [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:opacity-0 [&::-webkit-slider-thumb]:shadow-[0_2px_6px_rgba(0,0,0,.5)] active:[&::-webkit-slider-thumb]:opacity-100 hover:[&::-webkit-slider-thumb]:opacity-100"
                />
              </div>
              <span className="w-9 shrink-0 text-[13px] tabular-nums text-[#666]">{formatTrackTime(progress.duration)}</span>
            </div>
          )}

          {expanded && nextTrack && (
            <div className="flex items-center gap-2.5 border-t border-[#2a2a2a] pl-1 pt-2 animate-fade-in">
              <span className="text-[12px] tracking-[2px] text-[#666]">СЛЕДУЮЩИЙ</span>
              {nextTrack.imageUrl
                ? <img src={nextTrack.imageUrl} alt="" className="h-6 w-6 shrink-0 rounded object-cover" />
                : <div className="h-6 w-6 shrink-0 rounded bg-[#2a2a2a]" />}
              <span className="max-w-[360px] truncate text-[14px] text-[#aaa]">{nextTrack.artists} — {nextTrack.name}</span>
            </div>
          )}
          </div>
        ) : (
          <div className={`${strip} items-center gap-2.5 py-3 pl-4`}>
            <SpotifyEqualizer playing={false} />
            {status === 'disconnected' && <button className={textButton} onClick={spotify.connect}>Подключить Spotify</button>}
            {status === 'connecting' && <span className="text-[15px] text-[#777]">Подключаем Spotify…</span>}
            {status === 'error' && (
              <>
                <span className="text-[15px] text-[#a66]">{errorMessage}</span>
                <button className={textButton} onClick={spotify.connect}>Подключить заново</button>
              </>
            )}
          </div>
        )}
        {notice && <span className="px-1 text-[13px] text-[#a66]">{notice}</span>}
      </div>

      {searchOpen && <SpotifySearchDialog onPick={handlePick} onClose={() => setSearchOpen(false)} />}
    </>
  );
}
