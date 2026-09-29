// ============================================================
// WeatherNow AI — Loading State Component
// ============================================================

import React from 'react';

interface LoadingStateProps {
  message?: string;
  subtext?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading weather observations...',
  subtext = 'Aligning Himawari-9 satellite & GFS NWP inputs for SIHV3Nowcast inference...',
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-gray-800/80 border border-gray-700/80 rounded-2xl shadow-xl min-h-[260px] text-center">
      <div className="relative mb-4">
        <div className="w-12 h-12 rounded-full border-4 border-teal-500/20 border-t-teal-400 animate-spin" />
        <span className="absolute inset-0 flex items-center justify-center text-sm">🛰️</span>
      </div>
      <h4 className="text-white font-bold text-base">{message}</h4>
      <p className="text-gray-400 text-xs mt-1.5 max-w-md font-mono">{subtext}</p>
    </div>
  );
};
