'use client';

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

const PRIMARY = '#021A54';
const QR_CENTER_LOGO = '/icon1.png';
const PRINT_SHELL_ID = 'stampogen-platform-qr-print';

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugFilename(title) {
  return `${String(title || 'qr')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'qr'}.png`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Unable to load logo'));
    img.src = src;
  });
}

function drawCenterLogo(ctx, canvasSize, logo) {
  const maxLogo = Math.round(canvasSize * 0.26);
  const naturalW = logo.naturalWidth || logo.width || 1;
  const naturalH = logo.naturalHeight || logo.height || 1;
  const scale = Math.min(maxLogo / naturalW, maxLogo / naturalH);
  const logoW = Math.round(naturalW * scale);
  const logoH = Math.round(naturalH * scale);
  const pad = Math.max(6, Math.round(maxLogo * 0.12));
  const boxW = logoW + pad * 2;
  const boxH = logoH + pad * 2;
  const x = (canvasSize - boxW) / 2;
  const y = (canvasSize - boxH) / 2;
  const radius = Math.max(8, Math.round(Math.min(boxW, boxH) * 0.18));

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + boxW, y, x + boxW, y + boxH, radius);
  ctx.arcTo(x + boxW, y + boxH, x, y + boxH, radius);
  ctx.arcTo(x, y + boxH, x, y, radius);
  ctx.arcTo(x, y, x + boxW, y, radius);
  ctx.closePath();
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(2, 26, 84, 0.14)';
  ctx.shadowBlur = Math.max(4, Math.round(canvasSize * 0.012));
  ctx.shadowOffsetY = 1;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.clip();
  ctx.drawImage(logo, x + pad, y + pad, logoW, logoH);
  ctx.restore();
}

async function renderQrWithLogo(targetCanvas, value, size, margin = 1) {
  await QRCode.toCanvas(targetCanvas, value, {
    width: size,
    margin,
    errorCorrectionLevel: 'H',
    color: { dark: PRIMARY, light: '#FFFFFF' },
  });

  try {
    const logo = await loadImage(QR_CENTER_LOGO);
    const ctx = targetCanvas.getContext('2d');
    if (ctx) drawCenterLogo(ctx, targetCanvas.width, logo);
  } catch {
    // Keep plain QR if logo fails to load
  }

  return targetCanvas;
}

async function qrDataUrlWithLogo(value, size = 512, margin = 2) {
  const canvas = document.createElement('canvas');
  await renderQrWithLogo(canvas, value, size, margin);
  return canvas.toDataURL('image/png');
}

function QrPreview({ value, size = 160, className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return undefined;
    let cancelled = false;

    renderQrWithLogo(canvasRef.current, value, size, 1).catch(() => {
      if (!cancelled && canvasRef.current) {
        QRCode.toCanvas(canvasRef.current, value, {
          width: size,
          margin: 1,
          errorCorrectionLevel: 'H',
          color: { dark: PRIMARY, light: '#FFFFFF' },
        }).catch(() => {});
      }
    });

    return () => {
      cancelled = true;
    };
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
  const dataUrl = await qrDataUrlWithLogo(url, 512, 2);
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename || 'stampogen-qr.png';
  link.click();
}

function cleanupPlatformQrPrint() {
  document.getElementById(PRINT_SHELL_ID)?.remove();
  document.documentElement.classList.remove('stampogen-platform-qr-printing');
}

function trackValue(item) {
  return item?.scanUrl || item?.url || '';
}

async function printPlatformQr({ url, displayUrl = '', title = '', note = '' }) {
  if (!url || typeof window === 'undefined') return;

  cleanupPlatformQrPrint();

  const dataUrl = await qrDataUrlWithLogo(url, 720, 2);
  const logoUrl = `${window.location.origin}/logo.png`;
  const displayTitle = String(title || 'Scan to visit').trim();
  const displayNote = String(note || '').trim();
  const urlLabel = String(displayUrl || url).trim();

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(displayTitle)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      min-height: 100%;
      background: #EEF2F7;
      color: #021A54;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18px;
    }
    .poster {
      width: min(420px, 100%);
      min-height: min(640px, calc(100vh - 36px));
      margin: 0 auto;
      padding: 28px 24px 22px;
      border-radius: 22px;
      background:
        radial-gradient(circle at 12% 8%, rgba(46,144,250,0.12), transparent 36%),
        radial-gradient(circle at 88% 92%, rgba(2,26,84,0.08), transparent 40%),
        #FFFFFF;
      border: 1px solid #D9E2F2;
      box-shadow: 0 18px 40px rgba(2, 26, 84, 0.12);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      text-align: center;
    }
    .top { width: 100%; }
    .logo {
      display: block;
      width: 150px;
      max-width: 55%;
      height: auto;
      margin: 0 auto 14px;
      object-fit: contain;
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 999px;
      background: #EEF2FF;
      color: #021A54;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .title {
      margin: 14px 0 0;
      font-size: 28px;
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -0.03em;
      color: #021A54;
    }
    .mid { width: 100%; }
    .qr-frame {
      width: fit-content;
      max-width: 100%;
      margin: 0 auto;
      padding: 14px;
      border-radius: 20px;
      background: linear-gradient(165deg, #021A54 0%, #0B3A7A 100%);
      box-shadow: 0 14px 28px rgba(2, 26, 84, 0.22);
    }
    .qr-card {
      padding: 14px;
      border-radius: 14px;
      background: #fff;
    }
    .qr {
      display: block;
      width: min(240px, 62vw);
      height: auto;
      aspect-ratio: 1 / 1;
    }
    .scan {
      margin: 16px 0 0;
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #021A54;
    }
    .hint {
      margin: 6px auto 0;
      max-width: 300px;
      font-size: 13px;
      line-height: 1.45;
      font-weight: 600;
      color: #64748B;
    }
    .url-pill {
      display: inline-block;
      margin-top: 14px;
      max-width: 100%;
      padding: 8px 12px;
      border-radius: 10px;
      background: #F8FAFC;
      border: 1px solid #E4E7EC;
      color: #344054;
      font-size: 12px;
      font-weight: 600;
      word-break: break-all;
    }
    .note {
      margin: 10px auto 0;
      max-width: 320px;
      font-size: 13px;
      line-height: 1.4;
      color: #475467;
    }
    .bottom {
      width: 100%;
      padding-top: 8px;
      border-top: 1px solid #E4E7EC;
    }
    .brand {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.16em;
      color: #98A2B3;
    }
    @media print {
      @page { size: A4 portrait; margin: 0; }
      html, body {
        width: 210mm;
        height: 297mm;
        background: #fff !important;
        overflow: hidden !important;
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
        max-width: none;
        min-height: 277mm;
        margin: 0;
        padding: 16mm 14mm 12mm;
        border-radius: 14px;
        box-shadow: none;
        gap: 8mm;
        justify-content: space-between;
      }
      .logo { width: 52mm; margin-bottom: 4mm; }
      .eyebrow { font-size: 9pt; padding: 2mm 4mm; }
      .title { font-size: 22pt; margin-top: 4mm; }
      .qr-frame { padding: 3.5mm; border-radius: 12px; }
      .qr-card { padding: 3.5mm; border-radius: 9px; }
      .qr { width: 92mm; height: 92mm; }
      .scan { font-size: 16pt; margin-top: 5mm; }
      .hint { max-width: 130mm; font-size: 10pt; }
      .url-pill { margin-top: 4mm; font-size: 9pt; padding: 2mm 3mm; }
      .note { max-width: 130mm; font-size: 10pt; }
      .bottom { padding-top: 4mm; }
      .brand { font-size: 8pt; }
    }
  </style>
</head>
<body>
  <div class="poster">
    <div class="top">
      <img class="logo" src="${logoUrl}" alt="Stampogen" />
      <div class="eyebrow">Scan to open</div>
      <h1 class="title">${escapeHtml(displayTitle)}</h1>
    </div>
    <div class="mid">
      <div class="qr-frame">
        <div class="qr-card">
          <img class="qr" src="${dataUrl}" alt="QR code" />
        </div>
      </div>
      <p class="scan">Point your camera here</p>
      <p class="hint">Open your phone camera and scan this code to visit the page instantly.</p>
      <div class="url-pill">${escapeHtml(urlLabel)}</div>
      ${displayNote ? `<p class="note">${escapeHtml(displayNote)}</p>` : ''}
    </div>
    <div class="bottom">
      <div class="brand">POWERED BY STAMPOGEN</div>
    </div>
  </div>
</body>
</html>`;

  const style = document.createElement('style');
  style.textContent = `
    html.stampogen-platform-qr-printing,
    html.stampogen-platform-qr-printing body { overflow: hidden !important; }
    #${PRINT_SHELL_ID} {
      position: fixed; inset: 0; z-index: 2147483646;
      display: flex; flex-direction: column; background: #0B1220;
    }
    #${PRINT_SHELL_ID} iframe {
      flex: 1 1 auto; width: 100%; min-height: 0; border: 0; background: #EEF2F7;
    }
    #${PRINT_SHELL_ID} .actions {
      flex: 0 0 auto; display: flex; gap: 10px;
      padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
      background: #0B1220;
    }
    #${PRINT_SHELL_ID} .actions button {
      flex: 1; border: 0; border-radius: 12px; padding: 14px 12px;
      font-size: 15px; font-weight: 700; cursor: pointer;
    }
    #${PRINT_SHELL_ID} .btn-print { background: #fff; color: #021A54; }
    #${PRINT_SHELL_ID} .btn-close { background: #334155; color: #fff; }
    @media print {
      @page { margin: 0; }
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

  await new Promise((r) => setTimeout(r, 250));
  runPrint();
}

export {
  PRIMARY,
  QrPreview,
  downloadQrPng,
  printPlatformQr,
  trackValue,
  slugFilename,
  qrDataUrlWithLogo,
};
