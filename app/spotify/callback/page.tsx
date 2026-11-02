'use client';
import { useEffect, useState } from 'react';
import { completeSpotifyLogin } from '@/lib/spotify/auth';

export default function SpotifyCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    completeSpotifyLogin(new URLSearchParams(window.location.search))
      .then(() => window.location.replace('/'))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Не удалось подключить Spotify'));
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#1a1a1a] px-4 text-center">
      {error ? (
        <>
          <p className="text-[18px] text-[#ccc]">{error}</p>
          <a href="/" className="text-[15px] text-[#888] underline hover:text-[#aaa]">Вернуться к таймеру</a>
        </>
      ) : (
        <p className="text-[16px] text-[#666]">Подключаем Spotify…</p>
      )}
    </div>
  );
}
