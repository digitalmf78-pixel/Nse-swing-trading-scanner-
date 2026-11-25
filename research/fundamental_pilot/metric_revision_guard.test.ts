import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateRevisionMetric, type RevisionMetricSnapshot, type MetricStatementCrossCheck } from './metric_revision_guard.ts';

const original:RevisionMetricSnapshot={sequenceId:'100',kind:'Original',revisionAt:null,value:-456.85};
const rev=(sequenceId:string,value:number,revisionAt:string):RevisionMetricSnapshot=>({sequenceId,kind:'Revision',revisionAt,value});
const cross:MetricStatementCrossCheck={value:-456.85,period:'30-SEP-2025',basis:'Standalone',concept:'in-capmkt:CashFlowsFromUsedInOperatingActivities',sourceUrl:'https://nsearchives.nseindia.in/official.pdf'};

test('original-only remains candidate and never production-approved',()=>{
  const r=evaluateRevisionMetric('30-SEP-2025','Standalone',cross.concept,original,[]);
  assert.equal(r.status,'ORIGINAL_ONLY_CANDIDATE');
  assert.equal(r.selectedValue,-456.85);
  assert.equal(r.productionApproved,false);
});

test('identical revisions retain candidate value',()=>{
  const r=evaluateRevisionMetric('30-SEP-2025','Standalone',cross.concept,original,[rev('101',-456.85,'2026-01-05T18:56:35Z')]);
  assert.equal(r.status,'REVISIONS_IDENTICAL_CANDIDATE');
  assert.equal(r.selectedValue,-456.85);
});

test('changed revision without statement cross-check is blocked',()=>{
  const r=evaluateRevisionMetric('30-SEP-2025','Standalone',cross.concept,original,[rev('102',-778.69,'2026-07-21T11:08:34Z')]);
  assert.equal(r.status,'REVISION_CHANGED_REVIEW_REQUIRED');
  assert.equal(r.selectedValue,null);
});

test('latest changed revision matching exact official statement is candidate only',()=>{
  const r=evaluateRevisionMetric('30-SEP-2025','Standalone',cross.concept,original,[rev('102',-778.69,'2026-07-21T11:08:34Z')],{...cross,value:-778.69});
  assert.equal(r.status,'LATEST_REVISION_RECONCILED_CANDIDATE');
  assert.equal(r.selectedValue,-778.69);
  assert.equal(r.productionApproved,false);
});

test('original PDF matching while latest revision differs is blocked',()=>{
  const r=evaluateRevisionMetric('30-SEP-2025','Standalone',cross.concept,original,[rev('102',-778.69,'2026-07-21T11:08:34Z')],cross);
  assert.equal(r.status,'REVISION_PDF_CONFLICT_REVIEW_REQUIRED');
  assert.equal(r.selectedValue,null);
});

test('wrong-period or wrong-basis cross-check is rejected',()=>{
  const r=evaluateRevisionMetric('30-SEP-2025','Standalone',cross.concept,original,[rev('102',-778.69,'2026-07-21T11:08:34Z')],{...cross,period:'31-DEC-2025'});
  assert.equal(r.status,'BLOCKED_INVALID_REVISION_HISTORY');
});

test('duplicate sequence IDs are rejected',()=>{
  const r=evaluateRevisionMetric('30-SEP-2025','Standalone',cross.concept,original,[rev('100',-778.69,'2026-07-21T11:08:34Z')]);
  assert.equal(r.status,'BLOCKED_INVALID_REVISION_HISTORY');
});

test('missing version value is not silently replaced by another version',()=>{
  const r=evaluateRevisionMetric('30-SEP-2025','Standalone',cross.concept,original,[{...rev('102',-778.69,'2026-07-21T11:08:34Z'),value:null}]);
  assert.equal(r.status,'BLOCKED_MISSING_VALUE');
  assert.equal(r.selectedValue,null);
});

test('revision timestamps must be strict UTC ISO timestamps',()=>{
  for(const timestamp of ['bad-date','July 21, 2026','2026-07-21','2026-07-21T11:08:34','2026-07-21T11:08:34+05:30']) {
    const r=evaluateRevisionMetric('30-SEP-2025','Standalone',cross.concept,original,[rev('102',-778.69,timestamp)]);
    assert.equal(r.status,'BLOCKED_INVALID_REVISION_HISTORY',timestamp);
  }
});

test('impossible calendar dates and invalid clock times are rejected',()=>{
  for(const timestamp of ['2026-02-30T11:08:34Z','2026-07-21T25:08:34Z','2026-07-21T11:61:34Z']) {
    const r=evaluateRevisionMetric('30-SEP-2025','Standalone',cross.concept,original,[rev('102',-778.69,timestamp)]);
    assert.equal(r.status,'BLOCKED_INVALID_REVISION_HISTORY',timestamp);
  }
});

test('original filing cannot carry a revision timestamp',()=>{
  const r=evaluateRevisionMetric('30-SEP-2025','Standalone',cross.concept,{...original,revisionAt:'2026-01-01T00:00:00Z'},[]);
  assert.equal(r.status,'BLOCKED_INVALID_REVISION_HISTORY');
});

test('revision timestamps must be strictly increasing and valid',()=>{
  const r=evaluateRevisionMetric('30-SEP-2025','Standalone',cross.concept,original,[rev('102',-778.69,'2026-07-21T11:08:34Z')]);
  assert.equal(r.status,'REVISION_CHANGED_REVIEW_REQUIRED');
});
