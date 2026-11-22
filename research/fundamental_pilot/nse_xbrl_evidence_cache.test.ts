import test from 'node:test';
import assert from 'node:assert/strict';
import {validateOfficialXbrlArchiveUrl, mergeXbrlEvidenceDocuments} from '../../server/nseXbrlEvidenceCache.ts';

const doc = (seqId:string, sha256='a'.repeat(64), patch:Partial<any>={}) => ({
  symbol:'ABC',seqId,periodEnd:'2026-03-31',filingType:'Integrated Filing- Financials',
  filingSubType:'Original',basis:'Standalone',filingUrl:'https://nsearchives.nseindia.com/corporate/xbrl/a.xml',
  fetchedAtUtc:'2026-11-23T00:00:00Z',sha256,extraction:{contexts:{},units:{},facts:[],contextCount:0,factCount:0,warnings:[]},...patch
});

test('XBRL evidence URL accepts official archive host/path only',()=>{
  assert.equal(validateOfficialXbrlArchiveUrl('https://nsearchives.nseindia.in/corporate/xbrl/a.xml').hostname,'nsearchives.nseindia.in');
  assert.throws(()=>validateOfficialXbrlArchiveUrl('http://nsearchives.nseindia.in/corporate/xbrl/a.xml'));
  assert.throws(()=>validateOfficialXbrlArchiveUrl('https://evil.example/corporate/xbrl/a.xml'));
  assert.throws(()=>validateOfficialXbrlArchiveUrl('https://nsearchives.nseindia.in/corporate/ixbrl/a.xml'));
});

test('Evidence merge is idempotent and retains original records',()=>{
  const merged=mergeXbrlEvidenceDocuments([doc('10')],[doc('10'),doc('11','b'.repeat(64))]);
  assert.deepEqual(merged.map(x=>x.seqId),['10','11']);
});

test('Conflicting same sequence archive evidence blocks merge',()=>{
  assert.throws(()=>mergeXbrlEvidenceDocuments([doc('10')],[doc('10','b'.repeat(64))]),/Conflicting XBRL evidence/);
});

test('Evidence merge validates SHA-256 format',()=>{
  assert.throws(()=>mergeXbrlEvidenceDocuments([],[doc('10','bad')]),/SHA-256/);
});
