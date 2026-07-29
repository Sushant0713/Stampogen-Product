const { InvoiceSettings } = require('@models');
const config = require('@config');
const {
  DEFAULT_INVOICE_SETTINGS,
  toInvoiceSettingsView,
} = require('@helpers/invoiceSettings.helper');
const {
  buildPlanChangeInvoice,
  buildInvoiceEmailCopy,
  rebuildInvoiceFromRecord,
} = require('@helpers/platformInvoice.helper');
const { buildInvoicePdfBuffer } = require('@helpers/invoicePdf.helper');
const { sendMail } = require('@services/email.service');
const PlatformInvoiceRepository = require('@repositories/platformInvoice.repository');
const PaymentRepository = require('@repositories/payment.repository');
const TenantRepository = require('@repositories/tenant.repository');
const AppError = require('@utils/AppError');
const { HTTP_STATUS } = require('@constants');

class PlatformInvoiceService {
  async recordIssuedInvoice({
    invoice,
    mail = null,
    source = 'payment',
    payment = null,
    tenant = null,
  }) {
    if (!invoice?.meta?.invoiceNumber) return null;

    const customer = invoice.customer || {};
    const totals = invoice.totals || {};
    const item = invoice.item || {};
    const paymentRef = invoice.paymentRef || {};

    const paymentId = payment?._id || payment?.id || paymentRef.id || null;
    const tenantId = tenant?._id || tenant?.id || null;
    const safePaymentId =
      paymentId && /^[a-f\d]{24}$/i.test(String(paymentId)) ? String(paymentId) : null;
    const safeTenantId =
      tenantId && /^[a-f\d]{24}$/i.test(String(tenantId)) ? String(tenantId) : null;

    try {
      return await PlatformInvoiceRepository.upsertByInvoiceNumber(invoice.meta.invoiceNumber, {
        invoiceDate: invoice.meta.invoiceDate || '',
        dueDate: invoice.dueDate || '',
        source,
        payment: safePaymentId,
        tenant: safeTenantId,
        clientName: customer.contactName || customer.name || '',
        clientEmail: customer.email || mail?.recipient || '',
        shopName: customer.organization || customer.name || '',
        planName: invoice.planName || '',
        billing: invoice.billingCycle || payment?.billing || '',
        currency: payment?.currency || 'INR',
        listAmount: Number(item.rate) || Number(payment?.listAmount) || 0,
        discountAmount: Number(totals.discount) || Number(payment?.discountAmount) || 0,
        taxableAmount: Number(totals.taxable) || Number(payment?.taxableAmount) || 0,
        taxAmount: Number(totals.tax) || Number(payment?.taxAmount) || 0,
        total: Number(totals.total) || Number(payment?.payableAmount) || 0,
        taxMode: invoice.taxMode || payment?.taxMode || null,
        taxLabel: item.taxLabel || payment?.taxLabel || '',
        discountCode: paymentRef.discountCode || payment?.discountCode || '',
        emailed: Boolean(mail?.emailed),
        recipient: mail?.recipient || customer.email || null,
        attached: Boolean(mail?.attached),
        pdfFileName: mail?.pdfFileName || null,
        issuedAt: new Date(),
      });
    } catch (error) {
      console.error('[invoice] Failed to persist platform invoice:', error.message);
      return null;
    }
  }

  async list(options = {}) {
    await PlatformInvoiceRepository.syncFromPayments();
    return PlatformInvoiceRepository.list(options);
  }

  async getFilterOptions() {
    await PlatformInvoiceRepository.syncFromPayments();
    return PlatformInvoiceRepository.filterOptions();
  }

  async getStats() {
    await PlatformInvoiceRepository.syncFromPayments();
    return PlatformInvoiceRepository.stats();
  }

  async getById(id) {
    await PlatformInvoiceRepository.syncFromPayments();
    const record = await PlatformInvoiceRepository.findById(id);
    if (!record) {
      throw new AppError('Invoice not found', HTTP_STATUS.NOT_FOUND);
    }
    return record;
  }

  async buildPdfForRecord(id) {
    const record = await this.getById(id);
    const settingsDoc = await this.getOrCreateSettings();
    const settingsView = toInvoiceSettingsView(settingsDoc);

    let payment = null;
    if (record.payment) {
      payment = await PaymentRepository.findById(record.payment);
      payment = payment?.toObject ? payment.toObject() : payment;
    }

    let tenant = null;
    if (record.tenant) {
      tenant = await TenantRepository.findById(record.tenant);
      tenant = tenant?.toObject ? tenant.toObject() : tenant;
    }

    const invoice = rebuildInvoiceFromRecord({
      settingsView,
      record,
      payment,
      tenant,
    });

    const pdfBuffer = await buildInvoicePdfBuffer(invoice, settingsView);
    const fileName = record.pdfFileName || `${record.invoiceNumber}.pdf`;

    return {
      record,
      invoice,
      pdfBuffer,
      fileName,
      contentType: 'application/pdf',
    };
  }

  async remove(id) {
    const deleted = await PlatformInvoiceRepository.softDeleteById(id);
    if (!deleted) {
      throw new AppError('Invoice not found', HTTP_STATUS.NOT_FOUND);
    }
    return deleted;
  }

  async removeMany(ids = []) {
    const uniqueIds = [...new Set((ids || []).map(String).filter(Boolean))];
    if (!uniqueIds.length) {
      throw new AppError('No invoices selected', HTTP_STATUS.BAD_REQUEST);
    }
    const result = await PlatformInvoiceRepository.softDeleteManyByIds(uniqueIds);
    return { deleted: result.deletedCount };
  }

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

    await this.recordIssuedInvoice({
      invoice,
      mail,
      source: 'plan_change',
      tenant,
    });

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

    await this.recordIssuedInvoice({
      invoice,
      mail,
      source: 'payment',
      payment,
      tenant,
    });

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
