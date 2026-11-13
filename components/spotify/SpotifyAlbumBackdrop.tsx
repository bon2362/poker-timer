'use client';
import { useState } from 'react';
import { useSpotify } from '@/context/SpotifyContext';

type Layer = { url: string; loaded: boolean };

const FADE_MS = 1500;

// The cover of the track playing here, blurred behind the whole timer screen while no game is running.
// A new cover fades in over the old one; pausing, playing elsewhere or starting a game fades it out.
export function SpotifyAlbumBackdrop({ enabled }: { enabled: boolean }) {
  const spotify = useSpotify();
  const active = Boolean(enabled && spotify && spotify.status !== 'disabled' && spotify.isActiveHere && spotify.isPlaying);
  const url = active ? spotify?.track?.imageUrl ?? null : null;
  const [layers, setLayers] = useState<Layer[]>([]);

  // Keep the previous cover underneath until the new one has faded in.
  if (url && layers.at(-1)?.url !== url) {
    setLayers(prev => [...prev.slice(-1), { url, loaded: false }]);
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
    <div aria-hidden className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden transition-opacity duration-[1500ms] ${url ? 'opacity-100' : 'opacity-0'}`}>
      {layers.map(layer => (
        <img
          key={layer.url}
          src={layer.url}
          alt=""
          onLoad={() => handleLoad(layer.url)}
          className={`absolute inset-0 h-full w-full scale-125 object-cover blur-3xl brightness-75 saturate-150 transition-opacity duration-[1500ms] ${layer.loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      ))}
    </div>
  );
}
