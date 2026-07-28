const PDFDocument = require('pdfkit');
const { getAffiliateTypeLabel } = require('@constants/affiliateTypes');

const PRIMARY = '#021A54';
const MUTED = '#667085';
const INK = '#101828';
const LINE = '#E4E7EC';
const LABEL = '#98A2B3';

const MARGIN = 48;

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function affiliateDisplayName(affiliate = {}) {
  const full =
    affiliate.fullName ||
    [affiliate.firstName, affiliate.lastName].filter(Boolean).join(' ').trim();
  return full || affiliate.email || 'Affiliate Partner';
}

function affiliateDetailLines(affiliate = {}) {
  const lines = [
    `Name: ${affiliateDisplayName(affiliate)}`,
    affiliate.email ? `Email: ${affiliate.email}` : null,
    affiliate.phone ? `Phone: ${affiliate.phone}` : null,
    affiliate.affiliateType
      ? `Affiliate type: ${getAffiliateTypeLabel(affiliate.affiliateType)}`
      : null,
    affiliate.collegeName ? `College: ${affiliate.collegeName}` : null,
    affiliate.universityName ? `University: ${affiliate.universityName}` : null,
    affiliate.socialMediaAccount
      ? `Social media: ${affiliate.socialMediaAccount}`
      : null,
  ];
  return lines.filter(Boolean);
}

/**
 * Build affiliate partner agreement PDF (Buffer), same stack as invoices (pdfkit).
 */
function buildAgreementPdfBuffer({ settings = {}, affiliate = {} } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        info: {
          Title: settings.title || 'Affiliate Partner Agreement',
          Author: 'Stampogen',
        },
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const contentWidth = pageWidth - MARGIN * 2;
      const title = settings.title || 'Affiliate Partner Agreement';
      const version = settings.version || '1.0';
      const effective = formatDate(settings.effectiveDate);
      const issued = formatDate(new Date());
      const content = String(settings.content || '').trim() || 'No agreement content configured.';

      // Header bar
      doc.rect(0, 0, pageWidth, 72).fill(PRIMARY);
      doc
        .fillColor('#FFFFFF')
        .font('Helvetica-Bold')
        .fontSize(18)
        .text('Stampogen', MARGIN, 22, { width: contentWidth });
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#D0D5DD')
        .text('Affiliate Partner Agreement', MARGIN, 46, { width: contentWidth });

      let y = 96;

      doc
        .fillColor(INK)
        .font('Helvetica-Bold')
        .fontSize(16)
        .text(title, MARGIN, y, { width: contentWidth });
      y = doc.y + 10;

      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(10)
        .text(`Version ${version}  ·  Effective ${effective}  ·  Issued ${issued}`, MARGIN, y, {
          width: contentWidth,
        });
      y = doc.y + 16;

      doc
        .strokeColor(LINE)
        .lineWidth(1)
        .moveTo(MARGIN, y)
        .lineTo(MARGIN + contentWidth, y)
        .stroke();
      y += 18;

      doc
        .fillColor(PRIMARY)
        .font('Helvetica-Bold')
        .fontSize(11)
        .text('Partner details', MARGIN, y);
      y = doc.y + 8;

      doc.fillColor(INK).font('Helvetica').fontSize(10);
      for (const line of affiliateDetailLines(affiliate)) {
        doc.text(line, MARGIN, y, { width: contentWidth });
        y = doc.y + 3;
      }

      y += 12;
      doc
        .strokeColor(LINE)
        .lineWidth(1)
        .moveTo(MARGIN, y)
        .lineTo(MARGIN + contentWidth, y)
        .stroke();
      y += 18;

      doc
        .fillColor(PRIMARY)
        .font('Helvetica-Bold')
        .fontSize(11)
        .text('Agreement', MARGIN, y);
      y = doc.y + 10;

      doc.fillColor(INK).font('Helvetica').fontSize(10);
      doc.text(content, MARGIN, y, {
        width: contentWidth,
        align: 'left',
        lineGap: 3,
      });
      y = doc.y + 28;

      if (y > doc.page.height - 140) {
        doc.addPage();
        y = MARGIN;
      }

      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(9)
        .text(
          'This agreement was issued when your affiliate application was placed on hold for review. Please read carefully. Stampogen may contact you for next steps.',
          MARGIN,
          y,
          { width: contentWidth }
        );
      y = doc.y + 28;

      const colW = (contentWidth - 24) / 2;
      doc
        .strokeColor(LINE)
        .lineWidth(1)
        .moveTo(MARGIN, y + 36)
        .lineTo(MARGIN + colW, y + 36)
        .stroke();
      doc
        .fillColor(LABEL)
        .font('Helvetica')
        .fontSize(9)
        .text('Partner signature', MARGIN, y + 42, { width: colW });

      doc
        .strokeColor(LINE)
        .lineWidth(1)
        .moveTo(MARGIN + colW + 24, y + 36)
        .lineTo(MARGIN + contentWidth, y + 36)
        .stroke();
      doc
        .fillColor(LABEL)
        .font('Helvetica')
        .fontSize(9)
        .text('Date', MARGIN + colW + 24, y + 42, { width: colW });

      const footerY = doc.page.height - 36;
      doc
        .fillColor(LABEL)
        .font('Helvetica')
        .fontSize(8)
        .text('Stampogen · Confidential', MARGIN, footerY, {
          width: contentWidth,
          align: 'center',
        });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function buildAgreementPdfFileName(affiliate = {}) {
  const raw = affiliateDisplayName(affiliate)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const stamp = new Date().toISOString().slice(0, 10);
  return `Stampogen-Affiliate-Agreement-${raw || 'Partner'}-${stamp}.pdf`;
}

module.exports = {
  buildAgreementPdfBuffer,
  buildAgreementPdfFileName,
  affiliateDisplayName,
};
