'use client';
import { useState } from 'react';
export function PublicGameLink({ slug }: { slug: string }) {
  const [status, setStatus] = useState('');
  async function copy() { try { await navigator.clipboard.writeText(`https://bsptimer.online/games/${slug}`); setStatus('Скопировано'); } catch { setStatus('Не удалось скопировать. Выделите ссылку вручную.'); } }
  return <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg bg-[#242424] p-3"><span className="text-[13px] text-[#888]">Публичная страница</span><a href={`/games/${slug}`} className="min-w-0 flex-[1_1_200px] truncate text-sm text-violet-400">bsptimer.online/games/{slug} ↗</a><button onClick={copy} className="min-h-9 rounded-lg border border-[#444] bg-[#333] px-3 text-xs">Копировать</button>{status && <p role="status" className="w-full text-xs text-[#aaa]">{status}</p>}</div>;
}
