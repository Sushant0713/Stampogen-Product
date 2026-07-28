'use client';

import { useState } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';

/**
 * Terms acceptance for registration.
 * Content stays hidden until "Terms and Conditions" is clicked; Back returns to the checkbox.
 */
export function TermsAcceptanceBlock({
  terms,
  register,
  error = '',
  id = 'acceptTerms',
  loading = false,
}) {
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <div className="rounded-[10px] border border-[#EAECF0] bg-[#F9FAFB] px-4 py-3 text-[14px] text-[#667085]">
        Loading terms and conditions…
      </div>
    );
  }

  if (!terms || terms.isActive === false || terms.requireAcceptance === false) {
    return null;
  }

  if (open) {
    return (
      <div className="overflow-hidden rounded-[12px] border border-[#D0D5DD] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex items-center gap-2 border-b border-[#F2F4F7] bg-[#F9FAFB] px-3.5 py-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-[#021A54] transition hover:bg-[#EAF2FF]"
          >
            <ArrowLeft size={15} />
            Back
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-[#101828]">
              Terms and Conditions
            </p>
            <p className="truncate text-[11px] text-[#667085]">
              Version {terms.version || '1.0'}
              {terms.effectiveDate ? ` · Effective ${terms.effectiveDate}` : ''}
            </p>
          </div>
        </div>

        <div className="max-h-[220px] overflow-y-auto px-3.5 py-3">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-[#667085]">
            {terms.title || 'Terms and Conditions'}
          </p>
          <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#344054]">
            {terms.content || 'No terms content available.'}
          </div>
        </div>

        <div className="border-t border-[#F2F4F7] bg-[#F9FAFB] px-3.5 py-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-9 w-full rounded-lg bg-[#021A54] text-[13px] font-semibold text-white transition hover:bg-[#01133F]"
          >
            Back to registration
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className={`flex cursor-pointer items-start gap-2.5 rounded-[10px] border px-4 py-3.5 text-[16px] leading-snug text-[#101828] transition ${
          error
            ? 'border-red-500 bg-red-50'
            : 'border-[#D0D5DD] bg-white hover:border-[#021A54]/40'
        }`}
      >
        <input
          id={id}
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#D0D5DD] text-[#021A54] focus:ring-[#021A54]"
          {...register}
        />
        <span className="min-w-0">
          I have read and agree to the{' '}
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setOpen(true);
            }}
            className="inline-flex items-center gap-1 font-semibold text-[#021A54] underline decoration-[#021A54]/30 underline-offset-2 hover:decoration-[#021A54]"
          >
            <FileText size={13} className="shrink-0" />
            Terms and Conditions
          </button>
          <span className="text-red-500"> *</span>
        </span>
      </label>
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  );
}

export function isTermsAcceptanceRequired(terms) {
  return Boolean(terms && terms.isActive !== false && terms.requireAcceptance !== false);
}
