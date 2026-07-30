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

function safeFileName(shopName) {
  const base = String(shopName || 'loyalty-qr')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${base || 'loyalty-qr'}.png`;
}

/** Mobile Safari/Chrome often print the parent page from a hidden iframe. */
function prefersQrDownload() {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
  const narrow = window.matchMedia?.('(max-width: 768px)')?.matches;
  return Boolean(mobileUa || (coarse && narrow));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function buildQrPosterPng({ value, shopName = '' }) {
  const qrDataUrl = await QRCode.toDataURL(value, {
    width: 900,
    margin: 2,
    color: { dark: '#021A54', light: '#FFFFFF' },
  });

  const width = 1080;
  const height = 1520;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#F7FAFF');
  grad.addColorStop(0.35, '#FFFFFF');
  grad.addColorStop(1, '#FFFFFF');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Soft orbs
  ctx.fillStyle = '#E8F0FF';
  ctx.beginPath();
  ctx.arc(width - 40, -40, 220, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(40, height + 20, 160, 0, Math.PI * 2);
  ctx.fill();

  // Card border
  ctx.strokeStyle = '#DCE5F5';
  ctx.lineWidth = 6;
  roundRect(ctx, 48, 48, width - 96, height - 96, 48);
  ctx.stroke();

  let y = 140;

  try {
    const logo = await loadImage(`${window.location.origin}/logo.png`);
    const logoW = 360;
    const logoH = (logo.height / logo.width) * logoW;
    ctx.drawImage(logo, (width - logoW) / 2, y, logoW, logoH);
    y += logoH + 48;
  } catch {
    y += 20;
  }

  // Eyebrow pill
  const eyebrow = 'LOYALTY REWARDS';
  ctx.font = '800 28px ui-sans-serif, system-ui, -apple-system, Segoe UI, Arial, sans-serif';
  const eyebrowW = ctx.measureText(eyebrow).width + 56;
  ctx.fillStyle = '#EAF1FF';
  roundRect(ctx, (width - eyebrowW) / 2, y, eyebrowW, 56, 28);
  ctx.fill();
  ctx.fillStyle = '#1649AF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(eyebrow, width / 2, y + 28);
  y += 90;

  if (shopName) {
    ctx.fillStyle = '#021A54';
    ctx.font = '800 44px ui-sans-serif, system-ui, -apple-system, Segoe UI, Arial, sans-serif';
    wrapCenteredText(ctx, shopName, width / 2, y, width - 160, 52);
    y += 90;
  }

  // QR card
  const qrSize = 720;
  const qrX = (width - qrSize) / 2;
  const pad = 28;
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(2, 26, 84, 0.14)';
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 18;
  roundRect(ctx, qrX - pad, y, qrSize + pad * 2, qrSize + pad * 2, 36);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = '#DFE7F4';
  ctx.lineWidth = 2;
  roundRect(ctx, qrX - pad, y, qrSize + pad * 2, qrSize + pad * 2, 36);
  ctx.stroke();

  const qrImg = await loadImage(qrDataUrl);
  ctx.drawImage(qrImg, qrX, y + pad, qrSize, qrSize);
  y += qrSize + pad * 2 + 56;

  ctx.fillStyle = '#021A54';
  ctx.font = '800 52px ui-sans-serif, system-ui, -apple-system, Segoe UI, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Scan & Earn Rewards', width / 2, y);
  y += 56;

  ctx.fillStyle = '#64748B';
  ctx.font = '600 28px ui-sans-serif, system-ui, -apple-system, Segoe UI, Arial, sans-serif';
  wrapCenteredText(
    ctx,
    'Open your phone camera and scan the QR code to join our loyalty programme.',
    width / 2,
    y,
    width - 180,
    38
  );
  y += 110;

  ctx.fillStyle = '#A0AEC0';
  ctx.font = '800 22px ui-sans-serif, system-ui, -apple-system, Segoe UI, Arial, sans-serif';
  ctx.fillText('POWERED BY STAMPOGEN', width / 2, y);

  return canvas.toDataURL('image/png');
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapCenteredText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(/\s+/).filter(Boolean);
  let line = '';
  let cy = y;
  for (let i = 0; i < words.length; i += 1) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = words[i];
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}

async function downloadOrSharePng(dataUrl, fileName) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const file = new File([blob], fileName, { type: 'image/png' });

  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Loyalty QR',
        text: 'Stampogen loyalty QR',
      });
      return 'share';
    } catch (err) {
      // User cancelled share sheet — not an error for UX
      if (err?.name === 'AbortError') return 'cancelled';
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();

  // iOS often ignores download — open image so user can long-press Save
  const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent || '');
  if (isIOS) {
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
  }

  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  return 'download';
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

async function printViaPopup({ value, shopName = '' }) {
  const dataUrl = await QRCode.toDataURL(value, {
    width: 900,
    margin: 2,
    color: { dark: '#021A54', light: '#FFFFFF' },
  });
  const logoUrl = `${window.location.origin}/logo.png`;
  const html = buildPrintHtml({ dataUrl, logoUrl, shopName });

  const win = window.open('', '_blank', 'noopener,noreferrer,width=820,height=1100');
  if (!win) {
    // Popup blocked — fall back to download
    const png = await buildQrPosterPng({ value, shopName });
    return downloadOrSharePng(png, safeFileName(shopName));
  }

  win.document.open();
  win.document.write(html);
  win.document.close();

  await new Promise((resolve) => {
    const images = Array.from(win.document.images || []);
    if (!images.length) {
      resolve();
      return;
    }
    Promise.all(
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
    ).then(resolve);
  });

  win.focus();
  win.print();
  // Close after print dialog (best-effort; some browsers ignore)
  setTimeout(() => {
    try {
      win.close();
    } catch {
      /* ignore */
    }
  }, 500);
  return 'print';
}

/**
 * Desktop: open a print poster.
 * Mobile: download / share a PNG (hidden iframe print dumps the whole admin page).
 * @returns {'print'|'download'|'share'|'cancelled'}
 */
export async function printLoyaltyQr({ value, shopName = '' }) {
  if (!value || typeof window === 'undefined') return 'cancelled';

  if (prefersQrDownload()) {
    const png = await buildQrPosterPng({ value, shopName });
    return downloadOrSharePng(png, safeFileName(shopName));
  }

  return printViaPopup({ value, shopName });
}

export function buildJoinUrl(tenantSlug) {
  // Prefer the domain the admin is currently on so QR matches after a domain cutover
  // even if NEXT_PUBLIC_APP_URL was baked with the old host at build time.
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/join/${tenantSlug}`;
  }
  // Fallback (SSR / print): NEXT_PUBLIC_APP_URL — e.g. https://app.stampogen.in/join/{slug}
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  return `${base || 'http://localhost:3000'}/join/${tenantSlug}`;
}
