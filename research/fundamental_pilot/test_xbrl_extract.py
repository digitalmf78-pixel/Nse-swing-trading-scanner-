import unittest
import io
import zipfile
from xbrl_extract import extract

XML = b'''<?xml version="1.0"?><xbrl xmlns="http://www.xbrl.org/2003/instance" xmlns:in="http://www.xbrl.org/2003/instance" xmlns:ix="http://www.xbrl.org/2013/inlineXBRL" xmlns:ex="https://example.test/taxonomy"><context id="FY"><entity><identifier scheme="https://www.nseindia.com">INE000A01000</identifier></entity><period><startDate>2025-04-01</startDate><endDate>2026-03-31</endDate></period></context><context id="Q"><entity><identifier scheme="https://www.nseindia.com">INE000A01000</identifier></entity><period><instant>2026-03-31</instant></period></context><unit id="INR"><measure>in:INR</measure></unit><ex:Revenue contextRef="FY" unitRef="INR" decimals="-3">1,250,000</ex:Revenue><ex:CashFlow contextRef="FY" unitRef="INR" xsi:nil="true" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/><ix:nonFraction name="ex:Profit" contextRef="FY" unitRef="INR" scale="3" sign="-" decimals="0">2,500</ix:nonFraction></xbrl>'''

class ParserTests(unittest.TestCase):
    def test_context_period_and_entity(self):
        out = extract(XML)
        self.assertEqual(out['contexts']['FY']['period_start'], '2025-04-01')
        self.assertEqual(out['contexts']['FY']['period_end'], '2026-03-31')
        self.assertEqual(out['contexts']['FY']['entity_identifier'], 'INE000A01000')
    def test_standard_fact_value(self):
        out = extract(XML)
        revenue = next(f for f in out['facts'] if f['concept'].endswith('Revenue'))
        self.assertEqual(revenue['numeric_value'], '1250000')
        self.assertEqual(revenue['context_ref'], 'FY')
    def test_nil_is_not_zero(self):
        out = extract(XML)
        cash = next(f for f in out['facts'] if f['concept'].endswith('CashFlow'))
        self.assertTrue(cash['is_nil'])
        self.assertIsNone(cash['numeric_value'])
    def test_inline_scale_and_sign(self):
        out = extract(XML)
        profit = next(f for f in out['facts'] if f['concept'] == 'ex:Profit')
        self.assertEqual(profit['numeric_value'], '-2500000')
    def test_zip_prefers_instance_document(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w') as zf:
            zf.writestr('taxonomy.xsd', b'<schema/>')
            zf.writestr('issuer-instance.xml', XML)
        out = extract(buffer.getvalue())
        self.assertEqual(out['contexts']['FY']['period_end'], '2026-03-31')

    def test_instant_context_is_preserved(self):
        out = extract(XML)
        self.assertEqual(out['contexts']['Q']['instant'], '2026-03-31')

    def test_dtd_rejected(self):
        with self.assertRaises(ValueError):
            extract(b'<!DOCTYPE x [<!ENTITY e "bad">]><x/>')

if __name__ == '__main__':
    unittest.main()
