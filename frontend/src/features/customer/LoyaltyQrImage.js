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

export function buildJoinUrl(tenantSlug) {
  if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_APP_URL) {
    return `${window.location.origin}/join/${tenantSlug}`;
  }
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  return `${base || 'http://localhost:3000'}/join/${tenantSlug}`;
}
