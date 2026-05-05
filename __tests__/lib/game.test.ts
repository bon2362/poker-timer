// __tests__/lib/game.test.ts
import { calcGameStats } from '@/lib/game';
import type { Session, SessionPlayer } from '@/types/game';

const baseSession: Session = {
  id: 's1', createdAt: '', status: 'active',
  buyIn: 1000, initialStack: 10000,
  rebuyCost: 500, rebuyChips: 5000, maxRebuys: 0,
  addonCost: 500, addonChips: 5000,
  prizeSpots: 3, prizePcts: [50, 30, 20],
  numberOfTables: 1, mergeThreshold: 0, tablesMergedAt: null,
};

function sp(overrides: Partial<SessionPlayer> = {}): SessionPlayer {
  return {
    id: 'sp1', sessionId: 's1', playerId: 'p1',
    rebuys: 0, hasAddon: false,
    status: 'playing', finishPosition: null, eliminatedAt: null,
    tableNumber: 1,
    ...overrides,
  };
}

describe('calcGameStats', () => {
  test('basic bank with no rebuys/addons', () => {
    const players = [sp(), sp({ id: 'sp2', playerId: 'p2' })];
    const stats = calcGameStats(baseSession, players);
    expect(stats.bank).toBe(2000);
    expect(stats.totalChips).toBe(20000);
  });

  test('bank includes rebuys', () => {
    const players = [sp({ rebuys: 2 }), sp({ id: 'sp2', playerId: 'p2' })];
    const stats = calcGameStats(baseSession, players);
    expect(stats.bank).toBe(2000 + 2 * 500);
    expect(stats.totalChips).toBe(20000 + 2 * 5000);
  });

  test('bank includes addons', () => {
    const players = [sp({ hasAddon: true }), sp({ id: 'sp2', playerId: 'p2' })];
    const stats = calcGameStats(baseSession, players);
    expect(stats.bank).toBe(2000 + 500);
    expect(stats.totalChips).toBe(20000 + 5000);
  });

  test('avgStack uses only active players', () => {
    const players = [
      sp({ status: 'playing' }),
      sp({ id: 'sp2', playerId: 'p2', status: 'eliminated' }),
    ];
    const stats = calcGameStats(baseSession, players);
    expect(stats.avgStack).toBe(20000); // 20000 chips / 1 active player
  });

  test('payouts sum equals bank', () => {
    const players = [sp(), sp({ id: 'sp2', playerId: 'p2' }), sp({ id: 'sp3', playerId: 'p3' })];
    const stats = calcGameStats(baseSession, players);
    const total = stats.payouts.reduce((a, b) => a + b, 0);
    expect(total).toBe(stats.bank);
  });

  test('last payout absorbs rounding remainder', () => {
    const oddSession: Session = { ...baseSession, buyIn: 333, prizePcts: [50, 30, 20] };
    const players = [sp(), sp({ id: 'sp2', playerId: 'p2' }), sp({ id: 'sp3', playerId: 'p3' })];
    const stats = calcGameStats(oddSession, players);
    expect(stats.payouts.reduce((a, b) => a + b, 0)).toBe(stats.bank);
  });

  test('avgStack is 0 when no active players', () => {
    const players = [sp({ status: 'eliminated' })];
    const stats = calcGameStats(baseSession, players);
    expect(stats.avgStack).toBe(0);
  });

  test('can scope stats to a single table', () => {
    const twoTableSession = { ...baseSession, numberOfTables: 2, mergeThreshold: 2 };
    const players = [
      sp({ id: 'sp1', playerId: 'p1', tableNumber: 1, rebuys: 1 }),
      sp({ id: 'sp2', playerId: 'p2', tableNumber: 2, hasAddon: true }),
      sp({ id: 'sp3', playerId: 'p3', tableNumber: 2 }),
    ];

    const stats = calcGameStats(twoTableSession, players, 2);

    expect(stats.bank).toBe(2500);
    expect(stats.totalChips).toBe(25000);
    expect(stats.avgStack).toBe(12500);
  });
});
