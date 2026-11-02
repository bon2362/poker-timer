'use client';
import { useEffect, useState } from 'react';
import { useSpotify } from '@/context/SpotifyContext';
import type { SpotifyPlaylistItem } from '@/lib/spotify/api';

const SEARCH_DELAY_MS = 400;

type Props = {
  onPick: (item: SpotifyPlaylistItem) => void;
  onClose: () => void;
};

export function SpotifySearchDialog({ onPick, onClose }: Props) {
  const spotify = useSpotify();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifyPlaylistItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const search = spotify?.search;

  useEffect(() => {
    const q = query.trim();
    if (!q || !search) {
      setResults([]);
      setError(null);
      return;
    }
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      setSearching(true);
      search(q)
        .then(items => { if (!cancelled) { setResults(items); setError(null); } })
        .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Поиск не удался'); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, SEARCH_DELAY_MS);
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [query, search]);

  if (!spotify) return null;

  const handlePick = (item: SpotifyPlaylistItem) => {
    onPick(item);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Поиск в Spotify"
      className="fixed inset-0 z-[85] flex items-start justify-center bg-black/60 px-4 pt-[10vh] backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        className="flex max-h-[75vh] w-full max-w-[520px] flex-col rounded-2xl border border-[#333] bg-[#1e1e1e] p-4"
        onClick={e => e.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Плейлист, жанр, настроение…"
          className="h-11 w-full rounded-lg border border-[#333] bg-[#141414] px-3 text-[15px] text-[#ddd] outline-none placeholder:text-[#555] focus:border-[#555]"
        />
        <div className="mt-3 flex-1 overflow-y-auto">
          {error && <p className="px-1 py-2 text-[14px] text-red-400">{error}</p>}
          {searching && results.length === 0 && <p className="px-1 py-2 text-[14px] text-[#666]">Ищем…</p>}
          {!searching && !error && query.trim() && results.length === 0 && (
            <p className="px-1 py-2 text-[14px] text-[#666]">Ничего не нашлось</p>
          )}
          <ul className="flex flex-col gap-1">
            {results.map(item => (
              <li key={item.uri}>
                <button
                  onClick={() => handlePick(item)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-lg border-none bg-transparent p-2 text-left hover:bg-[#2a2a2a]"
                >
                  {item.imageUrl
                    ? <img src={item.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded object-cover" />
                    : <div className="h-11 w-11 shrink-0 rounded bg-[#2a2a2a]" />}
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] text-[#ddd]">{item.name}</span>
                    {item.owner && <span className="block truncate text-[13px] text-[#777]">{item.owner}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
