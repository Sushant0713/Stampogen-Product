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

const PRINT_ROOT_ID = 'stampogen-qr-print-root';
const PRINT_STYLE_ID = 'stampogen-qr-print-style';

function cleanupPrintOverlay() {
  document.getElementById(PRINT_ROOT_ID)?.remove();
  document.getElementById(PRINT_STYLE_ID)?.remove();
}

function waitForImages(root) {
  const images = Array.from(root.querySelectorAll('img'));
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
          // Don't hang forever if a remote asset stalls (e.g. logo)
          setTimeout(finish, 2500);
        })
    )
  );
}

/**
 * Same-document print overlay — reliable on mobile (avoids "Preparing preview…" hang
 * from blank popup windows + document.write).
 */
export async function printLoyaltyQr({ value, shopName = '' }) {
  if (!value || typeof window === 'undefined') return;

  cleanupPrintOverlay();

  // Keep QR modest so mobile print preview stays fast
  const dataUrl = await QRCode.toDataURL(value, {
    width: 512,
    margin: 2,
    color: { dark: '#021A54', light: '#FFFFFF' },
  });
  const logoUrl = `${window.location.origin}/logo.png`;
  const shopBlock = shopName
    ? `<div class="shop">${escapeHtml(shopName)}</div>`
    : '';

  const style = document.createElement('style');
  style.id = PRINT_STYLE_ID;
  style.textContent = `
    #${PRINT_ROOT_ID} {
      position: fixed;
      inset: 0;
      z-index: 2147483646;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: #EEF2F7;
      overflow: auto;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    #${PRINT_ROOT_ID} .poster {
      width: min(100%, 420px);
      margin: auto;
      padding: 28px 22px;
      border: 2px solid #DCE5F5;
      border-radius: 24px;
      background: #fff;
      text-align: center;
      color: #021A54;
      font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif;
    }
    #${PRINT_ROOT_ID} .logo {
      width: 160px;
      height: auto;
      object-fit: contain;
      margin: 0 auto 12px;
      display: block;
    }
    #${PRINT_ROOT_ID} .eyebrow {
      display: inline-block;
      margin: 0 0 10px;
      padding: 6px 12px;
      border-radius: 999px;
      background: #EAF1FF;
      color: #1649AF;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: .12em;
    }
    #${PRINT_ROOT_ID} .shop {
      margin: 0 0 12px;
      font-size: 18px;
      font-weight: 800;
      line-height: 1.25;
    }
    #${PRINT_ROOT_ID} .qr-card {
      display: inline-block;
      padding: 10px;
      border: 1px solid #DFE7F4;
      border-radius: 16px;
      background: #fff;
    }
    #${PRINT_ROOT_ID} .qr {
      display: block;
      width: 240px;
      height: 240px;
    }
    #${PRINT_ROOT_ID} .headline {
      margin: 14px 0 6px;
      font-size: 22px;
      font-weight: 800;
      line-height: 1.2;
    }
    #${PRINT_ROOT_ID} .sub {
      margin: 0 auto;
      max-width: 320px;
      font-size: 13px;
      line-height: 1.45;
      font-weight: 600;
      color: #64748B;
    }
    #${PRINT_ROOT_ID} .brand {
      margin-top: 14px;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: .14em;
      color: #A0AEC0;
    }
    #${PRINT_ROOT_ID} .screen-actions {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 2147483647;
      display: flex;
      gap: 10px;
      padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
      background: rgba(255,255,255,.96);
      border-top: 1px solid #E2E8F0;
    }
    #${PRINT_ROOT_ID} .screen-actions button {
      flex: 1;
      border: 0;
      border-radius: 12px;
      padding: 14px 12px;
      font-size: 15px;
      font-weight: 700;
    }
    #${PRINT_ROOT_ID} .btn-print {
      background: #021A54;
      color: #fff;
    }
    #${PRINT_ROOT_ID} .btn-close {
      background: #F1F5F9;
      color: #021A54;
    }
    @media print {
      @page { margin: 12mm; }
      html, body {
        background: #fff !important;
        height: auto !important;
        overflow: visible !important;
      }
      body > *:not(#${PRINT_ROOT_ID}) {
        display: none !important;
      }
      #${PRINT_ROOT_ID} {
        position: static !important;
        inset: auto !important;
        padding: 0 !important;
        background: #fff !important;
        overflow: visible !important;
        display: block !important;
      }
      #${PRINT_ROOT_ID} .screen-actions {
        display: none !important;
      }
      #${PRINT_ROOT_ID} .poster {
        width: 100% !important;
        max-width: none !important;
        border-radius: 0 !important;
        box-shadow: none !important;
      }
      #${PRINT_ROOT_ID} .qr {
        width: 90mm !important;
        height: 90mm !important;
      }
    }
  `;

  const root = document.createElement('div');
  root.id = PRINT_ROOT_ID;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Print loyalty QR');
  root.innerHTML = `
    <div class="poster">
      <img class="logo" src="${logoUrl}" alt="Stampogen" />
      <div class="eyebrow">LOYALTY REWARDS</div>
      ${shopBlock}
      <div class="qr-card">
        <img class="qr" src="${dataUrl}" alt="Loyalty QR code" />
      </div>
      <h1 class="headline">Scan &amp; Earn Rewards</h1>
      <p class="sub">Open your phone camera and scan the QR code to join our loyalty programme and start collecting stamps.</p>
      <div class="brand">POWERED BY STAMPOGEN</div>
    </div>
    <div class="screen-actions">
      <button type="button" class="btn-close" data-action="close">Close</button>
      <button type="button" class="btn-print" data-action="print">Print</button>
    </div>
  `;

  document.head.appendChild(style);
  document.body.appendChild(root);

  const close = () => {
    window.removeEventListener('afterprint', onAfterPrint);
    cleanupPrintOverlay();
  };
  const onAfterPrint = () => close();

  root.querySelector('[data-action="close"]')?.addEventListener('click', close);
  root.querySelector('[data-action="print"]')?.addEventListener('click', () => {
    window.print();
  });

  await waitForImages(root);
  window.addEventListener('afterprint', onAfterPrint);

  // Open system print UI immediately (same document = works on mobile)
  window.print();
}

export function buildJoinUrl(tenantSlug) {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/join/${tenantSlug}`;
  }
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  return `${base || 'http://localhost:3000'}/join/${tenantSlug}`;
}
