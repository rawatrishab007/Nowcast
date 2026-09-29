import React, { useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';
import type { WeatherObservation, WeatherPredictionStep } from '../../types/weather';

interface PredictionChartProps {
  observations: WeatherObservation[];
  predictions: WeatherPredictionStep[];
  className?: string;
}

type MetricType = 'rainfall' | 'temperature' | 'windSpeed' | 'humidity';

export const PredictionChart: React.FC<PredictionChartProps> = ({
  observations,
  predictions,
  className = '',
}) => {
  const [metric, setMetric] = useState<MetricType>('rainfall');

  // Build merged timeline: past observations up to NOW + future predictions from NOW onward
  // past points have observed value, future points have predicted value + confidence bounds
  const timelineDataMap = new Map<string, any>();

  // 1. Add historical observations (-60m .. Now)
  observations.forEach((obs) => {
    timelineDataMap.set(obs.label, {
      time: obs.label,
      isFuture: false,
      observed: obs[metric] as number,
      predicted: obs.label === 'Now' ? (obs[metric] as number) : null,
      lowerBound: obs.label === 'Now' ? (obs[metric] as number) : null,
      upperBound: obs.label === 'Now' ? (obs[metric] as number) : null,
      confidenceBand: [obs[metric], obs[metric]],
      confidence: 100,
    });
  });

  // 2. Add future predictions (Now .. +120m)
  predictions.forEach((pred) => {
    const existing = timelineDataMap.get(pred.label) || { time: pred.label, isFuture: true, observed: null };
    const val = pred[metric] as number;
    const lower = metric === 'rainfall' ? pred.lowerBound : parseFloat((val * 0.9).toFixed(1));
    const upper = metric === 'rainfall' ? pred.upperBound : parseFloat((val * 1.1).toFixed(1));

    timelineDataMap.set(pred.label, {
      ...existing,
      predicted: val,
      lowerBound: lower,
      upperBound: upper,
      confidenceBand: [lower, upper],
      confidence: pred.confidence,
    });
  });

  const chartData = Array.from(timelineDataMap.values());

  const metricMeta: Record<MetricType, { label: string; unit: string; obsColor: string; predColor: string; icon: string }> = {
    rainfall:    { label: 'Rainfall Intensity', unit: 'mm/hr', obsColor: '#f97316', predColor: '#14b8a6', icon: '🌧️' },
    temperature: { label: 'Temperature',        unit: '°C',    obsColor: '#ef4444', predColor: '#f59e0b', icon: '🌡️' },
    windSpeed:   { label: 'Wind Speed',         unit: 'km/h',  obsColor: '#3b82f6', predColor: '#06b6d4', icon: '💨' },
    humidity:    { label: 'Humidity',           unit: '%',     obsColor: '#8b5cf6', predColor: '#a78bfa', icon: '💧' },
  };

  const meta = metricMeta[metric];

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Chart Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{meta.icon}</span>
          <h4 className="text-white font-semibold text-sm sm:text-base">
            Observed vs Predicted {meta.label}
          </h4>
        </div>
        <div className="flex bg-gray-900 border border-gray-700/80 rounded-lg p-1 gap-1">
          {(['rainfall', 'temperature', 'windSpeed', 'humidity'] as MetricType[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-all ${
                metric === m
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {metricMeta[m].label.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Main Time-Series Chart */}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
            <defs>
              {/* Confidence interval shaded area gradient */}
              <linearGradient id="confidenceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.03} />
              </linearGradient>
              {/* Observed line glow */}
              <linearGradient id="obsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={meta.obsColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={meta.obsColor} stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.6} />
            <XAxis dataKey="time" stroke="#9ca3af" tick={{ fontSize: 11 }} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} unit={` ${meta.unit}`} />
            
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                borderColor: '#374151',
                borderRadius: '8px',
                fontSize: '12px',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
              }}
              formatter={(value: any, name: string, item: any) => {
                if (value === null || value === undefined) return ['--', name];
                if (name === 'Upper Confidence Bound' || name === 'Lower Confidence Bound') {
                  return [`${value} ${meta.unit}`, name];
                }
                const confText = item.payload.confidence ? ` (Conf: ${item.payload.confidence}%)` : '';
                return [`${value} ${meta.unit}${confText}`, name];
              }}
            />
            
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />

            {/* Division Line between Past (Observed) and Future (Nowcast) */}
            <ReferenceLine
              x="Now"
              stroke="#14b8a6"
              strokeDasharray="4 2"
              strokeWidth={2}
              label={{
                value: 'NOW (Forecast Point)',
                fill: '#14b8a6',
                fontSize: 10,
                fontWeight: 'bold',
                position: 'top',
              }}
            />

            {/* Confidence Interval Upper Bound Area */}
            {metric === 'rainfall' && (
              <Area
                type="monotone"
                dataKey="upperBound"
                name="Confidence Interval (80%)"
                stroke="none"
                fill="url(#confidenceGrad)"
                connectNulls
              />
            )}

            {/* Predicted Model Output Line */}
            <Area
              type="monotone"
              dataKey="predicted"
              name="Predicted (Nowcast Model)"
              stroke={meta.predColor}
              strokeWidth={2.5}
              strokeDasharray="4 4"
              fill="none"
              dot={{ r: 4, fill: meta.predColor }}
              connectNulls
            />

            {/* Past Observed Weather Line */}
            <Line
              type="monotone"
              dataKey="observed"
              name="Observed (Radar / Station)"
              stroke={meta.obsColor}
              strokeWidth={3}
              dot={{ r: 5, fill: meta.obsColor, strokeWidth: 2 }}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap justify-between items-center text-xs text-gray-400 pt-1 border-t border-gray-700/60">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-1 inline-block rounded" style={{ background: meta.obsColor }} />
          <strong>Observed:</strong> Past historical weather up to NOW
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-1 inline-block rounded border border-dashed" style={{ background: meta.predColor }} />
          <strong>Predicted:</strong> AI nowcast (+15 min to +120 min) with confidence bounds
        </span>
      </div>
    </div>
  );
};

export default PredictionChart;
