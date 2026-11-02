'use client';
import { useState } from 'react';
import { useSpotify } from '@/context/SpotifyContext';
import { SpotifySearchDialog } from './SpotifySearchDialog';
import { SpotifyEqualizer } from './SpotifyEqualizer';
import type { SpotifyPlaylistItem } from '@/lib/spotify/api';

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

  if (!spotify || spotify.status === 'disabled') return null;

  const { status, track, isPlaying, isActiveHere, playingElsewhere, activeHolds, lastPlaylist, volume, errorMessage, notice } = spotify;
  const showControls = canControl && controlsVisible;
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
  const strip = 'flex max-w-[calc(100vw-56px)] items-center gap-4 rounded-xl bg-black/40 py-2 pl-2 pr-[18px] animate-fade-in';

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

  return (
    <>
      <div className={position}>
        {status === 'ready' ? (
          <div className={strip}>
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
        ) : (
          <div className={`${strip} gap-2.5 py-3 pl-4`}>
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
