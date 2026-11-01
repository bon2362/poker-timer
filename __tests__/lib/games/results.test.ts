import { assignPayouts, buildLeaderboard, calcPlayerCost, validateResultPositions } from '@/lib/games/results';
import type { Session, SessionPlayer } from '@/types/game';

const session: Session = {
  id: 's1', createdAt: '2026-11-01T19:00:00Z', status: 'finished',
  buyIn: 1000, initialStack: 10000, rebuyCost: 1000, rebuyChips: 10000, maxRebuys: 0,
  addonCost: 1000, addonChips: 10000, prizeSpots: 3, prizePcts: [50, 30, 20],
  numberOfTables: 1, mergeThreshold: 0, tablesMergedAt: null,
  slug: '2026-november-01', finishedAt: null, finishedAtApproximate: false, blindStructure: null,
};

function player(id: string, overrides: Partial<SessionPlayer> = {}): SessionPlayer {
  return { id, sessionId: 's1', playerId: id, rebuys: 0, hasAddon: false, status: 'eliminated',
    finishPosition: null, eliminatedAt: null, tableNumber: 1, payout: null, loserImageId: null, winnerImageId: null, ...overrides };
}

describe('game results', () => {
  test('assigns prizes with the last prize absorbing rounding and calculates player cost', () => {
    const players = [player('1', { finishPosition: 1 }), player('2', { finishPosition: 2 }), player('3', { finishPosition: 3 }), player('4', { finishPosition: 4 })];
    expect(assignPayouts({ ...session, buyIn: 4750 }, players)).toEqual([
      { id: '1', payout: 9500 }, { id: '2', payout: 5700 }, { id: '3', payout: 3800 }, { id: '4', payout: 0 },
    ]);
    expect(assignPayouts({ ...session, buyIn: 2500, prizePcts: [33, 33, 34] }, players).slice(0, 3))
      .toEqual([{ id: '1', payout: 3300 }, { id: '2', payout: 3300 }, { id: '3', payout: 3400 }]);
    expect(calcPlayerCost(session, player('cost', { rebuys: 2, hasAddon: true }))).toBe(4000);
  });

  test('requires consecutive result positions and retains negative leaderboard net', () => {
    expect(validateResultPositions([1, 2, 3])).toBe(true);
    expect(validateResultPositions([1, 1, 3])).toBe(false);
    expect(validateResultPositions([1, 3])).toBe(false);
    expect(validateResultPositions([])).toBe(false);
    expect(buildLeaderboard([{ session, players: [player('p1', { finishPosition: 1, payout: 500 }), player('p2', { finishPosition: 2, payout: 0 })] }]))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ playerId: 'p1', games: 1, wins: 1, prizes: 1, totalWon: 500, net: -500 }),
        expect.objectContaining({ playerId: 'p2', games: 1, wins: 0, prizes: 0, totalWon: 0, net: -1000 }),
      ]));
  });
});
