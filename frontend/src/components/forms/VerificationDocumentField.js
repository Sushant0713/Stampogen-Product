'use client';

import { useId, useRef, useState } from 'react';
import { FileUp, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const ACCEPTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 5 * 1024 * 1024;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload Student ID or Aadhaar as a data URL for affiliate verification.
 */
export function VerificationDocumentField({
  label,
  value = '',
  fileName = '',
  onChange,
  error = '',
  hint = 'JPG, PNG, WEBP, or PDF · max 5MB',
  required = false,
}) {
  const inputId = useId();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      toast.error('Upload a JPG, PNG, WEBP, or PDF file');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('File must be 5MB or smaller');
      return;
    }

    try {
      setBusy(true);
      const dataUrl = await readFileAsDataUrl(file);
      onChange({
        verificationDocument: dataUrl,
        verificationDocumentName: file.name,
      });
    } catch {
      toast.error('Unable to read that file');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-[16px] font-semibold text-[#101828]">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>

      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-[10px] border border-[#D0D5DD] bg-[#F9FAFB] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-[16px] font-medium text-[#101828]">
              {fileName || 'Document uploaded'}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#D0D5DD] bg-white text-[#667085] transition hover:text-red-600"
            aria-label="Remove document"
            onClick={() =>
              onChange({ verificationDocument: '', verificationDocumentName: '' })
            }
          >
            <Trash2 size={17} />
          </button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={`flex h-[52px] cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-dashed border-[#D0D5DD] bg-white px-4 text-[16px] text-[#667085] transition hover:border-[#021A54] hover:text-[#021A54] ${
            error ? 'border-red-500' : ''
          } ${busy ? 'pointer-events-none opacity-60' : ''}`}
        >
          <FileUp size={16} />
          {busy ? 'Uploading…' : `Upload ${label}`}
        </label>
      )}

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="sr-only"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />

      {error ? (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      ) : (
        <p className="mt-1.5 text-[14px] text-[#667085]">{hint}</p>
      )}
    </div>
  );
}
