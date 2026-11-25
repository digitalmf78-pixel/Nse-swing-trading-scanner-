import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifySwingTier,
  countConsecutiveQualifyingRolling5SessionWindows,
} from './swing_tier_policy.ts';

test('Cycle A passes only after five consecutive qualifying rolling windows', () => {
  // Nine consecutive qualifying sessions produce exactly five rolling windows.
  assert.equal(countConsecutiveQualifyingRolling5SessionWindows(Array(9).fill(60)), 5);
  assert.equal(countConsecutiveQualifyingRolling5SessionWindows(Array(8).fill(60)), 4);
});

test('Cycle A does not combine separated qualifying windows into a pass', () => {
  const values = [60, 60, 60, 60, 60, 40, 60, 60, 60, 60, 60, 40, 60, 60, 60, 60, 60];
  assert.equal(countConsecutiveQualifyingRolling5SessionWindows(values), 1);
  const separated = [60, 60, 60, 60, 60, 40, 40, 40, 40, 60, 60, 60, 60, 60];
  assert.equal(countConsecutiveQualifyingRolling5SessionWindows(separated), 1);
});

test('Cycle A resets on missing or invalid delivery observations', () => {
  assert.equal(countConsecutiveQualifyingRolling5SessionWindows([60, 60, 60, 60, null, 60, 60, 60, 60, 60]), 1);
  assert.equal(countConsecutiveQualifyingRolling5SessionWindows([60, 60, 60, 60, Number.NaN, 60, 60, 60, 60, 60]), 1);
  assert.equal(countConsecutiveQualifyingRolling5SessionWindows([60, 60, 60, 60, 101, 60, 60, 60, 60, 60]), 0);
  assert.equal(countConsecutiveQualifyingRolling5SessionWindows([60, 60, 60, 60, -1, 60, 60, 60, 60, 60]), 0);
});

test('Cycle A rejects invalid thresholds outside the delivery percentage range', () => {
  assert.equal(countConsecutiveQualifyingRolling5SessionWindows(Array(9).fill(60), -1), 0);
  assert.equal(countConsecutiveQualifyingRolling5SessionWindows(Array(9).fill(60), 101), 0);
});

test('Tier 1 requires every breakout confirmation', () => {
  const base = {
    liquidityPass: true,
    deliveryQualified: true,
    ema21AboveEma44: true,
    aboveEma21: true,
    deliveryQuantityRatio: 1.3,
    relativeVolume: 1.8,
    changePct: 1.1,
    rsi14: 60,
  };
  assert.equal(classifySwingTier(base), 'TIER_1_READY');
  assert.equal(classifySwingTier({ ...base, rsi14: 80 }), 'TIER_2_ACCUMULATION');
  assert.equal(classifySwingTier({ ...base, changePct: 0 }), 'TIER_2_ACCUMULATION');
});

test('Tier 2 requires delivery expansion and aligned trend, not RVOL OR substitution', () => {
  const base = {
    liquidityPass: true,
    deliveryQualified: true,
    ema21AboveEma44: true,
    aboveEma21: true,
    deliveryQuantityRatio: 1.25,
    relativeVolume: 1.1,
    changePct: 0.2,
    rsi14: 55,
  };
  assert.equal(classifySwingTier(base), 'TIER_2_ACCUMULATION');
  assert.equal(classifySwingTier({ ...base, deliveryQuantityRatio: 1.19, relativeVolume: 2.5 }), 'TIER_3_RVOL_WATCH');
});

test('Tier 3 requires liquid delivery-qualified high-RVOL green mover, not EMA alignment', () => {
  const base = {
    liquidityPass: true,
    deliveryQualified: true,
    ema21AboveEma44: false,
    aboveEma21: false,
    deliveryQuantityRatio: 0.8,
    relativeVolume: 2,
    changePct: 1,
    rsi14: 40,
  };
  assert.equal(classifySwingTier(base), 'TIER_3_RVOL_WATCH');
  assert.equal(classifySwingTier({ ...base, deliveryQualified: false }), 'NONE');
  assert.equal(classifySwingTier({ ...base, liquidityPass: false }), 'NONE');
});
