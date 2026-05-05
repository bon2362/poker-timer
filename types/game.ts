// types/game.ts
export type SessionStatus = 'setup' | 'active' | 'finished'
export type PlayerStatus = 'playing' | 'eliminated' | 'winner'

export type Player = {
  id: string
  name: string
  avatarUrl: string | null
  createdAt: string
}

export type Session = {
  id: string
  buyIn: number           // RSD
  initialStack: number    // chips
  rebuyCost: number       // RSD, 0 = disabled
  rebuyChips: number      // chips per rebuy
  maxRebuys: number       // 0 = unlimited
  addonCost: number       // RSD, 0 = disabled
  addonChips: number      // chips per addon
  prizeSpots: number
  prizePcts: number[]     // e.g. [50, 30, 20], must sum to 100
  numberOfTables: number
  mergeThreshold: number
  tablesMergedAt: string | null
  status: SessionStatus
  createdAt: string
}

export type SessionPlayer = {
  id: string
  sessionId: string
  playerId: string
  rebuys: number
  hasAddon: boolean
  status: PlayerStatus
  finishPosition: number | null   // 1 = winner, 2 = runner-up, etc.
  eliminatedAt: string | null
  tableNumber: number
}

export type GameStats = {
  bank: number
  totalChips: number
  avgStack: number
  payouts: number[]  // index 0 = 1st place payout
}

export type NewSessionData = Omit<Session, 'id' | 'createdAt' | 'status'>
