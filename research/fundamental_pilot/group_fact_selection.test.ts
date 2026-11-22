import assert from 'node:assert/strict';
import test from 'node:test';
import { selectUniqueGroupFact } from './group_fact_selection.ts';

const contexts = {
  group: { periodStart: '2026-07-01', periodEnd: '2026-09-30', instant: null, dimensions: [] },
  fmcg: { periodStart: '2026-07-01', periodEnd: '2026-09-30', instant: null, dimensions: ['in:SegmentAxis=in:FMCG'] },
  hotels: { periodStart: '2026-07-01', periodEnd: '2026-09-30', instant: null, dimensions: ['in:SegmentAxis=in:Hotels'] },
  prior: { periodStart: '2025-07-01', periodEnd: '2025-09-30', instant: null, dimensions: [] },
};
const expected = {
  periodStart: '2026-07-01', periodEnd: '2026-09-30',
  periodKind: 'DURATION' as const, basis: 'CONSOLIDATED' as const,
  filingBasis: 'CONSOLIDATED' as const,
};
const fact = (contextRef: string, numericValue: number) => ({
  concept: 'in:RevenueFromOperations', contextRef, unitRef: 'INR', rawValue: String(numericValue),
  numericValue, isNil: false,
});

test('selects the unique group total and excludes segment facts', () => {
  const result = selectUniqueGroupFact([fact('group', 1000), fact('fmcg', 700), fact('hotels', 300)], contexts, expected);
  assert.equal(result.status, 'SELECTED_UNIQUE_GROUP_FACT');
  assert.equal(result.selected?.numericValue, 1000);
  assert.equal(result.rejectedDimensionalOrPeriodCount, 2);
});

test('does not add segment facts to manufacture a group total', () => {
  const result = selectUniqueGroupFact([fact('fmcg', 700), fact('hotels', 300)], contexts, expected);
  assert.equal(result.status, 'NO_ELIGIBLE_GROUP_FACT');
  assert.equal(result.selected, null);
});

test('fails closed when multiple undimensioned facts match the same period', () => {
  const result = selectUniqueGroupFact([fact('group', 1000), fact('group', 1000)], contexts, expected);
  assert.equal(result.status, 'AMBIGUOUS_GROUP_FACTS');
  assert.equal(result.selected, null);
  assert.equal(result.eligibleCount, 2);
});

test('rejects prior-year contexts instead of silently mixing periods', () => {
  const result = selectUniqueGroupFact([fact('prior', 900)], contexts, expected);
  assert.equal(result.status, 'NO_ELIGIBLE_GROUP_FACT');
});

test('rejects unresolved context references', () => {
  const result = selectUniqueGroupFact([fact('missing', 900)], contexts, expected);
  assert.equal(result.status, 'NO_ELIGIBLE_GROUP_FACT');
});
