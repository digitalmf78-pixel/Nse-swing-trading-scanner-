import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIssuerAuditPlan } from './issuer_audit_priority.ts';

const ready = {
  sector: 'NON_FINANCIAL' as const,
  metadataComplete: true,
  currentOriginalResolved: true,
  priorOriginalResolved: true,
  paginationComplete: true,
  currentParserWarnings: 0,
  priorParserWarnings: 0,
};

test('ready non-financial issuer runs only the three candidate-eligible metrics', () => {
  const plan = buildIssuerAuditPlan(ready);
  assert.equal(plan.status, 'READY_CORE_METRICS');
  assert.deepEqual(plan.runMetrics, ['REVENUE_GROWTH', 'PROFIT_GROWTH', 'OPERATING_CASH_FLOW']);
  assert.deepEqual(plan.deferMetrics, ['ROE', 'ROCE', 'DEBT_EQUITY', 'INTEREST_COVERAGE']);
  assert.equal(plan.productionApproved, false);
});

test('incomplete pagination blocks the issuer before filing selection', () => {
  assert.equal(buildIssuerAuditPlan({ ...ready, paginationComplete: false }).status, 'BLOCKED_INCOMPLETE_METADATA');
});

test('missing prior Original blocks YoY work', () => {
  assert.equal(buildIssuerAuditPlan({ ...ready, priorOriginalResolved: false }).status, 'BLOCKED_FILING_PAIR');
});

test('any parser warning blocks metric work', () => {
  assert.equal(buildIssuerAuditPlan({ ...ready, currentParserWarnings: 1 }).status, 'BLOCKED_PARSER_WARNINGS');
});

test('bank, NBFC and insurance never inherit industrial core formulas', () => {
  for (const sector of ['BANK', 'NBFC', 'INSURANCE'] as const) {
    const plan = buildIssuerAuditPlan({ ...ready, sector });
    assert.equal(plan.status, 'SECTOR_SPECIFIC_MAPPING_REQUIRED');
    assert.deepEqual(plan.runMetrics, []);
  }
});

test('unknown sector is blocked', () => {
  assert.equal(buildIssuerAuditPlan({ ...ready, sector: 'UNKNOWN' }).status, 'UNKNOWN_SECTOR_BLOCKED');
});

test('invalid warning counts fail closed', () => {
  assert.equal(buildIssuerAuditPlan({ ...ready, priorParserWarnings: -1 }).status, 'BLOCKED_PARSER_WARNINGS');
});
