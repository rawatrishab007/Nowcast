// ============================================================
// WeatherNow AI — Premium Dark Error State
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
  message = 'Failed to connect to the operational nowcasting inference backend.',
  errorCode,
  onRetry,
}) => {
  return (
    <div className="bg-rose-950/50 border border-rose-800/80 rounded-2xl p-5 shadow-xl text-rose-200 flex flex-col sm:flex-row items-start justify-between gap-4">
      <div className="flex items-start gap-3.5">
        <div className="p-2.5 rounded-xl bg-rose-900/60 text-2xl flex-shrink-0 shadow-sm border border-rose-700/60">
          ⚠️
        </div>
        <div>
          <h4 className="text-rose-200 font-bold text-sm sm:text-base font-heading">{title}</h4>
          <p className="text-rose-300/80 text-xs mt-1 leading-relaxed">{message}</p>
          {errorCode && (
            <p className="text-[11px] font-mono text-rose-300 mt-2 bg-rose-900/50 inline-block px-2.5 py-0.5 rounded-full border border-rose-700 font-semibold">
              Error Code: {errorCode}
            </p>
          )}
        </div>
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          className="self-start sm:self-center bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-lg active:scale-95 flex-shrink-0"
        >
          Retry Connection
        </button>
      )}
    </div>
  );
};
