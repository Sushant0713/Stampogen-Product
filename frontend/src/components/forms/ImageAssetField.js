'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { ImagePlus, Link2, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';

const ACCEPTED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const MAX_BYTES = 5 * 1024 * 1024;
const ALPHA_CUTOFF = 12;
const COLOR_TOLERANCE = 28;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Unable to load image'));
    img.src = src;
  });
}

function colorDistance(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

/**
 * Detect corner background color (handles white/black padded logos).
 */
function sampleBackground(data, width, height) {
  const at = (x, y) => {
    const i = (y * width + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };
  const corners = [
    at(0, 0),
    at(width - 1, 0),
    at(0, height - 1),
    at(width - 1, height - 1),
  ];
  const opaque = corners.filter((c) => c[3] > ALPHA_CUTOFF);
  if (!opaque.length) return null;
  const avg = opaque
    .reduce(
      (acc, c) => [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]],
      [0, 0, 0]
    )
    .map((v) => Math.round(v / opaque.length));
  return avg;
}

function isBackgroundPixel(r, g, b, a, bg) {
  if (a <= ALPHA_CUTOFF) return true;
  if (!bg) return false;
  return colorDistance([r, g, b], bg) <= COLOR_TOLERANCE;
}

/**
 * Crop away transparent / solid-color margins so the logo content fills the frame.
 */
function trimImageEdges(sourceCanvas) {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const ctx = sourceCanvas.getContext('2d');
  if (!ctx || width < 2 || height < 2) return sourceCanvas;

  const { data } = ctx.getImageData(0, 0, width, height);
  const bg = sampleBackground(data, width, height);

  let top = height;
  let left = width;
  let right = 0;
  let bottom = 0;
  let found = false;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (!isBackgroundPixel(data[i], data[i + 1], data[i + 2], data[i + 3], bg)) {
        found = true;
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }

  if (!found) return sourceCanvas;

  const pad = Math.max(2, Math.round(Math.min(width, height) * 0.02));
  left = Math.max(0, left - pad);
  top = Math.max(0, top - pad);
  right = Math.min(width - 1, right + pad);
  bottom = Math.min(height - 1, bottom + pad);

  const cropW = right - left + 1;
  const cropH = bottom - top + 1;
  if (cropW >= width * 0.98 && cropH >= height * 0.98) {
    return sourceCanvas;
  }

  const cropped = document.createElement('canvas');
  cropped.width = cropW;
  cropped.height = cropH;
  const cropCtx = cropped.getContext('2d');
  if (!cropCtx) return sourceCanvas;
  cropCtx.drawImage(sourceCanvas, left, top, cropW, cropH, 0, 0, cropW, cropH);
  return cropped;
}

/**
 * Trim margins, then scale so the logo fills the target slot (contain + upscale).
 */
async function fitImageToBox(file, { maxWidth, maxHeight, quality }) {
  const original = await readFileAsDataUrl(file);
  const img = await loadImage(original);

  const source = document.createElement('canvas');
  source.width = img.width;
  source.height = img.height;
  const sourceCtx = source.getContext('2d');
  if (!sourceCtx) return original;
  sourceCtx.drawImage(img, 0, 0);

  const trimmed = trimImageEdges(source);
  const scale = Math.min(maxWidth / trimmed.width, maxHeight / trimmed.height);
  const drawW = Math.max(1, Math.round(trimmed.width * scale));
  const drawH = Math.max(1, Math.round(trimmed.height * scale));

  const preferPng =
    file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/gif';
  const canvas = document.createElement('canvas');
  canvas.width = drawW;
  canvas.height = drawH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return original;

  if (!preferPng) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, drawW, drawH);
  } else {
    ctx.clearRect(0, 0, drawW, drawH);
  }
  ctx.drawImage(trimmed, 0, 0, drawW, drawH);

  if (preferPng) {
    return canvas.toDataURL('image/png');
  }
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Logo / signature asset picker: upload from computer (click or drag-drop) or paste a URL.
 */
export function ImageAssetField({
  label,
  value = '',
  onChange,
  placeholder = 'https://...',
  hint = 'Auto-crops empty space and fills the slot',
  maxWidth = 800,
  maxHeight = 400,
  previewClassName = 'h-full w-full object-contain',
}) {
  const inputId = useId();
  const fileInputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(() =>
    value && !String(value).startsWith('data:') ? 'url' : 'upload'
  );

  const processFile = useCallback(
    async (file) => {
      if (!file) return;
      if (!ACCEPTED.includes(file.type)) {
        toast.error('Please choose a PNG, JPG, WEBP, or GIF image');
        return;
      }
      if (file.size > MAX_BYTES) {
        toast.error('Image must be 5MB or smaller');
        return;
      }

      try {
        setBusy(true);
        const dataUrl = await fitImageToBox(file, {
          maxWidth,
          maxHeight,
          quality: 0.92,
        });
        onChange(dataUrl);
        setMode('upload');
        toast.success('Logo cropped and sized');
      } catch (error) {
        toast.error(error?.message || 'Unable to process image');
      } finally {
        setBusy(false);
      }
    },
    [maxHeight, maxWidth, onChange]
  );

  const onDrop = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) await processFile(file);
  };

  const isDataUrl = String(value || '').startsWith('data:');

  return (
    <div className="space-y-2">
      {label ? (
        <div className="flex items-center justify-between gap-2">
          <label className="block text-[12px] font-semibold text-[#344054]">{label}</label>
          <div className="inline-flex rounded-md border border-[#D0D5DD] bg-[#F9FAFB] p-0.5">
            <button
              type="button"
              onClick={() => setMode('upload')}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold ${
                mode === 'upload' ? 'bg-white text-primary shadow-sm' : 'text-[#667085]'
              }`}
            >
              <Upload size={12} />
              Upload
            </button>
            <button
              type="button"
              onClick={() => setMode('url')}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold ${
                mode === 'url' ? 'bg-white text-primary shadow-sm' : 'text-[#667085]'
              }`}
            >
              <Link2 size={12} />
              URL
            </button>
          </div>
        </div>
      ) : null}

      {mode === 'upload' ? (
        <div
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragging(false);
          }}
          onDrop={onDrop}
          className={`rounded-xl border border-dashed px-3 py-4 transition ${
            dragging
              ? 'border-primary bg-primary-50'
              : 'border-[#D0D5DD] bg-[#F9FAFB] hover:border-primary/50'
          }`}
        >
          <input
            id={inputId}
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED.join(',')}
            className="hidden"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) processFile(file);
            }}
          />

          {value ? (
            <div className="flex items-center gap-3">
              <div className="flex h-20 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-lg border border-[#E4E7EC] bg-[#EEF2F6] px-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={value} alt={label || 'Preview'} className={previewClassName} />
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-8 items-center justify-center rounded-md border border-[#D0D5DD] px-2.5 text-[11px] font-semibold text-[#344054] hover:bg-white disabled:opacity-60"
                >
                  Replace
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onChange('')}
                  className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-[#FEE4E2] px-2.5 text-[11px] font-semibold text-[#D92D20] hover:bg-red-50 disabled:opacity-60"
                >
                  <Trash2 size={12} />
                  Clear
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 text-center disabled:opacity-60"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-primary shadow-sm">
                <ImagePlus size={18} />
              </span>
              <span className="text-[13px] font-semibold text-[#101828]">
                {busy ? 'Cropping & sizing…' : 'Drag & drop or click to upload'}
              </span>
              <span className="text-[11px] text-[#667085]">{hint}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <input
            className="h-10 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none placeholder:text-[#98A2B3] focus:border-primary focus:ring-1 focus:ring-primary"
            value={isDataUrl ? '' : value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
          />
          {value ? (
            <div className="flex items-center gap-3 rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] px-3 py-2">
              <div className="flex h-14 min-w-0 flex-1 items-center justify-center overflow-hidden rounded bg-[#EEF2F6] px-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={value} alt={label || 'Preview'} className={previewClassName} />
              </div>
              <button
                type="button"
                onClick={() => onChange('')}
                className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-[#D92D20] hover:bg-red-50"
              >
                <Trash2 size={12} />
                Clear
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
