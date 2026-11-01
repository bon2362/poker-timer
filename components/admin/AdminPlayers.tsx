'use client';
import { GameProvider } from '@/context/GameContext';
import { PlayerManager } from '@/components/PlayerManager/PlayerManager';
export function AdminPlayers() { return <GameProvider><PlayerManager flush /></GameProvider>; }
