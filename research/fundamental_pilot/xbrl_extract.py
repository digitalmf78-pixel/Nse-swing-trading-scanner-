"""Research-only XBRL/iXBRL fact extractor; no scanner/runtime integration."""
from __future__ import annotations
import io, re, zipfile
from dataclasses import dataclass, asdict
from decimal import Decimal, InvalidOperation
from typing import Optional
import xml.etree.ElementTree as ET


def local(tag: str) -> str:
    return tag.rsplit('}', 1)[-1].split(':')[-1]


def child_text(node: ET.Element, wanted: str) -> Optional[str]:
    for child in node.iter():
        if local(child.tag) == wanted and child.text:
            return child.text.strip()
    return None


def parse_xml_bytes(data: bytes) -> ET.Element:
    # Fail closed on DTD/entity declarations to avoid XML external-entity attacks.
    head = data[:8192].upper()
    if b'<!DOCTYPE' in head or b'<!ENTITY' in head:
        raise ValueError('DTD/entity declarations are not accepted')
    try:
        return ET.fromstring(data)
    except ET.ParseError:
        cleaned = re.sub(br'<!DOCTYPE[^>]*(?:\[[\s\S]*?\]\s*)?>', b'', data, flags=re.I)
        return ET.fromstring(cleaned)


def _source_root(data: bytes) -> ET.Element:
    if zipfile.is_zipfile(io.BytesIO(data)):
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            candidates = [n for n in zf.namelist() if n.lower().endswith(('.xml', '.xhtml', '.html'))]
            if not candidates:
                raise ValueError('ZIP contains no XML/XHTML/HTML filing')
            # Prefer instance/iXBRL documents over taxonomy schemas and linkbases.
            scored = []
            for name in candidates:
                head = zf.read(name)[:2_000_000].lower()
                score = (b'<context' in head or b':context' in head) * 4
                score += (b'nonfraction' in head) * 3
                score += (b'<xbrl' in head or b'<html' in head) * 2
                score += zf.getinfo(name).file_size / 10_000_000
                scored.append((score, name))
            return parse_xml_bytes(zf.read(max(scored)[1]))
    return parse_xml_bytes(data)


@dataclass(frozen=True)
class Context:
    context_id: str
    entity_scheme: Optional[str]
    entity_identifier: Optional[str]
    period_start: Optional[str]
    period_end: Optional[str]
    instant: Optional[str]
    dimensions: tuple[str, ...]


@dataclass(frozen=True)
class Fact:
    concept: str
    context_ref: Optional[str]
    unit_ref: Optional[str]
    value: Optional[str]
    numeric_value: Optional[str]
    decimals: Optional[str]
    scale: Optional[int]
    sign: Optional[str]
    is_nil: bool


def extract(data: bytes) -> dict:
    root = _source_root(data)
    contexts: dict[str, Context] = {}
    units: dict[str, str] = {}
    facts: list[Fact] = []

    for node in root.iter():
        name = local(node.tag)
        if name == 'context':
            cid = node.attrib.get('id')
            if not cid:
                continue
            ent = next((x for x in node.iter() if local(x.tag) == 'identifier'), None)
            dims = []
            for x in node.iter():
                if local(x.tag) in ('explicitMember', 'typedMember'):
                    dims.append(f"{x.attrib.get('dimension', '')}={''.join(x.itertext()).strip()}")
            contexts[cid] = Context(
                cid, ent.attrib.get('scheme') if ent is not None else None,
                (ent.text or '').strip() if ent is not None else None,
                child_text(node, 'startDate'), child_text(node, 'endDate'),
                child_text(node, 'instant'), tuple(dims)
            )
        elif name == 'unit':
            uid = node.attrib.get('id')
            if uid:
                units[uid] = ''.join(node.itertext()).strip()

    structural = {'xbrl','html','body','div','table','tr','td','th','span','p',
                  'ixheader','resources','references','hidden','context','unit','schemaRef'}
    for node in root.iter():
        lname = local(node.tag)
        is_inline = lname in ('nonFraction', 'fraction', 'nonNumeric')
        is_standard = not is_inline and lname not in structural and bool(node.attrib.get('contextRef'))
        if not (is_inline or is_standard):
            continue
        raw = ''.join(node.itertext()).strip()
        nil = node.attrib.get('{http://www.w3.org/2001/XMLSchema-instance}nil', 'false').lower() == 'true'
        scale_text = node.attrib.get('scale')
        try:
            scale = int(scale_text) if scale_text is not None else None
        except ValueError:
            scale = None
        sign = node.attrib.get('sign')
        numeric = None
        if not nil and raw:
            compact = re.sub(r'[\s,]', '', raw)
            compact = re.sub(r'\(([^()]*)\)', r'-\1', compact)
            compact = re.sub(r'[^0-9.+-]', '', compact)
            try:
                number = Decimal(compact)
                if sign == '-':
                    number = -abs(number)
                if scale is not None:
                    number *= Decimal(10) ** scale
                numeric = str(number)
            except (InvalidOperation, ValueError):
                pass
        facts.append(Fact(
            concept=node.attrib.get('name') or lname,
            context_ref=node.attrib.get('contextRef'),
            unit_ref=node.attrib.get('unitRef'),
            value=raw or None, numeric_value=numeric,
            decimals=node.attrib.get('decimals'), scale=scale,
            sign=sign, is_nil=nil
        ))

    return {
        'contexts': {k: asdict(v) for k, v in contexts.items()},
        'units': units,
        'facts': [asdict(f) for f in facts],
        'fact_count': len(facts),
        'context_count': len(contexts),
        'warning': 'Raw fact extraction only. No metric mapping, ratio calculation, basis selection, or filing-version precedence is applied.'
    }
