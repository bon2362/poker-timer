import { render, screen, fireEvent, within } from '@testing-library/react';
import { GameDetail } from '@/components/games/GameDetail';
import { Leaderboard } from '@/components/games/Leaderboard';
import { metadata as catalogueMetadata } from '@/app/games/page';
import { metadata as layoutMetadata } from '@/app/games/layout';
import GamePage from '@/app/games/[slug]/page';
import { getGameBySlug } from '@/lib/games/queries';
import type { GameDetails } from '@/lib/games/queries';

jest.mock('@/lib/games/queries', () => ({ getGameBySlug: jest.fn() }));
jest.mock('next/font/google', () => ({ PT_Serif: () => ({ variable: 'serif' }) }));
jest.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
const game: GameDetails = {
  session: { id: 'game', slug: '2026-may-10', status: 'finished', createdAt: '2026-05-10T21:30:00Z', finishedAt: '2026-05-10T22:41:00Z', finishedAtApproximate: true,
    buyIn: 1000, initialStack: 10000, rebuyCost: 1000, rebuyChips: 10000, maxRebuys: 2, addonCost: 1000, addonChips: 10000, prizeSpots: 1, prizePcts: [100], numberOfTables: 1, mergeThreshold: 0, tablesMergedAt: null, blindStructure: null },
  players: [], winner: { id: 'sp', playerId: 'p', sessionId: 'game', name: 'Алекс', avatarUrl: null, rebuys: 0, hasAddon: false, status: 'winner', finishPosition: 1, payout: 1000, eliminatedAt: null, tableNumber: 1 },
  bank: 1000, photos: [], images: [],
};
test('leaderboard defaults to winnings and changes sort on click', () => {
  render(<Leaderboard rows={[
    { playerId: 'a', name: 'Алекс', avatarUrl: null, games: 2, wins: 1, prizes: 1, totalWon: 5000, net: -1000 },
    { playerId: 'b', name: 'Борис', avatarUrl: null, games: 1, wins: 1, prizes: 1, totalWon: 3000, net: 2000 },
  ]} />);
  const names = () => screen.getAllByTestId('leaderboard-row').map(row => within(row).getByTestId('player-name').textContent);
  expect(names()).toEqual(['Алекс', 'Борис']);
  fireEvent.click(screen.getAllByRole('button', { name: /Итог/ })[0]);
  expect(names()).toEqual(['Борис', 'Алекс']);
});
test('unknown game returns 404', async () => {
  (getGameBySlug as jest.Mock).mockResolvedValue(null);
  await expect(GamePage({ params: Promise.resolve({ slug: 'missing' }) })).rejects.toThrow('NOT_FOUND');
});
test('link description does not reveal the bank', async () => {
  (getGameBySlug as jest.Mock).mockResolvedValue(game);
  const { generateMetadata } = await import('@/app/games/[slug]/page');
  const metadata = await generateMetadata({ params: Promise.resolve({ slug: '2026-may-10' }) });
  expect(metadata.description).toBe('Победитель: Алекс. 0 игроков.');
  expect(metadata.openGraph?.description).toBe('Победитель: Алекс. 0 игроков.');
});

test('catalogue and parent layout forbid indexing for the entire games section', () => {
  expect(catalogueMetadata.robots).toEqual({ index: false, follow: false });
  expect(layoutMetadata.robots).toEqual({ index: false, follow: false });
});
test('exact game length uses the recorded start', () => {
  render(<GameDetail game={{ ...game, session: { ...game.session, startedAt: '2026-05-10T22:00:00Z', finishedAtApproximate: false } }} now={new Date('2026-11-01')} />);
  expect(screen.getByText('41 мин')).toBeInTheDocument();
});
