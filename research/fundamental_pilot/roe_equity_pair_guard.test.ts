import assert from 'node:assert/strict';
import test from 'node:test';
import { selectRoeEquityPairCandidate } from './roe_equity_pair_guard.ts';
import type { XbrlExtraction } from './xbrl_extract.ts';

function filing(date: string, value: number, issuer='INE000A01000'): XbrlExtraction {
  return {
    contexts: {
      balance: { id:'balance', entityScheme:'https://www.nseindia.com', entityIdentifier:issuer,
        periodStart:null, periodEnd:null, instant:date, dimensions:[] },
    },
    units: { INR:['iso4217:INR'] },
    facts: [{ concept:'in-capmkt:EquityAttributableToOwnersOfParent', contextRef:'balance',
      unitRef:'INR', rawValue:String(value), numericValue:value, decimals:'-3', scale:null,
      sign:null, format:null, continuedAt:null, isNil:false, isInline:false }],
    contextCount:1, factCount:1, warnings:[],
  };
}
const request = () => ({
  opening: { extraction:filing('2025-03-31',800), concept:'in-capmkt:EquityAttributableToOwnersOfParent',
    date:'2025-03-31', basis:'CONSOLIDATED' as const, filingBasis:'CONSOLIDATED' as const },
  closing: { extraction:filing('2026-03-31',1000), concept:'in-capmkt:EquityAttributableToOwnersOfParent',
    date:'2026-03-31', basis:'CONSOLIDATED' as const, filingBasis:'CONSOLIDATED' as const },
});

test('selects matching same-issuer equity facts and returns average equity as candidate only',()=>{
  const result=selectRoeEquityPairCandidate(request());
  assert.equal(result.status,'SELECTED_EQUITY_PAIR_CANDIDATE');
  assert.equal(result.openingEquity,800);
  assert.equal(result.closingEquity,1000);
  assert.equal(result.averageEquity,900);
  assert.equal(result.currency,'iso4217:INR');
  assert.equal(result.productionApproved,false);
});

test('blocks issuer identity mismatch',()=>{
  const input=request();
  input.closing.extraction=filing('2026-03-31',1000,'INE999Z01000');
  assert.equal(selectRoeEquityPairCandidate(input).status,'BLOCKED_ISSUER_MISMATCH');
});

test('blocks standalone/consolidated basis mismatch',()=>{
  const input=request();
  input.closing.basis='STANDALONE';
  input.closing.filingBasis='STANDALONE';
  assert.equal(selectRoeEquityPairCandidate(input).status,'BLOCKED_BASIS_MISMATCH');
});

test('blocks a missing filing-level basis',()=>{
  const input=request();
  input.opening.filingBasis=null;
  assert.equal(selectRoeEquityPairCandidate(input).status,'BLOCKED_BASIS_MISMATCH');
});

test('blocks mismatched concept names rather than pairing different equity definitions',()=>{
  const input=request();
  input.closing.concept='in-capmkt:Equity';
  assert.equal(selectRoeEquityPairCandidate(input).status,'BLOCKED_CONCEPT_MISMATCH');
});

test('blocks same or reversed dates',()=>{
  const input=request();
  input.closing.date='2025-03-31';
  input.closing.extraction=filing('2025-03-31',1000);
  assert.equal(selectRoeEquityPairCandidate(input).status,'BLOCKED_DATE_ORDER');
});

test('blocks missing closing fact and withholds partial pair',()=>{
  const input=request();
  input.closing.extraction.facts=[];
  const result=selectRoeEquityPairCandidate(input);
  assert.equal(result.status,'BLOCKED_FACT_SELECTION');
  assert.equal(result.averageEquity,null);
  assert.deepEqual(result.failedFacts,['closing: MISSING_CONCEPT']);
});

test('blocks zero or negative equity denominator',()=>{
  const input=request();
  input.opening.extraction=filing('2025-03-31',0);
  const result=selectRoeEquityPairCandidate(input);
  assert.equal(result.status,'BLOCKED_EQUITY_VALUE');
  assert.equal(result.averageEquity,null);
});

test('blocks mixed currencies',()=>{
  const input=request();
  input.closing.extraction.units.INR=['iso4217:USD'];
  const result=selectRoeEquityPairCandidate(input);
  assert.equal(result.status,'BLOCKED_FACT_SELECTION');
  assert.equal(result.averageEquity,null);
});
