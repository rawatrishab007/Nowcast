// ============================================================
// WeatherNow AI — Model-Aligned Risk Summary Engine
// Strictly interprets P(future B13 < 235 K) without unverified hazard claims
// ============================================================

export interface ConvectiveRiskClassification {
  level: 'minimal' | 'moderate' | 'high' | 'very_high';
  title: string;
  badgeLabel: string;
  badgeColor: string;
  description: string;
}

export interface PeakHorizonResult {
  peakHorizon: number;
  peakProb: number;
  peakProbPct: string;
}

export interface TemporalEvolutionResult {
  evolutionString: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  trendLabel: string;
  trendColor: string;
}

/**
 * Classifies model probability into UI interpretation bands:
 *  - < 15%: Minimal Convective Signal
 *  - 15%–45%: Moderate Convective Signal
 *  - 45%–75%: High Convective Signal
 *  - > 75%: Very High Convective Signal
 */
export function classifyConvectiveSignal(prob: number): ConvectiveRiskClassification {
  const pct = prob > 1 ? prob : prob * 100;

  if (pct < 15) {
    return {
      level: 'minimal',
      title: 'Conditions Stable',
      badgeLabel: 'Minimal Convective Signal (< 15%)',
      badgeColor: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80',
      description:
        'Low probability of future cold cloud-top development over the selected location during the forecast window.',
    };
  } else if (pct <= 45) {
    return {
      level: 'moderate',
      title: 'Convective Activity Possible',
      badgeLabel: 'Moderate Convective Signal (15%–45%)',
      badgeColor: 'bg-amber-950/80 text-amber-300 border-amber-700/80',
      description:
        'The model indicates an increased probability of future cold cloud-top development over the selected location.',
    };
  } else if (pct <= 75) {
    return {
      level: 'high',
      title: 'High Convective Signal',
      badgeLabel: 'High Convective Signal (45%–75%)',
      badgeColor: 'bg-red-950/80 text-red-300 border-red-700/80',
      description:
        'The model indicates a high probability of future cold cloud-top development over the selected location.',
    };
  } else {
    return {
      level: 'very_high',
      title: 'Very High Convective Signal',
      badgeLabel: 'Very High Convective Signal (> 75%)',
      badgeColor: 'bg-fuchsia-950/80 text-fuchsia-300 border-fuchsia-700/80',
      description:
        'The model indicates a very high probability of future cold cloud-top development over the selected location.',
    };
  }
}

/**
 * Identifies the peak horizon and maximum probability across the 4 lead times
 */
export function calculatePeakHorizon(
  horizonValues: Array<{ horizon: number; prob: number }>
): PeakHorizonResult {
  if (!horizonValues || horizonValues.length === 0) {
    return { peakHorizon: 30, peakProb: 0, peakProbPct: '0.0%' };
  }

  let peak = horizonValues[0];
  for (const item of horizonValues) {
    if (item.prob > peak.prob) {
      peak = item;
    }
  }

  return {
    peakHorizon: peak.horizon,
    peakProb: peak.prob,
    peakProbPct: (peak.prob * 100).toFixed(1) + '%',
  };
}

/**
 * Computes temporal evolution trajectory and trend direction
 */
export function calculateTemporalEvolution(
  horizonValues: Array<{ horizon: number; prob: number }>
): TemporalEvolutionResult {
  if (!horizonValues || horizonValues.length === 0) {
    return {
      evolutionString: '0.0% → 0.0% → 0.0% → 0.0%',
      trend: 'stable',
      trendLabel: 'Stable Signal',
      trendColor: 'text-gray-400',
    };
  }

  const evolutionString = horizonValues
    .map((v) => `${(v.prob * 100).toFixed(1)}%`)
    .join(' → ');

  const firstProb = horizonValues[0]?.prob ?? 0;
  const lastProb = horizonValues[horizonValues.length - 1]?.prob ?? 0;
  const delta = lastProb - firstProb;

  if (delta > 0.05) {
    return {
      evolutionString,
      trend: 'increasing',
      trendLabel: 'Increasing Signal (Development)',
      trendColor: 'text-amber-400',
    };
  } else if (delta < -0.05) {
    return {
      evolutionString,
      trend: 'decreasing',
      trendLabel: 'Decreasing Signal (Decay)',
      trendColor: 'text-sky-400',
    };
  } else {
    return {
      evolutionString,
      trend: 'stable',
      trendLabel: 'Relatively Stable Signal',
      trendColor: 'text-emerald-400',
    };
  }
}
