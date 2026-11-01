'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/admin/client';
import { ConfirmDialog } from './ConfirmDialog';
export function DeleteGame({ id, date }: { id: string; date: string }) {
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const router = useRouter();
  async function remove() { setBusy(true); setError(''); try { await adminFetch(`/api/admin/games/${id}`, 'DELETE'); router.push('/admin'); router.refresh(); } catch (e) { setError((e as Error).message); setBusy(false); } }
  return <details className="mt-6 border-t border-[#333] pt-4 text-sm text-[#888]"><summary className="cursor-pointer">Ещё действия ↓</summary><p className="my-3">Удалить игру целиком, например тестовую. Фото останутся в карусели.</p><button onClick={() => setOpen(true)} className="min-h-11 rounded-lg border border-[#444] px-4 text-red-400">Удалить игру…</button>
    {open && <ConfirmDialog title={`Удалить игру ${date}?`} confirmLabel="Удалить игру" busy={busy} onConfirm={remove} onClose={() => setOpen(false)}><p>Игра будет удалена навсегда, её фото останутся в карусели.</p>{error && <p role="alert" className="mt-3 text-red-400">{error}</p>}</ConfirmDialog>}
  </details>;
}
