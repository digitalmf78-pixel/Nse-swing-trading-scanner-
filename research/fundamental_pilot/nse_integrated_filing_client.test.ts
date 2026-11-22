import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchNseIntegratedFilingRows,
  selectNseIssuerPeriodHistory,
} from './nse_integrated_filing_client.ts';

const official = (id: string, kind: 'Original'|'Revision', date='04-NOV-2026 19:16:48') => ({
  symbol:'KSHINTL', smName:'KSH International Limited', seq_Id:id,
  qe_Date:'30-SEP-2026', type:'Integrated Filing- Financials', type_Sub:kind,
  audited:'Un-Audited', consolidated:'Standalone', broadcast_Date:date,
  creation_Date:date, revised_Date:kind==='Revision'?date:null,
  revision_Remark:kind==='Revision'?'Test revision':null,
  xbrl:`https://nsearchives.nseindia.in/corporate/xbrl/${id}.xml`,
  ixbrl:`https://nsearchives.nseindia.in/corporate/ixbrl/${id}.html`,
});

function response(data: unknown[], status=200): Response {
  return new Response(JSON.stringify({data}), {
    status, headers:{'content-type':'application/json'},
  });
}

test('fetches all pages until a short page proves end of results', async () => {
  const calls: string[]=[];
  const fetchImpl=(async (input: string|URL) => {
    const url=new URL(String(input)); calls.push(url.searchParams.get('page')!);
    return response(url.searchParams.get('page')==='1' ? [official('1','Original'),official('2','Revision')] : []);
  }) as typeof fetch;
  const result=await fetchNseIntegratedFilingRows({
    symbol:'kshintl',pageSize:2,maxPages:4,fetchImpl,
  });
  assert.deepEqual(calls,['1','2']);
  assert.equal(result.rows.length,2);
  assert.equal(result.complete,true);
  assert.equal(result.pagesFetched,2);
  assert.equal(result.source,'NSE_OFFICIAL_INTEGRATED_FILING_API');
});

test('marks pagination incomplete when the page ceiling is reached', async () => {
  const fetchImpl=(async () => response([official('1','Original'),official('2','Revision')])) as typeof fetch;
  const result=await fetchNseIntegratedFilingRows({
    symbol:'KSHINTL',pageSize:2,maxPages:1,fetchImpl,
  });
  assert.equal(result.complete,false);
  assert.match(result.warnings.join(' '),/PAGE_LIMIT_REACHED/);
});

test('rejects conflicting duplicate sequence IDs instead of silently selecting one', async () => {
  const a=official('1','Original');
  const b={...a,smName:'Different issuer name'};
  const fetchImpl=(async () => response([a,b])) as typeof fetch;
  await assert.rejects(
    fetchNseIntegratedFilingRows({symbol:'KSHINTL',fetchImpl}),
    /Conflicting NSE API rows share sequence ID/,
  );
});

test('retries a transient 503 and succeeds', async () => {
  let attempts=0;
  const fetchImpl=(async () => {
    attempts+=1;
    return attempts===1 ? response([],503) : response([official('1','Original')]);
  }) as typeof fetch;
  const result=await fetchNseIntegratedFilingRows({
    symbol:'KSHINTL',maxRetries:1,timeoutMs:1000,fetchImpl,
  });
  assert.equal(attempts,2);
  assert.equal(result.complete,true);
});

test('rejects invalid symbol and invalid page-size controls before network access', async () => {
  const fetchImpl=(async () => { throw new Error('must not call network'); }) as typeof fetch;
  await assert.rejects(fetchNseIntegratedFilingRows({symbol:'../../bad',fetchImpl}),/Invalid NSE symbol/);
  await assert.rejects(fetchNseIntegratedFilingRows({symbol:'KSHINTL',pageSize:101,fetchImpl}),/pageSize/);
});

test('selects an original-only filing without pretending it has a revision', () => {
  const result=selectNseIssuerPeriodHistory([official('1','Original')],{
    symbol:'KSHINTL',period:'30-SEP-2026',basis:'Standalone',
  });
  assert.equal(result.status,'ORIGINAL_ONLY');
  if(result.status==='ORIGINAL_ONLY') {
    assert.equal(result.original.seq_Id,'1');
    assert.equal(result.revisions.length,0);
  }
});

test('returns the complete Original and Revision history in timestamp order', () => {
  const original=official('1','Original','04-NOV-2026 19:16:48');
  const revision2=official('3','Revision','06-NOV-2026 10:00:00');
  const revision1=official('2','Revision','05-NOV-2026 10:00:00');
  const result=selectNseIssuerPeriodHistory([revision2,original,revision1],{
    symbol:'KSHINTL',period:'30-SEP-2026',basis:'Standalone',
  });
  assert.equal(result.status,'REVISION_HISTORY');
  if(result.status==='REVISION_HISTORY') {
    assert.deepEqual(result.revisions.map(x=>x.seq_Id),['2','3']);
  }
});

test('does not use a revision when the Original is missing', () => {
  const result=selectNseIssuerPeriodHistory([official('2','Revision')],{
    symbol:'KSHINTL',period:'30-SEP-2026',basis:'Standalone',
  });
  assert.equal(result.status,'BLOCKED');
});

test('blocks wrong exchange archive URLs', () => {
  const bad={...official('1','Original'),xbrl:'https://example.com/file.xml'};
  const result=selectNseIssuerPeriodHistory([bad],{
    symbol:'KSHINTL',period:'30-SEP-2026',basis:'Standalone',
  });
  assert.equal(result.status,'BLOCKED');
});

test('distinguishes no matching filing from a blocked filing history', () => {
  const result=selectNseIssuerPeriodHistory([],{
    symbol:'KSHINTL',period:'30-SEP-2026',basis:'Standalone',
  });
  assert.equal(result.status,'ORIGINAL_MISSING');
});
