// components/PlayerManager/PlayerForm.tsx
'use client';
import { useState, useRef } from 'react';
import { useGame } from '@/context/GameContext';
import { uploadAvatar } from '@/lib/supabase/storage';
import { AvatarCropper } from './AvatarCropper';
import type { Player } from '@/types/game';

type Props = {
  player?: Player;   // undefined = new player
  onDone: () => void;
};

export function PlayerForm({ player, onDone }: Props) {
  const { addPlayer, updatePlayer } = useGame();
  const [name, setName] = useState(player?.name ?? '');
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    if (player) {
      await updatePlayer(player.id, { name: name.trim() });
      onDone();
    } else {
      const created = await addPlayer(name.trim());
      if (created) onDone();
    }
    setSaving(false);
  }

  async function handleCropSave(blob: Blob) {
    if (!player) return;
    const url = await uploadAvatar(player.id, blob);
    if (url) await updatePlayer(player.id, { avatarUrl: url });
    setCropFile(null);
  }

  return (
    <>
      {cropFile && player && (
        <AvatarCropper
          file={cropFile}
          onSave={handleCropSave}
          onCancel={() => setCropFile(null)}
        />
      )}
      <div className="flex flex-col gap-3 p-4 bg-[#242424] rounded-lg">
        <input
          type="text"
          placeholder="Имя игрока"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          className="bg-[#333] border border-[#444] rounded-lg px-3 py-2 text-white text-[15px] focus:outline-none focus:border-violet-600"
          autoFocus
        />
        {player && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) setCropFile(f); }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-transparent border border-[#444] text-[#888] rounded-lg px-3 py-2 text-[13px] cursor-pointer hover:border-violet-600 hover:text-violet-400"
            >
              📷 {player.avatarUrl ? 'Заменить аватарку' : 'Загрузить аватарку'}
            </button>
          </>
        )}
        <div className="flex gap-2">
          <button
            onClick={onDone}
            className="flex-1 bg-transparent border border-[#333] text-[#666] rounded-lg py-2 text-[13px] cursor-pointer hover:border-[#555]"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex-1 bg-violet-700 text-white border-none rounded-lg py-2 text-[13px] font-semibold cursor-pointer hover:bg-violet-800 disabled:opacity-50"
          >
            {saving ? 'Сохраняем...' : player ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      </div>
    </>
  );
}
