'use client';

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export function LoyaltyQrImage({ value, size = 120, className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 1,
      color: { dark: '#021A54', light: '#FFFFFF' },
    }).catch(() => {});
  }, [value, size]);

  if (!value) return null;

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-label="Shop loyalty QR code"
      role="img"
    />
  );
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const SHELL_ID = 'stampogen-qr-print-shell';
const STYLE_ID = 'stampogen-qr-print-shell-style';

function cleanupPrintShell() {
  document.getElementById(SHELL_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
  document.documentElement.classList.remove('stampogen-qr-printing');
}

function waitForDocImages(doc) {
  const images = Array.from(doc.images || []);
  if (!images.length) return Promise.resolve();
  return Promise.all(
    images.map(
      (image) =>
        new Promise((done) => {
          if (image.complete) {
            done();
            return;
          }
          const finish = () => done();
          image.onload = finish;
          image.onerror = finish;
          setTimeout(finish, 2000);
        })
    )
  );
}

function buildPosterHtml({ dataUrl, logoUrl, shopName }) {
  // Empty <title> reduces browser header text in some print UIs
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title></title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      min-height: 100%;
      background: #fff;
      color: #021A54;
      font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif;
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
      max-width: 170mm;
      padding: 12mm 10mm;
      border: 2px solid #DCE5F5;
      border-radius: 16px;
      text-align: center;
      background: #fff;
    }
    .logo { width: 48mm; height: auto; margin: 0 auto 6mm; display: block; object-fit: contain; }
    .eyebrow {
      display: inline-block;
      margin-bottom: 4mm;
      padding: 2mm 4mm;
      border-radius: 999px;
      background: #EAF1FF;
      color: #1649AF;
      font-size: 9pt;
      font-weight: 800;
      letter-spacing: .12em;
    }
    .shop { margin: 0 0 5mm; font-size: 16pt; font-weight: 800; line-height: 1.25; }
    .qr-card {
      display: inline-block;
      padding: 3mm;
      border: 1px solid #DFE7F4;
      border-radius: 10px;
      background: #fff;
    }
    .qr { display: block; width: 85mm; height: 85mm; }
    .headline { margin: 5mm 0 3mm; font-size: 18pt; font-weight: 800; line-height: 1.2; }
    .sub {
      max-width: 120mm;
      margin: 0 auto;
      font-size: 10pt;
      line-height: 1.45;
      font-weight: 600;
      color: #64748B;
    }
    .brand {
      margin-top: 6mm;
      font-size: 8pt;
      font-weight: 800;
      letter-spacing: .14em;
      color: #A0AEC0;
    }
    @media print {
      html, body {
        width: 210mm;
        height: 297mm;
        background: #fff !important;
      }
      body { padding: 12mm; }
      .poster {
        max-width: none;
        width: 100%;
        min-height: 273mm;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
    }
  </style>
</head>
<body>
  <div class="poster">
    <img class="logo" src="${logoUrl}" alt="" />
    <div class="eyebrow">LOYALTY REWARDS</div>
    ${shopName ? `<div class="shop">${escapeHtml(shopName)}</div>` : ''}
    <div class="qr-card">
      <img class="qr" src="${dataUrl}" alt="Loyalty QR" />
    </div>
    <h1 class="headline">Scan &amp; Earn Rewards</h1>
    <p class="sub">Open your phone camera and scan the QR code to join our loyalty programme and start collecting stamps.</p>
    <div class="brand">POWERED BY STAMPOGEN</div>
  </div>
</body>
</html>`;
}

/**
 * Print only the QR poster (no admin page).
 * Uses a full-screen iframe so homepage / nav / date chrome from the app are not included.
 * Browser header/footer (date, URL) — turn off “Headers and footers” in the print dialog.
 */
export async function printLoyaltyQr({ value, shopName = '' }) {
  if (!value || typeof window === 'undefined') return;

  cleanupPrintShell();

  const dataUrl = await QRCode.toDataURL(value, {
    width: 640,
    margin: 2,
    color: { dark: '#021A54', light: '#FFFFFF' },
  });
  const logoUrl = `${window.location.origin}/logo.png`;
  const html = buildPosterHtml({ dataUrl, logoUrl, shopName });

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    html.stampogen-qr-printing,
    html.stampogen-qr-printing body {
      overflow: hidden !important;
    }
    #${SHELL_ID} {
      position: fixed;
      inset: 0;
      z-index: 2147483646;
      display: flex;
      flex-direction: column;
      background: #0f172a;
    }
    #${SHELL_ID} iframe {
      flex: 1;
      width: 100%;
      border: 0;
      background: #fff;
    }
    #${SHELL_ID} .actions {
      display: flex;
      gap: 10px;
      padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
      background: #0f172a;
    }
    #${SHELL_ID} .actions button {
      flex: 1;
      border: 0;
      border-radius: 12px;
      padding: 14px 12px;
      font-size: 15px;
      font-weight: 700;
    }
    #${SHELL_ID} .btn-print { background: #fff; color: #021A54; }
    #${SHELL_ID} .btn-close { background: #334155; color: #fff; }
    /* Hide the entire app if anything tries to print the parent document */
    @media print {
      @page { margin: 0; }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
      }
      body * { visibility: hidden !important; }
      #${SHELL_ID},
      #${SHELL_ID} * { visibility: visible !important; }
      #${SHELL_ID} {
        position: fixed !important;
        inset: 0 !important;
        background: #fff !important;
      }
      #${SHELL_ID} .actions { display: none !important; }
      #${SHELL_ID} iframe {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
      }
    }
  `;

  const shell = document.createElement('div');
  shell.id = SHELL_ID;
  shell.innerHTML = `
    <iframe title="Loyalty QR print"></iframe>
    <div class="actions">
      <button type="button" class="btn-close" data-action="close">Close</button>
      <button type="button" class="btn-print" data-action="print">Print QR</button>
    </div>
  `;

  document.head.appendChild(style);
  document.body.appendChild(shell);
  document.documentElement.classList.add('stampogen-qr-printing');

  const iframe = shell.querySelector('iframe');
  const doc = iframe.contentDocument;
  doc.open();
  doc.write(html);
  doc.close();

  const close = () => {
    cleanupPrintShell();
  };

  const runPrint = () => {
    try {
      // Print the iframe document only — not the admin homepage
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch {
      window.print();
    }
  };

  shell.querySelector('[data-action="close"]')?.addEventListener('click', close);
  shell.querySelector('[data-action="print"]')?.addEventListener('click', runPrint);

  await waitForDocImages(doc);
  await new Promise((r) => setTimeout(r, 150));
  runPrint();
}

export function buildJoinUrl(tenantSlug) {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/join/${tenantSlug}`;
  }
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  return `${base || 'http://localhost:3000'}/join/${tenantSlug}`;
}
