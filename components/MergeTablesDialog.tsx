'use client';

type Props = {
  activePlayers: number;
  mergeThreshold: number;
  onConfirm: () => void;
  onCancel: () => void;
  confirming?: boolean;
};

export function MergeTablesDialog({ activePlayers, mergeThreshold, onConfirm, onCancel, confirming = false }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[360px] rounded-2xl border border-[#3a3a3a] bg-[#1e1e1e] p-6 text-center shadow-2xl">
        <div className="text-[11px] text-[#555] tracking-[2px] uppercase mb-2">Два стола</div>
        <h2 className="text-[22px] font-black text-[#eee] mb-3">Объединить столы?</h2>
        <p className="text-[14px] leading-6 text-[#888] mb-6">
          В игре осталось {activePlayers}. Порог объединения: {mergeThreshold}.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={confirming}
            className="rounded-lg border border-[#444] bg-[#242424] px-4 py-3 text-[14px] font-semibold text-[#aaa] hover:bg-[#2a2a2a] disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className="rounded-lg border border-green-600 bg-green-700 px-4 py-3 text-[14px] font-semibold text-white hover:bg-green-600 disabled:opacity-50"
          >
            {confirming ? 'Объединяем...' : 'Объединить'}
          </button>
        </div>
      </div>
    </div>
  );
}
