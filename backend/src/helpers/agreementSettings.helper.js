const AUDIENCES = {
  AFFILIATE: 'affiliate',
  CLIENT: 'client',
};

const DEFAULT_CONTENT_BY_AUDIENCE = {
  [AUDIENCES.AFFILIATE]: `TERMS AND CONDITIONS — AFFILIATE PARTNER

These Terms and Conditions ("Terms") set out the rules under which you may promote Stampogen products and services and earn commissions as an Affiliate Partner.

1. Eligibility
You must provide accurate registration details and complete any verification or interview process required by Stampogen.

2. Conduct
You agree to promote Stampogen honestly, without misleading claims, spam, or prohibited advertising practices.

3. Commissions
Commission rates, payout schedules, and eligible conversions are defined by Stampogen and may be updated with notice.

4. Confidentiality
You must keep non-public Stampogen information confidential.

5. Termination
Stampogen may suspend or terminate affiliate access for policy violations, fraud, or inactivity.

By accepting these Terms, you confirm that you have read and agree to them.`,
  [AUDIENCES.CLIENT]: `TERMS AND CONDITIONS — CLIENT

These Terms and Conditions ("Terms") govern your use of Stampogen as a Client / shop admin.

1. Account
You are responsible for keeping your login credentials secure and for activity under your account.

2. Subscriptions & billing
Plan features, pricing, renewals, and invoices follow the plan you select and Stampogen’s billing policies.

3. Acceptable use
You must not misuse the platform, attempt unauthorized access, or upload unlawful content.

4. Data & privacy
You agree to handle customer and business data in line with applicable laws and Stampogen policies.

5. Termination
Stampogen may suspend or terminate access for non-payment, abuse, or policy violations.

By accepting these Terms, you confirm that you have read and agree to them.`,
};

const DEFAULT_TITLE_BY_AUDIENCE = {
  [AUDIENCES.AFFILIATE]: 'Terms and Conditions',
  [AUDIENCES.CLIENT]: 'Terms and Conditions',
};

function isValidAudience(key) {
  return key === AUDIENCES.AFFILIATE || key === AUDIENCES.CLIENT;
}

function normalizeAudience(key) {
  const value = String(key || '').trim().toLowerCase();
  if (value === 'client' || value === 'admin') return AUDIENCES.CLIENT;
  return AUDIENCES.AFFILIATE;
}

function getDefaultSettings(audience = AUDIENCES.AFFILIATE) {
  const key = normalizeAudience(audience);
  return {
    key,
    title: DEFAULT_TITLE_BY_AUDIENCE[key],
    content: DEFAULT_CONTENT_BY_AUDIENCE[key],
    version: '1.0',
    effectiveDate: '',
    requireAcceptance: true,
    isActive: true,
  };
}

function toAgreementSettingsView(doc, audience = AUDIENCES.AFFILIATE) {
  const defaults = getDefaultSettings(audience);
  if (!doc) return { ...defaults };
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    id: plain._id?.toString?.() || plain.id || null,
    key: plain.key || defaults.key,
    title: plain.title || defaults.title,
    content: plain.content || '',
    version: plain.version || '1.0',
    effectiveDate: plain.effectiveDate || '',
    requireAcceptance: plain.requireAcceptance !== false,
    isActive: plain.isActive !== false,
    updatedAt: plain.updatedAt || null,
    createdAt: plain.createdAt || null,
  };
}

function normalizeAgreementSettingsPayload(body = {}, audience = AUDIENCES.AFFILIATE) {
  const defaults = getDefaultSettings(audience);
  const title = String(body.title || '').trim().slice(0, 200);
  const content = String(body.content || '').trim().slice(0, 50000);
  const version = String(body.version || '1.0').trim().slice(0, 40) || '1.0';
  let effectiveDate = String(body.effectiveDate || '').trim();
  if (effectiveDate && !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
    const parsed = new Date(effectiveDate);
    effectiveDate = Number.isNaN(parsed.getTime())
      ? ''
      : parsed.toISOString().slice(0, 10);
  }

  return {
    title: title || defaults.title,
    content,
    version,
    effectiveDate: effectiveDate || new Date().toISOString().slice(0, 10),
    requireAcceptance: body.requireAcceptance !== false && body.requireAcceptance !== 'false',
    isActive: body.isActive !== false && body.isActive !== 'false',
  };
}

module.exports = {
  AUDIENCES,
  DEFAULT_CONTENT_BY_AUDIENCE,
  DEFAULT_TITLE_BY_AUDIENCE,
  isValidAudience,
  normalizeAudience,
  getDefaultSettings,
  toAgreementSettingsView,
  normalizeAgreementSettingsPayload,
};
