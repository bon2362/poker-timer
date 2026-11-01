import { toSession, toSessionPlayer } from '@/lib/supabase/sessions';

const sessionRow = {
  id: 'session-1', buy_in: 1000, initial_stack: 10000,
  rebuy_cost: 1000, rebuy_chips: 10000, max_rebuys: 0,
  addon_cost: 1000, addon_chips: 10000, prize_spots: 3,
  prize_pcts: [50, 30, 20], number_of_tables: 1, merge_threshold: 0,
  tables_merged_at: null, status: 'active', created_at: '2026-11-01T10:00:00Z',
};

const sessionPlayerRow = {
  id: 'session-player-1', session_id: 'session-1', player_id: 'player-1',
  rebuys: 0, has_addon: false, status: 'playing', finish_position: null,
  eliminated_at: null, table_number: 1,
};

describe('Supabase session mapping', () => {
  test('maps new game-history fields and defaults absent legacy fields to null', () => {
    expect(toSession(sessionRow)).toMatchObject({
      slug: null, startedAt: null, finishedAt: null, finishedAtApproximate: false, blindStructure: null,
    });
    expect(toSession({
      ...sessionRow,
      slug: '2026-november-01', started_at: '2026-11-01T18:00:00Z', finished_at: '2026-11-01T23:00:00Z',
      finished_at_approximate: true,
      blind_structure: { levelDuration: 20, breakDuration: 10, breakEvery: 2, blindLevels: [] },
    })).toMatchObject({
      slug: '2026-november-01', startedAt: '2026-11-01T18:00:00Z', finishedAt: '2026-11-01T23:00:00Z',
      finishedAtApproximate: true,
      blindStructure: { levelDuration: 20, breakDuration: 10, breakEvery: 2, blindLevels: [] },
    });
    expect(toSessionPlayer(sessionPlayerRow)).toMatchObject({ payout: null, loserImageId: null, winnerImageId: null });
    expect(toSessionPlayer({ ...sessionPlayerRow, payout: 9500, loser_image_id: 'loser-1', winner_image_id: 'winner-1' }))
      .toMatchObject({ payout: 9500, loserImageId: 'loser-1', winnerImageId: 'winner-1' });
  });
});
