'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';
import { Copy, Download, Loader2, Plus, Printer, QrCode, Trash2 } from 'lucide-react';
import { platformQrService } from '@/services/platformQr.service';
import { getErrorMessage } from '@/utils';

const PRIMARY = '#021A54';
const fieldClass =
  'h-11 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none placeholder:text-[#98A2B3] focus:border-[#021A54] focus:ring-1 focus:ring-[#021A54]';
const PRINT_SHELL_ID = 'stampogen-platform-qr-print';

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

async function printPlatformQr({ url, title = '', note = '' }) {
  if (!url || typeof window === 'undefined') return;

  cleanupPlatformQrPrint();

  const dataUrl = await QRCode.toDataURL(url, {
    width: 640,
    margin: 2,
    color: { dark: PRIMARY, light: '#FFFFFF' },
  });
  const logoUrl = `${window.location.origin}/logo.png`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title || 'QR code')}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      color: #101828;
      background: #fff;
    }
    .sheet {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      text-align: center;
    }
    .logo { height: 40px; width: auto; margin-bottom: 20px; object-fit: contain; }
    .title { margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.02em; }
    .qr-card {
      margin: 24px 0 16px;
      padding: 16px;
      border: 1px solid #EAECF0;
      border-radius: 16px;
      background: #fff;
    }
    .qr { width: 280px; height: 280px; display: block; }
    .url {
      max-width: 420px;
      margin: 0 auto;
      font-size: 13px;
      color: #667085;
      word-break: break-all;
    }
    .note {
      max-width: 420px;
      margin: 10px auto 0;
      font-size: 14px;
      color: #344054;
    }
    .brand {
      margin-top: 28px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      color: #98A2B3;
    }
    @media print {
      @page { margin: 12mm; }
      .sheet { min-height: auto; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <img class="logo" src="${logoUrl}" alt="" />
    ${title ? `<h1 class="title">${escapeHtml(title)}</h1>` : ''}
    <div class="qr-card"><img class="qr" src="${dataUrl}" alt="QR code" /></div>
    <p class="url">${escapeHtml(url)}</p>
    ${note ? `<p class="note">${escapeHtml(note)}</p>` : ''}
    <div class="brand">POWERED BY STAMPOGEN</div>
  </div>
</body>
</html>`;

  const style = document.createElement('style');
  style.textContent = `
    html.stampogen-platform-qr-printing,
    html.stampogen-platform-qr-printing body { overflow: hidden !important; }
    #${PRINT_SHELL_ID} {
      position: fixed; inset: 0; z-index: 2147483646;
      display: flex; flex-direction: column; background: #0f172a;
    }
    #${PRINT_SHELL_ID} iframe {
      flex: 1 1 auto; width: 100%; min-height: 0; border: 0; background: #fff;
    }
    #${PRINT_SHELL_ID} .actions {
      flex: 0 0 auto; display: flex; gap: 10px;
      padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
      background: #0f172a;
    }
    #${PRINT_SHELL_ID} .actions button {
      flex: 1; border: 0; border-radius: 12px; padding: 14px 12px;
      font-size: 15px; font-weight: 700; cursor: pointer;
    }
    #${PRINT_SHELL_ID} .btn-print { background: #fff; color: #021A54; }
    #${PRINT_SHELL_ID} .btn-close { background: #334155; color: #fff; }
    @media print {
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

  await new Promise((r) => setTimeout(r, 200));
  runPrint();
}

function emptyForm() {
  return { title: '', url: '', note: '' };
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
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#EAECF0] bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white"
            style={{ backgroundColor: PRIMARY }}
          >
            <QrCode size={18} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-[#101828]">Create QR</h2>
            <p className="text-sm text-[#667085]">
              Paste a website link — a QR code is generated automatically. Add as many as you need.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="grid gap-5 lg:grid-cols-[1fr_200px]">
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-[#344054]">Title</label>
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
              <input
                className={fieldClass}
                value={form.url}
                onChange={(e) => updateField('url', e.target.value)}
                placeholder="https://stampogen.com/pricing"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-[#344054]">
                Note <span className="font-normal text-[#98A2B3]">(optional)</span>
              </label>
              <input
                className={fieldClass}
                value={form.note}
                onChange={(e) => updateField('note', e.target.value)}
                placeholder="Where this QR will be used"
              />
            </div>
            <button
              type="submit"
              disabled={saving || !form.title.trim() || !form.url.trim()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: PRIMARY }}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Add to list
            </button>
            {previewUrl ? (
              <button
                type="button"
                onClick={() =>
                  printPlatformQr({
                    url: previewUrl,
                    title: form.title.trim() || 'QR code',
                    note: form.note.trim(),
                  }).catch(() => toast.error('Unable to print QR'))
                }
                className="ml-2 inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#D0D5DD] bg-white px-4 text-sm font-semibold text-[#344054] hover:bg-[#F9FAFB]"
              >
                <Printer size={16} />
                Print preview
              </button>
            ) : null}
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#D0D5DD] bg-[#F9FAFB] p-4">
            {previewUrl ? (
              <>
                <QrPreview value={previewUrl} size={160} className="rounded-lg bg-white p-2" />
                <p className="mt-3 max-w-[180px] truncate text-center text-[11px] text-[#667085]">
                  {previewUrl}
                </p>
              </>
            ) : (
              <p className="px-3 text-center text-sm text-[#98A2B3]">QR preview appears here</p>
            )}
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#101828]">Saved QR codes</h2>
            <p className="text-sm text-[#667085]">Download or copy any link from the list.</p>
          </div>
          <p className="text-sm font-medium text-[#667085]">{items.length} total</p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-[#EAECF0] bg-white px-4 py-10 text-sm text-[#667085]">
            <Loader2 size={16} className="animate-spin" />
            Loading QR list…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D0D5DD] bg-white px-4 py-12 text-center text-sm text-[#667085]">
            No QR codes yet. Add a website link above.
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col rounded-2xl border border-[#EAECF0] bg-white p-4 shadow-sm"
              >
                <div className="flex justify-center rounded-xl bg-[#F9FAFB] p-3">
                  <QrPreview value={item.url} size={140} className="rounded-md bg-white p-1.5" />
                </div>
                <h3 className="mt-3 truncate text-[15px] font-semibold text-[#101828]">
                  {item.title}
                </h3>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 truncate text-[12px] font-medium text-[#2E90FA] hover:underline"
                >
                  {item.url}
                </a>
                {item.note ? (
                  <p className="mt-1 line-clamp-2 text-[12px] text-[#667085]">{item.note}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      printPlatformQr({
                        url: item.url,
                        title: item.title,
                        note: item.note,
                      }).catch(() => toast.error('Unable to print QR'))
                    }
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#D0D5DD] bg-white px-3 text-[12px] font-semibold text-[#344054] hover:bg-[#F9FAFB]"
                  >
                    <Printer size={14} />
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadQrPng(
                        item.url,
                        `${String(item.title || 'qr')
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')
                          .slice(0, 40)}.png`
                      ).catch(() => toast.error('Unable to download QR'))
                    }
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#D0D5DD] bg-white px-3 text-[12px] font-semibold text-[#344054] hover:bg-[#F9FAFB]"
                  >
                    <Download size={14} />
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={() => copyUrl(item.url)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#D0D5DD] bg-white px-3 text-[12px] font-semibold text-[#344054] hover:bg-[#F9FAFB]"
                  >
                    <Copy size={14} />
                    Copy link
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#FEE4E2] bg-[#FEF3F2] px-3 text-[12px] font-semibold text-[#B42318] hover:bg-[#FEE4E2] disabled:opacity-60"
                  >
                    {deletingId === item.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
