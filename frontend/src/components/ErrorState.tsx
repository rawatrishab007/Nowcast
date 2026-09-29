// ============================================================
// WeatherNow AI — Error State & Fallback Component
// ============================================================

import React from 'react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  errorCode?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Unable to retrieve weather data',
  message = 'Failed to connect to the SIHV3Nowcast operational inference backend.',
  errorCode,
  onRetry,
}) => {
  return (
    <div className="bg-red-950/70 border border-red-800/90 rounded-2xl p-5 shadow-xl text-red-200 flex flex-col sm:flex-row items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-red-900/60 text-2xl flex-shrink-0">
          ⚠️
        </div>
        <div>
          <h4 className="text-red-300 font-bold text-sm sm:text-base">{title}</h4>
          <p className="text-red-300/80 text-xs mt-1 leading-relaxed">{message}</p>
          {errorCode && (
            <p className="text-[11px] font-mono text-red-400 mt-2 bg-red-900/40 inline-block px-2 py-0.5 rounded border border-red-800">
              Error Code: {errorCode}
            </p>
          )}
        </div>
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          className="self-start sm:self-center bg-red-800 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-md flex-shrink-0"
        >
          Retry Connection
        </button>
      )}
    </div>
  );
};
