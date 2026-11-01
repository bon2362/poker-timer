// components/PlayerManager/PlayerManager.tsx
'use client';
import { useEffect, useState, useRef } from 'react';
import { useGame } from '@/context/GameContext';
import { PlayerForm } from './PlayerForm';
import { getWinnerImageUrl, getWinnerThumbUrl, uploadWinnerImage, deleteWinnerImage } from '@/lib/supabase/winnerImage';
import { getLoserImageUrl, getLoserThumbUrl, uploadLoserImage, deleteLoserImage } from '@/lib/supabase/loserImage';
import type { Player } from '@/types/game';

function Avatar({ player, size = 40 }: { player: Player; size?: number }) {
  const initials = player.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['bg-violet-800', 'bg-blue-700', 'bg-emerald-800', 'bg-amber-800', 'bg-red-900'];
  const color = colors[player.name.charCodeAt(0) % colors.length];
  const sizes: Record<number, string> = { 24: 'w-6 h-6 text-[8px]', 28: 'w-7 h-7 text-[10px]', 32: 'w-8 h-8 text-[11px]', 36: 'w-9 h-9 text-[13px]', 40: 'w-10 h-10 text-sm', 44: 'w-11 h-11 text-[15px]', 48: 'w-12 h-12 text-[17px]', 80: 'w-20 h-20 text-[28px]', 120: 'w-[120px] h-[120px] text-[42px]', 160: 'w-40 h-40 text-[56px]' };
  const sizeClass = sizes[size] ?? sizes[40];
  return player.avatarUrl ? <img src={player.avatarUrl} alt={player.name} className={`rounded-full object-cover shrink-0 ${sizeClass}`} /> : <div className={`rounded-full flex items-center justify-center text-white font-bold shrink-0 ${color} ${sizeClass}`}>{initials}</div>;
}

export { Avatar };

/* ── Small preview in the player row ── */
function PlayerThumb({ player, icon, getThumbUrl }: { player: Player; icon: string; getThumbUrl: (playerId: string) => Promise<string | null> }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getThumbUrl(player.id).then(next => {
      if (!cancelled) setUrl(next);
    });
    return () => { cancelled = true; };
  }, [getThumbUrl, player.id]);

  return (
    <span className="w-14 h-8 overflow-hidden rounded border border-[#333] shrink-0">
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="w-full h-full flex items-center justify-center bg-[#1e1e1e] text-[#555] text-[16px]">{icon}</span>
      )}
    </span>
  );
}

type ImageSlotProps = {
  player: Player;
  icon: string;
  title: string;
  kindLabel: string;
  getImageUrl: (playerId: string) => Promise<string | null>;
  uploadImage: (playerId: string, file: File) => Promise<string | null>;
  deleteImage: (playerId: string) => Promise<void>;
};

/* ── Winner or loser image for future games ── */
function ImageSlot({ player, icon, title, kindLabel, getImageUrl, uploadImage, deleteImage }: ImageSlotProps) {
  const [imageUrl, setImageUrl] = useState<string | null | 'loading'>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setImageUrl('loading');
    getImageUrl(player.id).then(url => {
      if (!cancelled) setImageUrl(url);
    });
    return () => { cancelled = true; };
  }, [getImageUrl, player.id]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError('');
    try {
      const url = await uploadImage(player.id, file);
      if (!url) throw new Error('Upload failed');
      setImageUrl(url);
    } catch { setError('Не удалось загрузить изображение. Попробуйте ещё раз.'); }
    finally { setBusy(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  }

  async function handleDelete() {
    if (!confirm(`Удалить изображение ${kindLabel} для ${player.name}?`)) return;
    setBusy(true); setError('');
    try { await deleteImage(player.id); setImageUrl(null); }
    catch { setError('Не удалось удалить изображение. Попробуйте ещё раз.'); }
    finally { setBusy(false); }
  }

  const hasImage = imageUrl !== null && imageUrl !== 'loading';

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <input ref={fileInputRef} aria-label={`Файл: ${title}`} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-[#eee]">{icon} {title}</span>
        <span className="rounded-full bg-[#2a2040] px-2 py-0.5 text-[11px] text-[#c4b5fd]">для будущих игр</span>
      </div>
      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-md bg-[#1e1e1e] text-3xl text-[#555]">
        {hasImage ? <img src={imageUrl} alt={`${title}: ${player.name}`} className="h-full w-full object-cover" /> : imageUrl === null ? icon : null}
      </div>
      <p className="text-xs leading-relaxed text-[#8a8a8a]">Будет показана в следующих играх, прошедшие не изменятся.</p>
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button disabled={busy || imageUrl === 'loading'} onClick={() => fileInputRef.current?.click()} className="min-h-10 rounded-md border border-[#444] bg-[#333] px-3.5 text-[13px] text-white disabled:opacity-50">
          {busy ? 'Сохраняем…' : hasImage ? 'Заменить' : 'Загрузить'}
        </button>
        {hasImage && <button disabled={busy} onClick={handleDelete} aria-label={`Удалить: ${title}`} className="min-h-10 rounded-md border border-[#333] px-3.5 text-[13px] text-red-400 disabled:opacity-50">Удалить</button>}
      </div>
    </div>
  );
}

function PlayerCard({ player, onEdit, onClose }: { player: Player; onEdit: () => void; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-3.5 rounded-[10px] border border-[#3a2060] bg-[#242424] p-3.5">
      <div className="flex items-center gap-3">
        <Avatar player={player} size={48} />
        <span className="min-w-0 flex-1 truncate text-[17px] font-semibold text-white">{player.name}</span>
        <button onClick={onEdit} className="min-h-9 rounded-md border border-[#333] px-3 text-[13px] text-[#aaa]">Изменить</button>
        <button onClick={onClose} className="min-h-9 rounded-md border border-[#333] px-3 text-[13px] text-[#aaa]">Свернуть</button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
        <ImageSlot player={player} icon="🏆" title="Победитель" kindLabel="победителя" getImageUrl={getWinnerImageUrl} uploadImage={uploadWinnerImage} deleteImage={deleteWinnerImage} />
        <ImageSlot player={player} icon="💀" title="Вылет" kindLabel="проигравшего" getImageUrl={getLoserImageUrl} uploadImage={uploadLoserImage} deleteImage={deleteLoserImage} />
      </div>
    </div>
  );
}

export function PlayerManager({ flush = false }: { flush?: boolean }) {
  const { players, removePlayer, activeSession } = useGame();
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  async function handleDelete(player: Player) {
    if (activeSession !== null) {
      alert('Нельзя удалить игрока во время активной сессии');
      return;
    }
    if (confirm(`Удалить ${player.name}?`)) {
      await removePlayer(player.id);
    }
  }

  return (
    <div className={`flex flex-col gap-3 ${flush ? '' : 'px-6 py-5'}`}>
      <div className="rounded-lg border border-[#3a2060] bg-[#261d36] p-4">
        <span className="rounded-full bg-[#3a2060] px-2.5 py-1 text-[11px] text-[#c4b5fd]">→ Для будущих игр</span>
        <p className="mt-3 text-sm leading-relaxed text-[#b5a4cb]">Картинки отсюда таймер покажет в следующих играх. Прошедшие игры хранят свои копии и не изменятся.</p>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-[11px] text-[#555] tracking-[2px] uppercase">Игроки ({players.length})</div>
        <button
          onClick={() => { setAddingNew(true); setEditingId(null); }}
          className="text-violet-500 text-[13px] bg-transparent border-none cursor-pointer hover:text-violet-400"
        >
          + Добавить
        </button>
      </div>

      {addingNew && (
        <PlayerForm onDone={() => setAddingNew(false)} />
      )}

      {players.map(player => (
        <div key={player.id}>
          {editingId === player.id ? (
            <PlayerForm player={player} onDone={() => setEditingId(null)} />
          ) : openId === player.id ? (
            <PlayerCard player={player} onEdit={() => setEditingId(player.id)} onClose={() => setOpenId(null)} />
          ) : (
            <div className="flex items-center gap-2 bg-[#242424] rounded-lg px-4 py-3">
              <button onClick={() => { setOpenId(player.id); setEditingId(null); }} aria-label={`Открыть карточку: ${player.name}`} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left">
                <Avatar player={player} size={40} />
                <span className="flex-1 text-[15px] text-[#ccc] hover:text-white min-w-0 truncate">{player.name}</span>
                <PlayerThumb player={player} icon="🏆" getThumbUrl={getWinnerThumbUrl} />
                <PlayerThumb player={player} icon="💀" getThumbUrl={getLoserThumbUrl} />
              </button>
              <button
                onClick={() => handleDelete(player)}
                aria-label={`Удалить игрока: ${player.name}`}
                className="bg-transparent border-none text-[#444] text-[16px] cursor-pointer hover:text-red-500 px-1 shrink-0"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      ))}

      {players.length === 0 && !addingNew && (
        <p className="text-[#555] text-[13px] text-center py-6">
          Нет игроков. Добавьте первого.
        </p>
      )}
    </div>
  );
}
