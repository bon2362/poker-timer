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
import { listSlideshowPhotos } from '@/lib/supabase/slideshow';
import type { Config } from '@/types/timer';

export function PokerTimer() {
  const { state, dispatch } = useTimer();
  const { activeSession, showWinner, loading } = useGame();

  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gamePanelOpen, setGamePanelOpen] = useState(false);
  const gamePanelAutoOpenedRef = useRef(false);

  // Slideshow state
  const [slideshowUrls, setSlideshowUrls] = useState<string[]>([]);
  const [slideshowCurrentUrl, setSlideshowCurrentUrl] = useState<string | null>(null);
  const slideshowTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slideshowIndexRef = useRef(0);
  const slideshowShuffledRef = useRef<number[]>([]);

  // Auto-open panel when session becomes active
  useEffect(() => {
    if (activeSession && !gamePanelAutoOpenedRef.current) {
      setGamePanelOpen(true);
      gamePanelAutoOpenedRef.current = true;
    }
    if (!activeSession) {
      gamePanelAutoOpenedRef.current = false;
      setGamePanelOpen(false);
    }
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

  // Keyboard: Space → toggle pause (only when session active)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!activeSession) return;
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault();
        dispatch({ type: 'TOGGLE_PAUSE' });
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

  const handleSaveSettings = useCallback((config: Config) => {
    dispatch({ type: 'SAVE_SETTINGS', config });
  }, [dispatch]);

  const stage = state.stages[state.currentStage];
  const isWarning = state.timeLeft <= 60 && state.timeLeft >= 0 && stage.type !== 'break';
  const isOnBreak = !state.isOver && stage?.type === 'break';

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

  // Next blind info
  const nextStage = state.stages[state.currentStage + 1];
  let nextText = '';
  if (!nextStage) {
    nextText = 'Финал';
  } else if (nextStage.type === 'break') {
    nextText = `☕ Перерыв ${state.config.breakDuration} мин`;
  } else {
    nextText = `${nextStage.sb} / ${nextStage.bb}`;
  }

  if (state.screen === 'settings') {
    return (
      <SettingsScreen
        config={state.config}
        onSave={handleSaveSettings}
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
        <BlindInfo stage={stage} breakDuration={state.config.breakDuration} />
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

      {/* Timer */}
      {!state.isOver && <TimerDisplay timeLeft={state.timeLeft} stage={stage} isPaused={state.isPaused} />}

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

      {/* Controls */}
      {!state.isOver && (
        <Controls
          isPaused={state.isPaused}
          isOver={state.isOver}
          visible={controlsVisible}
          onPrev={() => dispatch({ type: 'PREV_STAGE' })}
          onTogglePause={() => dispatch({ type: 'TOGGLE_PAUSE' })}
          onNext={() => dispatch({ type: 'NEXT_STAGE' })}
        />
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
        <SlideshowOverlay url={slideshowCurrentUrl} timeLeft={state.timeLeft} />
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
          />
        </div>
      )}

      {/* Next blind info */}
      {!state.isOver && nextText && (
        <div className="pb-[22px] text-center pointer-events-none">
          <div className="text-[11px] text-[#383838] tracking-[2px] uppercase mb-1">Далее</div>
          <div className="font-bold text-[#444] leading-tight" style={{ fontSize: 'clamp(58px, 8vw, 96px)' }}>
            {nextText}
          </div>
        </div>
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
        <GamePanel isOpen={gamePanelOpen} onToggle={() => setGamePanelOpen(v => !v)} />
      )}

      {/* Winner screen */}
      {showWinner && <WinnerScreen />}
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
