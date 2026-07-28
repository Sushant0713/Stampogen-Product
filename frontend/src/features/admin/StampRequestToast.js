'use client';

import toast from 'react-hot-toast';
import { loyaltyService } from '@/services/loyalty.service';
import { getErrorMessage } from '@/utils';

function initialsOf(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatRequestedAt(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Top toast with full stamp-request details + Approve / Reject.
 */
export function showStampRequestToast(request) {
  if (!request?.id) return;

  const toastId = `stamp-req-${request.id}`;
  toast.dismiss(toastId);

  toast.custom(
    (t) => (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } w-[min(100vw-1.5rem,380px)] overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_18px_40px_rgba(2,26,84,0.18)]`}
      >
        <div className="border-b border-[#F1F5F9] bg-[#021A54] px-4 py-2.5">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-white/80">
            New stamp request
          </p>
        </div>

        <div className="flex gap-3 px-4 py-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#021A54] text-sm font-extrabold text-white">
            {initialsOf(request.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-extrabold text-[#021A54]">
              {request.name || 'Customer'}
            </p>
            <p className="mt-0.5 truncate text-[12px] font-bold text-[#475569]">
              {request.offer || request.reward || 'Offer'}
            </p>
            <p className="mt-1 text-[11px] font-medium leading-snug text-[#64748B]">
              {request.progressAfterApprove
                ? `After approve: ${request.progressAfterApprove}`
                : `${request.stamps || 0}/${request.stampsRequired || 5} stamps`}
              {request.phone ? ` · ${request.phone}` : ''}
              {!request.phone && request.email ? ` · ${request.email}` : ''}
            </p>
            {request.email && request.phone ? (
              <p className="mt-0.5 truncate text-[11px] text-[#94A3B8]">{request.email}</p>
            ) : null}
            {request.requestedAt ? (
              <p className="mt-0.5 text-[10px] font-semibold text-[#94A3B8]">
                {formatRequestedAt(request.requestedAt)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex gap-2 border-t border-[#F1F5F9] px-4 py-3">
          <button
            type="button"
            className="flex-1 rounded-xl border border-[#FECACA] bg-[#FEF2F2] py-2.5 text-[12px] font-bold text-[#DC2626]"
            onClick={async () => {
              try {
                await loyaltyService.adminRejectStampRequest(request.id);
                toast.dismiss(t.id);
                toast.success(`Rejected ${request.name || 'customer'}`);
                window.dispatchEvent(
                  new CustomEvent('stampogen:stamp-request-resolved', {
                    detail: { id: request.id, action: 'reject' },
                  })
                );
              } catch (error) {
                toast.error(getErrorMessage(error, 'Unable to reject'));
              }
            }}
          >
            Reject
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl bg-gradient-to-br from-[#021A54] to-[#3B82F6] py-2.5 text-[12px] font-bold text-white"
            onClick={async () => {
              try {
                const { data } = await loyaltyService.adminApproveStampRequest(request.id);
                toast.dismiss(t.id);
                toast.success(data.message || `Approved ${request.name || 'customer'}`);
                window.dispatchEvent(
                  new CustomEvent('stampogen:stamp-request-resolved', {
                    detail: { id: request.id, action: 'approve' },
                  })
                );
              } catch (error) {
                toast.error(getErrorMessage(error, 'Unable to approve'));
              }
            }}
          >
            Approve
          </button>
        </div>
      </div>
    ),
    {
      id: toastId,
      duration: 20000,
      position: 'top-center',
    }
  );
}
