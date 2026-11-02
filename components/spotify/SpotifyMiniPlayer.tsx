'use client';
import { useState } from 'react';
import { useSpotify } from '@/context/SpotifyContext';
import { SpotifySearchDialog } from './SpotifySearchDialog';
import type { SpotifyPlaylistItem } from '@/lib/spotify/api';

type Props = {
  canControl: boolean;
  controlsVisible: boolean;
  onPlayDuringBreakSong: () => void;
};

const iconButton = 'bg-transparent border-none text-[#555] text-[18px] cursor-pointer p-1 leading-none hover:text-[#999] transition-colors disabled:opacity-30 disabled:cursor-not-allowed';
const textButton = 'bg-transparent border-none text-[#777] text-[14px] cursor-pointer p-0 hover:text-[#aaa] transition-colors';

export function SpotifyMiniPlayer({ canControl, controlsVisible, onPlayDuringBreakSong }: Props) {
  const spotify = useSpotify();
  const [searchOpen, setSearchOpen] = useState(false);

  if (!spotify || spotify.status === 'disabled') return null;

  const { status, track, isPlaying, isActiveHere, playingElsewhere, activeHolds, lastPlaylist, volume, errorMessage, notice } = spotify;
  const showControls = canControl && controlsVisible;
  const onlyBreakSong = activeHolds.length > 0 && activeHolds.every(id => id === 'breakSong');
  const playBlocked = activeHolds.length > 0 && !onlyBreakSong;

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

  const nowPlaying = track && isActiveHere
    ? `${track.artists} — ${track.name}`
    : playingElsewhere ? 'Музыка играет на другом устройстве' : null;

  if (!nowPlaying && !canControl) return null;

  return (
    <>
      <div className={`fixed bottom-[18px] left-7 z-[70] flex max-w-[45vw] flex-col gap-1.5 rounded-lg px-3 py-1.5 transition-colors duration-500 ${nowPlaying || showControls ? 'bg-black/40' : 'bg-transparent'}`}>
        {nowPlaying && (
          <div className="truncate text-[15px] text-[#555]">
            <span className="mr-2 text-[#1db954]/60">♫</span>{nowPlaying}
          </div>
        )}

        {canControl && (
          <div className={`flex flex-wrap items-center gap-3 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {status === 'disconnected' && (
              <button className={textButton} onClick={spotify.connect}>♫ Подключить Spotify</button>
            )}

            {status === 'connecting' && <span className="text-[14px] text-[#555]">Подключаем Spotify…</span>}

            {status === 'error' && (
              <>
                <span className="text-[14px] text-[#a66]">{errorMessage}</span>
                <button className={textButton} onClick={spotify.connect}>Подключить заново</button>
              </>
            )}

            {status === 'ready' && (
              <>
                <button className={iconButton} onClick={() => spotify.previous()} disabled={!isActiveHere} title="Предыдущий трек">{'⏮︎'}</button>
                <button
                  className={`${iconButton} text-[22px]`}
                  onClick={handlePlayPause}
                  disabled={!isPlaying && (playBlocked || (!isActiveHere && !lastPlaylist))}
                  title={isPlaying ? 'Пауза' : 'Играть'}
                >
                  {isPlaying ? '⏸︎' : '▶︎'}
                </button>
                <button className={iconButton} onClick={() => spotify.next()} disabled={!isActiveHere} title="Следующий трек">{'⏭︎'}</button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={e => spotify.setVolume(Number(e.target.value))}
                  aria-label="Громкость"
                  className="w-24 cursor-pointer accent-[#666]"
                />
                <button className={iconButton} onClick={() => setSearchOpen(true)} disabled={playBlocked} title="Найти музыку">🔍</button>
                {playBlocked && !isPlaying && <span className="text-[13px] text-[#555]">Музыка продолжится сама</span>}
                {!isActiveHere && lastPlaylist && !playBlocked && (
                  <span className="max-w-[200px] truncate text-[13px] text-[#555]">{lastPlaylist.name}</span>
                )}
                <button className={`${textButton} text-[12px] text-[#444]`} onClick={spotify.disconnect}>Выйти из Spotify</button>
                {notice && <span className="basis-full text-[13px] text-[#a66]">{notice}</span>}
              </>
            )}
          </div>
        )}
      </div>

      {searchOpen && <SpotifySearchDialog onPick={handlePick} onClose={() => setSearchOpen(false)} />}
    </>
  );
}
