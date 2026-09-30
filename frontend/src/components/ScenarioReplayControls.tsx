// ============================================================
// WeatherNow AI — ChatGPT-Style Scenario Replay Controls
// ============================================================

import React, { useEffect, useState, useRef } from 'react';
import { FORECAST_HORIZONS } from '../constants';
import { formatIstTime } from '../utils/timeUtils';

interface ScenarioReplayControlsProps {
  selectedHorizon: number;
  onHorizonSelect: (horizon: number) => void;
  baseTime?: string;
  targetTimes?: Record<string, string>;
}

export const ScenarioReplayControls: React.FC<ScenarioReplayControlsProps> = ({
  selectedHorizon,
  onHorizonSelect,
  baseTime,
  targetTimes,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1500); // 1.5s default interval

  const timerRef = useRef<any>(null);

  // Playback timer effect
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      const horizons = [...FORECAST_HORIZONS];
      const currentIndex = horizons.indexOf(selectedHorizon as any);

      if (currentIndex === -1 || currentIndex >= horizons.length - 1) {
        if (isLooping) {
          onHorizonSelect(horizons[0]);
        } else {
          setIsPlaying(false);
        }
      } else {
        onHorizonSelect(horizons[currentIndex + 1]);
      }
    }, playbackSpeed);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPlaying, selectedHorizon, playbackSpeed, isLooping, onHorizonSelect]);

  const handleStepPrev = () => {
    setIsPlaying(false);
    const horizons = [...FORECAST_HORIZONS];
    const currentIndex = horizons.indexOf(selectedHorizon as any);
    if (currentIndex <= 0) {
      onHorizonSelect(horizons[horizons.length - 1]);
    } else {
      onHorizonSelect(horizons[currentIndex - 1]);
    }
  };

  const handleStepNext = () => {
    setIsPlaying(false);
    const horizons = [...FORECAST_HORIZONS];
    const currentIndex = horizons.indexOf(selectedHorizon as any);
    if (currentIndex === -1 || currentIndex >= horizons.length - 1) {
      onHorizonSelect(horizons[0]);
    } else {
      onHorizonSelect(horizons[currentIndex + 1]);
    }
  };

  const activeTargetTime = targetTimes?.[String(selectedHorizon)];
  const validTimeFormatted = formatIstTime(activeTargetTime, `+${selectedHorizon}m`);
  const baseTimeFormatted = formatIstTime(baseTime, 'Observation');

  return (
    <div className="dark-card p-4 rounded-2xl space-y-3.5 shadow-sm">
      {/* Header with Blue Heading & Valid Time */}
      <div className="flex items-center justify-between border-b border-[#383838] pb-2.5">
        <div className="flex items-center gap-2 text-xs font-bold font-heading text-blue-400 uppercase tracking-wider">
          <span>⏱️</span>
          <span>Scenario Replay Engine</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-[#BDBDBD] font-medium">Valid:</span>
          <span className="text-white font-bold bg-[#212121] px-2.5 py-0.5 rounded-full border border-[#383838] font-mono text-[11px]">
            {validTimeFormatted}
          </span>
        </div>
      </div>

      {/* Horizon Scrub Buttons */}
      <div className="grid grid-cols-4 gap-1.5">
        {FORECAST_HORIZONS.map((h) => {
          const isSelected = selectedHorizon === h;
          const hTarget = targetTimes?.[String(h)];
          const hTimeStr = formatIstTime(hTarget, `+${h}m`);

          return (
            <button
              key={h}
              onClick={() => {
                setIsPlaying(false);
                onHorizonSelect(h);
              }}
              className={`py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer text-center flex flex-col items-center justify-center ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-md border border-blue-400 scale-[1.02]'
                  : 'bg-[#212121] hover:bg-[#2E2E2E] text-[#F5F5F5] border border-[#383838] hover:border-[#4F4F4F]'
              }`}
            >
              <span className="font-heading">+{h}m</span>
              <span className="text-[9px] font-mono opacity-80 mt-0.5">{hTimeStr}</span>
            </button>
          );
        })}
      </div>

      {/* Primary Playback Bar */}
      <div className="flex items-center justify-between pt-1 gap-2">
        <div className="flex items-center gap-1.5">
          {/* Step Backward */}
          <button
            onClick={handleStepPrev}
            title="Step backward (-30m lead)"
            className="p-2 rounded-xl bg-[#212121] hover:bg-[#2E2E2E] text-[#F5F5F5] border border-[#383838] text-xs cursor-pointer active:scale-95 transition-all"
          >
            ⏮️
          </button>

          {/* Play / Pause */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? 'Pause replay' : 'Play forecast replay'}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
              isPlaying
                ? 'bg-blue-600 text-white shadow-md animate-pulse border border-blue-400'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md'
            }`}
          >
            <span>{isPlaying ? '⏸ Pause' : '▶ Play Replay'}</span>
          </button>

          {/* Step Forward */}
          <button
            onClick={handleStepNext}
            title="Step forward (+30m lead)"
            className="p-2 rounded-xl bg-[#212121] hover:bg-[#2E2E2E] text-[#F5F5F5] border border-[#383838] text-xs cursor-pointer active:scale-95 transition-all"
          >
            ⏭️
          </button>
        </div>

        {/* Loop Toggle */}
        <button
          onClick={() => setIsLooping(!isLooping)}
          title={isLooping ? 'Looping enabled' : 'Single pass mode'}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
            isLooping
              ? 'bg-[#212121] text-blue-300 border border-blue-600 font-bold'
              : 'bg-[#212121] text-[#BDBDBD] border border-[#383838]'
          }`}
        >
          {isLooping ? '🔁 Loop' : '➡️ 1-Pass'}
        </button>
      </div>

      {/* Speed Selector & Timeline Bar */}
      <div className="flex items-center justify-between text-xs text-[#BDBDBD] pt-2 border-t border-[#383838]">
        <div className="flex items-center gap-1">
          <span className="text-[#737373] font-medium">Speed:</span>
          {[
            { label: '0.5x', speed: 2500 },
            { label: '1x', speed: 1500 },
            { label: '2x', speed: 750 },
          ].map((s) => (
            <button
              key={s.label}
              onClick={() => setPlaybackSpeed(s.speed)}
              className={`px-2 py-0.5 rounded-lg cursor-pointer transition-all ${
                playbackSpeed === s.speed
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-[#BDBDBD] hover:text-white bg-[#212121]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="text-[10px] text-[#BDBDBD] font-mono">
          Base: <span className="text-white font-semibold">{baseTimeFormatted}</span>
        </div>
      </div>
    </div>
  );
};
