import assert from 'node:assert/strict';
import test from 'node:test';
import { selectRoceCapitalEmployedPairCandidate } from './roce_capital_employed_pair_guard.ts';
import type { XbrlExtraction } from './xbrl_extract.ts';

const concepts = {
  TOTAL_EQUITY: 'in-capmkt:Equity',
  CURRENT_BORROWINGS: 'in-capmkt:BorrowingsCurrent',
  NONCURRENT_BORROWINGS: 'in-capmkt:BorrowingsNoncurrent',
} as const;

function filing(date: string, values: [number, number, number], issuer='INE000A01000'): XbrlExtraction {
  const roles = Object.keys(concepts) as (keyof typeof concepts)[];
  const facts = roles.map((role, index) => ({
    concept: concepts[role], contextRef: 'balance', unitRef: 'INR',
    rawValue: String(values[index]), numericValue: values[index], decimals: '-3',
    scale: null, sign: null, format: null, continuedAt: null, isNil: false, isInline: false,
  }));
  return {
    contexts: {
      balance: { id:'balance', entityScheme:'https://www.nseindia.com', entityIdentifier:issuer,
        periodStart:null, periodEnd:null, instant:date, dimensions:[] },
    },
    units: { INR:['iso4217:INR'] }, facts,
    contextCount:1, factCount:facts.length, warnings:[],
  };
}
const request = (): Parameters<typeof selectRoceCapitalEmployedPairCandidate>[0] => ({
  opening: { extraction:filing('2025-03-31',[800,100,200]), concepts:{...concepts},
    date:'2025-03-31', basis:'CONSOLIDATED', filingBasis:'CONSOLIDATED' },
  closing: { extraction:filing('2026-03-31',[1000,150,250]), concepts:{...concepts},
    date:'2026-03-31', basis:'CONSOLIDATED', filingBasis:'CONSOLIDATED' },
});

test('selects six aligned components and reports pre-lease subtotal as research-only',()=>{
  const result=selectRoceCapitalEmployedPairCandidate(request());
  assert.equal(result.status,'SELECTED_COMPONENT_PAIR_CANDIDATE');
  assert.equal(result.opening?.preLeaseCapitalEmployed,1100);
  assert.equal(result.closing?.preLeaseCapitalEmployed,1400);
  assert.equal(result.leaseTreatment,'EXCLUDED_PENDING_POLICY');
  assert.equal(result.productionApproved,false);
});

test('blocks issuer mismatch',()=>{
  const input=request();
  input.closing.extraction=filing('2026-03-31',[1000,150,250],'INE999Z01000');
  assert.equal(selectRoceCapitalEmployedPairCandidate(input).status,'BLOCKED_ISSUER_MISMATCH');
});

test('blocks basis mismatch and missing filing basis',()=>{
  const input=request();
  input.closing.filingBasis=null;
  assert.equal(selectRoceCapitalEmployedPairCandidate(input).status,'BLOCKED_BASIS_MISMATCH');
});

test('blocks owner-attributable equity as a substitute for total equity',()=>{
  const input=request();
  input.closing.concepts.TOTAL_EQUITY='in-capmkt:EquityAttributableToOwnersOfParent';
  assert.equal(selectRoceCapitalEmployedPairCandidate(input).status,'BLOCKED_CONCEPT_MISMATCH');
});

test('blocks reversed or invalid dates',()=>{
  const input=request();
  input.closing.date='2025-03-31';
  assert.equal(selectRoceCapitalEmployedPairCandidate(input).status,'BLOCKED_DATE_ORDER');
});

test('blocks a missing component and withholds the whole pair',()=>{
  const input=request();
  input.closing.extraction.facts=input.closing.extraction.facts.slice(0,2);
  const result=selectRoceCapitalEmployedPairCandidate(input);
  assert.equal(result.status,'BLOCKED_FACT_SELECTION');
  assert.equal(result.opening,null);
  assert.equal(result.closing,null);
});

test('blocks mixed component currencies',()=>{
  const input=request();
  input.closing.extraction.units.INR=['iso4217:USD'];
  assert.equal(selectRoceCapitalEmployedPairCandidate(input).status,'BLOCKED_CURRENCY_MISMATCH');
});

test('blocks negative borrowings and non-positive equity',()=>{
  const input=request();
  input.opening.extraction=filing('2025-03-31',[800,-1,200]);
  assert.equal(selectRoceCapitalEmployedPairCandidate(input).status,'BLOCKED_COMPONENT_VALUE');
  const second=request();
  second.opening.extraction=filing('2025-03-31',[0,100,200]);
  assert.equal(selectRoceCapitalEmployedPairCandidate(second).status,'BLOCKED_COMPONENT_VALUE');
});
