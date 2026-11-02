import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminAuthProvider, useAdminAuth } from '@/context/AdminAuthContext';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
function Form() {
  const { isAdmin } = useAdminAuth();
  return <><AdminLoginForm /><output>{isAdmin ? 'admin' : 'viewer'}</output></>;
}
function setup(outcome: 'wrong' | 'success' | 'offline') {
  global.fetch = jest.fn(async (url, init) => {
    if (url === '/api/admin/session') return { ok: true, json: async () => ({ authenticated: false }) } as Response;
    if (url !== '/api/admin/login' || init?.method !== 'POST' || init?.body !== JSON.stringify({ password: 'secret' })) throw new Error('Unexpected request');
    if (outcome === 'offline') throw new Error('offline');
    return { ok: outcome === 'success', json: async () => ({ authenticated: outcome === 'success' }) } as Response;
  });
  render(<AdminAuthProvider><Form /></AdminAuthProvider>);
}

test('wrong password shows an accessible error and keeps viewer access', async () => {
  setup('wrong');
  const user = userEvent.setup();
  const input = screen.getByLabelText('Пароль');
  expect(input).toHaveFocus();
  expect(input).toHaveAttribute('type', 'password');
  await user.type(input, 'secret{Enter}');
  expect(await screen.findByRole('alert')).toHaveTextContent('Неверный пароль');
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('status')).toHaveTextContent('viewer');
  expect(screen.getByRole('button', { name: 'Войти' })).toBeEnabled();
});

test('network failure offers a retry without unlocking controls', async () => {
  setup('offline');
  await userEvent.setup().type(screen.getByLabelText('Пароль'), 'secret{Enter}');
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось войти');
  expect(screen.getByRole('status')).toHaveTextContent('viewer');
  expect(screen.getByRole('button', { name: 'Войти' })).toBeEnabled();
});
