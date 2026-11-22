import assert from 'node:assert/strict';
import test from 'node:test';
import { extractXbrl } from './xbrl_extract.ts';

const fixture = `<?xml version="1.0"?>
<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance"
 xmlns:ix="http://www.xbrl.org/2013/inlineXBRL"
 xmlns:in="https://example.test/taxonomy" xmlns:xbrldi="http://www.xbrl.org/2006/xbrldi"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
 <xbrli:context id="FY">
  <xbrli:entity><xbrli:identifier scheme="https://www.nseindia.com">INE000A01000</xbrli:identifier></xbrli:entity>
  <xbrli:period><xbrli:startDate>2025-04-01</xbrli:startDate><xbrli:endDate>2026-03-31</xbrli:endDate></xbrli:period>
  <xbrli:scenario><xbrldi:explicitMember dimension="in:ConsolidatedOrStandalone">in:Standalone</xbrldi:explicitMember></xbrli:scenario>
 </xbrli:context>
 <xbrli:context id="Q"><xbrli:entity><xbrli:identifier scheme="https://www.nseindia.com">INE000A01000</xbrli:identifier></xbrli:entity><xbrli:period><xbrli:instant>2026-03-31</xbrli:instant></xbrli:period></xbrli:context>
 <xbrli:unit id="INR"><xbrli:measure>in:INR</xbrli:measure></xbrli:unit><xbrli:unit id="pure"><xbrli:measure>xbrli:pure</xbrli:measure></xbrli:unit>
 <in:Revenue contextRef="FY" unitRef="INR" decimals="-3">1,250,000</in:Revenue>\n <in:Loss contextRef="FY" unitRef="INR">(4,500)</in:Loss>
 <in:NilCash contextRef="FY" unitRef="INR" xsi:nil="true"/>
 <ix:nonFraction name="in:Profit" contextRef="FY" unitRef="INR" scale="3" sign="-" decimals="0">2,500</ix:nonFraction>
 <ix:fraction name="in:Margin" contextRef="FY" unitRef="pure"><ix:numerator>1</ix:numerator><ix:denominator>4</ix:denominator></ix:fraction>
 <ix:fraction name="in:ScaledMargin" contextRef="FY" unitRef="pure" scale="2" sign="-"><ix:numerator>1</ix:numerator><ix:denominator>4</ix:denominator></ix:fraction>
</xbrli:xbrl>`;

test('extracts context dates, entity identifier and dimensions', () => {
  const out = extractXbrl(fixture);
  assert.equal(out.contexts.FY.periodStart, '2025-04-01');
  assert.equal(out.contexts.FY.periodEnd, '2026-03-31');
  assert.equal(out.contexts.FY.entityIdentifier, 'INE000A01000');
  assert.match(out.contexts.FY.dimensions[0], /Standalone/);
  assert.equal(out.contexts.Q.instant, '2026-03-31');
});

test('extracts standard numeric facts with context and unit', () => {
  const out = extractXbrl(fixture);
  const fact = out.facts.find((item) => item.concept.endsWith('Revenue'));
  assert.equal(fact?.numericValue, 1250000);
  assert.equal(fact?.contextRef, 'FY');
  assert.equal(fact?.unitRef, 'INR');
});

test('applies inline scale and sign', () => {
  const out = extractXbrl(fixture);
  const fact = out.facts.find((item) => item.concept === 'in:Profit');
  assert.equal(fact?.numericValue, -2500000);
});

test('does not convert nil facts to zero', () => {
  const out = extractXbrl(fixture);
  const fact = out.facts.find((item) => item.concept.endsWith('NilCash'));
  assert.equal(fact?.isNil, true);
  assert.equal(fact?.numericValue, null);
});

test('extracts inline fraction as numerator divided by denominator', () => {
  const out = extractXbrl(fixture);
  const fact = out.facts.find((item) => item.concept === 'in:Margin');
  assert.equal(fact?.numericValue, 0.25);
});

test('applies scale and sign to inline fractions', () => {
  const out = extractXbrl(fixture);
  const fact = out.facts.find((item) => item.concept === 'in:ScaledMargin');
  assert.equal(fact?.numericValue, -25);
});

test('rejects DTD/entity declarations', () => {
  assert.throws(() => extractXbrl('<!DOCTYPE x [<!ENTITY e "bad">]><xbrli:xbrl/>'), /DTD and entity/);
});

test('warns when a fact references a missing context', () => {
  const out = extractXbrl('<xbrli:xbrl><in:Revenue contextRef="missing" unitRef="INR">12</in:Revenue></xbrli:xbrl>');
  assert.equal(out.warnings.length, 2);
});

test('preserves accounting-style parenthesized negatives', () => {
  const out = extractXbrl(fixture);
  const fact = out.facts.find((item) => item.concept.endsWith('Loss'));
  assert.equal(fact?.numericValue, -4500);
});

test('withholds numeric value for unsupported Inline XBRL format transformations', () => {
  const xml = '<xbrli:xbrl><ix:nonFraction name="in:Revenue" contextRef="c" unitRef="INR" format="ixt:num-comma-decimal">1.234,56</ix:nonFraction></xbrli:xbrl>';
  const out = extractXbrl(xml);
  assert.equal(out.facts[0]?.numericValue, null);
  assert.equal(out.facts[0]?.format, 'ixt:num-comma-decimal');
  assert.match(out.warnings.join(' '), /unsupported Inline XBRL format transformation/);
});

test('withholds numeric value when Inline XBRL continuedAt chain is unresolved', () => {
  const xml = '<xbrli:xbrl><ix:nonFraction name="in:Revenue" contextRef="c" unitRef="INR" continuedAt="cont1">123</ix:nonFraction><ix:continuation id="cont1">456</ix:continuation></xbrli:xbrl>';
  const out = extractXbrl(xml);
  assert.equal(out.facts[0]?.numericValue, null);
  assert.equal(out.facts[0]?.continuedAt, 'cont1');
  assert.match(out.warnings.join(' '), /continuedAt=cont1/);
});

test('warns and omits numeric facts that have no contextRef', () => {
  const xml = '<xbrli:xbrl><in:Revenue unitRef="INR">100</in:Revenue></xbrli:xbrl>';
  const out = extractXbrl(xml);
  assert.equal(out.factCount, 0);
  assert.match(out.warnings.join(' '), /has no contextRef; fact omitted/);
});

test('warns when duplicate context IDs would overwrite a context', () => {
  const xml = '<xbrli:xbrl><xbrli:context id="c"><xbrli:period><xbrli:instant>2026-09-30</xbrli:instant></xbrli:period></xbrli:context><xbrli:context id="c"><xbrli:period><xbrli:instant>2025-09-30</xbrli:instant></xbrli:period></xbrli:context></xbrli:xbrl>';
  const out = extractXbrl(xml);
  assert.match(out.warnings.join(' '), /Duplicate XBRL context id c/);
  assert.equal(out.contexts.c.instant, '2025-09-30');
});

test('warns when duplicate unit IDs would overwrite a unit', () => {
  const xml = '<xbrli:xbrl><xbrli:unit id="u"><xbrli:measure>iso4217:INR</xbrli:measure></xbrli:unit><xbrli:unit id="u"><xbrli:measure>xbrli:pure</xbrli:measure></xbrli:unit></xbrli:xbrl>';
  const out = extractXbrl(xml);
  assert.match(out.warnings.join(' '), /Duplicate XBRL unit id u/);
});
