// lib/game.ts
import type { Session, SessionPlayer, GameStats } from '@/types/game';

export function calcGameStats(session: Session, players: SessionPlayer[]): GameStats {
  const totalPlayers = players.length;
  const totalRebuys = players.reduce((sum, p) => sum + p.rebuys, 0);
  const totalAddons = players.filter(p => p.hasAddon).length;
  const activePlayers = players.filter(p => p.status === 'playing').length;

  const bank =
    totalPlayers * session.buyIn +
    totalRebuys * session.rebuyCost +
    totalAddons * session.addonCost;

  const totalChips =
    totalPlayers * session.initialStack +
    totalRebuys * session.rebuyChips +
    totalAddons * session.addonChips;

  const avgStack = activePlayers > 0 ? Math.floor(totalChips / activePlayers) : 0;

  // Distribute payouts; last spot absorbs rounding remainder
  const payouts: number[] = [];
  let remaining = bank;
  for (let i = 0; i < session.prizeSpots - 1; i++) {
    const payout = Math.floor(bank * session.prizePcts[i] / 100);
    payouts.push(payout);
    remaining -= payout;
  }
  if (session.prizeSpots > 0) payouts.push(remaining);

  return { bank, totalChips, avgStack, payouts };
}
