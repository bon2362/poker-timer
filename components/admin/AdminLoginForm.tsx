'use client';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { useAdminAuth } from '@/context/AdminAuthContext';

type Props = {
  onSuccess?: () => void;
  onClose?: () => void;
  redirectTo?: string;
};

export function AdminLoginForm({ onSuccess, onClose, redirectTo }: Props) {
  const { isAdmin, login } = useAdminAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputId = useId();
  const errorId = `${inputId}-error`;

  useEffect(() => {
    if (isAdmin && redirectTo) window.location.replace(redirectTo);
  }, [isAdmin, redirectTo]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      if (await login(password)) {
        setPassword('');
        onSuccess?.();
      } else {
        setError('Неверный пароль. Попробуйте ещё раз.');
      }
    } catch {
      setError('Не удалось войти. Проверьте соединение и попробуйте ещё раз.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-[360px] mx-auto text-white font-sans">
      <div className="flex flex-col items-center mb-8 gap-4">
        <img src="/poker-timer-favicon/favicon.svg" alt="Poker Timer" className="w-[52px] h-[52px]" />
        <h1 className="text-[13px] font-semibold tracking-[3px] text-[#8a8a8a]">АДМИНКА</h1>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="bg-[#242424] rounded-lg p-3.5">
          <label htmlFor={inputId} className="block text-[11px] text-[#8a8a8a] tracking-[1px] uppercase mb-2">Пароль</label>
          <input
            id={inputId}
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            value={password}
            onChange={event => setPassword(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className={`h-12 w-full bg-[#333] border rounded-md text-lg px-3 outline-none focus:ring-2 focus:ring-violet-500 ${error ? 'border-red-500' : 'border-[#444]'}`}
          />
          {error && <p id={errorId} role="alert" className="text-[13px] text-red-400 mt-2">{error}</p>}
        </div>
        <button type="submit" disabled={submitting} className="h-12 bg-violet-700 hover:bg-violet-800 rounded-lg text-[15px] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-wait">
          {submitting ? 'Вход…' : 'Войти'}
        </button>
      </form>
      {onClose ? (
        <button type="button" onClick={onClose} className="block mx-auto mt-4 min-h-11 text-[14px] text-violet-400 cursor-pointer">← На сайт</button>
      ) : (
        <a href="/" className="flex items-center justify-center mt-4 min-h-11 text-[14px] text-violet-400">← На сайт</a>
      )}
    </div>
  );
}

export function AdminLoginDialog({ onSuccess, onClose }: Pick<Props, 'onSuccess' | 'onClose'>) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Вход в управление" onKeyDown={event => { if (event.key === 'Escape') onClose?.(); }} className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#1a1a1a]/95 p-4">
      <AdminLoginForm onSuccess={onSuccess} onClose={onClose} />
    </div>
  );
}
