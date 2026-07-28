'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Minus, Plus, ZoomIn, ZoomOut } from 'lucide-react';
import { ImageAssetField } from '@/components/forms/ImageAssetField';
import { InvoicePreview, TAX_MODES, normalizeTaxMode } from '@/features/super-admin/InvoicePreview';
import { invoiceSettingsService } from '@/services/invoiceSettings.service';
import { getErrorMessage } from '@/utils';
import {
  extractInvoiceSequence,
  extractInvoiceYear,
  formatInvoiceId,
  normalizeInvoicePrefix,
  resolveInvoiceId,
  sanitizeInvoicePrefixInput,
  yearFromInvoiceDate,
} from '@/utils/invoiceNumber';
import { describeTaxRoute, resolveTaxModeFromGstins } from '@/utils/gstTax';

const PRIMARY = '#021A54';

function applyTaxModeToSettings(prev, taxMode) {
  const mode = normalizeTaxMode(taxMode);
  const defaults = { ...prev.defaults, taxMode: mode };
  let sampleItems = prev.sampleItems || [];

  if (mode === 'gst') {
    const rate = defaults.gstRate ?? defaults.igstRate ?? 18;
    defaults.gstRate = rate;
    sampleItems = sampleItems.map((item) => ({
      ...item,
      gst: item.gst || item.igst || rate,
    }));
  } else if (mode === 'sgst_cgst') {
    const half = Math.round(((defaults.gstRate || defaults.igstRate || 18) / 2) * 100) / 100;
    defaults.sgstRate = defaults.sgstRate || half;
    defaults.cgstRate = defaults.cgstRate || half;
    sampleItems = sampleItems.map((item) => ({
      ...item,
      sgst: item.sgst || defaults.sgstRate,
      cgst: item.cgst || defaults.cgstRate,
    }));
  } else {
    const rate = defaults.igstRate || defaults.gstRate || 18;
    defaults.igstRate = rate;
    sampleItems = sampleItems.map((item) => ({
      ...item,
      igst: item.igst || item.gst || rate,
    }));
  }

  return { ...prev, defaults, sampleItems };
}

const EMPTY_ITEM = {
  name: '',
  rate: 0,
  units: 1,
  discount: 0,
  gst: 18,
  igst: 18,
  sgst: 9,
  cgst: 9,
};

const fieldClass =
  'h-10 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none placeholder:text-[#98A2B3] focus:border-primary focus:ring-1 focus:ring-primary';
const labelClass = 'mb-1.5 block text-[12px] font-semibold text-[#344054]';
const sectionTitleClass =
  'mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085]';

function Field({ label, children }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

export function InvoiceSettings() {
  const [tab, setTab] = useState('preview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [zoom, setZoom] = useState(0.72);
  const [settings, setSettings] = useState(null);
  const previewRef = useRef(null);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await invoiceSettingsService.get();
      const loaded = data.data.settings;
      const defaults = loaded.defaults || {};
      let next = {
        ...loaded,
        showMadeWithBadge: loaded.showMadeWithBadge !== false,
        madeWithImageUrl: loaded.madeWithImageUrl || '',
        defaults: {
          ...defaults,
          invoicePrefix: normalizeInvoicePrefix(defaults.invoicePrefix),
          sampleInvoiceNumber: resolveInvoiceId(defaults),
        },
      };
      const autoMode = resolveTaxModeFromGstins(
        next.company?.gstin,
        next.sampleCustomer?.gstin
      );
      if (autoMode) {
        next = applyTaxModeToSettings(next, autoMode);
      }
      setSettings(next);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to load invoice settings'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateNested = (section, key, value) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

  const updateItem = (index, key, value) => {
    setSettings((prev) => ({
      ...prev,
      sampleItems: prev.sampleItems.map((item, i) =>
        i === index ? { ...item, [key]: value } : item
      ),
    }));
  };

  const addItem = () => {
    setSettings((prev) => {
      const defaults = prev.defaults || {};
      return {
        ...prev,
        sampleItems: [
          ...prev.sampleItems,
          {
            ...EMPTY_ITEM,
            gst: defaults.gstRate ?? 18,
            igst: defaults.igstRate ?? 18,
            sgst: defaults.sgstRate ?? 9,
            cgst: defaults.cgstRate ?? 9,
          },
        ],
      };
    });
  };

  const setTaxMode = (taxMode) => {
    setSettings((prev) => applyTaxModeToSettings(prev, taxMode));
  };

  const updatePartyGstin = (section, value) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        [section]: {
          ...prev[section],
          gstin: value,
        },
      };
      const autoMode = resolveTaxModeFromGstins(
        next.company?.gstin,
        next.sampleCustomer?.gstin
      );
      if (!autoMode) return next;
      return applyTaxModeToSettings(next, autoMode);
    });
  };

  const taxRouteHint = useMemo(() => {
    if (!settings) return '';
    return describeTaxRoute(settings.company?.gstin, settings.sampleCustomer?.gstin);
  }, [settings]);

  const removeItem = (index) => {
    setSettings((prev) => ({
      ...prev,
      sampleItems: prev.sampleItems.filter((_, i) => i !== index),
    }));
  };

  const termsText = useMemo(() => (settings?.terms || []).join('\n'), [settings?.terms]);

  const rebuildInvoiceId = (defaultsPatch = {}) => {
    setSettings((prev) => {
      const defaults = { ...prev.defaults, ...defaultsPatch };
      const dateYear = yearFromInvoiceDate(defaults.sampleInvoiceDate);
      const sequence =
        defaultsPatch.sequence !== undefined
          ? defaultsPatch.sequence
          : extractInvoiceSequence(defaults.sampleInvoiceNumber);
      const prefixForId = normalizeInvoicePrefix(defaults.invoicePrefix);
      const nextId = formatInvoiceId({
        prefix: prefixForId,
        year: dateYear ?? extractInvoiceYear(defaults.sampleInvoiceNumber),
        sequence,
      });
      return {
        ...prev,
        defaults: {
          ...defaults,
          // Keep typed prefix as-is (may be empty while editing); ID always uses normalized prefix.
          invoicePrefix:
            defaultsPatch.invoicePrefix !== undefined
              ? defaultsPatch.invoicePrefix
              : defaults.invoicePrefix,
          sampleInvoiceNumber: nextId,
        },
      };
    });
  };

  const handleSave = async () => {
    if (!settings) return;
    try {
      setSaving(true);
      const payload = {
        ...settings,
        defaults: {
          ...settings.defaults,
          invoicePrefix: normalizeInvoicePrefix(settings.defaults.invoicePrefix),
          sampleInvoiceNumber: resolveInvoiceId(settings.defaults),
        },
      };
      const { data } = await invoiceSettingsService.save(payload);
      const saved = data.data.settings;
      setSettings({
        ...saved,
        defaults: {
          ...saved.defaults,
          invoicePrefix: normalizeInvoicePrefix(saved.defaults?.invoicePrefix),
          sampleInvoiceNumber: resolveInvoiceId(saved.defaults || {}),
        },
      });
      toast.success('Invoice settings saved');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to save invoice settings'));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="rounded-xl border border-[#ECEFF3] bg-white px-6 py-16 text-center text-sm text-[#667085]">
        Loading invoice settings...
      </div>
    );
  }

  const showPreviewExtras = tab === 'preview';

  const handleDownloadPdf = async () => {
    if (downloading) return;
    const previousZoom = zoom;
    try {
      setDownloading(true);
      setZoom(1);
      await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });
      await new Promise((resolve) => setTimeout(resolve, 80));
      const root = previewRef.current?.getRoot?.() || previewRef.current;
      const { downloadInvoicePdf } = await import('@/utils/downloadInvoicePdf');
      const fileName = await downloadInvoicePdf(root, settings);
      toast.success(`Downloaded ${fileName}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to download PDF'));
    } finally {
      setZoom(previousZoom);
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-[#ECEFF3] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-[#101828]">Stampogen Invoice</p>
          <p className="mt-0.5 text-[12px] text-[#667085]">
            Billing defaults are saved to the platform and used when a client plan is changed
            (invoice email + next invoice ID).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-[#D0D5DD] bg-[#F9FAFB] p-1">
            <button
              type="button"
              onClick={() => setTab('preview')}
              className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition ${
                tab === 'preview' ? 'bg-white text-primary shadow-sm' : 'text-[#667085]'
              }`}
            >
              Live preview
            </button>
            <button
              type="button"
              onClick={() => setTab('defaults')}
              className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition ${
                tab === 'defaults' ? 'bg-white text-primary shadow-sm' : 'text-[#667085]'
              }`}
            >
              Billing defaults
            </button>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white transition hover:bg-[#01133F] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: PRIMARY }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="max-h-[calc(100vh-220px)] overflow-y-auto rounded-xl border border-[#ECEFF3] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <p className={sectionTitleClass}>Edit Form</p>

          <div className="space-y-5">
            <section className="space-y-3">
              <p className="text-sm font-semibold text-[#101828]">Company / From</p>
              <ImageAssetField
                label="Company Logo"
                value={settings.logoUrl}
                onChange={(next) => setSettings((prev) => ({ ...prev, logoUrl: next }))}
                placeholder="https://logo.example.com/stampogen.png"
                hint="Auto-crops empty margins and fills the logo area"
                maxWidth={640}
                maxHeight={220}
                previewClassName="h-full w-full object-contain"
              />
              <div className="space-y-3 rounded-xl border border-[#E4E7EC] bg-[#F8FAFC] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-[#101828]">Made with badge</p>
                    <p className="mt-0.5 text-[11px] text-[#667085]">
                      Large footer badge — customize the invogen.in name
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.showMadeWithBadge !== false}
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        showMadeWithBadge: prev.showMadeWithBadge === false,
                      }))
                    }
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                      settings.showMadeWithBadge !== false ? 'bg-primary' : 'bg-[#D0D5DD]'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                        settings.showMadeWithBadge !== false ? 'left-[22px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
                {settings.showMadeWithBadge !== false && (
                  <ImageAssetField
                    label="Invogen name (picture or URL)"
                    value={settings.madeWithImageUrl || ''}
                    onChange={(next) =>
                      setSettings((prev) => ({ ...prev, madeWithImageUrl: next }))
                    }
                    placeholder="https://cdn.example.com/invogen-logo.png"
                    hint="Upload a logo or paste a URL to replace the invogen.in name. Clear to use the default text logo."
                    maxWidth={360}
                    maxHeight={100}
                    previewClassName="h-full w-full object-contain"
                  />
                )}
              </div>
              <Field label="Company Name">
                <input
                  className={fieldClass}
                  value={settings.company.name}
                  onChange={(event) => updateNested('company', 'name', event.target.value)}
                />
              </Field>
              <Field label="Address">
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  value={settings.company.address}
                  onChange={(event) => updateNested('company', 'address', event.target.value)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="GSTIN">
                  <input
                    className={fieldClass}
                    value={settings.company.gstin}
                    onChange={(event) => updatePartyGstin('company', event.target.value)}
                    placeholder="First 2 digits = state code"
                  />
                </Field>
                <Field label="PAN">
                  <input
                    className={fieldClass}
                    value={settings.company.pan}
                    onChange={(event) => updateNested('company', 'pan', event.target.value)}
                  />
                </Field>
              </div>
              <Field label="Email">
                <input
                  className={fieldClass}
                  value={settings.company.email}
                  onChange={(event) => updateNested('company', 'email', event.target.value)}
                />
              </Field>
              <Field label="Phone">
                <input
                  className={fieldClass}
                  value={settings.company.phone}
                  onChange={(event) => updateNested('company', 'phone', event.target.value)}
                />
              </Field>
            </section>

            {showPreviewExtras && (
              <section className="space-y-3 border-t border-[#F2F4F7] pt-5">
                <p className="text-sm font-semibold text-[#101828]">Customer Details</p>
                <Field label="Section Title">
                  <input
                    className={fieldClass}
                    value={settings.defaults.billToTitle}
                    onChange={(event) =>
                      updateNested('defaults', 'billToTitle', event.target.value)
                    }
                  />
                </Field>
                <Field label="Name">
                  <input
                    className={fieldClass}
                    value={settings.sampleCustomer.name}
                    onChange={(event) =>
                      updateNested('sampleCustomer', 'name', event.target.value)
                    }
                  />
                </Field>
                <Field label="Address">
                  <textarea
                    rows={3}
                    className="w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    value={settings.sampleCustomer.address}
                    onChange={(event) =>
                      updateNested('sampleCustomer', 'address', event.target.value)
                    }
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="GSTIN">
                    <input
                      className={fieldClass}
                      value={settings.sampleCustomer.gstin}
                      onChange={(event) =>
                        updatePartyGstin('sampleCustomer', event.target.value)
                      }
                      placeholder="Different state → IGST"
                    />
                  </Field>
                  <Field label="PAN">
                    <input
                      className={fieldClass}
                      value={settings.sampleCustomer.pan}
                      onChange={(event) =>
                        updateNested('sampleCustomer', 'pan', event.target.value)
                      }
                    />
                  </Field>
                </div>
                <Field label="Email">
                  <input
                    className={fieldClass}
                    value={settings.sampleCustomer.email}
                    onChange={(event) =>
                      updateNested('sampleCustomer', 'email', event.target.value)
                    }
                  />
                </Field>
                <Field label="Phone">
                  <input
                    className={fieldClass}
                    value={settings.sampleCustomer.phone}
                    onChange={(event) =>
                      updateNested('sampleCustomer', 'phone', event.target.value)
                    }
                  />
                </Field>
              </section>
            )}

            <section className="space-y-3 border-t border-[#F2F4F7] pt-5">
              <p className="text-sm font-semibold text-[#101828]">Invoice Details</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Invoice Prefix">
                  <input
                    className={fieldClass}
                    value={settings.defaults.invoicePrefix}
                    maxLength={10}
                    onChange={(event) => {
                      const nextPrefix = sanitizeInvoicePrefixInput(event.target.value);
                      rebuildInvoiceId({ invoicePrefix: nextPrefix });
                    }}
                    onBlur={() => {
                      setSettings((prev) => {
                        const normalized = normalizeInvoicePrefix(prev.defaults.invoicePrefix);
                        const defaults = {
                          ...prev.defaults,
                          invoicePrefix: normalized,
                        };
                        return {
                          ...prev,
                          defaults: {
                            ...defaults,
                            sampleInvoiceNumber: formatInvoiceId({
                              prefix: normalized,
                              year:
                                yearFromInvoiceDate(defaults.sampleInvoiceDate) ??
                                extractInvoiceYear(defaults.sampleInvoiceNumber),
                              sequence: extractInvoiceSequence(defaults.sampleInvoiceNumber),
                            }),
                          },
                        };
                      });
                    }}
                    placeholder="INV"
                  />
                  <p className="mt-1 text-[11px] text-[#98A2B3]">
                    Letters/numbers only · max 10 · saved with Invoice ID
                  </p>
                </Field>
                <Field label="Due Days">
                  <input
                    type="number"
                    min="0"
                    className={fieldClass}
                    value={settings.defaults.dueDays}
                    onChange={(event) =>
                      updateNested('defaults', 'dueDays', Number(event.target.value) || 0)
                    }
                  />
                </Field>
              </div>
              {showPreviewExtras && (
                <>
                  <Field label="Invoice Date">
                    <input
                      type="date"
                      className={fieldClass}
                      value={settings.defaults.sampleInvoiceDate || ''}
                      onChange={(event) =>
                        rebuildInvoiceId({ sampleInvoiceDate: event.target.value })
                      }
                    />
                    <p className="mt-1 text-[11px] text-[#98A2B3]">
                      Invoice ID year follows this date
                    </p>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Sequence No.">
                      <input
                        type="number"
                        min="1"
                        max="99999"
                        className={fieldClass}
                        value={extractInvoiceSequence(settings.defaults.sampleInvoiceNumber)}
                        onChange={(event) => {
                          rebuildInvoiceId({ sequence: Number(event.target.value) || 1 });
                        }}
                      />
                    </Field>
                    <Field label="Invoice ID">
                      <input
                        className={`${fieldClass} bg-[#F9FAFB] font-semibold tracking-wide`}
                        value={resolveInvoiceId(settings.defaults)}
                        readOnly
                      />
                    </Field>
                  </div>
                  <p className="-mt-1 text-[11px] text-[#98A2B3]">
                    Fixed format:{' '}
                    <span className="font-medium text-[#667085]">PREFIX-YYYY-00000</span> — year
                    updates when invoice date year changes
                  </p>
                </>
              )}
              <div className="space-y-2">
                <p className={labelClass}>Tax Type</p>
                <p className="text-[11px] leading-relaxed text-[#667085]">{taxRouteHint}</p>
                <div className="grid grid-cols-1 gap-2">
                  {TAX_MODES.map((option) => {
                    const active =
                      normalizeTaxMode(settings.defaults.taxMode) === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setTaxMode(option.value)}
                        className={`rounded-lg border px-3 py-2.5 text-left text-[13px] font-semibold transition ${
                          active
                            ? 'border-primary bg-primary-50 text-primary'
                            : 'border-[#D0D5DD] bg-white text-[#344054] hover:bg-[#F9FAFB]'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {normalizeTaxMode(settings.defaults.taxMode) === 'gst' && (
                <Field label="Default GST %">
                  <input
                    type="number"
                    min="0"
                    className={fieldClass}
                    value={settings.defaults.gstRate ?? settings.defaults.igstRate ?? 0}
                    onChange={(event) =>
                      updateNested('defaults', 'gstRate', Number(event.target.value) || 0)
                    }
                  />
                </Field>
              )}

              {normalizeTaxMode(settings.defaults.taxMode) === 'igst' && (
                <Field label="Default IGST %">
                  <input
                    type="number"
                    min="0"
                    className={fieldClass}
                    value={settings.defaults.igstRate}
                    onChange={(event) =>
                      updateNested('defaults', 'igstRate', Number(event.target.value) || 0)
                    }
                  />
                </Field>
              )}

              {normalizeTaxMode(settings.defaults.taxMode) === 'sgst_cgst' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Default SGST %">
                    <input
                      type="number"
                      min="0"
                      className={fieldClass}
                      value={settings.defaults.sgstRate}
                      onChange={(event) =>
                        updateNested('defaults', 'sgstRate', Number(event.target.value) || 0)
                      }
                    />
                  </Field>
                  <Field label="Default CGST %">
                    <input
                      type="number"
                      min="0"
                      className={fieldClass}
                      value={settings.defaults.cgstRate ?? settings.defaults.sgstRate ?? 0}
                      onChange={(event) =>
                        updateNested('defaults', 'cgstRate', Number(event.target.value) || 0)
                      }
                    />
                  </Field>
                </div>
              )}
            </section>

            {showPreviewExtras && (
              <section className="space-y-3 border-t border-[#F2F4F7] pt-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#101828]">Line Items</p>
                  <button
                    type="button"
                    onClick={addItem}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-primary px-2.5 text-[12px] font-semibold text-primary hover:bg-primary-50"
                  >
                    <Plus size={14} />
                    Add
                  </button>
                </div>
                <div className="space-y-3">
                  {settings.sampleItems.map((item, index) => (
                    <div
                      key={`item-${index}`}
                      className="space-y-2 rounded-lg border border-[#EAECF0] bg-[#F9FAFB] p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[12px] font-semibold text-[#667085]">Item {index + 1}</p>
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#D92D20] hover:bg-red-50"
                          aria-label={`Remove item ${index + 1}`}
                        >
                          <Minus size={14} />
                        </button>
                      </div>
                      <input
                        className={fieldClass}
                        value={item.name}
                        onChange={(event) => updateItem(index, 'name', event.target.value)}
                        placeholder="Item name"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min="0"
                          className={fieldClass}
                          value={item.rate}
                          onChange={(event) =>
                            updateItem(index, 'rate', Number(event.target.value) || 0)
                          }
                          placeholder="Rate"
                        />
                        <input
                          type="number"
                          min="0"
                          className={fieldClass}
                          value={item.units}
                          onChange={(event) =>
                            updateItem(index, 'units', Number(event.target.value) || 0)
                          }
                          placeholder="Units"
                        />
                        <input
                          type="number"
                          min="0"
                          className={fieldClass}
                          value={item.discount}
                          onChange={(event) =>
                            updateItem(index, 'discount', Number(event.target.value) || 0)
                          }
                          placeholder="Discount"
                        />
                        {normalizeTaxMode(settings.defaults.taxMode) === 'gst' && (
                          <input
                            type="number"
                            min="0"
                            className={fieldClass}
                            value={item.gst ?? item.igst ?? 0}
                            onChange={(event) =>
                              updateItem(index, 'gst', Number(event.target.value) || 0)
                            }
                            placeholder="GST %"
                          />
                        )}
                        {normalizeTaxMode(settings.defaults.taxMode) === 'igst' && (
                          <input
                            type="number"
                            min="0"
                            className={fieldClass}
                            value={item.igst}
                            onChange={(event) =>
                              updateItem(index, 'igst', Number(event.target.value) || 0)
                            }
                            placeholder="IGST %"
                          />
                        )}
                        {normalizeTaxMode(settings.defaults.taxMode) === 'sgst_cgst' && (
                          <>
                            <input
                              type="number"
                              min="0"
                              className={fieldClass}
                              value={item.sgst}
                              onChange={(event) =>
                                updateItem(index, 'sgst', Number(event.target.value) || 0)
                              }
                              placeholder="SGST %"
                            />
                            <input
                              type="number"
                              min="0"
                              className={fieldClass}
                              value={item.cgst ?? item.sgst ?? 0}
                              onChange={(event) =>
                                updateItem(index, 'cgst', Number(event.target.value) || 0)
                              }
                              placeholder="CGST %"
                            />
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-3 border-t border-[#F2F4F7] pt-5">
              <p className="text-sm font-semibold text-[#101828]">Payment Details</p>
              <Field label="Bank Name">
                <input
                  className={fieldClass}
                  value={settings.payment.bankName}
                  onChange={(event) => updateNested('payment', 'bankName', event.target.value)}
                />
              </Field>
              <Field label="Account Name">
                <input
                  className={fieldClass}
                  value={settings.payment.accountName}
                  onChange={(event) => updateNested('payment', 'accountName', event.target.value)}
                />
              </Field>
              <Field label="Account Number">
                <input
                  className={fieldClass}
                  value={settings.payment.accountNumber}
                  onChange={(event) =>
                    updateNested('payment', 'accountNumber', event.target.value)
                  }
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="IFSC">
                  <input
                    className={fieldClass}
                    value={settings.payment.ifsc}
                    onChange={(event) => updateNested('payment', 'ifsc', event.target.value)}
                  />
                </Field>
                <Field label="Branch">
                  <input
                    className={fieldClass}
                    value={settings.payment.branch}
                    onChange={(event) => updateNested('payment', 'branch', event.target.value)}
                  />
                </Field>
              </div>
            </section>

            <section className="space-y-3 border-t border-[#F2F4F7] pt-5">
              <p className="text-sm font-semibold text-[#101828]">Terms & Signature</p>
              <Field label="Terms (one per line)">
                <textarea
                  rows={4}
                  className="w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  value={termsText}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      terms: event.target.value.split('\n'),
                    }))
                  }
                  onBlur={() =>
                    setSettings((prev) => ({
                      ...prev,
                      terms: (prev.terms || []).map((line) => line.trim()).filter(Boolean),
                    }))
                  }
                />
              </Field>
              <ImageAssetField
                label="Signature Image"
                value={settings.signatureUrl}
                onChange={(next) => setSettings((prev) => ({ ...prev, signatureUrl: next }))}
                placeholder="https://cdn.example.com/signature.png"
                hint="Auto-crops empty margins and fills the signature box"
                maxWidth={420}
                maxHeight={160}
                previewClassName="h-full w-full object-contain"
              />
              <Field label="Closing Note">
                <input
                  className={fieldClass}
                  value={settings.closingNote}
                  onChange={(event) =>
                    setSettings((prev) => ({ ...prev, closingNote: event.target.value }))
                  }
                />
              </Field>
            </section>
          </div>
        </aside>

        <section className="overflow-hidden rounded-xl border border-[#ECEFF3] bg-[#E8EEF5] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-center justify-between border-b border-[#E4E7EC] bg-white px-4 py-2.5">
            <div>
              <p className="text-sm font-semibold text-[#101828]">
                {tab === 'preview' ? 'Live preview' : 'Billing defaults preview'}
              </p>
              <p className="text-[11px] text-[#667085]">
                Measured flow · auto pagination · no overlapping blocks
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.max(0.45, Number((prev - 0.05).toFixed(2))))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#D0D5DD] text-[#667085] hover:bg-[#F9FAFB]"
                aria-label="Zoom out"
              >
                <ZoomOut size={14} />
              </button>
              <span className="min-w-[48px] text-center text-[12px] font-medium text-[#344054]">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.min(1.05, Number((prev + 0.05).toFixed(2))))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#D0D5DD] text-[#667085] hover:bg-[#F9FAFB]"
                aria-label="Zoom in"
              >
                <ZoomIn size={14} />
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloading}
                className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#D0D5DD] text-[#667085] hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Download PDF"
                title={downloading ? 'Preparing PDF…' : 'Download PDF'}
              >
                <Download size={14} />
              </button>
            </div>
          </div>
          <div className="flex max-h-[calc(100vh-260px)] justify-center overflow-auto p-6">
            <InvoicePreview ref={previewRef} settings={settings} zoom={zoom} />
          </div>
        </section>
      </div>
    </div>
  );
}
