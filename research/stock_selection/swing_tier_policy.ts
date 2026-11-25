export type SwingTierDecision =
  | 'TIER_1_READY'
  | 'TIER_2_ACCUMULATION'
  | 'TIER_3_RVOL_WATCH'
  | 'NONE';

export interface SwingTierInputs {
  liquidityPass: boolean;
  deliveryQualified: boolean;
  ema21AboveEma44: boolean;
  aboveEma21: boolean;
  deliveryQuantityRatio: number | null;
  relativeVolume: number | null;
  changePct: number | null;
  rsi14: number | null;
}

/**
 * Cycle A requires five consecutive qualifying rolling five-session windows.
 * A window qualifies only when all five daily delivery percentages are present
 * and their arithmetic mean is >= threshold. Missing/invalid data resets the run.
 */
export function countConsecutiveQualifyingRolling5SessionWindows(
  deliveryPercentages: Array<number | null>,
  threshold = 60,
): number {
  if (!Number.isFinite(threshold)) return 0;
  let currentRun = 0;
  let longestRun = 0;

  for (let end = 4; end < deliveryPercentages.length; end += 1) {
    const window = deliveryPercentages.slice(end - 4, end + 1);
    const valid = window.length === 5 && window.every(
      (value) => value !== null && Number.isFinite(value),
    );
    const average = valid
      ? (window as number[]).reduce((sum, value) => sum + value, 0) / 5
      : null;

    if (average !== null && average >= threshold) {
      currentRun += 1;
      longestRun = Math.max(longestRun, currentRun);
    } else {
      currentRun = 0;
    }
  }

  return longestRun;
}

/**
 * T1 = fully confirmed breakout; T2 = aligned accumulation with delivery
 * expansion, awaiting breakout confirmation; T3 = liquid high-RVOL green
 * mover that has not met the stronger T1/T2 alignment.
 */
export function classifySwingTier(input: SwingTierInputs): SwingTierDecision {
  if (!input.liquidityPass || !input.deliveryQualified) return 'NONE';

  const trendAligned = input.ema21AboveEma44 && input.aboveEma21;
  const deliveryExpansion =
    input.deliveryQuantityRatio !== null &&
    Number.isFinite(input.deliveryQuantityRatio) &&
    input.deliveryQuantityRatio >= 1.2;
  const highRvol =
    input.relativeVolume !== null &&
    Number.isFinite(input.relativeVolume) &&
    input.relativeVolume > 1.5;
  const greenClose =
    input.changePct !== null &&
    Number.isFinite(input.changePct) &&
    input.changePct > 0;
  const rsiConfirmed =
    input.rsi14 !== null &&
    Number.isFinite(input.rsi14) &&
    input.rsi14 >= 45 &&
    input.rsi14 <= 78;

  if (trendAligned && deliveryExpansion && highRvol && greenClose && rsiConfirmed) {
    return 'TIER_1_READY';
  }
  if (trendAligned && deliveryExpansion) {
    return 'TIER_2_ACCUMULATION';
  }
  if (highRvol && greenClose) {
    return 'TIER_3_RVOL_WATCH';
  }
  return 'NONE';
}
