require('../setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getStateCodeFromName,
  resolveTaxMode,
  calcLineTax,
} = require('@helpers/gstTax.helper');

test('getStateCodeFromName maps known states', () => {
  assert.equal(getStateCodeFromName('Maharashtra'), '27');
  assert.equal(getStateCodeFromName('Tamil Nadu'), '33');
  assert.equal(getStateCodeFromName('Delhi'), '07');
  assert.equal(getStateCodeFromName('nowhere-land'), null);
});

test('resolveTaxMode: same state -> intrastate, different -> interstate', () => {
  // 27 (Maharashtra) GSTIN prefixes on both sides
  assert.equal(
    resolveTaxMode({ companyGstin: '27AAAAA0000A1Z5', customerGstin: '27BBBBB1111B2Z6' }),
    'sgst_cgst'
  );
  // 27 vs 29 (Karnataka)
  assert.equal(
    resolveTaxMode({ companyGstin: '27AAAAA0000A1Z5', customerGstin: '29BBBBB1111B2Z6' }),
    'igst'
  );
  // Falls back to state names when GSTINs missing
  assert.equal(
    resolveTaxMode({ companyState: 'Maharashtra', customerState: 'Maharashtra' }),
    'sgst_cgst'
  );
  assert.equal(resolveTaxMode({}), null);
});

test('calcLineTax computes IGST tax-exclusive', () => {
  const r = calcLineTax({ taxable: 1000, taxMode: 'igst', igstRate: 18 });
  assert.equal(r.taxAmt, 180);
  assert.equal(r.total, 1180);
  assert.equal(r.breakdown.igst, 180);
});

test('calcLineTax splits SGST + CGST', () => {
  const r = calcLineTax({ taxable: 1000, taxMode: 'sgst_cgst', sgstRate: 9, cgstRate: 9 });
  assert.equal(r.breakdown.sgst, 90);
  assert.equal(r.breakdown.cgst, 90);
  assert.equal(r.total, 1180);
});
