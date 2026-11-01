import { act, render, screen, waitFor } from '@testing-library/react';
import { AdminAuthProvider, useAdminAuth } from '@/context/AdminAuthContext';

function Status() {
  const { isAdmin, checking, login } = useAdminAuth();
  return <>
    <output>{checking ? 'checking' : isAdmin ? 'admin' : 'viewer'}</output>
    <button onClick={() => void login('test-password').catch(() => undefined)}>login</button>
  </>;
}

const fetchMock = jest.fn();
const originalFetch = global.fetch;
beforeEach(() => { global.fetch = fetchMock; fetchMock.mockReset(); });
afterAll(() => { global.fetch = originalFetch; });

function response(authenticated: boolean, ok = true) {
  return { ok, json: async () => ({ authenticated }) };
}

test('keeps controls locked while checking the saved session, then restores admin', async () => {
  let resolve!: (value: unknown) => void;
  fetchMock.mockImplementation((url: string) => {
    if (url !== '/api/admin/session') throw new Error('Unexpected URL');
    return new Promise(r => { resolve = r; });
  });
  render(<AdminAuthProvider><Status /></AdminAuthProvider>);
  expect(screen.getByRole('status')).toHaveTextContent('checking');
  await act(async () => { resolve(response(true)); });
  expect(screen.getByRole('status')).toHaveTextContent('admin');
});

test('successful password login changes viewer to admin', async () => {
  fetchMock.mockImplementation(async (url: string, options?: RequestInit) => {
    if (url === '/api/admin/session') return response(false);
    if (url === '/api/admin/login' && options?.method === 'POST' && options.body === JSON.stringify({ password: 'test-password' })) return response(true);
    throw new Error('Unexpected request');
  });
  render(<AdminAuthProvider><Status /></AdminAuthProvider>);
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('viewer'));
  await act(async () => { screen.getByRole('button').click(); });
  expect(screen.getByRole('status')).toHaveTextContent('admin');
});

test.each(['unauthorized', 'network', 'malformed'])('fails closed for %s session response', async failure => {
  fetchMock.mockImplementation(async () => {
    if (failure === 'network') throw new Error('offline');
    return failure === 'malformed' ? { ok: true, json: async () => ({ authenticated: 'true' }) } : response(false, false);
  });
  render(<AdminAuthProvider><Status /></AdminAuthProvider>);
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('viewer'));
});


test('failed login clears checking even if initial session request is still pending', async () => {
  fetchMock.mockImplementation((url: string) => url === '/api/admin/session' ? new Promise(() => {}) : Promise.reject(new Error('offline')));
  render(<AdminAuthProvider><Status /></AdminAuthProvider>);
  expect(screen.getByRole('status')).toHaveTextContent('checking');
  await act(async () => { screen.getByRole('button').click(); });
  expect(screen.getByRole('status')).toHaveTextContent('viewer');
});
