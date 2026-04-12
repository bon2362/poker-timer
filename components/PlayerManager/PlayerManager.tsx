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
  const colors = ['#5b21b6','#1d4ed8','#065f46','#92400e','#7f1d1d'];
  const color = colors[player.name.charCodeAt(0) % colors.length];
  return player.avatarUrl ? (
    <img
      src={player.avatarUrl}
      alt={player.name}
      className="rounded-full object-cover shrink-0"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
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
    setUploading(true);
    const url = await uploadImage(player.id, file);
    setImageUrl(url);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleDelete(ev: React.MouseEvent) {
    ev.stopPropagation();
    if (!confirm(`Удалить изображение ${kindLabel} для ${player.name}?`)) return;
    await deleteImage(player.id);
    setImageUrl(null);
  }

  if (imageUrl === 'loading') return null;

  return (
    <div className="flex items-center gap-1 shrink-0">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />

      {/* Thumbnail or upload button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        title={imageUrl ? `Заменить изображение ${kindLabel}` : `Загрузить изображение ${kindLabel}`}
        className="relative overflow-hidden rounded border border-[#333] cursor-pointer hover:border-violet-500 transition-colors disabled:opacity-50 shrink-0"
        style={{ width: 56, height: 32 }}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#1e1e1e] text-[#555] text-[16px]">
            {uploading ? '…' : icon}
          </div>
        )}
      </button>

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
