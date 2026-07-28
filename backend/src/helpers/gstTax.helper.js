/**
 * Indian GST — interstate (IGST) vs intrastate (SGST + CGST)
 * from GSTIN state codes (first 2 digits) or billing state names.
 */

const STATE_CODE_BY_NAME = {
  'jammu and kashmir': '01',
  'jammu & kashmir': '01',
  'himachal pradesh': '02',
  punjab: '03',
  chandigarh: '04',
  uttarakhand: '05',
  haryana: '06',
  delhi: '07',
  'nct of delhi': '07',
  rajasthan: '08',
  'uttar pradesh': '09',
  bihar: '10',
  sikkim: '11',
  'arunachal pradesh': '12',
  nagaland: '13',
  manipur: '14',
  mizoram: '15',
  tripura: '16',
  meghalaya: '17',
  assam: '18',
  'west bengal': '19',
  jharkhand: '20',
  odisha: '21',
  orissa: '21',
  chhattisgarh: '22',
  'madhya pradesh': '23',
  gujarat: '24',
  'dadra and nagar haveli and daman and diu': '26',
  'dadra & nagar haveli and daman & diu': '26',
  maharashtra: '27',
  karnataka: '29',
  goa: '30',
  lakshadweep: '31',
  kerala: '32',
  'tamil nadu': '33',
  puducherry: '34',
  pondicherry: '34',
  'andaman and nicobar islands': '35',
  'andaman & nicobar islands': '35',
  telangana: '36',
  'andhra pradesh': '37',
  ladakh: '38',
};

function normalizeStateKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getGstinStateCode(gstin) {
  const cleaned = String(gstin || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const match = cleaned.match(/^(\d{2})/);
  if (!match) return null;
  return match[1];
}

function getStateCodeFromName(stateName) {
  const key = normalizeStateKey(stateName);
  if (!key) return null;
  if (/^\d{2}$/.test(key)) return key;
  if (STATE_CODE_BY_NAME[key]) return STATE_CODE_BY_NAME[key];

  // Match known state inside free-form address text (longest name wins)
  let best = null;
  let bestLen = 0;
  for (const [name, code] of Object.entries(STATE_CODE_BY_NAME)) {
    if (key.includes(name) && name.length > bestLen) {
      best = code;
      bestLen = name.length;
    }
  }
  return best;
}

/**
 * Prefer GSTIN codes; fall back to billing state names.
 * @returns {'igst' | 'sgst_cgst' | null}
 */
function resolveTaxModeFromGstins(companyGstin, customerGstin) {
  const companyState = getGstinStateCode(companyGstin);
  const customerState = getGstinStateCode(customerGstin);
  if (!companyState || !customerState) return null;
  return companyState === customerState ? 'sgst_cgst' : 'igst';
}

/**
 * @param {{
 *   companyGstin?: string,
 *   customerGstin?: string,
 *   companyState?: string,
 *   customerState?: string,
 * }} input
 * @returns {'igst' | 'sgst_cgst' | null}
 */
function resolveTaxMode(input = {}) {
  const fromGstin = resolveTaxModeFromGstins(input.companyGstin, input.customerGstin);
  if (fromGstin) return fromGstin;

  const companyState =
    getGstinStateCode(input.companyGstin) || getStateCodeFromName(input.companyState);
  const customerState =
    getGstinStateCode(input.customerGstin) || getStateCodeFromName(input.customerState);

  if (!companyState || !customerState) return null;
  return companyState === customerState ? 'sgst_cgst' : 'igst';
}

/**
 * Tax-exclusive: tax is added on taxable (list − discount).
 */
function calcLineTax({ taxable, taxMode, gstRate, igstRate, sgstRate, cgstRate }) {
  const base = Math.max(0, Number(taxable) || 0);
  const mode = taxMode || 'igst';

  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

  if (mode === 'gst') {
    const rate = Number(gstRate) || 0;
    const gstAmt = round2((base * rate) / 100);
    return {
      taxLabel: `GST ${rate}%`,
      taxAmt: gstAmt,
      total: round2(base + gstAmt),
      rates: { gst: rate, cgst: 0, sgst: 0, igst: 0 },
      breakdown: { gst: gstAmt, cgst: 0, sgst: 0, igst: 0 },
    };
  }

  if (mode === 'sgst_cgst') {
    const sgst = Number(sgstRate) || 0;
    const cgst = Number(cgstRate) || 0;
    const sgstAmt = round2((base * sgst) / 100);
    const cgstAmt = round2((base * cgst) / 100);
    return {
      taxLabel: `SGST ${sgst}% + CGST ${cgst}%`,
      taxAmt: round2(sgstAmt + cgstAmt),
      total: round2(base + sgstAmt + cgstAmt),
      rates: { gst: 0, cgst, sgst, igst: 0 },
      breakdown: { gst: 0, cgst: cgstAmt, sgst: sgstAmt, igst: 0 },
    };
  }

  const igst = Number(igstRate) || 0;
  const igstAmt = round2((base * igst) / 100);
  return {
    taxLabel: `IGST ${igst}%`,
    taxAmt: igstAmt,
    total: round2(base + igstAmt),
    rates: { gst: 0, cgst: 0, sgst: 0, igst },
    breakdown: { gst: 0, cgst: 0, sgst: 0, igst: igstAmt },
  };
}

module.exports = {
  getGstinStateCode,
  getStateCodeFromName,
  resolveTaxModeFromGstins,
  resolveTaxMode,
  calcLineTax,
};
