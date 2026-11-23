import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNseEpsCandidate,
  selectNseBasicEpsFact,
} from './nse_eps_candidate.ts';
import type { XbrlExtraction } from './xbrl_extract.ts';

function extraction(value: number, options: { unit?: string[]; dimensions?: string[]; concept?: string } = {}): XbrlExtraction {
  const concept = options.concept ?? 'ind-as:BasicEarningsLossPerShare';
  return {
    contexts: {
      ctx: {
        id: 'ctx', entityScheme: null, entityIdentifier: null,
        periodStart: '2026-04-01', periodEnd: '2026-06-30',
        instant: null, dimensions: options.dimensions ?? [],
      },
    },
    units: { perShare: options.unit ?? ['iso4217:INR', 'xbrli:shares'] },
    facts: [{
      concept, contextRef: 'ctx', unitRef: 'perShare', rawValue: String(value),
      numericValue: value, decimals: '2', scale: null, sign: null,
      format: null, continuedAt: null, isNil: false, isInline: false,
    }],
    contextCount: 1, factCount: 1, warnings: [],
  };
}

const input = (x: XbrlExtraction) => ({
  extraction: x, periodStart: '2026-04-01', periodEnd: '2026-06-30',
  periodType: 'QUARTER' as const, basis: 'STANDALONE' as const,
});

test('selects only exact-period undimensioned basic EPS with INR/share unit', () => {
  const selected = selectNseBasicEpsFact(extraction(4.25), '2026-04-01', '2026-06-30');
  assert.equal(selected.status, 'SELECTED_UNIQUE_PER_SHARE_FACT');
  assert.equal(selected.fact?.numericValue, 4.25);
});

test('blocks dimensional contexts and non-per-share units', () => {
  const dimensional = selectNseBasicEpsFact(extraction(4.25, { dimensions: ['segment=Domestic'] }), '2026-04-01', '2026-06-30');
  assert.equal(dimensional.status, 'NO_EXACT_PERIOD_FACT');
  const invalidUnit = selectNseBasicEpsFact(extraction(4.25, { unit: ['iso4217:INR'] }), '2026-04-01', '2026-06-30');
  assert.equal(invalidUnit.status, 'BLOCKED_INVALID_UNIT');
});

test('EPS candidate compares current and prior values and checks every revision', () => {
  const current = extraction(4.25);
  const prior = extraction(3.5);
  const stable = buildNseEpsCandidate(input(current), input(prior), [extraction(4.25)], [extraction(3.5)]);
  assert.equal(stable.status, 'CANDIDATE_ONLY');
  assert.equal(stable.currentValue, 4.25);
  assert.equal(stable.priorValue, 3.5);
  const changed = buildNseEpsCandidate(input(current), input(prior), [extraction(4.5)], []);
  assert.equal(changed.status, 'REVISION_REVIEW_REQUIRED');
  assert.deepEqual(changed.revisionAudit.changedPeriods, ['current']);
});

test('EPS candidate blocks when taxonomy QName changes between periods', () => {
  const current = extraction(4.25);
  const prior = extraction(3.5, { concept: 'custom:BasicEarningsLossPerShare' });
  const result = buildNseEpsCandidate(input(current), input(prior));
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.concept, null);
});
