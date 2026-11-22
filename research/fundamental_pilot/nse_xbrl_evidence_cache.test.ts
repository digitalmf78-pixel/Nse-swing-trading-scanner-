import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {collectXbrlEvidenceForFilingRows} from '../../server/nseXbrlEvidenceCache.ts';
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
  assert.throws(()=>validateOfficialXbrlArchiveUrl('https://nsearchives.nseindia.in:444/corporate/xbrl/a.xml'));
  assert.throws(()=>validateOfficialXbrlArchiveUrl('https://user@nsearchives.nseindia.in/corporate/xbrl/a.xml'));
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


test('collector archives exact original XML bytes and records relative raw evidence path', async () => {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'nse-evidence-'));
  const xml='<?xml version="1.0"?><xbrl><context id="c"><entity><identifier scheme="urn:test">123</identifier></entity><period><instant>2026-03-31</instant></period></context><unit id="u"><measure>iso4217:INR</measure></unit><demo:Revenue contextRef="c" unitRef="u">100</demo:Revenue></xbrl>';
  const raw=new TextEncoder().encode(xml);
  const fakeFetch=async()=>new Response(raw,{status:200,headers:{'content-type':'application/xml'}});
  try {
    const report=await collectXbrlEvidenceForFilingRows('ABC',[{seq_Id:'77',qe_Date:'31-MAR-2026',type:'Integrated Filing- Financials',type_Sub:'Original',consolidated:'Standalone',xbrl:'https://nsearchives.nseindia.in/corporate/xbrl/abc.xml'}],{fetchImpl:fakeFetch as typeof fetch,archiveDir:path.join(temp,'raw'),cacheFile:path.join(temp,'cache.json')});
    assert.equal(report.saved,1);
    const cache=JSON.parse(fs.readFileSync(path.join(temp,'cache.json'),'utf8'));
    const doc=cache.symbols.ABC.documents[0];
    const stored=fs.readFileSync(path.join(temp,'raw','ABC','77_'+doc.sha256+'.xml'));
    assert.equal(stored.toString('utf8'),xml);
    assert.equal(doc.rawArchivePath.endsWith('77_'+doc.sha256+'.xml'),true);
    assert.equal(doc.sha256.length,64);
  } finally { fs.rmSync(temp,{recursive:true,force:true}); }
});
