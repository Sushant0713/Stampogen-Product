const { resolveTaxModeFromGstins } = require('@helpers/gstTax.helper');

const TAX_MODES = ['gst', 'sgst_cgst', 'igst'];

const DEFAULT_INVOICE_SETTINGS = {
  logoUrl: '',
  company: {
    name: 'Stampogen Technologies Pvt Ltd',
    address: 'Andheri East, Mumbai, Maharashtra 400069',
    gstin: '27AABCT1234D1Z5',
    pan: 'AABCT1234D',
    email: 'billing@stampogen.com',
    phone: '+91 98765 43210',
  },
  sampleCustomer: {
    name: 'Sample Customer Pvt Ltd',
    address: 'Bandra West, Mumbai, Maharashtra 400050',
    gstin: '27AABCU9603R1ZM',
    pan: 'AABCU9603R',
    email: 'accounts@samplecustomer.com',
    phone: '+91 91234 56789',
  },
  defaults: {
    currency: 'INR',
    invoicePrefix: 'INV',
    sampleInvoiceNumber: 'INV-2026-00210',
    sampleInvoiceDate: '',
    dueDays: 30,
    taxMode: 'igst',
    gstRate: 18,
    igstRate: 18,
    sgstRate: 9,
    cgstRate: 9,
    billToTitle: 'Bill To',
  },
  sampleItems: [
    {
      name: 'Stampogen Professional Plan (Monthly)',
      rate: 4999,
      units: 1,
      discount: 0,
      gst: 18,
      igst: 18,
      sgst: 9,
      cgst: 9,
    },
  ],
  payment: {
    bankName: 'HDFC Bank',
    accountName: 'Stampogen Technologies Pvt Ltd',
    accountNumber: '50200012345678',
    ifsc: 'HDFC0001234',
    branch: 'Andheri East, Mumbai',
  },
  terms: [
    'Payment is due within 30 days of the invoice date.',
    'Late payments may attract interest as per applicable policy.',
    'This is a computer-generated invoice and does not require a physical signature.',
  ],
  signatureUrl: '',
  closingNote: 'Thank you for your business',
  showMadeWithBadge: true,
  madeWithImageUrl: '',
};

function normalizeTaxMode(value) {
  const mode = String(value || '').trim();
  return TAX_MODES.includes(mode) ? mode : 'igst';
}

function normalizeInvoicePrefix(prefix) {
  const cleaned = String(prefix || 'INV')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
  return cleaned || 'INV';
}

function yearFromInvoiceDate(dateValue) {
  if (!dateValue) return null;
  const match = String(dateValue).trim().match(/^(\d{4})/);
  if (match) {
    const year = Number(match[1]);
    if (year >= 2000 && year <= 2100) return year;
  }
  return null;
}

function formatInvoiceId({ prefix, year, sequence }) {
  const p = normalizeInvoicePrefix(prefix);
  const y = Number(year);
  const safeYear = Number.isFinite(y) && y >= 2000 && y <= 2100 ? y : new Date().getFullYear();
  const rawSeq = Number(sequence);
  const seq = Number.isFinite(rawSeq) ? Math.max(1, Math.min(99999, Math.floor(rawSeq))) : 1;
  return `${p}-${safeYear}-${String(seq).padStart(5, '0')}`;
}

function parseInvoiceNumber(value) {
  const match = String(value || '')
    .trim()
    .toUpperCase()
    .match(/^([A-Z0-9]{1,10})-(\d{4})-(\d{1,5})$/);
  if (!match) return null;
  return {
    prefix: match[1],
    year: Number(match[2]),
    sequence: Number(match[3]),
  };
}

function normalizeStoredInvoiceNumber(defaults = {}) {
  const parsed = parseInvoiceNumber(defaults.sampleInvoiceNumber);
  const dateYear = yearFromInvoiceDate(defaults.sampleInvoiceDate);
  return formatInvoiceId({
    prefix: defaults.invoicePrefix || parsed?.prefix || 'INV',
    year: dateYear ?? parsed?.year ?? new Date().getFullYear(),
    sequence: parsed?.sequence || 1,
  });
}

function toInvoiceSettingsView(doc) {
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const view = {
    id: String(plain._id),
    logoUrl: plain.logoUrl || '',
    company: {
      name: plain.company?.name || '',
      address: plain.company?.address || '',
      gstin: plain.company?.gstin || '',
      pan: plain.company?.pan || '',
      email: plain.company?.email || '',
      phone: plain.company?.phone || '',
    },
    sampleCustomer: {
      name: plain.sampleCustomer?.name || '',
      address: plain.sampleCustomer?.address || '',
      gstin: plain.sampleCustomer?.gstin || '',
      pan: plain.sampleCustomer?.pan || '',
      email: plain.sampleCustomer?.email || '',
      phone: plain.sampleCustomer?.phone || '',
    },
    defaults: {
      currency: plain.defaults?.currency || 'INR',
      invoicePrefix: normalizeInvoicePrefix(plain.defaults?.invoicePrefix),
      sampleInvoiceNumber: normalizeStoredInvoiceNumber(plain.defaults),
      sampleInvoiceDate: plain.defaults?.sampleInvoiceDate || '',
      dueDays: Number(plain.defaults?.dueDays) || 30,
      taxMode: normalizeTaxMode(plain.defaults?.taxMode),
      gstRate: Number(plain.defaults?.gstRate ?? plain.defaults?.igstRate) || 0,
      igstRate: Number(plain.defaults?.igstRate) || 0,
      sgstRate: Number(plain.defaults?.sgstRate) || 0,
      cgstRate: Number(plain.defaults?.cgstRate ?? plain.defaults?.sgstRate) || 0,
      billToTitle: plain.defaults?.billToTitle || 'Bill To',
    },
    sampleItems: Array.isArray(plain.sampleItems)
      ? plain.sampleItems.map((item) => ({
          name: item.name || '',
          rate: Number(item.rate) || 0,
          units: Number(item.units) || 0,
          discount: Number(item.discount) || 0,
          gst: Number(item.gst ?? item.igst) || 0,
          igst: Number(item.igst) || 0,
          sgst: Number(item.sgst) || 0,
          cgst: Number(item.cgst ?? item.sgst) || 0,
        }))
      : [],
    payment: {
      bankName: plain.payment?.bankName || '',
      accountName: plain.payment?.accountName || '',
      accountNumber: plain.payment?.accountNumber || '',
      ifsc: plain.payment?.ifsc || '',
      branch: plain.payment?.branch || '',
    },
    terms: Array.isArray(plain.terms) ? plain.terms.filter(Boolean) : [],
    signatureUrl: plain.signatureUrl || '',
    closingNote: plain.closingNote || 'Thank you for your business',
    showMadeWithBadge: plain.showMadeWithBadge !== false,
    madeWithImageUrl: plain.madeWithImageUrl || '',
    updatedAt: plain.updatedAt,
  };

  const autoMode = resolveTaxModeFromGstins(view.company.gstin, view.sampleCustomer.gstin);
  if (autoMode) {
    view.defaults.taxMode = autoMode;
  }
  return view;
}

function normalizeInvoiceSettingsPayload(body = {}) {
  const items = Array.isArray(body.sampleItems) ? body.sampleItems : [];
  const terms = Array.isArray(body.terms)
    ? body.terms.map((item) => String(item || '').trim()).filter(Boolean)
    : typeof body.termsText === 'string'
      ? body.termsText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
      : [];

  const companyGstin = String(body.company?.gstin || '').trim();
  const customerGstin = String(body.sampleCustomer?.gstin || '').trim();
  const autoMode = resolveTaxModeFromGstins(companyGstin, customerGstin);

  return {
    logoUrl: String(body.logoUrl || '').trim(),
    company: {
      name: String(body.company?.name || '').trim(),
      address: String(body.company?.address || '').trim(),
      gstin: companyGstin,
      pan: String(body.company?.pan || '').trim(),
      email: String(body.company?.email || '').trim(),
      phone: String(body.company?.phone || '').trim(),
    },
    sampleCustomer: {
      name: String(body.sampleCustomer?.name || '').trim(),
      address: String(body.sampleCustomer?.address || '').trim(),
      gstin: customerGstin,
      pan: String(body.sampleCustomer?.pan || '').trim(),
      email: String(body.sampleCustomer?.email || '').trim(),
      phone: String(body.sampleCustomer?.phone || '').trim(),
    },
    defaults: {
      currency: String(body.defaults?.currency || 'INR').trim() || 'INR',
      invoicePrefix: normalizeInvoicePrefix(body.defaults?.invoicePrefix),
      sampleInvoiceNumber: normalizeStoredInvoiceNumber({
        invoicePrefix: body.defaults?.invoicePrefix,
        sampleInvoiceNumber: body.defaults?.sampleInvoiceNumber,
        sampleInvoiceDate: body.defaults?.sampleInvoiceDate,
      }),
      sampleInvoiceDate: String(body.defaults?.sampleInvoiceDate || '').trim(),
      dueDays: Number(body.defaults?.dueDays) || 30,
      taxMode: autoMode || normalizeTaxMode(body.defaults?.taxMode),
      gstRate: Number(body.defaults?.gstRate) || 0,
      igstRate: Number(body.defaults?.igstRate) || 0,
      sgstRate: Number(body.defaults?.sgstRate) || 0,
      cgstRate: Number(body.defaults?.cgstRate) || 0,
      billToTitle: String(body.defaults?.billToTitle || 'Bill To').trim() || 'Bill To',
    },
    sampleItems: items.map((item) => ({
      name: String(item.name || '').trim(),
      rate: Number(item.rate) || 0,
      units: Number(item.units) || 0,
      discount: Number(item.discount) || 0,
      gst: Number(item.gst) || 0,
      igst: Number(item.igst) || 0,
      sgst: Number(item.sgst) || 0,
      cgst: Number(item.cgst) || 0,
    })),
    payment: {
      bankName: String(body.payment?.bankName || '').trim(),
      accountName: String(body.payment?.accountName || '').trim(),
      accountNumber: String(body.payment?.accountNumber || '').trim(),
      ifsc: String(body.payment?.ifsc || '').trim(),
      branch: String(body.payment?.branch || '').trim(),
    },
    terms,
    signatureUrl: String(body.signatureUrl || '').trim(),
    closingNote: String(body.closingNote || '').trim() || 'Thank you for your business',
    showMadeWithBadge: body.showMadeWithBadge !== false && body.showMadeWithBadge !== 'false',
    madeWithImageUrl: String(body.madeWithImageUrl || '').trim(),
  };
}

module.exports = {
  TAX_MODES,
  DEFAULT_INVOICE_SETTINGS,
  toInvoiceSettingsView,
  normalizeInvoiceSettingsPayload,
  normalizeInvoicePrefix,
};
