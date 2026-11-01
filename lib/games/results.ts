import { calcGameStats } from '@/lib/game';
import type { Session, SessionPlayer } from '@/types/game';

export type LeaderboardRow = {
  playerId: string;
  games: number;
  wins: number;
  prizes: number;
  totalWon: number;
  net: number;
};

export function assignPayouts(session: Session, players: SessionPlayer[]): { id: string; payout: number }[] {
  const payouts = calcGameStats(session, players).payouts;
  return players.map(player => ({
    id: player.id,
    payout: player.finishPosition && player.finishPosition <= payouts.length ? payouts[player.finishPosition - 1] : 0,
  }));
}

export function calcPlayerCost(session: Session, player: SessionPlayer): number {
  return session.buyIn + player.rebuys * session.rebuyCost + (player.hasAddon ? session.addonCost : 0);
}

export function validateResultPositions(positions: number[]): boolean {
  return positions.length > 0 && [...positions].sort((a, b) => a - b).every((position, index) => position === index + 1);
}

export function buildLeaderboard(games: { session: Session; players: SessionPlayer[] }[]): LeaderboardRow[] {
  const rows = new Map<string, LeaderboardRow>();
  for (const { session, players } of games) {
    for (const player of players) {
      const previous = rows.get(player.playerId) ?? {
        playerId: player.playerId, games: 0, wins: 0, prizes: 0, totalWon: 0, net: 0,
      };
      const payout = player.payout ?? 0;
      rows.set(player.playerId, {
        ...previous,
        games: previous.games + 1,
        wins: previous.wins + (player.finishPosition === 1 ? 1 : 0),
        prizes: previous.prizes + (payout > 0 ? 1 : 0),
        totalWon: previous.totalWon + payout,
        net: previous.net + payout - calcPlayerCost(session, player),
      });
    }
  }
  return [...rows.values()];
}
