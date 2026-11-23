import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildNseIndustryText,
  fetchNseIssuerIndustry,
  loadNseIssuerIndustryCache,
  saveNseIssuerIndustryCache,
} from '../../server/nseIssuerIndustryCache.ts';

test('fetches official NSE industry classification and ISIN', async () => {
  let requested = '';
  let apiCookie = '';
  let calls = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    calls += 1;
    if (calls === 1) {
      return new Response('ok', { status: 200, headers: { 'set-cookie': 'nseSession=abc; Path=/' } });
    }
    requested = String(input);
    apiCookie = (init?.headers as Record<string, string>)?.Cookie ?? '';
    return new Response(JSON.stringify({
      info: { isin: 'INE123A01016' },
      industryInfo: {
        macro: 'Financial Services',
        sector: 'Financial Services',
        industry: 'Banks',
        basicIndustry: 'Private Sector Bank',
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const record = await fetchNseIssuerIndustry('abc', fetchImpl);
  assert.match(requested, /quote-equity\?symbol=ABC/);
  assert.equal(apiCookie, 'nseSession=abc');
  assert.equal(record.symbol, 'ABC');
  assert.equal(record.isin, 'INE123A01016');
  assert.equal(buildNseIndustryText(record), 'Financial Services | Financial Services | Banks | Private Sector Bank');
});

test('falls back to the second official NSE host when the primary quote API is blocked', async () => {
  const fetchImpl: typeof fetch = async input => {
    const url = String(input);
    if (url === 'https://www.nseindia.com/') {
      return new Response('ok', { status: 200, headers: { 'set-cookie': 'primary=1; Path=/' } });
    }
    if (url.startsWith('https://www.nseindia.com/api/quote-equity')) {
      return new Response('blocked', { status: 403 });
    }
    if (url === 'https://www.nseindia.in/') {
      return new Response('ok', { status: 200, headers: { 'set-cookie': 'fallback=1; Path=/' } });
    }
    if (url.startsWith('https://www.nseindia.in/api/quote-equity')) {
      return new Response(JSON.stringify({
        info: { isin: 'INE123A01016' },
        industryInfo: { macro: 'Industrials', sector: 'Capital Goods', industry: 'Industrial Products', basicIndustry: 'Bearings' },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error('Unexpected NSE URL: ' + url);
  };
  const record = await fetchNseIssuerIndustry('ABC', fetchImpl);
  assert.match(record.sourceUrl, /^https:\/\/www\.nseindia\.in\//);
  assert.equal(record.industry, 'Industrial Products');
});

test('blocks invalid ISIN and missing industry classification', async () => {
  const invalidIsin: typeof fetch = async () => new Response(JSON.stringify({
    info: { isin: 'BAD' }, industryInfo: { industry: 'Banks' },
  }), { status: 200 });
  await assert.rejects(() => fetchNseIssuerIndustry('ABC', invalidIsin), /invalid ISIN/);
  const noIndustry: typeof fetch = async () => new Response(JSON.stringify({
    info: { isin: 'INE123A01016' }, industryInfo: {},
  }), { status: 200 });
  await assert.rejects(() => fetchNseIssuerIndustry('ABC', noIndustry), /no official industry classification/);
});

test('NSE issuer industry cache round-trips with identity validation', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nse-industry-'));
  const file = path.join(dir, 'industry.json');
  try {
    const record = {
      symbol: 'ABC', isin: 'INE123A01016', macro: 'Financial Services',
      sector: 'Financial Services', industry: 'Banks', basicIndustry: 'Private Sector Bank',
      source: 'NSE_OFFICIAL_QUOTE_EQUITY' as const,
      sourceUrl: 'https://www.nseindia.in/api/quote-equity?symbol=ABC',
      fetchedAtUtc: '2026-11-23T00:00:00.000Z',
    };
    saveNseIssuerIndustryCache({
      schemaVersion: 1, updatedAtUtc: record.fetchedAtUtc, symbols: { ABC: record },
    }, file);
    const loaded = loadNseIssuerIndustryCache(file);
    assert.equal(loaded.symbols.ABC.isin, 'INE123A01016');
    assert.equal(loaded.symbols.ABC.basicIndustry, 'Private Sector Bank');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
