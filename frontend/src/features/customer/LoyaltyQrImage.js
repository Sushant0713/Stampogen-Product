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

function buildPrintHtml({ dataUrl, logoUrl, shopName }) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Loyalty QR</title>
    <style>
      @page { size: A4 portrait; margin: 0; }
      * { box-sizing: border-box; }
      html, body {
        width: 210mm;
        min-height: 297mm;
        margin: 0;
        padding: 0;
      }
      body {
        padding: 12mm;
        font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif;
        color: #021A54;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .poster {
        position: relative;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        width: 186mm;
        min-height: 273mm;
        padding: 38px 34px;
        border: 2px solid #DCE5F5;
        border-radius: 28px;
        background: linear-gradient(180deg, #F7FAFF 0%, #FFFFFF 36%, #FFFFFF 100%);
        text-align: center;
      }
      .orb {
        position: absolute;
        border-radius: 999px;
        background: #E8F0FF;
        z-index: 0;
      }
      .orb-one { width: 180px; height: 180px; top: -90px; right: -70px; }
      .orb-two { width: 120px; height: 120px; bottom: -60px; left: -48px; }
      .content {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        width: 100%;
      }
      .logo { width: 210px; height: auto; object-fit: contain; }
      .shop {
        max-width: 90%;
        font-size: 25px;
        line-height: 1.2;
        font-weight: 800;
      }
      .eyebrow {
        padding: 7px 14px;
        border-radius: 999px;
        background: #EAF1FF;
        color: #1649AF;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .12em;
      }
      .qr-card {
        padding: 13px;
        border: 1px solid #DFE7F4;
        border-radius: 24px;
        background: #FFFFFF;
        box-shadow: 0 18px 42px rgba(2, 26, 84, .14);
      }
      .qr { display: block; width: 102mm; height: 102mm; border-radius: 14px; }
      .headline { font-size: 31px; line-height: 1.15; font-weight: 850; margin: 4px 0 0; }
      .sub {
        max-width: 420px;
        font-size: 15px;
        line-height: 1.55;
        font-weight: 600;
        color: #64748B;
        margin: 0;
      }
      .steps {
        display: flex;
        align-items: center;
        gap: 9px;
        margin-top: 2px;
        color: #31578F;
        font-size: 12px;
        font-weight: 750;
      }
      .dot { width: 4px; height: 4px; border-radius: 50%; background: #A9BBDD; }
      .brand {
        margin-top: 4px;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: .16em;
        color: #A0AEC0;
      }
      @media screen {
        body { background: #EEF2F7; }
      }
    </style>
  </head>
  <body>
    <div class="poster">
      <div class="orb orb-one"></div>
      <div class="orb orb-two"></div>
      <div class="content">
        <img class="logo" src="${logoUrl}" alt="Stampogen" />
        <div class="eyebrow">LOYALTY REWARDS</div>
        ${shopName ? `<div class="shop">${escapeHtml(shopName)}</div>` : ''}
        <div class="qr-card">
          <img class="qr" src="${dataUrl}" alt="Loyalty QR code" />
        </div>
        <h1 class="headline">Scan &amp; Earn Rewards</h1>
        <p class="sub">Open your phone camera and scan the QR code to join our loyalty programme and start collecting stamps.</p>
        <div class="steps">
          <span>Scan</span><span class="dot"></span>
          <span>Collect stamps</span><span class="dot"></span>
          <span>Get rewarded</span>
        </div>
        <div class="brand">POWERED BY STAMPOGEN</div>
      </div>
    </div>
  </body>
</html>`;
}

function waitForImages(doc) {
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
          image.onload = done;
          image.onerror = done;
        })
    )
  );
}

/**
 * Opens the loyalty QR poster print dialog (mobile + desktop).
 * Uses a real browser tab/window so mobile does not print the admin page.
 */
export async function printLoyaltyQr({ value, shopName = '' }) {
  if (!value || typeof window === 'undefined') return;

  const dataUrl = await QRCode.toDataURL(value, {
    width: 900,
    margin: 2,
    color: { dark: '#021A54', light: '#FFFFFF' },
  });
  const logoUrl = `${window.location.origin}/logo.png`;
  const html = buildPrintHtml({ dataUrl, logoUrl, shopName });

  // Do not use "noopener" — it makes window.open return null and we cannot call print().
  let win = window.open('', '_blank', 'width=820,height=1100');

  if (!win) {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    win = window.open(url, '_blank');
    if (!win) {
      // Last resort: same tab (user can use browser back after print)
      window.location.assign(url);
      return;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } else {
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  await waitForImages(win.document);
  // Small delay helps mobile browsers finish layout before print
  await new Promise((r) => setTimeout(r, 300));

  try {
    win.focus();
    win.print();
  } catch {
    /* ignore */
  }

  const closeLater = () => {
    try {
      win.close();
    } catch {
      /* ignore */
    }
  };
  win.addEventListener?.('afterprint', closeLater);
  setTimeout(closeLater, 60_000);
}

export function buildJoinUrl(tenantSlug) {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/join/${tenantSlug}`;
  }
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  return `${base || 'http://localhost:3000'}/join/${tenantSlug}`;
}
