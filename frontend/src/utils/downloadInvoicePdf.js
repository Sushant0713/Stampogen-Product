import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { resolveInvoiceId } from '@/utils/invoiceNumber';

/** A4 @ ~96dpi — keep in sync with InvoicePreview */
const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;

function waitForNextPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Capture each A4 invoice page and download as a multi-page PDF.
 * Pages are cloned into an untransformed offscreen host so parent
 * `scale()` / overflow clipping does not hide the signature + grand total.
 */
export async function downloadInvoicePdf(container, settings) {
  if (!container) {
    throw new Error('Invoice preview is not ready');
  }

  await waitForNextPaint();
  await wait(50);

  const pages = Array.from(container.querySelectorAll('[data-invoice-page]'));
  if (!pages.length) {
    throw new Error('No invoice pages found');
  }

  const host = document.createElement('div');
  host.setAttribute('data-invoice-pdf-host', 'true');
  host.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    'z-index:-1',
    'margin:0',
    'padding:0',
    'pointer-events:none',
    'opacity:1',
    'transform:none',
    'background:#ffffff',
  ].join(';');
  document.body.appendChild(host);

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: [PAGE_WIDTH, PAGE_HEIGHT],
    hotfixes: ['px_scaling'],
  });

  try {
    for (let index = 0; index < pages.length; index += 1) {
      const clone = pages[index].cloneNode(true);
      clone.style.transform = 'none';
      clone.style.margin = '0';
      clone.style.boxShadow = 'none';
      clone.style.borderRadius = '0';
      clone.style.overflow = 'visible';
      host.replaceChildren(clone);

      await waitForNextPaint();

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        windowWidth: PAGE_WIDTH,
        windowHeight: PAGE_HEIGHT,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        onclone: (_document, element) => {
          element.style.transform = 'none';
          element.style.overflow = 'visible';
          element.querySelectorAll('[data-grand-total]').forEach((node) => {
            node.style.backgroundColor = '#021A54';
            node.style.backgroundImage = 'none';
            node.querySelectorAll('td, div').forEach((child) => {
              if (child.tagName === 'TD') {
                child.style.backgroundColor = '#021A54';
              }
            });
          });
        },
      });

      const image = canvas.toDataURL('image/png', 1);
      if (index > 0) {
        pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT], 'portrait');
      }
      pdf.addImage(image, 'PNG', 0, 0, PAGE_WIDTH, PAGE_HEIGHT, undefined, 'FAST');
    }
  } finally {
    host.remove();
  }

  const fileName = `${resolveInvoiceId(settings?.defaults || {})}.pdf`;
  pdf.save(fileName);
  return fileName;
}
