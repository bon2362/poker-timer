'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import { useTimer } from '@/context/TimerContext';
import { useGame } from '@/context/GameContext';
import { BlindInfo } from './BlindInfo';
import { TimerDisplay } from './TimerDisplay';
import { Controls } from './Controls';
import { CombosPanel } from './CombosPanel';
import { SettingsScreen } from './SettingsScreen';
import { GamePanel } from './GamePanel/GamePanel';
import { WinnerScreen } from './WinnerScreen/WinnerScreen';
import { SlideshowOverlay } from './SlideshowOverlay';
import TractorOverlay from './TractorOverlay';
import { FinalGameSlideshowOverlay } from './FinalGameSlideshowOverlay';
import { MinuteTimerOverlay } from './MinuteTimerOverlay';
import { LoserImageOverlay } from './LoserImageOverlay';
import { MergeTablesDialog } from './MergeTablesDialog';
import { useBreakSong } from './BreakSongPlayer';
import { listSlideshowPhotos } from '@/lib/supabase/slideshow';
import { getLoserImageUrl } from '@/lib/supabase/loserImage';
import { getWinnerImageUrl } from '@/lib/supabase/winnerImage';
import type { Config } from '@/types/timer';
import type { PlayerStatus } from '@/types/game';

type LoserOverlayState = {
  sessionPlayerId: string;
  playerName: string;
  imageUrl: string;
};

export function PokerTimer() {
  const { state, dispatch } = useTimer();
  const { activeSession, showWinner, loading, sessionPlayers, players, finishGame } = useGame();

  const [controlsVisible, setControlsVisible] = useState(true);
  const [loserOverlay, setLoserOverlay] = useState<LoserOverlayState | null>(null);
  const [finalSlideshowVisible, setFinalSlideshowVisible] = useState(false);
  const [mergeDialogDismissedAtCount, setMergeDialogDismissedAtCount] = useState<number | null>(null);
  const [mergeConfirming, setMergeConfirming] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalSlideshowDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gamePanelAutoOpenedRef = useRef(false);
  const sessionPlayerStatusRef = useRef<Map<string, PlayerStatus>>(new Map());
  const eliminatedSessionPlayerIdsRef = useRef<Set<string>>(new Set());

  // Slideshow state
  const [slideshowUrls, setSlideshowUrls] = useState<string[]>([]);
  const [slideshowCurrentUrl, setSlideshowCurrentUrl] = useState<string | null>(null);
  const slideshowTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slideshowIndexRef = useRef(0);
  const slideshowShuffledRef = useRef<number[]>([]);

  // Auto-open panel when session becomes active (if not already explicitly hidden)
  useEffect(() => {
    if (activeSession && !gamePanelAutoOpenedRef.current) {
      dispatch({ type: 'RESTORE_DISPLAY', showCombos: state.config.showCombos, showPlayers: true });
      gamePanelAutoOpenedRef.current = true;
    }
    if (!activeSession) {
      gamePanelAutoOpenedRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession]);

  // Auto-hide controls on mouse inactivity
  useEffect(() => {
    function showControls() {
      setControlsVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
    }
    document.addEventListener('mousemove', showControls);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
    return () => {
      document.removeEventListener('mousemove', showControls);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  useEffect(() => {
    eliminatedSessionPlayerIdsRef.current = new Set(
      sessionPlayers.filter(sp => sp.status === 'eliminated').map(sp => sp.id)
    );
  }, [sessionPlayers]);

  // Show the prepared fullscreen image when a player newly becomes eliminated.
  useEffect(() => {
    if (!activeSession) {
      sessionPlayerStatusRef.current = new Map();
      setLoserOverlay(null);
      return;
    }

    const previousStatuses = sessionPlayerStatusRef.current;
    const newlyEliminated = sessionPlayers.find(sp => {
      const previous = previousStatuses.get(sp.id);
      return previous !== undefined && previous !== 'eliminated' && sp.status === 'eliminated';
    });

    sessionPlayerStatusRef.current = new Map(sessionPlayers.map(sp => [sp.id, sp.status]));

    if (!newlyEliminated) return;

    const player = players.find(p => p.id === newlyEliminated.playerId);
    if (!player) return;

    getLoserImageUrl(player.id).then(imageUrl => {
      if (!imageUrl) return;
      if (!eliminatedSessionPlayerIdsRef.current.has(newlyEliminated.id)) return;

      setLoserOverlay({
        sessionPlayerId: newlyEliminated.id,
        playerName: player.name,
        imageUrl,
      });
    });
  }, [activeSession, players, sessionPlayers]);

  // If the player is returned to active play, close the loser image immediately.
  useEffect(() => {
    if (!loserOverlay) return;
    const isStillEliminated = sessionPlayers.some(
      sp => sp.id === loserOverlay.sessionPlayerId && sp.status === 'eliminated'
    );
    if (!isStillEliminated) setLoserOverlay(null);
  }, [loserOverlay, sessionPlayers]);

  // Keyboard: Space / PageDown / PageUp → toggle pause (only when session active)
  // PageDown & PageUp support USB presentation clickers (HP 2.4GHz etc.)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!activeSession) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.code) {
        case 'Space':
        case 'PageDown':
        case 'PageUp':
          e.preventDefault();
          dispatch({ type: 'TOGGLE_PAUSE' });
          break;
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [activeSession, dispatch]);

  // Load slideshow photos on mount and preload them into browser cache
  useEffect(() => {
    listSlideshowPhotos().then(urls => {
      setSlideshowUrls(urls);
      urls.forEach(url => { const img = new Image(); img.src = url; });
    });
  }, []);

  // Preload loser/winner images for all players when session starts
  useEffect(() => {
    if (!activeSession || players.length === 0) return;
    players.forEach(player => {
      getLoserImageUrl(player.id).then(url => {
        if (url) { const img = new Image(); img.src = url; }
      });
      getWinnerImageUrl(player.id).then(url => {
        if (url) { const img = new Image(); img.src = url; }
      });
    });
  }, [activeSession, players]);

  async function handleSlideshowChanged() {
    const urls = await listSlideshowPhotos();
    setSlideshowUrls(urls);
  }

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const handleCloseLoserOverlay = useCallback(() => {
    setLoserOverlay(null);
  }, []);

  const handleFinishGame = useCallback(async () => {
    if (!state.isPaused) {
      dispatch({ type: 'TOGGLE_PAUSE' });
    }
    await finishGame();
    setFinalSlideshowVisible(false);
    dispatch({ type: 'OPEN_SETTINGS' });
  }, [dispatch, finishGame, state.isPaused]);

  const handleSaveSettings = useCallback((config: Config) => {
    dispatch({ type: 'SAVE_SETTINGS', config });
  }, [dispatch]);

  const handleSaveDisplayConfig = useCallback((config: Config) => {
    dispatch({ type: 'SAVE_DISPLAY_CONFIG', config });
  }, [dispatch]);

  const stage = state.stages[state.currentStage];
  const isWarning = state.timeLeft <= 60 && state.timeLeft >= 0 && stage.type !== 'break';
  const isOnBreak = !state.isOver && stage?.type === 'break';
  const isTwoTableActive = activeSession?.numberOfTables === 2 && !activeSession.tablesMergedAt;
  const activePlayersCount = sessionPlayers.filter(sp => sp.status === 'playing').length;
  const activePlayersLabel = isTwoTableActive
    ? `${sessionPlayers.filter(sp => sp.status === 'playing' && sp.tableNumber === 1).length} / ${sessionPlayers.filter(sp => sp.status === 'playing' && sp.tableNumber === 2).length}`
    : undefined;
  const shouldPromptMerge = Boolean(
    isTwoTableActive &&
    activeSession &&
    activeSession.mergeThreshold > 0 &&
    activePlayersCount <= activeSession.mergeThreshold &&
    mergeDialogDismissedAtCount !== activePlayersCount
  );

  const { songPaused, toggleSong, songTime } = useBreakSong(isOnBreak && state.config.breakSongEnabled);

  useEffect(() => {
    if (!shouldPromptMerge) return;
    dispatch({ type: 'PAUSE_TIMER' });
  }, [dispatch, shouldPromptMerge]);

  useEffect(() => {
    if (!isTwoTableActive) {
      setMergeDialogDismissedAtCount(null);
      setMergeConfirming(false);
      return;
    }
    if (activeSession && activePlayersCount > activeSession.mergeThreshold) {
      setMergeDialogDismissedAtCount(null);
    }
  }, [activePlayersCount, activeSession, isTwoTableActive]);

  const handleCancelMerge = useCallback(() => {
    setMergeDialogDismissedAtCount(activePlayersCount);
    setMergeConfirming(false);
    dispatch({ type: 'RESUME_TIMER' });
  }, [activePlayersCount, dispatch]);

  useEffect(() => {
    if (finalSlideshowDelayRef.current) {
      clearTimeout(finalSlideshowDelayRef.current);
      finalSlideshowDelayRef.current = null;
    }

    setFinalSlideshowVisible(false);

    if (!showWinner || !activeSession) return;

    finalSlideshowDelayRef.current = setTimeout(() => {
      setFinalSlideshowVisible(true);
      finalSlideshowDelayRef.current = null;
    }, 31000);

    return () => {
      if (finalSlideshowDelayRef.current) {
        clearTimeout(finalSlideshowDelayRef.current);
        finalSlideshowDelayRef.current = null;
      }
    };
  }, [activeSession, showWinner]);

  // Slideshow start/stop
  useEffect(() => {
    const urls = slideshowUrls;
    const shouldStart = isOnBreak && state.config.slideshowEnabled && urls.length > 0;

    if (!shouldStart) {
      if (slideshowTimerRef.current) { clearInterval(slideshowTimerRef.current); slideshowTimerRef.current = null; }
      setSlideshowCurrentUrl(null);
      return;
    }

    // Fisher-Yates shuffle
    const idxs = urls.map((_, i) => i);
    for (let i = idxs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
    }
    slideshowShuffledRef.current = idxs;
    slideshowIndexRef.current = 0;
    setSlideshowCurrentUrl(urls[idxs[0]]);

    const speed = Math.max(1, state.config.slideshowSpeed || 5) * 1000;
    slideshowTimerRef.current = setInterval(() => {
      slideshowIndexRef.current = (slideshowIndexRef.current + 1) % slideshowShuffledRef.current.length;
      setSlideshowCurrentUrl(urls[slideshowShuffledRef.current[slideshowIndexRef.current]]);
    }, speed);

    return () => { if (slideshowTimerRef.current) clearInterval(slideshowTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnBreak, state.config.slideshowEnabled, slideshowUrls.length]);

  // Next blind info (last stage has no "next" — level is infinite)
  const nextStage = state.stages[state.currentStage + 1];
  let nextText = '';
  if (!nextStage) {
    nextText = '';
  } else if (nextStage.type === 'break') {
    nextText = `☕ Перерыв ${nextStage.duration / 60} мин`;
  } else {
    nextText = `${nextStage.sb} / ${nextStage.bb}`;
  }

  if (state.screen === 'settings') {
    return (
      <SettingsScreen
        config={state.config}
        onSave={handleSaveSettings}
        onDisplaySave={handleSaveDisplayConfig}
        onClose={() => dispatch({ type: 'CLOSE_SETTINGS' })}
        onJumpToEnd={() => {
          dispatch({ type: 'JUMP_TO_END' });
          dispatch({ type: 'CLOSE_SETTINGS' });
        }}
        onSlideshowChanged={handleSlideshowChanged}
      />
    );
  }

  return (
    <div className={`flex flex-col h-screen overflow-hidden select-none transition-[background] duration-[1500ms] ${isWarning ? 'bg-[#3a1a0a]' : 'bg-[#1a1a1a]'}`}>
      {/* Top bar */}
      <div className="relative w-full px-7 pt-5">
        <BlindInfo stage={stage} />
        <div className="absolute top-5 right-10 flex gap-1 items-center">
          <button
            className="bg-transparent border-none text-[#555] text-[20px] cursor-pointer p-1 w-8"
            onClick={toggleFullscreen}
            title="Fullscreen"
          >
            ⛶
          </button>
          <button
            className="bg-transparent border-none text-[#383838] text-[20px] cursor-pointer p-1 w-8 hover:text-[#555] transition-colors"
            onClick={() => dispatch({ type: 'OPEN_SETTINGS' })}
            title="Settings"
          >
            {'⚙\uFE0E'}
          </button>
        </div>
      </div>

      {/* Timer — flex-1 wrapper with z-30 during tractor moment so timer floats above video overlay */}
      {!state.isOver && (
        state.tractorMomentActive
          ? <div className="relative z-30 flex-1 flex flex-col"><TimerDisplay timeLeft={state.timeLeft} stage={stage} isPaused={state.isPaused} activePlayersLabel={activePlayersLabel} /></div>
          : <TimerDisplay timeLeft={state.timeLeft} stage={stage} isPaused={state.isPaused} activePlayersLabel={activePlayersLabel} />
      )}

      {/* Tournament over */}
      {state.isOver && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <h1 className="text-[48px] font-black text-violet-600">Tournament Over</h1>
          <p className="text-[#888] text-[18px]">Хорошая игра!</p>
          <button
            className="bg-violet-700 text-white border-none rounded-lg px-6 h-11 text-[15px] cursor-pointer hover:bg-violet-800"
            onClick={() => dispatch({ type: 'RESTART' })}
          >
            ↺ Начать заново
          </button>
        </div>
      )}

      {/* Combos panel */}
      {!state.isOver && (
        <CombosPanel
          visible={state.config.showCombos !== false}
          onToggle={() => dispatch({ type: 'TOGGLE_COMBOS' })}
        />
      )}

      {/* Slideshow overlay — shown during breaks when enabled and photos are loaded */}
      {slideshowCurrentUrl && isOnBreak && (
        <SlideshowOverlay
          url={slideshowCurrentUrl}
          timeLeft={state.timeLeft}
          songTime={isOnBreak && state.config.breakSongEnabled ? songTime : undefined}
          showLyrics={isOnBreak && state.config.breakSongEnabled}
        />
      )}

      {/* Controls on top of slideshow — appear on mouse move */}
      {slideshowCurrentUrl && isOnBreak && (
        <div className="fixed inset-x-0 bottom-0 z-30">
          <Controls
            isPaused={state.isPaused}
            isOver={state.isOver}
            visible={controlsVisible}
            onPrev={() => dispatch({ type: 'PREV_STAGE' })}
            onTogglePause={() => dispatch({ type: 'TOGGLE_PAUSE' })}
            onNext={() => dispatch({ type: 'NEXT_STAGE' })}
            songMuted={state.config.breakSongEnabled ? songPaused : undefined}
            onToggleSong={state.config.breakSongEnabled ? toggleSong : undefined}
          />
        </div>
      )}

      {/* Tractor moment — audio + video overlay (z-20), timer and controls remain above */}
      {state.tractorMomentActive && !state.isOver && (
        <TractorOverlay timeLeft={state.timeLeft} isPaused={state.isPaused} />
      )}

      {/* Controls on top of tractor video overlay */}
      {state.tractorMomentActive && !state.isOver && (
        <div className="fixed inset-x-0 bottom-0 z-30">
          <Controls
            isPaused={state.isPaused}
            isOver={state.isOver}
            visible={controlsVisible}
            onPrev={() => dispatch({ type: 'PREV_STAGE' })}
            onTogglePause={() => dispatch({ type: 'TOGGLE_PAUSE' })}
            onNext={() => dispatch({ type: 'NEXT_STAGE' })}
          />
        </div>
      )}

      {/* Next blind info */}
      {!state.isOver && nextText && (
        <div className="pb-2 text-center pointer-events-none">
          <div className="text-[11px] text-[#383838] tracking-[2px] uppercase mb-1">Далее</div>
          <div className="font-bold text-[#444] leading-tight" style={{ fontSize: 'clamp(58px, 8vw, 96px)' }}>
            {nextText}
          </div>
        </div>
      )}

      {/* Controls — below next blind info so they never overlap */}
      {!state.isOver && !state.tractorMomentActive && (
        <Controls
          isPaused={state.isPaused}
          isOver={state.isOver}
          visible={controlsVisible}
          onPrev={() => dispatch({ type: 'PREV_STAGE' })}
          onTogglePause={() => dispatch({ type: 'TOGGLE_PAUSE' })}
          onNext={() => dispatch({ type: 'NEXT_STAGE' })}
          songMuted={isOnBreak && state.config.breakSongEnabled ? songPaused : undefined}
          onToggleSong={isOnBreak && state.config.breakSongEnabled ? toggleSong : undefined}
        />
      )}

      {/* Clock */}
      <ClockDisplay />

      {/* Session overlay — shown when loading done and no active session */}
      {!loading && !activeSession && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1e1e1e] border border-[#333] rounded-2xl p-8 text-center max-w-[320px]">
            <div className="text-4xl mb-4">🃏</div>
            <h2 className="text-[18px] font-semibold text-[#ccc] mb-2">Игра не настроена</h2>
            <p className="text-[14px] text-[#666] mb-6">Настройте игроков и параметры сессии перед стартом таймера</p>
            <button
              className="bg-violet-700 text-white border-none rounded-lg px-6 py-3 text-[15px] font-semibold cursor-pointer hover:bg-violet-800 w-full"
              onClick={() => dispatch({ type: 'OPEN_SETTINGS' })}
            >
              Открыть настройки
            </button>
          </div>
        </div>
      )}

      {/* Game panel */}
      {activeSession && (
        <GamePanel isOpen={state.config.showPlayers} onToggle={() => dispatch({ type: 'TOGGLE_GAME_PANEL' })} />
      )}

      {activeSession && shouldPromptMerge && (
        <MergeTablesDialog
          activePlayers={activePlayersCount}
          mergeThreshold={activeSession.mergeThreshold}
          confirming={mergeConfirming}
          onConfirm={() => setMergeConfirming(true)}
          onCancel={handleCancelMerge}
        />
      )}

      {/* Minute timer overlay */}
      <MinuteTimerOverlay />

      {/* Loser image overlay */}
      {loserOverlay && !state.isOver && (
        <LoserImageOverlay
          imageUrl={loserOverlay.imageUrl}
          playerName={loserOverlay.playerName}
          timeLeft={state.timeLeft}
          stage={stage}
          isPaused={state.isPaused}
          onClose={handleCloseLoserOverlay}
        />
      )}

      {/* Winner screen */}
      {showWinner && <WinnerScreen onFinishGame={handleFinishGame} />}

      {/* Final slideshow */}
      {showWinner && finalSlideshowVisible && (
        <FinalGameSlideshowOverlay
          urls={slideshowUrls}
          controlsVisible={controlsVisible}
          onFinish={handleFinishGame}
        />
      )}
    </div>
  );
}

function ClockDisplay() {
  const [clock, setClock] = useState('00:00');
  useEffect(() => {
    function update() {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      setClock(`${h}:${m}`);
    }
    update();
    // Align to next minute boundary, then tick every 60s
    const now = new Date();
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    let intervalId: ReturnType<typeof setInterval>;
    const timeoutId = setTimeout(() => {
      update();
      intervalId = setInterval(update, 60000);
    }, msToNextMinute);
    return () => { clearTimeout(timeoutId); clearInterval(intervalId); };
  }, []);
  return (
    <div className="fixed bottom-[18px] right-7 text-[28px] font-bold text-[#444] tabular-nums tracking-[2px] pointer-events-none">
      {clock}
    </div>
  );
}
