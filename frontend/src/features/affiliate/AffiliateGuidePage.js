'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  BookOpen,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Printer,
  QrCode,
} from 'lucide-react';
import { platformQrService } from '@/services/platformQr.service';
import { getErrorMessage } from '@/utils';
import {
  downloadQrPng,
  printPlatformQr,
  QrPreview,
  slugFilename,
  trackValue,
} from '@/features/shared/platformQrMedia';

function ActionButton({ onClick, disabled, children, title }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#E4E7EC] bg-white px-3 text-[12px] font-semibold text-[#344054] transition hover:border-[#021A54]/30 hover:bg-[#F8FAFC] hover:text-[#021A54] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function AffiliateGuidePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await platformQrService.listForAffiliates();
      setItems(data?.data?.items || []);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to load guide QR codes'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const copyUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Unable to copy link');
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <section className="relative overflow-hidden rounded-[24px] border border-[#D9E4F5] bg-white shadow-[0_14px_36px_rgba(2,26,84,0.08)]">
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, rgba(2,26,84,0.94) 0%, rgba(11,58,156,0.92) 48%, rgba(59,130,246,0.88) 100%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 20%, #fff 0, transparent 34%), radial-gradient(circle at 88% 70%, #fff 0, transparent 28%)',
          }}
        />
        <div className="relative px-5 py-7 sm:px-8 sm:py-9">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white/90 backdrop-blur">
            <BookOpen size={13} />
            Affiliate Guide
          </span>
          <h1 className="mt-3 max-w-xl font-display text-[28px] font-semibold tracking-tight text-white sm:text-[32px]">
            Ready-to-share QR codes
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/80">
            Print or download these Stampogen QR posters for shops, flyers, and partner materials.
            Super Admin publishes the guides that appear here.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white/12 px-3.5 py-2 text-[12px] font-semibold text-white backdrop-blur">
            <QrCode size={14} />
            {loading ? 'Loading…' : `${items.length} guide${items.length === 1 ? '' : 's'} available`}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-[#E4E7EC] bg-white py-20 text-sm text-[#667085]">
          <Loader2 size={16} className="animate-spin" />
          Loading affiliate guides…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D0D5DD] bg-[#FCFCFD] px-6 py-16 text-center">
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#021A54]">
            <QrCode size={22} />
          </span>
          <p className="mt-4 text-sm font-semibold text-[#344054]">No guides yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#667085]">
            When Super Admin adds a QR to Affiliate, it will show up here for printing and download.
          </p>
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const qrValue = trackValue(item);
            return (
              <li
                key={item.id}
                className="group flex flex-col overflow-hidden rounded-[22px] border border-[#E4E7EC] bg-white shadow-[0_8px_24px_rgba(2,26,84,0.06)] transition hover:border-[#021A54]/25 hover:shadow-[0_16px_36px_rgba(2,26,84,0.1)]"
              >
                <div
                  className="relative flex justify-center px-5 pb-5 pt-6"
                  style={{
                    background:
                      'linear-gradient(180deg, #F4F7FC 0%, #EEF2F7 100%)',
                  }}
                >
                  <div className="absolute left-4 top-4 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#175CD3] shadow-sm">
                    Guide
                  </div>
                  <div className="rounded-[18px] border border-white bg-white p-3.5 shadow-[0_10px_24px_rgba(2,26,84,0.1)] ring-1 ring-[#E4E7EC]">
                    <QrPreview value={qrValue} size={168} className="rounded-md" />
                  </div>
                </div>

                <div className="flex flex-1 flex-col px-4 pb-4 pt-4">
                  <h2 className="truncate text-[16px] font-extrabold tracking-tight text-[#021A54]">
                    {item.title}
                  </h2>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-flex max-w-full items-center gap-1 truncate text-[12px] font-medium text-[#2E90FA] hover:underline"
                  >
                    <span className="truncate">{item.url}</span>
                    <ExternalLink size={11} className="shrink-0 opacity-70" />
                  </a>
                  {item.note ? (
                    <p className="mt-2 line-clamp-2 text-[12.5px] leading-snug text-[#667085]">
                      {item.note}
                    </p>
                  ) : (
                    <p className="mt-2 text-[12px] text-[#D0D5DD]">No extra note</p>
                  )}

                  <div className="mt-auto flex gap-2 border-t border-[#F2F4F7] pt-3.5">
                    <ActionButton
                      title="Print poster"
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
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-center text-[12px] font-medium text-[#98A2B3]">
        Tip: printed posters use the Stampogen-branded QR with the logo in the center.
      </p>
    </div>
  );
}
