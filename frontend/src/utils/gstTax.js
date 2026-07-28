/**
 * Indian GST helpers — interstate (IGST) vs intrastate (SGST + CGST)
 * from GSTIN state codes (first 2 digits).
 */

const STATE_NAMES = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

export function getGstinStateCode(gstin) {
  const cleaned = String(gstin || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const match = cleaned.match(/^(\d{2})/);
  if (!match) return null;
  return match[1];
}

export function getStateNameFromGstin(gstin) {
  const code = getGstinStateCode(gstin);
  if (!code) return null;
  return STATE_NAMES[code] || `State ${code}`;
}

/**
 * @returns {'igst' | 'sgst_cgst' | null}
 * null when either GSTIN is missing / incomplete
 */
export function resolveTaxModeFromGstins(companyGstin, customerGstin) {
  const companyState = getGstinStateCode(companyGstin);
  const customerState = getGstinStateCode(customerGstin);
  if (!companyState || !customerState) return null;
  return companyState === customerState ? 'sgst_cgst' : 'igst';
}

export function describeTaxRoute(companyGstin, customerGstin) {
  const mode = resolveTaxModeFromGstins(companyGstin, customerGstin);
  if (!mode) {
    return 'Enter company and customer GSTIN to auto-select IGST vs SGST+CGST.';
  }
  const from = getStateNameFromGstin(companyGstin);
  const to = getStateNameFromGstin(customerGstin);
  if (mode === 'igst') {
    return `Customer is outside ${from} (${to}) → IGST applies.`;
  }
  return `Customer is in the same state (${from}) → SGST + CGST applies.`;
}
