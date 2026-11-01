/** @jest-environment node */
import AdminPage from '@/app/admin/page';
import GamePage from '@/app/admin/games/[slug]/page';
import NoGamePage from '@/app/admin/no-game/page';
import PlayersPage from '@/app/admin/players/page';
const mockAuth = jest.fn(); const mockService = jest.fn();
jest.mock('@/lib/admin/requireAdmin', () => ({ isAdminRequest: () => mockAuth() }));
jest.mock('@/lib/supabase/service', () => ({ getServiceClient: () => mockService() }));
jest.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); }, useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }), usePathname: () => '/admin' }));
beforeEach(() => { jest.clearAllMocks(); mockAuth.mockResolvedValue(false); });
test.each([
  ['games', () => AdminPage()],
  ['game', () => GamePage({ params: Promise.resolve({ slug: 'game' }) })],
  ['unassigned photos', () => NoGamePage()],
  ['players', () => PlayersPage()],
])('%s page redirects before reading private data', async (_, renderPage) => {
  await expect(renderPage()).rejects.toThrow('redirect:/admin/login'); expect(mockService).not.toHaveBeenCalled();
});
