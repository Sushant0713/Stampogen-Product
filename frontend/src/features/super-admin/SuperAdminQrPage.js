'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Copy,
  Download,
  ExternalLink,
  Handshake,
  Link2,
  Loader2,
  Plus,
  Printer,
  QrCode,
  Trash2,
} from 'lucide-react';
import { platformQrService } from '@/services/platformQr.service';
import { getErrorMessage } from '@/utils';
import {
  downloadQrPng,
  printPlatformQr,
  QrPreview,
  slugFilename,
  trackValue,
  PRIMARY,
} from '@/features/shared/platformQrMedia';

const fieldClass =
  'h-11 w-full rounded-xl border border-[#E4E7EC] bg-white px-3.5 text-sm text-[#101828] outline-none placeholder:text-[#98A2B3] transition focus:border-[#021A54] focus:ring-2 focus:ring-[#021A54]/15';

function emptyForm() {
  return { title: '', url: '', note: '' };
}

function ActionButton({ onClick, disabled, tone = 'default', children, title }) {
  const tones = {
    default:
      'border-[#E4E7EC] bg-white text-[#344054] hover:border-[#021A54]/30 hover:bg-[#F8FAFC] hover:text-[#021A54]',
    danger:
      'border-[#FEE4E2] bg-[#FEF3F2] text-[#B42318] hover:bg-[#FEE4E2]',
    primary:
      'border-transparent bg-[#021A54] text-white hover:bg-[#01133F]',
    affiliate:
      'border-[#D1E0FF] bg-[#EEF4FF] text-[#175CD3] hover:bg-[#D1E0FF]',
    affiliateOn:
      'border-transparent bg-[#175CD3] text-white hover:bg-[#1849A9]',
  };
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

export function SuperAdminQrPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [sharingId, setSharingId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [previewUrl, setPreviewUrl] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await platformQrService.list({ limit: 100 });
      setItems(data?.data?.items || []);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to load QR list'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const raw = String(form.url || '').trim();
    if (!raw) {
      setPreviewUrl('');
      return undefined;
    }
    const timer = setTimeout(() => {
      try {
        const normalized = raw.includes('://') ? raw : `https://${raw}`;
        const parsed = new URL(normalized);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          setPreviewUrl(parsed.toString());
        } else {
          setPreviewUrl('');
        }
      } catch {
        setPreviewUrl('');
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [form.url]);

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleCreate = async (event) => {
    event.preventDefault();
    if (saving) return;
    try {
      setSaving(true);
      await platformQrService.create({
        title: form.title.trim(),
        url: form.url.trim(),
        note: form.note.trim(),
      });
      toast.success('QR added');
      setForm(emptyForm());
      setPreviewUrl('');
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to add QR'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!id || deletingId) return;
    try {
      setDeletingId(id);
      await platformQrService.remove(id);
      toast.success('QR deleted');
      setItems((prev) => prev.filter((row) => row.id !== id));
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to delete QR'));
    } finally {
      setDeletingId('');
    }
  };

  const handleToggleAffiliate = async (item) => {
    if (!item?.id || sharingId) return;
    const next = !item.showToAffiliates;
    try {
      setSharingId(item.id);
      const { data } = await platformQrService.update(item.id, { showToAffiliates: next });
      const updated = data?.data?.item;
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? { ...row, ...(updated || {}), showToAffiliates: next }
            : row
        )
      );
      toast.success(next ? 'Added to Affiliate Guide' : 'Removed from Affiliate Guide');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to update affiliate sharing'));
    } finally {
      setSharingId('');
    }
  };

  const copyUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Unable to copy link');
    }
  };

  return (
    <div className="space-y-8">
      {/* Composer */}
      <section className="overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
          <form onSubmit={handleCreate} className="space-y-5 p-5 sm:p-7">
            <div className="flex items-start gap-3">
              <span
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                style={{ backgroundColor: PRIMARY }}
              >
                <QrCode size={20} />
              </span>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-[#101828]">
                  Create a QR code
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-[#667085]">
                  Paste any website link. Saved QRs use a trackable Stampogen link so scans show up in
                  QR Reports.
                </p>
              </div>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="mb-1.5 block text-[12px] font-semibold text-[#344054]">
                  Title
                </label>
                <input
                  className={fieldClass}
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="e.g. Pricing page"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-semibold text-[#344054]">
                  Website link
                </label>
                <div className="relative">
                  <Link2
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#98A2B3]"
                  />
                  <input
                    className={`${fieldClass} pl-10`}
                    value={form.url}
                    onChange={(e) => updateField('url', e.target.value)}
                    placeholder="https://stampogen.com/pricing"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-semibold text-[#344054]">
                  Note <span className="font-normal text-[#98A2B3]">(optional)</span>
                </label>
                <input
                  className={fieldClass}
                  value={form.note}
                  onChange={(e) => updateField('note', e.target.value)}
                  placeholder="Poster at shop entrance, flyer, Instagram bio…"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="submit"
                disabled={saving || !form.title.trim() || !form.url.trim()}
                className="inline-flex h-11 min-w-[140px] items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-55"
                style={{ backgroundColor: PRIMARY }}
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Add to library
              </button>
              {previewUrl ? (
                <button
                  type="button"
                  onClick={() =>
                    printPlatformQr({
                      url: previewUrl,
                      displayUrl: previewUrl,
                      title: form.title.trim() || 'QR code',
                      note: form.note.trim(),
                    }).catch(() => toast.error('Unable to print QR'))
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#E4E7EC] bg-white px-4 text-sm font-semibold text-[#344054] transition hover:border-[#021A54]/25 hover:bg-[#F8FAFC]"
                >
                  <Printer size={16} />
                  Print
                </button>
              ) : null}
            </div>
          </form>

          {/* Live stage */}
          <div
            className="relative flex min-h-[320px] flex-col items-center justify-center px-6 py-8"
            style={{
              background:
                'linear-gradient(165deg, #021A54 0%, #0A2F6B 48%, #123A7A 100%)',
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.12]"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 20% 20%, #fff 0, transparent 42%), radial-gradient(circle at 80% 80%, #fff 0, transparent 36%)',
              }}
            />
            <p className="relative mb-4 text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">
              Live preview
            </p>
            <div className="relative w-full max-w-[240px] rounded-2xl bg-white p-4 shadow-[0_20px_50px_rgba(0,0,0,0.28)]">
              {previewUrl ? (
                <>
                  <div className="flex justify-center rounded-xl bg-[#F8FAFC] p-3">
                    <QrPreview value={previewUrl} size={180} className="rounded-md" />
                  </div>
                  <p className="mt-3 truncate text-center text-[13px] font-semibold text-[#101828]">
                    {form.title.trim() || 'Untitled QR'}
                  </p>
                  <p className="mt-1 truncate text-center text-[11px] text-[#667085]">
                    {previewUrl}
                  </p>
                </>
              ) : (
                <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 px-2 text-center">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#021A54]">
                    <QrCode size={22} />
                  </span>
                  <p className="text-sm font-medium text-[#344054]">Waiting for a link</p>
                  <p className="text-[12px] leading-snug text-[#98A2B3]">
                    Your QR appears here as soon as the URL is valid.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Library */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[#101828]">QR library</h2>
            <p className="mt-1 text-sm text-[#667085]">
              Print, download, or copy any saved code. Scan totals update from trackable QR links.
            </p>
          </div>
          <span className="inline-flex h-8 items-center rounded-full bg-[#F2F4F7] px-3 text-[12px] font-semibold text-[#344054]">
            {items.length} saved
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-[#E4E7EC] bg-white py-16 text-sm text-[#667085]">
            <Loader2 size={16} className="animate-spin" />
            Loading library…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D0D5DD] bg-[#FCFCFD] px-6 py-16 text-center">
            <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#021A54]">
              <QrCode size={22} />
            </span>
            <p className="mt-4 text-sm font-semibold text-[#344054]">No QR codes yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-[#667085]">
              Create your first one above — it will show up here for printing and reuse.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const qrValue = trackValue(item);
              return (
              <li
                key={item.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#021A54]/25 hover:shadow-[0_12px_28px_rgba(2,26,84,0.08)]"
              >
                <div className="flex justify-center bg-[linear-gradient(180deg,#F8FAFC_0%,#EEF2F7_100%)] px-5 pb-4 pt-5">
                  <div className="rounded-2xl border border-white bg-white p-3 shadow-sm ring-1 ring-[#E4E7EC]">
                    <QrPreview value={qrValue} size={148} className="rounded-md" />
                  </div>
                </div>

                <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate text-[15px] font-semibold text-[#101828]">
                      {item.title}
                    </h3>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-bold text-[#021A54]">
                        {Number(item.scanCount) || 0} scans
                      </span>
                      {item.showToAffiliates ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#EEF4FF] px-2 py-0.5 text-[10px] font-bold text-[#175CD3]">
                          <Handshake size={10} />
                          Affiliate
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-[12px] font-medium text-[#2E90FA] hover:underline"
                  >
                    <span className="truncate">{item.url}</span>
                    <ExternalLink size={11} className="shrink-0 opacity-70" />
                  </a>
                  {item.note ? (
                    <p className="mt-2 line-clamp-2 text-[12px] leading-snug text-[#667085]">
                      {item.note}
                    </p>
                  ) : (
                    <p className="mt-2 text-[12px] text-[#D0D5DD]">No note</p>
                  )}

                  <button
                    type="button"
                    disabled={sharingId === item.id}
                    onClick={() => handleToggleAffiliate(item)}
                    className={`mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      item.showToAffiliates
                        ? 'bg-[#175CD3] text-white hover:bg-[#1849A9]'
                        : 'border border-[#B2CCFF] bg-[#EEF4FF] text-[#175CD3] hover:bg-[#D1E0FF]'
                    }`}
                  >
                    {sharingId === item.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Handshake size={16} />
                    )}
                    {item.showToAffiliates
                      ? 'Shared with Affiliates · Tap to remove'
                      : 'Add to Affiliate Guide'}
                  </button>

                  <div className="mt-2 flex flex-wrap gap-2 border-t border-[#F2F4F7] pt-3">
                    <ActionButton
                      title="Print"
                      onClick={() =>
                        printPlatformQr({
                          url: qrValue,
                          displayUrl: item.url,
                          title: item.title,
                          note: item.note,
                        }).catch(() => toast.error('Unable to print QR'))
                      }
                    >
                      <Printer size={14} />
                      Print
                    </ActionButton>
                    <ActionButton
                      title="Download PNG"
                      onClick={() =>
                        downloadQrPng(qrValue, slugFilename(item.title)).catch(() =>
                          toast.error('Unable to download QR')
                        )
                      }
                    >
                      <Download size={14} />
                      PNG
                    </ActionButton>
                    <ActionButton title="Copy trackable link" onClick={() => copyUrl(qrValue)}>
                      <Copy size={14} />
                      Copy
                    </ActionButton>
                    <ActionButton
                      tone="danger"
                      title="Delete"
                      disabled={deletingId === item.id}
                      onClick={() => handleDelete(item.id)}
                    >
                      {deletingId === item.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </ActionButton>
                  </div>
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
