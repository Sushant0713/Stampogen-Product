/**
 * Fixed invoice ID format: PREFIX-YYYY-NNNNN
 * Example: INV-2026-00210
 */

export function normalizeInvoicePrefix(prefix) {
  const cleaned = String(prefix || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
  return cleaned || 'INV';
}

/** Allow empty while typing so the field doesn't snap back to INV. */
export function sanitizeInvoicePrefixInput(prefix) {
  return String(prefix || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
}

export function parseInvoiceNumber(value) {
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

export function formatInvoiceId({ prefix, year, sequence }) {
  const p = normalizeInvoicePrefix(prefix);
  const y = Number(year);
  const safeYear = Number.isFinite(y) && y >= 2000 && y <= 2100 ? y : new Date().getFullYear();
  const rawSeq = Number(sequence);
  const seq = Number.isFinite(rawSeq) ? Math.max(1, Math.min(99999, Math.floor(rawSeq))) : 1;
  return `${p}-${safeYear}-${String(seq).padStart(5, '0')}`;
}

/**
 * Read year from an HTML date value (YYYY-MM-DD) without timezone shifts.
 */
export function yearFromInvoiceDate(dateValue) {
  if (!dateValue) return null;
  const match = String(dateValue).trim().match(/^(\d{4})/);
  if (match) {
    const year = Number(match[1]);
    if (year >= 2000 && year <= 2100) return year;
  }
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  // Use UTC date parts for ISO date-only strings to avoid timezone year rollback
  if (/^\d{4}-\d{2}-\d{2}/.test(String(dateValue))) {
    return date.getUTCFullYear();
  }
  return date.getFullYear();
}

/** Resolve canonical invoice ID from settings defaults. */
export function resolveInvoiceId(defaults = {}) {
  const parsed = parseInvoiceNumber(defaults.sampleInvoiceNumber);
  const dateYear = yearFromInvoiceDate(defaults.sampleInvoiceDate);
  return formatInvoiceId({
    prefix: defaults.invoicePrefix || parsed?.prefix || 'INV',
    year: dateYear ?? parsed?.year ?? new Date().getFullYear(),
    sequence: parsed?.sequence || 1,
  });
}

export function extractInvoiceSequence(invoiceNumber) {
  return parseInvoiceNumber(invoiceNumber)?.sequence || 1;
}

export function extractInvoiceYear(invoiceNumber) {
  return parseInvoiceNumber(invoiceNumber)?.year || new Date().getFullYear();
}
