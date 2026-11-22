/**
 * Research-only TypeScript XBRL/iXBRL extractor.
 *
 * This module is deliberately isolated from server/liveFetcher.ts and the
 * scanner runtime. It extracts raw facts and context metadata only; it does
 * not calculate or select investment metrics.
 */
import { XMLParser } from 'fast-xml-parser';

export interface XbrlContext {
  id: string;
  entityScheme: string | null;
  entityIdentifier: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  instant: string | null;
  dimensions: string[];
}

export interface XbrlFact {
  concept: string;
  contextRef: string | null;
  unitRef: string | null;
  rawValue: string | null;
  numericValue: number | null;
  decimals: string | null;
  scale: number | null;
  sign: string | null;
  format: string | null;
  continuedAt: string | null;
  isNil: boolean;
  isInline: boolean;
}

export interface XbrlExtraction {
  contexts: Record<string, XbrlContext>;
  units: Record<string, string[]>;
  facts: XbrlFact[];
  contextCount: number;
  factCount: number;
  warnings: string[];
}

type XmlObject = Record<string, unknown>;
type XmlValue = unknown;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  allowBooleanAttributes: true,
});

const STRUCTURAL = new Set([
  'xbrl', 'html', 'head', 'body', 'div', 'table', 'thead', 'tbody',
  'tfoot', 'tr', 'td', 'th', 'span', 'p', 'br', 'a', 'style', 'script',
  'ixheader', 'resources', 'references', 'hidden', 'context', 'unit',
  'schemaref', 'entity', 'identifier', 'period', 'segment', 'scenario',
  'explicitmember', 'typedmember', 'measure',
]);

function localName(name: string): string {
  return name.replace(/^@_/, '').split(':').pop()?.toLowerCase() ?? name.toLowerCase();
}

function asObjects(value: XmlValue): XmlObject[] {
  if (Array.isArray(value)) return value.filter((v): v is XmlObject => !!v && typeof v === 'object');
  return value && typeof value === 'object' ? [value as XmlObject] : [];
}

function attr(node: XmlObject, wanted: string): string | null {
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('@_') && localName(key) === wanted.toLowerCase() && value !== null && value !== undefined) {
      return String(value);
    }
  }
  return null;
}

function textOf(value: XmlValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(textOf).join('');
  if (typeof value === 'object') {
    const obj = value as XmlObject;
    let out = typeof obj['#text'] === 'string' ? String(obj['#text']) : '';
    for (const [key, child] of Object.entries(obj)) {
      if (key === '#text' || key.startsWith('@_') || localName(key) === 'exclude') continue;
      out += textOf(child);
    }
    return out;
  }
  return '';
}

function descendants(root: XmlValue, wanted: string): Array<{ name: string; node: XmlValue }> {
  const found: Array<{ name: string; node: XmlValue }> = [];
  const visit = (value: XmlValue): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value as XmlObject)) {
      if (key.startsWith('@_') || key === '#text') continue;
      const children = Array.isArray(child) ? child : [child];
      for (const node of children) {
        if (localName(key) === wanted.toLowerCase()) found.push({ name: key, node });
        visit(node);
      }
    }
  };
  visit(root);
  return found;
}

function firstDescendantText(root: XmlValue, wanted: string): string | null {
  const match = descendants(root, wanted)[0];
  if (!match) return null;
  const value = textOf(match.node).trim();
  return value || null;
}

function parseScale(value: string | null): number | null {
  if (value === null || !/^-?\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && Math.abs(n) <= 100 ? n : null;
}

function numericValue(raw: string, scale: number | null, sign: string | null): number | null {
  let value = raw.replace(/\u00a0/g, ' ').replace(/[−–]/g, '-').trim();
  if (!value) return null;
  const parenthesized = /^\([\s\S]*\)$/.test(value);
  if (parenthesized) value = value.slice(1, -1);
  value = value.replace(/[\s,]/g, '').replace(/[^0-9.+\-eE]/g, '');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) return null;
  let parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parenthesized || sign === '-') parsed = -Math.abs(parsed);
  if (scale !== null) parsed *= 10 ** scale;
  return Number.isFinite(parsed) ? parsed : null;
}

function fractionValue(node: XmlObject, scale: number | null, sign: string | null): number | null {
  const numerator = firstDescendantText(node, 'numerator');
  const denominator = firstDescendantText(node, 'denominator');
  if (numerator === null || denominator === null) return null;
  const n = numericValue(numerator, null, null);
  const d = numericValue(denominator, null, null);
  if (n === null || d === null || d === 0) return null;
  let value = (n / d) * (scale === null ? 1 : 10 ** scale);
  if (sign === '-') value = -Math.abs(value);
  return Number.isFinite(value) ? value : null;
}

export function extractXbrl(xml: string): XbrlExtraction {
  if (typeof xml !== 'string' || xml.trim().length < 20) {
    throw new Error('XBRL input is empty or too short');
  }
  if (xml.length > 25 * 1024 * 1024) {
    throw new Error('XBRL input exceeds the 25 MB safety limit');
  }
  // Never allow DTD/entity declarations: no external or recursive entity expansion.
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) {
    throw new Error('DTD and entity declarations are not accepted');
  }
  if (xml.startsWith('PK\u0003\u0004')) {
    throw new Error('ZIP-compressed filings must be decompressed before XML extraction');
  }

  let parsed: XmlObject;
  try {
    parsed = parser.parse(xml) as XmlObject;
  } catch (error) {
    throw new Error(`Unable to parse XBRL XML: ${(error as Error).message}`);
  }

  const warnings: string[] = [];
  const contexts: Record<string, XbrlContext> = {};
  for (const { node } of descendants(parsed, 'context')) {
    if (!node || typeof node !== 'object') continue;
    const contextNode = node as XmlObject;
    const id = attr(contextNode, 'id');
    if (!id) continue;
    if (contexts[id]) warnings.push(`Duplicate XBRL context id ${id}; later context would overwrite earlier context`);
    const identifierNode = descendants(contextNode, 'identifier')[0]?.node;
    const identifier = identifierNode && typeof identifierNode === 'object'
      ? identifierNode as XmlObject
      : null;
    const dimensions = descendants(contextNode, 'explicitMember')
      .concat(descendants(contextNode, 'typedMember'))
      .map(({ node: member }) => {
        const dimension = member && typeof member === 'object'
          ? attr(member as XmlObject, 'dimension') ?? ''
          : '';
        return `${dimension}=${textOf(member).trim()}`;
      });
    contexts[id] = {
      id,
      entityScheme: identifier ? attr(identifier, 'scheme') : null,
      entityIdentifier: identifier ? textOf(identifier).trim() || null : null,
      periodStart: firstDescendantText(contextNode, 'startDate'),
      periodEnd: firstDescendantText(contextNode, 'endDate'),
      instant: firstDescendantText(contextNode, 'instant'),
      dimensions,
    };
  }

  const units: Record<string, string[]> = {};
  for (const { node } of descendants(parsed, 'unit')) {
    if (!node || typeof node !== 'object') continue;
    const unitNode = node as XmlObject;
    const id = attr(unitNode, 'id');
    if (!id) continue;
    if (units[id]) warnings.push(`Duplicate XBRL unit id ${id}; later unit would overwrite earlier unit`);
    units[id] = descendants(unitNode, 'measure').map(({ node: measure }) => textOf(measure).trim()).filter(Boolean);
  }

  const facts: XbrlFact[] = [];
  const walkFacts = (value: XmlValue): void => {
    if (Array.isArray(value)) {
      for (const item of value) walkFacts(item);
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value as XmlObject)) {
      if (key.startsWith('@_') || key === '#text') continue;
      for (const node of asObjects(child)) {
        const contextRef = attr(node, 'contextref');
        const tag = localName(key);
        const isInline = tag === 'nonfraction' || tag === 'fraction' || tag === 'nonnumeric';
        if (!contextRef && (attr(node, 'unitref') || isInline)) {
          warnings.push(`Numeric or inline fact ${attr(node, 'name') ?? key} has no contextRef; fact omitted`);
        }
        if (contextRef && !STRUCTURAL.has(tag)) {
          const concept = attr(node, 'name') ?? key;
          const raw = textOf(node).trim();
          const nil = (attr(node, 'nil') ?? 'false').toLowerCase() === 'true';
          const scaleRaw = attr(node, 'scale');
          const scale = parseScale(scaleRaw);
          const sign = attr(node, 'sign');
          const format = attr(node, 'format');
          const continuedAt = attr(node, 'continuedat');
          const unitRef = attr(node, 'unitref');
          let numeric: number | null = null;
          if (!nil && raw && (unitRef || tag === 'nonfraction' || tag === 'fraction')) {
            // Fail closed: never normalize a value without a resolved context/unit,
            // a supported scale/sign, or implemented Inline XBRL transformations.
            if (!contextRef || !contexts[contextRef]) {
              warnings.push(`Fact ${concept} references an unresolved context; numeric value withheld`);
            } else if (unitRef && !units[unitRef]) {
              warnings.push(`Fact ${concept} references an unresolved unit ${unitRef}; numeric value withheld`);
            } else if (scaleRaw !== null && scale === null) {
              warnings.push(`Fact ${concept} has unsupported scale ${scaleRaw}; numeric value withheld`);
            } else if (sign !== null && sign !== '-' && sign !== '+') {
              warnings.push(`Fact ${concept} has unsupported sign ${sign}; numeric value withheld`);
            } else if (format) {
              warnings.push(`Fact ${concept} uses unsupported Inline XBRL format transformation ${format}; numeric value withheld`);
            } else if (continuedAt) {
              warnings.push(`Fact ${concept} uses continuedAt=${continuedAt}; numeric value withheld until continuation resolution is implemented`);
            } else {
              numeric = tag === 'fraction' ? fractionValue(node, scale, sign) : numericValue(raw, scale, sign);
            }
          }
          facts.push({
            concept,
            contextRef,
            unitRef,
            rawValue: raw || null,
            numericValue: nil ? null : numeric,
            decimals: attr(node, 'decimals'),
            scale,
            sign,
            format,
            continuedAt,
            isNil: nil,
            isInline,
          });
        }
        walkFacts(node);
      }
    }
  };
  walkFacts(parsed);

  for (const fact of facts) {
    if (fact.contextRef && !contexts[fact.contextRef]) {
      warnings.push(`Fact ${fact.concept} references missing context ${fact.contextRef}`);
    }
    if (fact.unitRef && !units[fact.unitRef]) {
      warnings.push(`Fact ${fact.concept} references missing unit ${fact.unitRef}`);
    }
  }

  return {
    contexts,
    units,
    facts,
    contextCount: Object.keys(contexts).length,
    factCount: facts.length,
    warnings: [...new Set(warnings)],
  };
}
