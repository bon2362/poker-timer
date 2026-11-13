'use client';
import { useState } from 'react';
import { useSpotify } from '@/context/SpotifyContext';

type Layer = { url: string; name: string; artists: string; loaded: boolean };

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

  // Keep the previous track underneath until the new one has faded in.
  if (track && url && layers.at(-1)?.url !== url) {
    setLayers(prev => [...prev.slice(-1), { url, name: track.name, artists: track.artists, loaded: false }]);
  }

  const handleLoad = (loadedUrl: string) => {
    setLayers(prev => prev.map(l => (l.url === loadedUrl ? { ...l, loaded: true } : l)));
    setTimeout(() => {
      setLayers(prev => {
        const i = prev.findIndex(l => l.url === loadedUrl);
        return i > 0 ? prev.slice(i) : prev;
      });
    }, FADE_MS + 100);
  };

  if (layers.length === 0) return null;

  return (
    <div aria-hidden className={`pointer-events-none fixed inset-0 z-[35] overflow-hidden bg-[#111] transition-opacity duration-[1500ms] ${url ? 'opacity-100' : 'opacity-0'}`}>
      {layers.map(layer => (
        <div key={layer.url} className={`absolute inset-0 transition-opacity duration-[1500ms] ${layer.loaded ? 'opacity-100' : 'opacity-0'}`}>
          <img src={layer.url} alt="" className="absolute inset-0 h-full w-full object-cover blur-2xl saturate-150 will-change-transform animate-cover-drift" />
          <div className="absolute inset-0 bg-black/25" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-8 pb-16">
            <img
              src={layer.url}
              alt=""
              onLoad={() => handleLoad(layer.url)}
              className="aspect-square w-[min(58vh,80vw)] rounded-2xl object-cover shadow-[0_30px_90px_rgba(0,0,0,0.6)] will-change-transform animate-cover-breathe"
            />
            <div className="flex max-w-[80vw] flex-col items-center gap-2 text-center drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]">
              <span className="line-clamp-2 text-[clamp(28px,4.5vh,48px)] font-bold leading-tight text-white">{layer.name}</span>
              <span className="truncate text-[clamp(18px,3vh,30px)] text-white/75">{layer.artists}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
