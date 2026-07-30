const PDFDocument = require('pdfkit');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');
const config = require('@config');

const PRIMARY = '#021A54';
const PRIMARY_MID = '#04307A';
const MUTED = '#667085';
const INK = '#101828';
const LINE = '#E4E7EC';
const SOFT = '#F8FAFC';
const LABEL = '#98A2B3';
const ORANGE = '#F97316';
const WHITE = '#FFFFFF';

const MARGIN = 28;

/** Helvetica has no ₹ glyph — use ASCII-safe INR formatting for PDF. */
function formatPdfMoney(amount = 0) {
  const n = Number(amount) || 0;
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `Rs. ${formatted}`;
}

function resolveImageSource(url) {
  const raw = String(url || '').trim();
  if (!raw) return null;

  // data:image/png;base64,....
  if (raw.startsWith('data:')) {
    const match = raw.match(/^data:([^;]+);base64,(.+)$/i);
    if (!match) return null;
    try {
      return { buffer: Buffer.from(match[2], 'base64'), type: match[1] };
    } catch {
      return null;
    }
  }

  // Absolute file path
  if (path.isAbsolute(raw) && fs.existsSync(raw)) {
    try {
      return { buffer: fs.readFileSync(raw) };
    } catch {
      return null;
    }
  }

  // Relative public/upload path → try frontend/public and backend uploads
  if (raw.startsWith('/') && !raw.startsWith('//')) {
    const candidates = [
      path.join(process.cwd(), 'uploads', raw.replace(/^\//, '')),
      path.join(process.cwd(), 'public', raw.replace(/^\//, '')),
      path.join(process.cwd(), '..', 'frontend', 'public', raw.replace(/^\//, '')),
    ];
    for (const file of candidates) {
      if (fs.existsSync(file)) {
        try {
          return { buffer: fs.readFileSync(file) };
        } catch {
          // continue
        }
      }
    }
    // Fall through to HTTP against frontend
    const base = String(config.frontendUrl || 'http://localhost:3000').replace(/\/$/, '');
    return { url: `${base}${raw}` };
  }

  if (/^https?:\/\//i.test(raw)) {
    return { url: raw };
  }

  return null;
}

function fetchHttpBuffer(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: 6000 }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchHttpBuffer(res.headers.location).then(resolve);
        return;
      }
      if (res.statusCode !== 200) {
        resolve(null);
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function loadImageBuffer(url) {
  const source = resolveImageSource(url);
  if (!source) return null;
  if (source.buffer) return source.buffer;
  if (source.url) return fetchHttpBuffer(source.url);
  return null;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
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

/** Safe rounded rect — always closes path before fill/stroke. */
function paintRoundRect(doc, x, y, w, h, r, { fill = null, stroke = null, lineWidth = 1 } = {}) {
  const radius = Math.min(r, w / 2, h / 2);
  doc.save();
  doc
    .moveTo(x + radius, y)
    .lineTo(x + w - radius, y)
    .quadraticCurveTo(x + w, y, x + w, y + radius)
    .lineTo(x + w, y + h - radius)
    .quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
    .lineTo(x + radius, y + h)
    .quadraticCurveTo(x, y + h, x, y + h - radius)
    .lineTo(x, y + radius)
    .quadraticCurveTo(x, y, x + radius, y)
    .closePath();
  if (fill && stroke) {
    doc.fillColor(fill).strokeColor(stroke).lineWidth(lineWidth).fillAndStroke();
  } else if (fill) {
    doc.fillColor(fill).fill();
  } else if (stroke) {
    doc.strokeColor(stroke).lineWidth(lineWidth).stroke();
  }
  doc.restore();
}

function partyDetailLines(party = {}) {
  return [
    party.address,
    party.gstin ? `GSTIN: ${party.gstin}` : null,
    party.pan ? `PAN: ${party.pan}` : null,
    party.email ? `Email: ${party.email}` : null,
    party.phone ? `Phone: ${party.phone}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function drawPartyCard(doc, { title, party, x, y, w, accent = PRIMARY }) {
  const name = party?.name || '—';
  const details = partyDetailLines(party) || '—';
  const detailsH = doc.heightOfString(details, { width: w - 24, lineGap: 1.5 });
  const h = Math.max(108, 56 + detailsH);

  // White card (preview PartyCard)
  paintRoundRect(doc, x, y, w, h, 10, { fill: WHITE, stroke: LINE, lineWidth: 1 });
  paintRoundRect(doc, x + 0.5, y + 0.5, w - 1, 26, 10, { fill: SOFT });
  doc.save();
  doc.rect(x + 0.5, y + 14, w - 1, 13).fill(SOFT);
  doc.restore();

  doc.save();
  doc.circle(x + 14, y + 14, 3).fill(accent);
  doc.restore();

  doc
    .fillColor(MUTED)
    .font('Helvetica-Bold')
    .fontSize(8)
    .text(String(title || '').toUpperCase(), x + 22, y + 10, { width: w - 34 });

  doc
    .fillColor(INK)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(name, x + 12, y + 34, { width: w - 24 });

  doc
    .fillColor(MUTED)
    .font('Helvetica')
    .fontSize(8.5)
    .text(details, x + 12, y + 50, { width: w - 24, lineGap: 1.5 });

  return h;
}

/**
 * PDF matching live InvoicePreview — white cards, navy accents, readable text.
 */
async function buildInvoicePdfBuffer(invoice, settingsView = null) {
  const settings = settingsView || {};
  const company = { ...(settings.company || {}), ...(invoice.company || {}) };
  const customer = invoice.customer || {};
  const meta = invoice.meta || {};
  const item = invoice.item || {};
  const totals = invoice.totals || {};
  const breakdown = totals.breakdown || {};
  const taxMode = invoice.taxMode || 'igst';
  const defaults = settings.defaults || {};
  const payment = settings.payment || invoice.payment || {};
  const terms = (settings.terms || invoice.terms || []).filter(Boolean);

  const billToParty = {
    name: customer.contactName || customer.name || customer.organization || 'Customer',
    address: [
      customer.organization &&
      customer.organization !== (customer.contactName || customer.name)
        ? customer.organization
        : null,
      customer.address,
    ]
      .filter(Boolean)
      .join('\n'),
    email: customer.email,
    phone: customer.phone,
    gstin: customer.gstin,
    pan: customer.pan,
  };

  const logoBuf = await loadImageBuffer(settings.logoUrl);
  const signatureBuf = await loadImageBuffer(settings.signatureUrl);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        info: {
          Title: meta.invoiceNumber || 'Invoice',
          Author: company.name || 'Stampogen',
        },
      });

      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width;
      const pageH = doc.page.height;
      const left = MARGIN;
      const right = pageW - MARGIN;
      const contentW = right - left;
      let y = MARGIN;

      // Top accent line
      doc.save();
      doc.rect(0, 0, pageW * 0.45, 3.5).fill(PRIMARY);
      doc.rect(pageW * 0.45, 0, pageW * 0.55, 3.5).fill('#2E90FA');
      doc.restore();

      // ===== HEADER =====
      const headerH = 112;
      paintRoundRect(doc, left, y, contentW, headerH, 12, {
        fill: WHITE,
        stroke: LINE,
        lineWidth: 1,
      });

      const logoW = contentW * 0.4;
      doc.save();
      doc.rect(left + 1, y + 1, logoW - 2, headerH - 2).fill(SOFT);
      doc.restore();

      if (logoBuf) {
        try {
          doc.image(logoBuf, left + 14, y + 16, {
            fit: [logoW - 28, headerH - 32],
            align: 'center',
            valign: 'center',
          });
        } catch {
          doc
            .fillColor(PRIMARY)
            .font('Helvetica-Bold')
            .fontSize(18)
            .text('Stampogen', left + 10, y + 40, { width: logoW - 20, align: 'center' });
        }
      } else {
        doc
          .fillColor(PRIMARY)
          .font('Helvetica-Bold')
          .fontSize(18)
          .text('Stampogen', left + 10, y + 36, { width: logoW - 20, align: 'center' });
        doc
          .fillColor(LABEL)
          .font('Helvetica')
          .fontSize(8)
          .text('DIGITAL STAMPING', left + 10, y + 60, { width: logoW - 20, align: 'center' });
      }

      const hx = left + logoW;
      const hw = contentW - logoW;

      // Navy INVOICE band
      doc.save();
      doc.rect(hx, y + 1, hw - 1, 54).fill(PRIMARY);
      doc.restore();

      doc
        .fillColor('#C7D2FE')
        .font('Helvetica')
        .fontSize(8)
        .text('TAX INVOICE', hx + 14, y + 10);
      doc
        .fillColor(WHITE)
        .font('Helvetica-Bold')
        .fontSize(17)
        .text('INVOICE', hx + 14, y + 24);

      // Total chip
      paintRoundRect(doc, hx + hw - 100, y + 10, 84, 32, 6, { fill: PRIMARY_MID });
      doc
        .fillColor('#C7D2FE')
        .font('Helvetica')
        .fontSize(7)
        .text('TOTAL', hx + hw - 92, y + 14, { width: 68, align: 'right' });
      doc
        .fillColor(WHITE)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(formatPdfMoney(totals.total), hx + hw - 92, y + 26, { width: 68, align: 'right' });

      // Date / ID white row
      doc.save();
      doc.rect(hx, y + 55, hw - 1, headerH - 56).fill(WHITE);
      doc.restore();
      doc
        .strokeColor(LINE)
        .moveTo(hx + hw / 2, y + 60)
        .lineTo(hx + hw / 2, y + headerH - 8)
        .stroke();

      doc
        .fillColor(LABEL)
        .font('Helvetica-Bold')
        .fontSize(7)
        .text('INVOICE DATE', hx + 12, y + 64);
      doc
        .fillColor(INK)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(formatDate(meta.invoiceDate), hx + 12, y + 78);

      doc
        .fillColor(LABEL)
        .font('Helvetica-Bold')
        .fontSize(7)
        .text('INVOICE ID', hx + hw / 2 + 12, y + 64);
      doc
        .fillColor(INK)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(meta.invoiceNumber || '—', hx + hw / 2 + 12, y + 78);

      y += headerH + 14;

      // ===== FROM / BILL TO (white cards) =====
      const cardW = (contentW - 12) / 2;
      const leftH = drawPartyCard(doc, {
        title: 'From',
        party: company,
        x: left,
        y,
        w: cardW,
        accent: PRIMARY,
      });
      const rightH = drawPartyCard(doc, {
        title: invoice.billToTitle || defaults.billToTitle || 'Bill To',
        party: billToParty,
        x: left + cardW + 12,
        y,
        w: cardW,
        accent: '#2E90FA',
      });
      y += Math.max(leftH, rightH) + 14;

      // ===== ITEMS TABLE =====
      const taxCols =
        taxMode === 'gst'
          ? [{ label: 'GST', amount: breakdown.gst || totals.tax || 0, pct: defaults.gstRate || 18 }]
          : taxMode === 'sgst_cgst'
            ? [
                { label: 'SGST', amount: breakdown.sgst || 0, pct: defaults.sgstRate || 9 },
                { label: 'CGST', amount: breakdown.cgst || 0, pct: defaults.cgstRate || 9 },
              ]
            : [{ label: 'IGST', amount: breakdown.igst || totals.tax || 0, pct: defaults.igstRate || 18 }];

      const colDefs = [
        { label: '#', w: 0.05, align: 'left' },
        { label: 'Items', w: taxMode === 'sgst_cgst' ? 0.22 : 0.28, align: 'left' },
        { label: 'Rate', w: 0.11, align: 'right' },
        { label: 'Units', w: 0.07, align: 'right' },
        { label: 'Discount', w: 0.11, align: 'right' },
        { label: 'Taxable', w: 0.11, align: 'right' },
        ...taxCols.map((t) => ({
          label: t.label,
          w: taxMode === 'sgst_cgst' ? 0.1 : 0.12,
          align: 'right',
        })),
        { label: 'Total', w: 0.11, align: 'right' },
      ];

      const sumW = colDefs.reduce((s, c) => s + c.w, 0);
      colDefs.forEach((c) => {
        c.px = (c.w / sumW) * contentW;
      });

      const headH = 24;
      const rowH = 38;
      paintRoundRect(doc, left, y, contentW, headH + rowH, 8, {
        fill: WHITE,
        stroke: LINE,
        lineWidth: 1,
      });

      // header bar
      doc.save();
      doc.rect(left, y, contentW, headH).fill(PRIMARY);
      doc.restore();

      let cx = left;
      colDefs.forEach((c) => {
        doc
          .fillColor(WHITE)
          .font('Helvetica-Bold')
          .fontSize(7.5)
          .text(c.label, cx + 4, y + 8, { width: c.px - 8, align: c.align });
        cx += c.px;
      });

      // body row (soft alt)
      doc.save();
      doc.rect(left, y + headH, contentW, rowH).fill(WHITE);
      doc.restore();

      const cells = [
        { text: '1', align: 'left', color: MUTED },
        { text: item.name || '—', align: 'left', color: INK, bold: true },
        { text: formatPdfMoney(item.rate), align: 'right', color: INK },
        { text: String(item.units || 1), align: 'right', color: INK },
        { text: formatPdfMoney(item.discount || 0), align: 'right', color: INK },
        { text: formatPdfMoney(item.taxable || totals.taxable || 0), align: 'right', color: INK },
        ...taxCols.map((t) => ({
          text: formatPdfMoney(t.amount),
          sub: `${t.pct || 0}%`,
          align: 'right',
          color: INK,
        })),
        {
          text: formatPdfMoney(item.total || totals.total || 0),
          align: 'right',
          color: INK,
          bold: true,
        },
      ];

      cx = left;
      cells.forEach((cell, i) => {
        const c = colDefs[i];
        doc
          .fillColor(cell.color || INK)
          .font(cell.bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(8)
          .text(cell.text, cx + 4, y + headH + (cell.sub ? 8 : 14), {
            width: c.px - 8,
            align: cell.align,
          });
        if (cell.sub) {
          doc
            .fillColor(LABEL)
            .font('Helvetica')
            .fontSize(6.5)
            .text(cell.sub, cx + 4, y + headH + 22, { width: c.px - 8, align: cell.align });
        }
        cx += c.px;
      });

      y += headH + rowH + 12;

      // ===== Amount in words =====
      paintRoundRect(doc, left, y, contentW, 32, 10, { fill: SOFT, stroke: LINE });
      doc
        .fillColor('#344054')
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('Amount in words: ', left + 12, y + 11, { continued: true });
      doc.fillColor(MUTED).font('Helvetica').text(numberToWords(totals.total));
      y += 44;

      // ===== Payment + Terms =====
      const half = (contentW - 12) / 2;
      const termList = terms.length ? terms : ['No terms configured'];
      let termsH = 28;
      termList.forEach((term) => {
        termsH += doc.heightOfString(`1. ${term}`, { width: half - 28 }) + 4;
      });
      const boxH = Math.max(118, termsH, 28 + 5 * 14);

      paintRoundRect(doc, left, y, half, boxH, 10, { fill: WHITE, stroke: LINE });
      paintRoundRect(doc, left + half + 12, y, half, boxH, 10, { fill: WHITE, stroke: LINE });

      doc
        .fillColor(MUTED)
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('PAYMENT DETAILS', left + 12, y + 12);

      const payRows = [
        ['Bank Name', payment.bankName],
        ['Account Name', payment.accountName],
        ['Account No.', payment.accountNumber],
        ['IFSC', payment.ifsc],
        ['Branch', payment.branch],
      ];
      let py = y + 28;
      payRows.forEach(([label, value]) => {
        doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(label, left + 12, py, { width: 78 });
        doc
          .fillColor('#475467')
          .text(value || '—', left + 90, py, { width: half - 102 });
        py += 14;
      });

      doc
        .fillColor(MUTED)
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('TERMS AND CONDITIONS', left + half + 24, y + 12);

      let ty = y + 28;
      termList.forEach((term, i) => {
        const line = `${i + 1}. ${term}`;
        doc
          .fillColor('#475467')
          .font('Helvetica')
          .fontSize(8)
          .text(line, left + half + 24, ty, { width: half - 36 });
        ty += doc.heightOfString(line, { width: half - 36 }) + 4;
      });

      y += boxH + 12;

      // ===== Signature + Grand total =====
      const sigH = 72;
      paintRoundRect(doc, left, y, contentW, sigH, 10, { fill: SOFT, stroke: LINE });

      doc
        .fillColor(MUTED)
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('COMPANY SIGNATURE', left + 12, y + 10);

      paintRoundRect(doc, left + 12, y + 26, 110, 34, 6, { fill: WHITE, stroke: '#D0D5DD' });
      if (signatureBuf) {
        try {
          doc.image(signatureBuf, left + 18, y + 30, {
            fit: [98, 26],
            align: 'center',
            valign: 'center',
          });
        } catch {
          doc
            .fillColor(LABEL)
            .font('Helvetica')
            .fontSize(8)
            .text('Signature', left + 12, y + 38, { width: 110, align: 'center' });
        }
      } else {
        doc
          .fillColor(LABEL)
          .font('Helvetica')
          .fontSize(8)
          .text('Signature', left + 12, y + 38, { width: 110, align: 'center' });
      }

      doc
        .fillColor(PRIMARY)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(
          settings.closingNote || invoice.closingNote || 'Thank you for your business',
          left + 140,
          y + 14,
          { width: contentW - 280, align: 'right' }
        );

      const gtW = 118;
      const gtX = right - gtW - 12;
      paintRoundRect(doc, gtX, y + 30, gtW, 32, 6, { fill: PRIMARY });
      doc
        .fillColor('#C7D2FE')
        .font('Helvetica-Bold')
        .fontSize(7)
        .text('GRAND TOTAL', gtX + 8, y + 35, { width: gtW - 16, align: 'right' });
      doc
        .fillColor(WHITE)
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(formatPdfMoney(totals.total), gtX + 8, y + 46, {
          width: gtW - 16,
          align: 'right',
        });

      // ===== Footer =====
      const footerY = pageH - 40;
      doc
        .strokeColor('#EEF2F6')
        .moveTo(left, footerY)
        .lineTo(right, footerY)
        .stroke();

      doc
        .fillColor(LABEL)
        .font('Helvetica')
        .fontSize(8)
        .text('Stampogen Invoice', left, footerY + 14);
      doc.text('Page 1 of 1', right - 64, footerY + 14, { width: 64, align: 'right' });

      if (settings.showMadeWithBadge !== false) {
        const badgeW = 108;
        const bx = left + (contentW - badgeW) / 2;
        paintRoundRect(doc, bx, footerY + 8, badgeW, 16, 8, { fill: WHITE, stroke: LINE });
        doc
          .fillColor(MUTED)
          .font('Helvetica')
          .fontSize(7)
          .text('Made with ', bx + 8, footerY + 12, { continued: true });
        doc.fillColor(PRIMARY).font('Helvetica-Bold').text('invo', { continued: true });
        doc.fillColor(ORANGE).text('gen', { continued: true });
        doc.fillColor(PRIMARY).text('.in');
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  buildInvoicePdfBuffer,
};
