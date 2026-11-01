/** @jest-environment node */
import { NextRequest } from 'next/server';
const requireAdmin = jest.fn();
jest.mock('@/lib/admin/requireAdmin', () => ({ requireAdmin: () => requireAdmin() }));
import { POST } from '@/app/api/admin/games/[id]/declare-winner/route';

test('declare-winner rejects requests without an admin cookie', async () => {
  requireAdmin.mockResolvedValue(new Response(null, { status: 401 }));
  const response = await POST(new NextRequest('http://localhost/api/admin/games/s1/declare-winner', { method: 'POST', body: JSON.stringify({ sessionPlayerId: 'sp1' }) }), { params: Promise.resolve({ id: 's1' }) });
  expect(response.status).toBe(401);
});
