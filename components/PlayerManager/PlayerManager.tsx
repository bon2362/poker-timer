// components/PlayerManager/PlayerManager.tsx
'use client';
import { useEffect, useState, useRef } from 'react';
import { useGame } from '@/context/GameContext';
import { PlayerForm } from './PlayerForm';
import { getWinnerThumbUrl, uploadWinnerImage, deleteWinnerImage } from '@/lib/supabase/winnerImage';
import { getLoserThumbUrl, uploadLoserImage, deleteLoserImage } from '@/lib/supabase/loserImage';
import type { Player } from '@/types/game';

function Avatar({ player, size = 40 }: { player: Player; size?: number }) {
  const initials = player.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['bg-violet-800', 'bg-blue-700', 'bg-emerald-800', 'bg-amber-800', 'bg-red-900'];
  const color = colors[player.name.charCodeAt(0) % colors.length];
  const sizes: Record<number, string> = { 24: 'w-6 h-6 text-[8px]', 28: 'w-7 h-7 text-[10px]', 32: 'w-8 h-8 text-[11px]', 36: 'w-9 h-9 text-[13px]', 40: 'w-10 h-10 text-sm', 44: 'w-11 h-11 text-[15px]', 80: 'w-20 h-20 text-[28px]', 120: 'w-[120px] h-[120px] text-[42px]', 160: 'w-40 h-40 text-[56px]' };
  const sizeClass = sizes[size] ?? sizes[40];
  return player.avatarUrl ? <img src={player.avatarUrl} alt={player.name} className={`rounded-full object-cover shrink-0 ${sizeClass}`} /> : <div className={`rounded-full flex items-center justify-center text-white font-bold shrink-0 ${color} ${sizeClass}`}>{initials}</div>;
}

export { Avatar };

type PlayerImageCellProps = {
  player: Player;
  icon: string;
  kindLabel: string;
  getImageUrl: (playerId: string) => Promise<string | null>;
  uploadImage: (playerId: string, file: File) => Promise<string | null>;
  deleteImage: (playerId: string) => Promise<void>;
};

/* ── Per-player special image cell ── */
function PlayerImageCell({
  player,
  icon,
  kindLabel,
  getImageUrl,
  uploadImage,
  deleteImage,
}: PlayerImageCellProps) {
  const [imageUrl, setImageUrl] = useState<string | null | 'loading'>('loading');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lazy-load on first render
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
    setUploading(true); setError('');
    try {
      const url = await uploadImage(player.id, file);
      if (!url) throw new Error('Upload failed');
      setImageUrl(url);
    } catch { setError('Не удалось загрузить изображение. Попробуйте ещё раз.'); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  }

  async function handleDelete(ev: React.MouseEvent) {
    ev.stopPropagation();
    if (!confirm(`Удалить изображение ${kindLabel} для ${player.name}?`)) return;
    setError('');
    try { await deleteImage(player.id); setImageUrl(null); }
    catch { setError('Не удалось удалить изображение. Попробуйте ещё раз.'); }
  }

  if (imageUrl === 'loading') return null;

  return (
    <div className="flex flex-wrap items-center gap-1 shrink-0">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />

      {/* Thumbnail or upload button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        title={imageUrl ? `Заменить изображение ${kindLabel}` : `Загрузить изображение ${kindLabel}`}
        className="w-14 h-8 relative overflow-hidden rounded border border-[#333] cursor-pointer hover:border-violet-500 transition-colors disabled:opacity-50 shrink-0"

      >
        {imageUrl ? (
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#1e1e1e] text-[#555] text-[16px]">
            {uploading ? '…' : icon}
          </div>
        )}
      </button>

      {error && <p role="alert" className="max-w-40 text-xs text-red-400">{error}</p>}
      {/* Delete button — only when image exists */}
      {imageUrl && (
        <button
          onClick={handleDelete}
          title="Удалить изображение"
          className="text-[#444] text-[13px] cursor-pointer hover:text-red-500 px-1 leading-none"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function WinnerImageCell({ player }: { player: Player }) {
  return (
    <PlayerImageCell
      player={player}
      icon="🏆"
      kindLabel="победителя"
      getImageUrl={getWinnerThumbUrl}
      uploadImage={uploadWinnerImage}
      deleteImage={deleteWinnerImage}
    />
  );
}

function LoserImageCell({ player }: { player: Player }) {
  return (
    <PlayerImageCell
      player={player}
      icon="💀"
      kindLabel="проигравшего"
      getImageUrl={getLoserThumbUrl}
      uploadImage={uploadLoserImage}
      deleteImage={deleteLoserImage}
    />
  );
}

export function PlayerManager() {
  const { players, removePlayer, activeSession } = useGame();
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
    <div className="px-6 py-5 flex flex-col gap-3">
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
          ) : (
            <div className="flex items-center gap-3 bg-[#242424] rounded-lg px-4 py-3">
              <Avatar player={player} size={40} />
              <span
                className="flex-1 text-[15px] text-[#ccc] cursor-pointer hover:text-white min-w-0 truncate"
                onClick={() => setEditingId(player.id)}
              >
                {player.name}
              </span>
              {/* Winner image thumbnail + controls */}
              <WinnerImageCell player={player} />
              <LoserImageCell player={player} />
              <button
                onClick={() => handleDelete(player)}
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
