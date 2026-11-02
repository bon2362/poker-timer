'use client';
import { useEffect, useState } from 'react';
import { clearTokens, getSpotifyClientId, loadTokens } from '@/lib/spotify/auth';

// The login lives in this browser, so logging out here also disconnects the open timer tab.
export function SpotifyAccountSection() {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    setConnected(Boolean(loadTokens()));
  }, []);

  if (!getSpotifyClientId() || connected === null) return null;

  const handleLogout = () => {
    clearTokens();
    setConnected(false);
  };

  return (
    <div className="px-6 pb-6">
      <div className="mb-[10px] text-[11px] uppercase tracking-[2px] text-[#555]">Spotify</div>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-[#333] bg-[#242424] px-4 py-3">
        <span className="text-[14px] text-[#ccc]">
          {connected ? 'Spotify подключён на этом компьютере' : 'Spotify на этом компьютере не подключён'}
        </span>
        {connected && (
          <button
            onClick={handleLogout}
            className="shrink-0 cursor-pointer rounded-lg border border-[#333] bg-transparent px-3 py-1.5 text-[13px] text-[#888] transition-colors hover:border-[#555] hover:text-[#ccc]"
          >
            Выйти из Spotify
          </button>
        )}
      </div>
      {!connected && (
        <p className="mt-2 text-[12px] text-[#666]">Подключить можно на экране таймера: двиньте мышью и нажмите «Подключить Spotify».</p>
      )}
    </div>
  );
}
