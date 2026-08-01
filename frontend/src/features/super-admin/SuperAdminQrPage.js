'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';
import {
  Copy,
  Download,
  ExternalLink,
  Link2,
  Loader2,
  Plus,
  Printer,
  QrCode,
  Trash2,
} from 'lucide-react';
import { platformQrService } from '@/services/platformQr.service';
import { getErrorMessage } from '@/utils';

const PRIMARY = '#021A54';
const fieldClass =
  'h-11 w-full rounded-xl border border-[#E4E7EC] bg-white px-3.5 text-sm text-[#101828] outline-none placeholder:text-[#98A2B3] transition focus:border-[#021A54] focus:ring-2 focus:ring-[#021A54]/15';
const PRINT_SHELL_ID = 'stampogen-platform-qr-print';

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugFilename(title) {
  return `${String(title || 'qr')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'qr'}.png`;
}

function QrPreview({ value, size = 160, className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 1,
      color: { dark: PRIMARY, light: '#FFFFFF' },
    }).catch(() => {});
  }, [value, size]);

  if (!value) return null;

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-label="QR code preview"
      role="img"
    />
  );
}

async function downloadQrPng(url, filename) {
  const dataUrl = await QRCode.toDataURL(url, {
    width: 512,
    margin: 2,
    color: { dark: PRIMARY, light: '#FFFFFF' },
  });
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename || 'stampogen-qr.png';
  link.click();
}

function cleanupPlatformQrPrint() {
  document.getElementById(PRINT_SHELL_ID)?.remove();
  document.documentElement.classList.remove('stampogen-platform-qr-printing');
}

function trackValue(item) {
  return item?.scanUrl || item?.url || '';
}

async function printPlatformQr({ url, displayUrl = '', title = '', note = '' }) {
  if (!url || typeof window === 'undefined') return;

  cleanupPlatformQrPrint();

  const dataUrl = await QRCode.toDataURL(url, {
    width: 720,
    margin: 2,
    color: { dark: PRIMARY, light: '#FFFFFF' },
  });
  const logoUrl = `${window.location.origin}/logo.png`;
  const displayTitle = String(title || 'Scan to visit').trim();
  const displayNote = String(note || '').trim();
  const urlLabel = String(displayUrl || url).trim();

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(displayTitle)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      min-height: 100%;
      background: #EEF2F7;
      color: #021A54;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18px;
    }
    .poster {
      width: min(420px, 100%);
      min-height: min(640px, calc(100vh - 36px));
      margin: 0 auto;
      padding: 28px 24px 22px;
      border-radius: 22px;
      background:
        radial-gradient(circle at 12% 8%, rgba(46,144,250,0.12), transparent 36%),
        radial-gradient(circle at 88% 92%, rgba(2,26,84,0.08), transparent 40%),
        #FFFFFF;
      border: 1px solid #D9E2F2;
      box-shadow: 0 18px 40px rgba(2, 26, 84, 0.12);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      text-align: center;
    }
    .top { width: 100%; }
    .logo {
      display: block;
      width: 150px;
      max-width: 55%;
      height: auto;
      margin: 0 auto 14px;
      object-fit: contain;
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 999px;
      background: #EEF2FF;
      color: #021A54;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .title {
      margin: 14px 0 0;
      font-size: 28px;
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -0.03em;
      color: #021A54;
    }
    .mid { width: 100%; }
    .qr-frame {
      width: fit-content;
      max-width: 100%;
      margin: 0 auto;
      padding: 14px;
      border-radius: 20px;
      background: linear-gradient(165deg, #021A54 0%, #0B3A7A 100%);
      box-shadow: 0 14px 28px rgba(2, 26, 84, 0.22);
    }
    .qr-card {
      padding: 14px;
      border-radius: 14px;
      background: #fff;
    }
    .qr {
      display: block;
      width: min(240px, 62vw);
      height: auto;
      aspect-ratio: 1 / 1;
    }
    .scan {
      margin: 16px 0 0;
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #021A54;
    }
    .hint {
      margin: 6px auto 0;
      max-width: 300px;
      font-size: 13px;
      line-height: 1.45;
      font-weight: 600;
      color: #64748B;
    }
    .url-pill {
      display: inline-block;
      margin-top: 14px;
      max-width: 100%;
      padding: 8px 12px;
      border-radius: 10px;
      background: #F8FAFC;
      border: 1px solid #E4E7EC;
      color: #344054;
      font-size: 12px;
      font-weight: 600;
      word-break: break-all;
    }
    .note {
      margin: 10px auto 0;
      max-width: 320px;
      font-size: 13px;
      line-height: 1.4;
      color: #475467;
    }
    .bottom {
      width: 100%;
      padding-top: 8px;
      border-top: 1px solid #E4E7EC;
    }
    .brand {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.16em;
      color: #98A2B3;
    }
    @media print {
      @page { size: A4 portrait; margin: 0; }
      html, body {
        width: 210mm;
        height: 297mm;
        background: #fff !important;
        overflow: hidden !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      body {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 10mm;
      }
      .poster {
        width: 100%;
        max-width: none;
        min-height: 277mm;
        margin: 0;
        padding: 16mm 14mm 12mm;
        border-radius: 14px;
        box-shadow: none;
        gap: 8mm;
        justify-content: space-between;
      }
      .logo { width: 52mm; margin-bottom: 4mm; }
      .eyebrow { font-size: 9pt; padding: 2mm 4mm; }
      .title { font-size: 22pt; margin-top: 4mm; }
      .qr-frame { padding: 3.5mm; border-radius: 12px; }
      .qr-card { padding: 3.5mm; border-radius: 9px; }
      .qr { width: 92mm; height: 92mm; }
      .scan { font-size: 16pt; margin-top: 5mm; }
      .hint { max-width: 130mm; font-size: 10pt; }
      .url-pill { margin-top: 4mm; font-size: 9pt; padding: 2mm 3mm; }
      .note { max-width: 130mm; font-size: 10pt; }
      .bottom { padding-top: 4mm; }
      .brand { font-size: 8pt; }
    }
  </style>
</head>
<body>
  <div class="poster">
    <div class="top">
      <img class="logo" src="${logoUrl}" alt="Stampogen" />
      <div class="eyebrow">Scan to open</div>
      <h1 class="title">${escapeHtml(displayTitle)}</h1>
    </div>
    <div class="mid">
      <div class="qr-frame">
        <div class="qr-card">
          <img class="qr" src="${dataUrl}" alt="QR code" />
        </div>
      </div>
      <p class="scan">Point your camera here</p>
      <p class="hint">Open your phone camera and scan this code to visit the page instantly.</p>
      <div class="url-pill">${escapeHtml(urlLabel)}</div>
      ${displayNote ? `<p class="note">${escapeHtml(displayNote)}</p>` : ''}
    </div>
    <div class="bottom">
      <div class="brand">POWERED BY STAMPOGEN</div>
    </div>
  </div>
</body>
</html>`;

  const style = document.createElement('style');
  style.textContent = `
    html.stampogen-platform-qr-printing,
    html.stampogen-platform-qr-printing body { overflow: hidden !important; }
    #${PRINT_SHELL_ID} {
      position: fixed; inset: 0; z-index: 2147483646;
      display: flex; flex-direction: column; background: #0B1220;
    }
    #${PRINT_SHELL_ID} iframe {
      flex: 1 1 auto; width: 100%; min-height: 0; border: 0; background: #EEF2F7;
    }
    #${PRINT_SHELL_ID} .actions {
      flex: 0 0 auto; display: flex; gap: 10px;
      padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
      background: #0B1220;
    }
    #${PRINT_SHELL_ID} .actions button {
      flex: 1; border: 0; border-radius: 12px; padding: 14px 12px;
      font-size: 15px; font-weight: 700; cursor: pointer;
    }
    #${PRINT_SHELL_ID} .btn-print { background: #fff; color: #021A54; }
    #${PRINT_SHELL_ID} .btn-close { background: #334155; color: #fff; }
    @media print {
      @page { margin: 0; }
      body * { visibility: hidden !important; }
      #${PRINT_SHELL_ID}, #${PRINT_SHELL_ID} * { visibility: visible !important; }
      #${PRINT_SHELL_ID} { position: fixed !important; inset: 0 !important; background: #fff !important; }
      #${PRINT_SHELL_ID} .actions { display: none !important; }
      #${PRINT_SHELL_ID} iframe {
        position: absolute !important; inset: 0 !important;
        width: 100% !important; height: 100% !important;
      }
    }
  `;

  const shell = document.createElement('div');
  shell.id = PRINT_SHELL_ID;
  shell.innerHTML = `
    <iframe title="QR print"></iframe>
    <div class="actions">
      <button type="button" class="btn-close" data-action="close">Close</button>
      <button type="button" class="btn-print" data-action="print">Print QR</button>
    </div>
  `;

  document.head.appendChild(style);
  document.body.appendChild(shell);
  document.documentElement.classList.add('stampogen-platform-qr-printing');

  const iframe = shell.querySelector('iframe');
  const doc = iframe.contentDocument;
  doc.open();
  doc.write(html);
  doc.close();

  const close = () => {
    style.remove();
    cleanupPlatformQrPrint();
  };
  const runPrint = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch {
      window.print();
    }
  };

  shell.querySelector('[data-action="close"]')?.addEventListener('click', close);
  shell.querySelector('[data-action="print"]')?.addEventListener('click', runPrint);

  await new Promise((r) => setTimeout(r, 250));
  runPrint();
}

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
                    <span className="shrink-0 rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-bold text-[#021A54]">
                      {Number(item.scanCount) || 0} scans
                    </span>
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

                  <div className="mt-auto flex flex-wrap gap-2 border-t border-[#F2F4F7] pt-3">
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
