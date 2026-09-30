// ============================================================
// WeatherNow AI — Premium Dark Loading State
// ============================================================

import React from 'react';

interface LoadingStateProps {
  message?: string;
  subtext?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading weather observations...',
  subtext = 'Aligning Himawari-9 satellite & GFS NWP inputs for multi-model inference...',
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 dark-card shadow-xl min-h-[260px] text-center space-y-3 border border-[#383838]">
      <div className="relative mb-2">
        <div className="w-14 h-14 rounded-full border-4 border-[#383838] border-t-blue-500 animate-spin" />
        <span className="absolute inset-0 flex items-center justify-center text-lg">🛰️</span>
      </div>
      <h4 className="text-white font-bold text-base font-heading">{message}</h4>
      <p className="text-neutral-400 text-xs max-w-md font-sans">{subtext}</p>
    </div>
  );
};
