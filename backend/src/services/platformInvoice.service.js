const { InvoiceSettings } = require('@models');
const config = require('@config');
const {
  DEFAULT_INVOICE_SETTINGS,
  toInvoiceSettingsView,
} = require('@helpers/invoiceSettings.helper');
const {
  buildPlanChangeInvoice,
  buildInvoiceEmailCopy,
} = require('@helpers/platformInvoice.helper');
const { buildInvoicePdfBuffer } = require('@helpers/invoicePdf.helper');
const { sendMail } = require('@services/email.service');

class PlatformInvoiceService {
  async getOrCreateSettings() {
    let settings = await InvoiceSettings.findOne({ key: 'platform' });
    if (!settings) {
      settings = await InvoiceSettings.create({
        key: 'platform',
        ...DEFAULT_INVOICE_SETTINGS,
        defaults: {
          ...DEFAULT_INVOICE_SETTINGS.defaults,
          sampleInvoiceDate: new Date().toISOString().slice(0, 10),
        },
      });
    }
    return settings;
  }

  async persistInvoiceMeta(settingsDoc, meta) {
    settingsDoc.defaults = settingsDoc.defaults || {};
    settingsDoc.defaults.invoicePrefix = meta.prefix;
    settingsDoc.defaults.sampleInvoiceNumber = meta.invoiceNumber;
    settingsDoc.defaults.sampleInvoiceDate = meta.invoiceDate;
    settingsDoc.markModified('defaults');
    await settingsDoc.save();
  }

  paymentsHistoryUrl() {
    const base = String(config.frontendUrl || 'http://localhost:3000').replace(/\/$/, '');
    return `${base}/admin/dashboard`;
  }

  async emailInvoice({ invoice, planName, recipient, settingsView = null }) {
    if (!recipient) {
      return { emailed: false, preview: false, recipient: null, attached: false };
    }

    const pdfFileName = `${invoice.meta.invoiceNumber}.pdf`;
    const copy = buildInvoiceEmailCopy(invoice, {
      paymentsUrl: this.paymentsHistoryUrl(),
      pdfFileName,
    });

    let pdfBuffer = null;
    try {
      pdfBuffer = await buildInvoicePdfBuffer(invoice, settingsView || null);
    } catch (error) {
      console.error('[invoice] Failed to build PDF:', error.message);
    }

    const attachments = pdfBuffer
      ? [
          {
            filename: pdfFileName,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ]
      : [];

    const result = await sendMail({
      to: recipient,
      subject: copy.subject || `Subscription tax invoice ${invoice.meta.invoiceNumber}`,
      html: copy.html,
      text: copy.text,
      attachments,
    });

    return {
      emailed: true,
      preview: Boolean(result?.preview),
      recipient,
      attached: Boolean(pdfBuffer),
      pdfFileName: pdfBuffer ? pdfFileName : null,
      planName,
    };
  }

  async issueForPlanChange({ tenant, planName, pricePerCycle }) {
    const settingsDoc = await this.getOrCreateSettings();
    const settingsView = toInvoiceSettingsView(settingsDoc);
    const invoice = buildPlanChangeInvoice({
      settingsView,
      tenant,
      planName,
      pricePerCycle,
    });

    await this.persistInvoiceMeta(settingsDoc, invoice.meta);

    const recipient = tenant.owner?.email || invoice.customer?.email || null;
    const mail = await this.emailInvoice({ invoice, planName, recipient, settingsView });

    return {
      invoiceNumber: invoice.meta.invoiceNumber,
      invoiceDate: invoice.meta.invoiceDate,
      dueDate: invoice.dueDate,
      total: invoice.totals.total,
      emailed: mail.emailed,
      preview: mail.preview,
      recipient: mail.recipient,
      attached: mail.attached,
      pdfFileName: mail.pdfFileName,
    };
  }

  /**
   * Issue + email invoice PDF after a successful checkout payment.
   */
  async issueForPayment({ tenant, payment }) {
    if (!tenant || !payment) {
      return null;
    }

    const planName = payment.planName || tenant.currentPlan?.name || 'Plan';
    const settingsDoc = await this.getOrCreateSettings();
    const settingsView = toInvoiceSettingsView(settingsDoc);
    const invoice = buildPlanChangeInvoice({
      settingsView,
      tenant,
      planName,
      pricePerCycle: Number(payment.listAmount) || Number(payment.payableAmount) || 0,
      payment,
    });

    await this.persistInvoiceMeta(settingsDoc, invoice.meta);

    const recipient =
      tenant.owner?.email ||
      payment.customerEmail ||
      invoice.customer?.email ||
      null;

    const mail = await this.emailInvoice({ invoice, planName, recipient, settingsView });

    return {
      invoiceNumber: invoice.meta.invoiceNumber,
      invoiceDate: invoice.meta.invoiceDate,
      dueDate: invoice.dueDate,
      total: invoice.totals.total,
      emailed: mail.emailed,
      preview: mail.preview,
      recipient: mail.recipient,
      attached: mail.attached,
      pdfFileName: mail.pdfFileName,
      customer: invoice.customer,
    };
  }
}

module.exports = new PlatformInvoiceService();
