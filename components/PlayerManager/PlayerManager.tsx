// components/PlayerManager/PlayerManager.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { useGame } from '@/context/GameContext';
import { PlayerForm } from './PlayerForm';
import { getWinnerImageUrl, uploadWinnerImage, deleteWinnerImage } from '@/lib/supabase/winnerImage';
import type { Player } from '@/types/game';

function Avatar({ player, size = 40 }: { player: Player; size?: number }) {
  const initials = player.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['#5b21b6','#1d4ed8','#065f46','#92400e','#7f1d1d'];
  const color = colors[player.name.charCodeAt(0) % colors.length];
  return player.avatarUrl ? (
    <img
      src={player.avatarUrl}
      alt={player.name}
      className="rounded-full object-cover"
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

export function PlayerManager() {
  const { players, removePlayer, activeSession } = useGame();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  async function handleDelete(player: Player) {
    const inSession = activeSession !== null;
    if (inSession) {
      alert(`Нельзя удалить игрока во время активной сессии`);
      return;
    }
    if (confirm(`Удалить ${player.name}?`)) {
      await removePlayer(player.id);
    }
  }

  return (
    <div className="px-6 py-5 flex flex-col gap-3">
      {/* Winner image section */}
      <WinnerImageManager />

      <div className="flex justify-between items-center mt-2">
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
                className="flex-1 text-[15px] text-[#ccc] cursor-pointer hover:text-white"
                onClick={() => setEditingId(player.id)}
              >
                {player.name}
              </span>
              <button
                onClick={() => handleDelete(player)}
                className="bg-transparent border-none text-[#444] text-[16px] cursor-pointer hover:text-red-500 px-1"
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

function WinnerImageManager() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getWinnerImageUrl().then(url => setImageUrl(url));
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadWinnerImage(file);
    setImageUrl(url);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleDelete() {
    if (!confirm('Удалить изображение победителя?')) return;
    await deleteWinnerImage();
    setImageUrl(null);
  }

  return (
    <div>
      <div className="text-[11px] text-[#555] tracking-[2px] uppercase mb-2">Изображение победителя (16:9)</div>

      {imageUrl && (
        <div className="relative rounded-xl overflow-hidden mb-3" style={{ aspectRatio: '16/9' }}>
          <img src={imageUrl} alt="Победитель" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="flex gap-2">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex-1 bg-[#242424] border border-[#444] text-[#ccc] rounded-lg px-4 py-2 text-[13px] cursor-pointer hover:border-violet-600 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? 'Загружаем…' : imageUrl ? '🏆 Заменить изображение' : '🏆 Загрузить изображение'}
        </button>
        {imageUrl && (
          <button
            onClick={handleDelete}
            className="bg-[#242424] border border-[#444] text-[#666] rounded-lg px-3 py-2 text-[13px] cursor-pointer hover:border-red-700 hover:text-red-400 transition-colors"
          >
            Удалить
          </button>
        )}
      </div>
    </div>
  );
}
