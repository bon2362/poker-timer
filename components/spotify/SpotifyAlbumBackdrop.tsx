'use client';
import { useState } from 'react';
import { useSpotify } from '@/context/SpotifyContext';
import { SpotifyLyrics, useSyncedLyrics } from './SpotifyLyrics';

type Layer = { uri: string; url: string; name: string; artists: string; loaded: boolean };

const FADE_MS = 1500;

// Whether the cover screen should be up: music playing here and a cover to show.
export function useAlbumCoverShowing(enabled: boolean): boolean {
  const spotify = useSpotify();
  return Boolean(enabled && spotify && spotify.status !== 'disabled' && spotify.isActiveHere && spotify.isPlaying && spotify.track?.imageUrl);
}

// Before a game is set up, the playing track takes over the timer screen: a large sharp cover
// over a blurred, slowly drifting copy of itself, with the title below.
// A new track cross-fades over the old one; pausing, playing elsewhere or starting a game fades it out.
export function SpotifyAlbumBackdrop({ enabled }: { enabled: boolean }) {
  const spotify = useSpotify();
  const showing = useAlbumCoverShowing(enabled);
  const track = showing ? spotify?.track ?? null : null;
  const url = track?.imageUrl ?? null;
  const [layers, setLayers] = useState<Layer[]>([]);
  const lyrics = useSyncedLyrics(track, spotify?.progress?.duration ?? null);

  // Keep the previous track underneath until the new one has faded in.
  // Layers follow the track, not the cover: tracks of one album share a cover but not a title.
  if (track && url && layers.at(-1)?.uri !== track.uri) {
    setLayers(prev => [...prev.slice(-1), { uri: track.uri, url, name: track.name, artists: track.artists, loaded: false }]);
  }

  const handleLoad = (loadedUri: string) => {
    setLayers(prev => prev.map(l => (l.uri === loadedUri ? { ...l, loaded: true } : l)));
    setTimeout(() => {
      setLayers(prev => {
        const i = prev.findIndex(l => l.uri === loadedUri);
        return i > 0 ? prev.slice(i) : prev;
      });
    }, FADE_MS + 100);
  };

  if (layers.length === 0) return null;

  return (
    <div aria-hidden className={`pointer-events-none fixed inset-0 z-[35] overflow-hidden bg-[#111] transition-opacity duration-[1500ms] ${url ? 'opacity-100' : 'opacity-0'}`}>
      {layers.map(layer => {
        const layerLyrics = layer.uri === track?.uri ? lyrics : null;
        return (
          <div key={layer.uri} className={`absolute inset-0 transition-opacity duration-[1500ms] ${layer.loaded ? 'opacity-100' : 'opacity-0'}`}>
            <img src={layer.url} alt="" className="absolute inset-0 h-full w-full object-cover blur-2xl saturate-150 will-change-transform animate-cover-drift" />
            <div className="absolute inset-0 bg-black/25" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-8 pb-16">
              <img
                src={layer.url}
                alt=""
                onLoad={() => handleLoad(layer.uri)}
                className={`aspect-square rounded-2xl object-cover shadow-[0_30px_90px_rgba(0,0,0,0.6)] will-change-transform animate-cover-breathe transition-[width] duration-700 ${layerLyrics ? 'w-[min(44vh,80vw)]' : 'w-[min(58vh,80vw)]'}`}
              />
              <div className="flex max-w-[80vw] flex-col items-center gap-2 text-center drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]">
                <span className="line-clamp-2 text-[clamp(28px,4.5vh,48px)] font-bold leading-tight text-white">{layer.name}</span>
                <span className="truncate text-[clamp(18px,3vh,30px)] text-white/75">{layer.artists}</span>
              </div>
              {layerLyrics && <SpotifyLyrics lines={layerLyrics} progress={spotify?.progress ?? null} playing={Boolean(spotify?.isPlaying)} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
