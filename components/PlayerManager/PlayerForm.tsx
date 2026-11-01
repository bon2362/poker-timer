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
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    if (!name.trim() || saving || uploadProgress !== null) return;
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
    if (!player || uploadProgress !== null) return;
    setCropFile(null);
    setUploadError(null);
    setUploadProgress(0);
    try {
      const url = await uploadAvatar(player.id, blob, setUploadProgress);
      if (!url) throw new Error('Upload failed');
      await updatePlayer(player.id, { avatarUrl: url });
    } catch {
      setUploadError('Не удалось загрузить аватарку. Попробуйте ещё раз.');
    } finally {
      setUploadProgress(null);
    }
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
        <p className="text-xs leading-relaxed text-violet-300">Будет показана в следующих играх, прошедшие не изменятся.</p>
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
              disabled={uploadProgress !== null}
              className="bg-transparent border border-[#444] text-[#888] rounded-lg px-3 py-2 text-[13px] cursor-pointer hover:border-violet-600 hover:text-violet-400"
            >
              📷 {player.avatarUrl ? 'Заменить аватарку' : 'Загрузить аватарку'}
            </button>
          </>
        )}
        {uploadProgress !== null && (
          <div role="status" className="text-[13px] text-[#aaa]">
            Загрузка аватарки: {uploadProgress}%
            <progress aria-label="Загрузка аватарки" max={100} value={uploadProgress} className="w-full" />
          </div>
        )}
        {uploadError && <p role="alert" className="text-[13px] text-red-400">{uploadError}</p>}
        <div className="flex gap-2">
          <button
            onClick={onDone}
            disabled={uploadProgress !== null}
            className="flex-1 bg-transparent border border-[#333] text-[#666] rounded-lg py-2 text-[13px] cursor-pointer hover:border-[#555]"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving || uploadProgress !== null || !name.trim()}
            className="flex-1 bg-violet-700 text-white border-none rounded-lg py-2 text-[13px] font-semibold cursor-pointer hover:bg-violet-800 disabled:opacity-50"
          >
            {saving ? 'Сохраняем...' : player ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      </div>
    </>
  );
}
