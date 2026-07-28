'use client';

import { useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, forwardRef } from 'react';
import { resolveInvoiceId } from '@/utils/invoiceNumber';

const PRIMARY = '#021A54';
export const PAGE_WIDTH = 794;
export const PAGE_HEIGHT = 1123;
const PAGE_PADDING = 28;
const PAGE_FOOTER_BAR = 58;
const BODY_HEIGHT = PAGE_HEIGHT - PAGE_PADDING * 2 - PAGE_FOOTER_BAR;
const INVOGEN_ORANGE = '#F97316';

const GAP = {
  afterHeader: 16,
  afterContHeader: 14,
  afterParties: 16,
  afterTable: 10,
  footerStack: 10,
};

function formatMoney(amount = 0) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function numberToWords(amount) {
  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const twoDigits = (n) => {
    if (n < 20) return ones[n];
    return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`.trim();
  };

  const threeDigits = (n) => {
    if (n < 100) return twoDigits(n);
    return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${twoDigits(n % 100)}` : ''}`.trim();
  };

  const convertInteger = (n) => {
    if (n === 0) return 'Zero';
    const crore = Math.floor(n / 10000000);
    const lakh = Math.floor((n % 10000000) / 100000);
    const thousand = Math.floor((n % 100000) / 1000);
    const rest = n % 1000;
    const parts = [];
    if (crore) parts.push(`${threeDigits(crore)} Crore`);
    if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
    if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
    if (rest) parts.push(threeDigits(rest));
    return parts.join(' ');
  };

  const total = Math.round((Number(amount) || 0) * 100) / 100;
  const rupees = Math.floor(total);
  const paise = Math.round((total - rupees) * 100);
  let words = `${convertInteger(rupees)} Rupees`;
  if (paise) words += ` and ${twoDigits(paise)} Paise`;
  return `${words} Only`;
}

export const TAX_MODES = [
  { value: 'gst', label: 'Simple GST' },
  { value: 'sgst_cgst', label: 'SGST + CGST' },
  { value: 'igst', label: 'IGST' },
];

export function normalizeTaxMode(value) {
  const mode = String(value || '').trim();
  return TAX_MODES.some((item) => item.value === mode) ? mode : 'igst';
}

export function calcItem(item, taxMode = 'igst') {
  const rate = Number(item.rate) || 0;
  const units = Number(item.units) || 0;
  const discount = Number(item.discount) || 0;
  const gross = rate * units;
  const taxable = Math.max(0, gross - discount);
  const mode = normalizeTaxMode(taxMode);

  if (mode === 'gst') {
    const gstRate = Number(item.gst ?? item.igst) || 0;
    const gstAmt = (taxable * gstRate) / 100;
    return {
      taxable,
      gstAmt,
      igstAmt: 0,
      sgstAmt: 0,
      cgstAmt: 0,
      taxAmt: gstAmt,
      total: taxable + gstAmt,
    };
  }

  if (mode === 'sgst_cgst') {
    const sgstRate = Number(item.sgst) || 0;
    const cgstRate = Number(item.cgst ?? item.sgst) || 0;
    const sgstAmt = (taxable * sgstRate) / 100;
    const cgstAmt = (taxable * cgstRate) / 100;
    return {
      taxable,
      gstAmt: 0,
      igstAmt: 0,
      sgstAmt,
      cgstAmt,
      taxAmt: sgstAmt + cgstAmt,
      total: taxable + sgstAmt + cgstAmt,
    };
  }

  const igstRate = Number(item.igst) || 0;
  const igstAmt = (taxable * igstRate) / 100;
  return {
    taxable,
    gstAmt: 0,
    igstAmt,
    sgstAmt: 0,
    cgstAmt: 0,
    taxAmt: igstAmt,
    total: taxable + igstAmt,
  };
}

function readHeight(el) {
  if (!el) return 0;
  return Math.ceil(el.getBoundingClientRect().height);
}

/** Sub-pixel / border rounding slack so packed blocks never paint over the footer bar. */
const FIT_SLACK = 4;

function gapBefore(type, prevType) {
  if (!prevType) return 0;
  if (prevType === 'header') return GAP.afterHeader;
  if (prevType === 'contHeader') return GAP.afterContHeader;
  if (prevType === 'parties') return GAP.afterParties;
  if (prevType === 'table') return GAP.afterTable;
  if (prevType === 'continued') return GAP.afterTable;
  return GAP.footerStack;
}

/**
 * Pack measured blocks into fixed A4 pages.
 * Gaps are stored on each block (mb) so render matches pack math — no overlap / clipping.
 * Oversized atomic blocks are forced onto their own page to avoid infinite loops.
 */
function packPages(heights, rowCount) {
  const h = {
    header: heights.header || 160,
    contHeader: heights.contHeader || 64,
    parties: heights.parties || 140,
    tableHead: heights.tableHead || 42,
    continued: heights.continued || 20,
    amountWords: heights.amountWords || 48,
    paymentTerms: heights.paymentTerms || 160,
    signature: heights.signature || 120,
    emptyTable: Math.max(0, (heights.emptyTable || 80) - (heights.tableHead || 42)),
    rows: Array.from({ length: rowCount }, (_, i) => heights[`row-${i}`] || 48),
  };

  const footerBlocks = [
    { type: 'amountWords', height: h.amountWords },
    { type: 'paymentTerms', height: h.paymentTerms },
    { type: 'signature', height: h.signature },
  ];

  const pages = [];
  let rowIndex = 0;
  let footerIndex = 0;
  let guard = 0;
  const maxGuard = Math.max(40, rowCount + footerBlocks.length + 12);

  while (guard < maxGuard) {
    guard += 1;
    const isFirst = pages.length === 0;
    const blocks = [];
    let used = 0;
    let prevType = null;

    const remaining = () => BODY_HEIGHT - used - FIT_SLACK;
    const canFit = (height, gap = 0) => gap + height <= remaining();

    const pushBlock = (block, height) => {
      const gap = gapBefore(block.type, prevType);
      if (blocks.length > 0) {
        blocks[blocks.length - 1].mb = gap;
      }
      blocks.push({ ...block, mb: 0 });
      used += gap + height;
      prevType = block.type;
    };

    if (isFirst) {
      pushBlock({ type: 'header' }, h.header);
      pushBlock({ type: 'parties' }, h.parties);
    } else {
      pushBlock({ type: 'contHeader' }, h.contHeader);
    }

    const showEmpty = isFirst && rowCount === 0;
    const needTable = rowIndex < rowCount || showEmpty;

    if (needTable) {
      const tableGap = gapBefore('table', prevType);
      if (!canFit(h.tableHead, tableGap)) {
        pages.push({ blocks, isFirst, used });
        continue;
      }

      if (blocks.length > 0) {
        blocks[blocks.length - 1].mb = tableGap;
      }
      used += tableGap + h.tableHead;
      prevType = 'table';

      const rowSlice = [];

      if (showEmpty) {
        used += h.emptyTable;
      } else {
        // Fill the page with as many rows as fit — do not reserve footer space
        // up front (that left huge empty gaps and "Continued on next page").
        while (rowIndex < rowCount) {
          const rowH = h.rows[rowIndex];
          if (rowH > remaining()) {
            if (rowSlice.length === 0) {
              rowSlice.push(rowIndex);
              used += rowH;
              rowIndex += 1;
            }
            break;
          }
          rowSlice.push(rowIndex);
          used += rowH;
          rowIndex += 1;
        }
      }

      blocks.push({
        type: 'table',
        rowSlice,
        showEmpty,
        mb: 0,
      });
    }

    const rowsDone = rowIndex >= rowCount;

    if (!rowsDone) {
      if (canFit(h.continued, gapBefore('continued', prevType))) {
        pushBlock({ type: 'continued' }, h.continued);
      }
      pages.push({ blocks, isFirst, used });
      continue;
    }

    while (footerIndex < footerBlocks.length) {
      const fb = footerBlocks[footerIndex];
      const gap = gapBefore(fb.type, prevType);

      if (canFit(fb.height, gap)) {
        pushBlock({ type: fb.type }, fb.height);
        footerIndex += 1;
        continue;
      }

      const contentBlocks = blocks.filter(
        (b) => !['header', 'contHeader', 'parties'].includes(b.type)
      );
      if (contentBlocks.length === 0) {
        pushBlock({ type: fb.type }, fb.height);
        footerIndex += 1;
        continue;
      }

      break;
    }

    pages.push({ blocks, isFirst, used });

    if (rowsDone && footerIndex >= footerBlocks.length) break;
  }

  if (!pages.length) {
    pages.push({
      blocks: [
        { type: 'header', mb: GAP.afterHeader },
        { type: 'parties', mb: GAP.afterParties },
        { type: 'table', rowSlice: [], showEmpty: true, mb: GAP.afterTable },
        { type: 'amountWords', mb: GAP.footerStack },
        { type: 'paymentTerms', mb: GAP.footerStack },
        { type: 'signature', mb: 0 },
      ],
      isFirst: true,
      used: 0,
    });
  }

  // Pull footer-only orphan pages back onto the previous page when space remains.
  while (pages.length >= 2) {
    const last = pages[pages.length - 1];
    const prev = pages[pages.length - 2];
    const movable = (last.blocks || []).filter((b) => b.type !== 'contHeader');
    if (!movable.length || movable.some((b) => b.type === 'table')) break;

    let prevUsed = Number(prev.used) || 0;
    let movedCount = 0;

    for (const block of movable) {
      const blockH =
        block.type === 'amountWords'
          ? h.amountWords
          : block.type === 'paymentTerms'
            ? h.paymentTerms
            : block.type === 'signature'
              ? h.signature
              : 0;
      const gap = GAP.footerStack;
      if (!blockH || prevUsed + gap + blockH > BODY_HEIGHT - FIT_SLACK) break;
      if (prev.blocks.length) {
        prev.blocks[prev.blocks.length - 1].mb = gap;
      }
      prev.blocks.push({ type: block.type, mb: 0 });
      prevUsed += gap + blockH;
      movedCount += 1;
    }

    if (movedCount === 0) break;

    prev.used = prevUsed;

    if (movedCount >= movable.length) {
      pages.pop();
      continue;
    }

    last.blocks = [
      ...(last.blocks || []).filter((b) => b.type === 'contHeader'),
      ...movable.slice(movedCount),
    ];
    break;
  }

  pages.forEach((page) => {
    if (page.blocks.length) page.blocks[page.blocks.length - 1].mb = 0;
  });

  return pages.map((page, i, all) => ({
    ...page,
    pageNumber: i + 1,
    totalPages: all.length,
  }));
}

function PartyCard({ title, party, accent }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-[#E8ECF4] bg-gradient-to-br from-white to-[#F8FAFC] p-4">
      <div className="mb-2 flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: accent || PRIMARY }}
        />
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#667085]">
          {title}
        </p>
      </div>
      <p className="break-words text-[15px] font-semibold tracking-tight text-[#101828]">
        {party?.name || '—'}
      </p>
      <p className="mt-1.5 break-words whitespace-pre-line text-[12.5px] leading-relaxed text-[#475467] [overflow-wrap:anywhere]">
        {party?.address || '—'}
      </p>
      <div className="mt-3 min-w-0 space-y-1 text-[12px] text-[#475467]">
        {party?.gstin && (
          <p className="break-words [overflow-wrap:anywhere]">
            <span className="font-medium text-[#667085]">GSTIN:</span> {party.gstin}
          </p>
        )}
        {party?.pan && (
          <p className="break-words [overflow-wrap:anywhere]">
            <span className="font-medium text-[#667085]">PAN:</span> {party.pan}
          </p>
        )}
        {party?.email && (
          <p className="break-words [overflow-wrap:anywhere]">
            <span className="font-medium text-[#667085]">Email:</span> {party.email}
          </p>
        )}
        {party?.phone && (
          <p className="break-words [overflow-wrap:anywhere]">
            <span className="font-medium text-[#667085]">Phone:</span> {party.phone}
          </p>
        )}
      </div>
    </div>
  );
}

function InvoiceHeader({ settings, totals }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E4E7EC]">
      <div className="flex items-stretch">
        <div className="flex w-[42%] min-h-[132px] items-center justify-center self-stretch bg-[#F8FAFC] p-3">
          {settings.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.logoUrl}
              alt="Logo"
              className="h-full w-full object-contain object-center"
            />
          ) : (
            <div className="text-center">
              <p className="text-[28px] font-bold tracking-tight" style={{ color: PRIMARY }}>
                Stampogen
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[#98A2B3]">
                Digital Stamping
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col">
          <div
            className="flex items-center justify-between px-5 py-4 text-white"
            style={{
              background: `linear-gradient(135deg, ${PRIMARY} 0%, #04307A 55%, #0B4AA8 100%)`,
            }}
          >
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/70">
                Tax Invoice
              </p>
              <p className="mt-1 text-[26px] font-bold tracking-[0.14em]">INVOICE</p>
            </div>
            <div className="rounded-lg bg-white/10 px-3 py-2 text-right">
              <p className="text-[10px] uppercase tracking-[0.08em] text-white/70">Total</p>
              <p className="text-sm font-semibold">{formatMoney(totals.total)}</p>
            </div>
          </div>
          <div className="grid flex-1 grid-cols-2 divide-x divide-[#E4E7EC] bg-white">
            <div className="px-5 py-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">
                Invoice Date
              </p>
              <p className="mt-1 text-sm font-semibold text-[#101828]">
                {formatDate(settings.defaults?.sampleInvoiceDate)}
              </p>
            </div>
            <div className="px-5 py-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">
                Invoice ID
              </p>
              <p className="mt-1 text-sm font-semibold tracking-wide text-[#101828]">
                {resolveInvoiceId(settings.defaults)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContHeader({ settings }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#E4E7EC] bg-[#F8FAFC] px-4 py-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#667085]">
          Continued invoice
        </p>
        <p className="mt-0.5 text-sm font-semibold tracking-wide text-[#101828]">
          {resolveInvoiceId(settings.defaults)}
        </p>
      </div>
      <p className="text-[12px] text-[#667085]">
        {formatDate(settings.defaults?.sampleInvoiceDate)}
      </p>
    </div>
  );
}

function PartiesBlock({ settings }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="min-w-0">
        <PartyCard title="From" party={settings.company} />
      </div>
      <div className="min-w-0">
        <PartyCard
          title={settings.defaults?.billToTitle || 'Bill To'}
          party={settings.sampleCustomer}
          accent="#2E90FA"
        />
      </div>
    </div>
  );
}

function ItemsTable({ rows, startIndex = 0, showEmpty, headOnly, taxMode = 'igst' }) {
  const mode = normalizeTaxMode(taxMode);
  const taxColumns =
    mode === 'gst'
      ? [{ key: 'gst', label: 'GST' }]
      : mode === 'sgst_cgst'
        ? [
            { key: 'sgst', label: 'SGST' },
            { key: 'cgst', label: 'CGST' },
          ]
        : [{ key: 'igst', label: 'IGST' }];

  const colCount = 6 + taxColumns.length + 1;
  const itemWidth = mode === 'sgst_cgst' ? '22%' : '28%';
  const taxWidth = mode === 'sgst_cgst' ? '10%' : '12%';

  return (
    <div className="overflow-hidden rounded-xl border border-[#E4E7EC]">
      <table className="w-full table-fixed text-left text-[12px]">
        <colgroup>
          <col style={{ width: '6%' }} />
          <col style={{ width: itemWidth }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '11%' }} />
          {taxColumns.map((col) => (
            <col key={col.key} style={{ width: taxWidth }} />
          ))}
          <col style={{ width: '11%' }} />
        </colgroup>
        <thead>
          <tr
            className="text-white"
            style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, #04307A 100%)` }}
          >
            <th className="px-2 py-3 font-semibold">#</th>
            <th className="px-2 py-3 font-semibold">Items</th>
            <th className="px-2 py-3 font-semibold">Rate</th>
            <th className="px-2 py-3 font-semibold">Units</th>
            <th className="px-2 py-3 font-semibold">Discount</th>
            <th className="px-2 py-3 font-semibold">Taxable</th>
            {taxColumns.map((col) => (
              <th key={col.key} className="px-2 py-3 font-semibold">
                {col.label}
              </th>
            ))}
            <th className="px-2 py-3 font-semibold">Total</th>
          </tr>
        </thead>
        {!headOnly && (
          <tbody>
            {showEmpty ? (
              <tr>
                <td colSpan={colCount} className="px-3 py-10 text-center text-[#98A2B3]">
                  No line items yet — add items from the form.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={`${row.item.name}-${startIndex + index}`}
                  className={index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'}
                >
                  <td className="px-2 py-3 align-top text-[#667085]">{startIndex + index + 1}</td>
                  <td className="break-words px-2 py-3 align-top font-medium leading-snug text-[#101828]">
                    {row.item.name || '—'}
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 align-top">
                    {formatMoney(row.item.rate)}
                  </td>
                  <td className="px-2 py-3 align-top">{row.item.units}</td>
                  <td className="whitespace-nowrap px-2 py-3 align-top">
                    {formatMoney(row.item.discount)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 align-top">
                    {formatMoney(row.taxable)}
                  </td>
                  {taxColumns.map((col) => {
                    const amount =
                      col.key === 'gst'
                        ? row.gstAmt
                        : col.key === 'cgst'
                          ? row.cgstAmt
                          : col.key === 'sgst'
                            ? row.sgstAmt
                            : row.igstAmt;
                    const pct =
                      col.key === 'gst'
                        ? row.item.gst ?? row.item.igst
                        : col.key === 'cgst'
                          ? row.item.cgst ?? row.item.sgst
                          : row.item[col.key];
                    return (
                      <td key={col.key} className="whitespace-nowrap px-2 py-3 align-top">
                        {formatMoney(amount)}
                        <span className="mt-0.5 block text-[10px] text-[#98A2B3]">
                          {pct || 0}%
                        </span>
                      </td>
                    );
                  })}
                  <td className="whitespace-nowrap px-2 py-3 align-top font-semibold text-[#101828]">
                    {formatMoney(row.total)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        )}
      </table>
    </div>
  );
}

function AmountWords({ total }) {
  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-[#F8FAFC] px-4 py-3 text-[13px]">
      <span className="font-semibold text-[#344054]">Amount in words: </span>
      <span className="break-words text-[#475467]">{numberToWords(total)}</span>
    </div>
  );
}

function PaymentTerms({ settings }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl border border-[#E4E7EC] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085]">
          Payment Details
        </p>
        <dl className="mt-3 space-y-1.5 text-[12px] text-[#475467]">
          {[
            ['Bank Name', settings.payment?.bankName],
            ['Account Name', settings.payment?.accountName],
            ['Account No.', settings.payment?.accountNumber],
            ['IFSC', settings.payment?.ifsc],
            ['Branch', settings.payment?.branch],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <dt className="w-28 shrink-0 font-medium text-[#667085]">{label}</dt>
              <dd className="min-w-0 break-words">{value || '—'}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="rounded-xl border border-[#E4E7EC] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085]">
          Terms and Conditions
        </p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-[12px] leading-relaxed text-[#475467]">
          {(settings.terms || []).filter(Boolean).length === 0 ? (
            <li>No terms configured</li>
          ) : (
            settings.terms.filter(Boolean).map((term) => (
              <li key={term} className="break-words">
                {term}
              </li>
            ))
          )}
        </ol>
      </div>
    </div>
  );
}

function SignatureBlock({ settings, totals }) {
  return (
    <div
      className="flex items-start justify-between gap-4 rounded-xl border border-[#E4E7EC] px-3 py-3"
      style={{ backgroundColor: '#F8FAFC' }}
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085]">
          Company Signature
        </p>
        <div className="mt-2 flex h-14 w-40 items-center justify-center overflow-hidden rounded-lg border border-dashed border-[#D0D5DD] bg-white p-1.5">
          {settings.signatureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.signatureUrl}
              alt="Signature"
              className="max-h-full max-w-full object-contain object-center"
            />
          ) : (
            <span className="text-[11px] text-[#98A2B3]">Signature</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <p className="text-sm font-semibold" style={{ color: PRIMARY }}>
          {settings.closingNote || 'Thank you for your business'}
        </p>
        <table
          data-grand-total
          cellPadding="0"
          cellSpacing="0"
          style={{
            borderCollapse: 'collapse',
            backgroundColor: PRIMARY,
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  backgroundColor: PRIMARY,
                  padding: '7px 14px',
                  textAlign: 'right',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#C7D2FE',
                    marginBottom: 2,
                  }}
                >
                  Grand Total
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', lineHeight: 1.2 }}>
                  {formatMoney(totals.total)}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MadeWithBadge({ settings }) {
  if (settings?.showMadeWithBadge === false) return null;
  const brandSrc = String(settings?.madeWithImageUrl || '').trim();

  return (
    <div
      data-made-with-badge
      className="inline-flex items-center gap-1.5 rounded-full border border-[#E4E7EC] bg-white px-3 py-1.5"
      style={{
        boxShadow: '0 3px 10px rgba(16,24,40,0.1), 0 1px 2px rgba(16,24,40,0.05)',
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: '#667085',
          whiteSpace: 'nowrap',
        }}
      >
        Made with
      </span>
      {brandSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brandSrc}
          alt="Brand"
          style={{
            display: 'block',
            height: 20,
            maxWidth: 140,
            width: 'auto',
            objectFit: 'contain',
          }}
        />
      ) : (
        <span
          style={{
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ color: PRIMARY }}>invo</span>
          <span style={{ color: INVOGEN_ORANGE }}>gen</span>
          <span style={{ color: PRIMARY }}>.in</span>
        </span>
      )}
    </div>
  );
}

function InvoicePageShell({ children, pageNumber, totalPages, settings }) {
  const showBadge = settings?.showMadeWithBadge !== false;

  return (
    <div
      data-invoice-page
      className="relative overflow-hidden bg-white text-[#101828]"
      style={{
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        boxShadow: '0 18px 50px rgba(16,24,40,0.14), 0 2px 8px rgba(16,24,40,0.06)',
        borderRadius: 4,
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1.5"
        style={{ background: `linear-gradient(90deg, ${PRIMARY}, #2E90FA)` }}
      />
      <div className="flex h-full flex-col" style={{ padding: PAGE_PADDING }}>
        <div className="relative min-h-0 flex-1" style={{ overflow: 'hidden' }}>
          {children}
        </div>
        <div
          className="grid shrink-0 grid-cols-3 items-center border-t border-[#EEF2F6] text-[11px] text-[#98A2B3]"
          style={{ paddingTop: 10, minHeight: 48 }}
        >
          <span>Stampogen Invoice</span>
          <div className="flex items-center justify-center">
            {showBadge ? <MadeWithBadge settings={settings} /> : null}
          </div>
          <span className="text-right">
            Page {pageNumber} of {totalPages}
          </span>
        </div>
      </div>
    </div>
  );
}

function MeasurementLayer({ settings, computed, totals, onMeasured }) {
  const taxMode = normalizeTaxMode(settings.defaults?.taxMode);
  const headerRef = useRef(null);
  const contHeaderRef = useRef(null);
  const partiesRef = useRef(null);
  const tableHeadRef = useRef(null);
  const emptyTableRef = useRef(null);
  const continuedRef = useRef(null);
  const amountWordsRef = useRef(null);
  const paymentTermsRef = useRef(null);
  const signatureRef = useRef(null);
  const rowRefs = useRef([]);

  useLayoutEffect(() => {
    const next = {
      header: readHeight(headerRef.current),
      contHeader: readHeight(contHeaderRef.current),
      parties: readHeight(partiesRef.current),
      tableHead: readHeight(tableHeadRef.current),
      emptyTable: readHeight(emptyTableRef.current),
      continued: readHeight(continuedRef.current),
      amountWords: readHeight(amountWordsRef.current),
      paymentTerms: readHeight(paymentTermsRef.current),
      signature: readHeight(signatureRef.current),
    };
    computed.forEach((_, index) => {
      const wrap = rowRefs.current[index];
      const rowEl = wrap?.querySelector?.('tbody tr');
      next[`row-${index}`] = Math.max(36, readHeight(rowEl) || readHeight(wrap) - (next.tableHead || 0));
    });
    onMeasured(next);
  }, [settings, computed, totals, onMeasured, taxMode]);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-[-12000px] top-0"
      style={{ width: PAGE_WIDTH, visibility: 'hidden' }}
    >
      <div ref={headerRef}>
        <InvoiceHeader settings={settings} totals={totals} />
      </div>
      <div ref={contHeaderRef}>
        <ContHeader settings={settings} />
      </div>
      <div ref={partiesRef}>
        <PartiesBlock settings={settings} />
      </div>
      <div ref={tableHeadRef}>
        <ItemsTable rows={[]} headOnly taxMode={taxMode} />
      </div>
      <div ref={emptyTableRef}>
        <ItemsTable rows={[]} showEmpty taxMode={taxMode} />
      </div>
      {computed.map((row, index) => (
        <div
          key={`m-row-${index}`}
          ref={(el) => {
            rowRefs.current[index] = el;
          }}
        >
          <ItemsTable rows={[row]} startIndex={index} taxMode={taxMode} />
        </div>
      ))}
      <div ref={continuedRef}>
        <p className="text-right text-[11px] italic text-[#98A2B3]">Continued on next page…</p>
      </div>
      <div ref={amountWordsRef}>
        <AmountWords total={totals.total} />
      </div>
      <div ref={paymentTermsRef}>
        <PaymentTerms settings={settings} />
      </div>
      <div ref={signatureRef}>
        <SignatureBlock settings={settings} totals={totals} />
      </div>
    </div>
  );
}

function PageContent({ page, settings, computed, totals }) {
  return (
    <div className="flex h-full flex-col">
      {page.blocks.map((block, idx) => {
        const key = `${page.pageNumber}-${block.type}-${idx}`;
        const mb = block.mb ?? 0;
        if (block.type === 'header') {
          return (
            <div key={key} style={{ marginBottom: mb }}>
              <InvoiceHeader settings={settings} totals={totals} />
            </div>
          );
        }
        if (block.type === 'contHeader') {
          return (
            <div key={key} style={{ marginBottom: mb }}>
              <ContHeader settings={settings} />
            </div>
          );
        }
        if (block.type === 'parties') {
          return (
            <div key={key} style={{ marginBottom: mb }}>
              <PartiesBlock settings={settings} />
            </div>
          );
        }
        if (block.type === 'table') {
          const rows = (block.rowSlice || []).map((i) => computed[i]).filter(Boolean);
          const startIndex = block.rowSlice?.[0] ?? 0;
          return (
            <div key={key} style={{ marginBottom: mb }}>
              <ItemsTable
                rows={rows}
                startIndex={startIndex}
                showEmpty={Boolean(block.showEmpty)}
                taxMode={settings.defaults?.taxMode}
              />
            </div>
          );
        }
        if (block.type === 'continued') {
          return (
            <p key={key} className="text-right text-[11px] italic text-[#98A2B3]" style={{ marginBottom: mb }}>
              Continued on next page…
            </p>
          );
        }
        if (block.type === 'amountWords') {
          return (
            <div key={key} style={{ marginBottom: mb }}>
              <AmountWords total={totals.total} />
            </div>
          );
        }
        if (block.type === 'paymentTerms') {
          return (
            <div key={key} style={{ marginBottom: mb }}>
              <PaymentTerms settings={settings} />
            </div>
          );
        }
        if (block.type === 'signature') {
          return (
            <div key={key} style={{ marginBottom: mb }}>
              <SignatureBlock settings={settings} totals={totals} />
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

export const InvoicePreview = forwardRef(function InvoicePreview({ settings, zoom }, ref) {
  const rootRef = useRef(null);
  const taxMode = normalizeTaxMode(settings.defaults?.taxMode);

  const computed = useMemo(
    () =>
      (settings.sampleItems || []).map((item) => ({ item, ...calcItem(item, taxMode) })),
    [settings.sampleItems, taxMode]
  );

  const totals = useMemo(
    () =>
      computed.reduce(
        (acc, row) => ({
          taxable: acc.taxable + row.taxable,
          gst: acc.gst + (row.gstAmt || 0),
          igst: acc.igst + (row.igstAmt || 0),
          sgst: acc.sgst + (row.sgstAmt || 0),
          cgst: acc.cgst + (row.cgstAmt || 0),
          total: acc.total + row.total,
        }),
        { taxable: 0, gst: 0, igst: 0, sgst: 0, cgst: 0, total: 0 }
      ),
    [computed]
  );

  const [heights, setHeights] = useState(null);

  const onMeasured = useCallback((next) => {
    setHeights((prev) => {
      if (!prev) return next;
      const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
      for (const key of keys) {
        if (prev[key] !== next[key]) return next;
      }
      return prev;
    });
  }, []);

  const pages = useMemo(() => packPages(heights || {}, computed.length), [heights, computed]);

  const stackHeight = pages.length * PAGE_HEIGHT + Math.max(0, pages.length - 1) * 32;

  useImperativeHandle(ref, () => ({
    getRoot: () => rootRef.current,
  }));

  return (
    <div className="relative" ref={rootRef}>
      <MeasurementLayer
        settings={settings}
        computed={computed}
        totals={totals}
        onMeasured={onMeasured}
      />
      <div style={{ width: PAGE_WIDTH * zoom, height: stackHeight * zoom }}>
        <div
          className="flex flex-col items-center gap-8"
          style={{
            width: PAGE_WIDTH,
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
          }}
        >
          {pages.map((page) => (
            <InvoicePageShell
              key={`p-${page.pageNumber}-${page.blocks.map((b) => b.type).join('_')}-${(page.blocks.find((b) => b.type === 'table')?.rowSlice || []).join(',')}`}
              pageNumber={page.pageNumber}
              totalPages={page.totalPages}
              settings={settings}
            >
              <PageContent
                page={page}
                settings={settings}
                computed={computed}
                totals={totals}
              />
            </InvoicePageShell>
          ))}
        </div>
      </div>
    </div>
  );
});
