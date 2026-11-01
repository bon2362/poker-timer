/** @jest-environment node */
import { NextRequest } from 'next/server';

const mockRequireAdmin = jest.fn();
const mockClient = { from: jest.fn() };
jest.mock('@/lib/admin/requireAdmin', () => ({ requireAdmin: () => mockRequireAdmin() }));
jest.mock('@/lib/supabase/service', () => ({ getServiceClient: () => mockClient }));

import { POST } from '@/app/api/admin/player-images/route';

test('rejects player-image changes without an admin cookie', async () => {
  mockRequireAdmin.mockResolvedValue(new Response(null, { status: 401 }));
  const response = await POST(new NextRequest('http://localhost/api/admin/player-images', {
    method: 'POST', body: JSON.stringify({ playerId: 'p1', kind: 'winner', path: 'x.jpg' }),
  }));
  expect(response.status).toBe(401);
  expect(mockClient.from).not.toHaveBeenCalled();
});
