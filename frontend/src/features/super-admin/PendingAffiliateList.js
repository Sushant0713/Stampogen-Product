'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  FileSignature,
  Handshake,
  PauseCircle,
  PlayCircle,
  Search,
  Video,
  X,
  XCircle,
} from 'lucide-react';
import { userService } from '@/services/user.service';
import { ROLES } from '@/constants';
import {
  AFFILIATE_TYPES,
  getAffiliateTypeLabel,
  getAffiliateExtraSummary,
  getVerificationDocLabel,
} from '@/constants/affiliateTypes';
import {
  AFFILIATE_APPROVAL_STATUS,
  getAffiliateApprovalLabel,
} from '@/constants/affiliateApproval';
import { getErrorMessage } from '@/utils';

const PAGE_SIZE = 10;
const ACCENT = '#021A54';

const STAGE_OPTIONS = [
  { value: 'pending', label: 'All pending' },
  { value: AFFILIATE_APPROVAL_STATUS.PENDING_REVIEW, label: 'Awaiting review' },
  { value: AFFILIATE_APPROVAL_STATUS.ON_HOLD, label: 'On hold' },
  { value: AFFILIATE_APPROVAL_STATUS.INTERVIEW_SCHEDULED, label: 'Interview scheduled' },
];

const REJECT_REASON_PRESETS = [
  'Your application does not currently meet our affiliate partner eligibility criteria.',
  'After reviewing your application, we are unable to approve your affiliate partnership at this time.',
  'The information provided is incomplete or could not be verified.',
  'Your profile does not align with our current affiliate program requirements.',
  'We could not verify the authenticity of the submitted details.',
  'Duplicate or previously submitted application detected.',
  'Required supporting documents are missing or invalid.',
  'Your application has been rejected after our verification process.',
];

const REJECT_REASON_CUSTOM = '__custom__';

const inputClass =
  'h-10 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none focus:border-[#021A54] focus:ring-1 focus:ring-[#021A54]';

const textareaClass =
  'min-h-[88px] w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#101828] outline-none focus:border-[#021A54] focus:ring-1 focus:ring-[#021A54]';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function toDatetimeLocalValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function displayName(user) {
  return (
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    '—'
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-[#F2F4F7] py-2.5 last:border-b-0">
      <p className="text-[13px] font-medium text-[#667085]">{label}</p>
      <p className="text-[13px] text-[#101828] break-words">{value || '—'}</p>
    </div>
  );
}

function ModalShell({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white shadow-xl ${
          wide ? 'max-w-2xl' : 'max-w-lg'
        }`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#F2F4F7] bg-white px-5 py-4">
          <h3 className="text-base font-semibold text-[#101828]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#667085] hover:bg-[#F2F4F7]"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function openDocument(dataUrl, title) {
  if (!dataUrl) return;
  const win = window.open('', '_blank');
  if (!win) {
    toast.error('Popup blocked — allow popups to view the document');
    return;
  }
  if (String(dataUrl).startsWith('data:application/pdf')) {
    win.document.write(
      `<title>${title || 'Document'}</title><embed src="${dataUrl}" type="application/pdf" width="100%" height="100%" />`
    );
  } else {
    win.document.write(
      `<title>${title || 'Document'}</title><img src="${dataUrl}" style="max-width:100%;height:auto;" alt="${title || 'Document'}" />`
    );
  }
}

export function PendingAffiliateList() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    pages: 1,
  });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stage, setStage] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);

  const [viewUser, setViewUser] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [interviewUser, setInterviewUser] = useState(null);
  const [meetLink, setMeetLink] = useState('');
  const [interviewAt, setInterviewAt] = useState('');
  const [interviewNote, setInterviewNote] = useState('');

  const [decisionUser, setDecisionUser] = useState(null);
  const [decisionType, setDecisionType] = useState('approve');
  const [decisionNote, setDecisionNote] = useState('');
  const [rejectReasonKey, setRejectReasonKey] = useState('');
  const [holdUser, setHoldUser] = useState(null);
  const [holdNote, setHoldNote] = useState('');
  const [issuedCredentials, setIssuedCredentials] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadRows = useCallback(
    async (page = 1, { silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);
        const { data } = await userService.getAll({
          role: ROLES.AFFILIATE,
          affiliateApprovalStatus: stage,
          page,
          limit: PAGE_SIZE,
          search: debouncedSearch || undefined,
        });
        setRows(data.data.users || []);
        setPagination(data.data.pagination || { page: 1, limit: PAGE_SIZE, total: 0, pages: 1 });
      } catch (error) {
        if (!silent) toast.error(getErrorMessage(error, 'Unable to load pending affiliates'));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [debouncedSearch, stage]
  );

  useEffect(() => {
    loadRows(1);
  }, [loadRows]);

  // Keep list fresh so Approve appears when an affiliate uploads without manual refresh
  useEffect(() => {
    const refresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      loadRows(pagination.page, { silent: true });
    };

    const intervalId = setInterval(refresh, 12000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
    };
  }, [loadRows, pagination.page]);

  const handleView = async (affiliate) => {
    try {
      setViewLoading(true);
      const { data } = await userService.getById(affiliate._id);
      setViewUser(data.data.user);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to load affiliate details'));
    } finally {
      setViewLoading(false);
    }
  };

  const handleScheduleInterview = async () => {
    if (!interviewUser) return;
    if (!meetLink.trim()) {
      toast.error('Google Meet link is required');
      return;
    }
    if (!interviewAt) {
      toast.error('Interview date and time are required');
      return;
    }
    try {
      setActionId(interviewUser._id);
      await userService.scheduleAffiliateInterview(interviewUser._id, {
        meetLink: meetLink.trim(),
        interviewAt: new Date(interviewAt).toISOString(),
        note: interviewNote.trim(),
      });
      toast.success('Interview scheduled — Meet link emailed; super admins notified');
      setInterviewUser(null);
      setMeetLink('');
      setInterviewAt('');
      setInterviewNote('');
      loadRows(pagination.page);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to schedule interview'));
    } finally {
      setActionId(null);
    }
  };

  const handleHold = async () => {
    if (!holdUser) return;
    try {
      setActionId(holdUser._id);
      await userService.holdAffiliate(holdUser._id, { note: holdNote.trim() });
      toast.success('On hold — agreement PDF and upload link emailed');
      setHoldUser(null);
      setHoldNote('');
      loadRows(pagination.page);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to hold approval'));
    } finally {
      setActionId(null);
    }
  };

  const handleResume = async (affiliate) => {
    try {
      setActionId(affiliate._id);
      await userService.resumeAffiliate(affiliate._id);
      toast.success('Application resumed from hold');
      loadRows(pagination.page);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to resume application'));
    } finally {
      setActionId(null);
    }
  };

  const handleOnboarding = async (affiliate) => {
    try {
      setActionId(affiliate._id);
      await userService.requestSignedAgreementOnboarding(affiliate._id);
      toast.success('New upload link emailed — previous upload cleared for re-submit');
      loadRows(pagination.page);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to send onboarding email'));
    } finally {
      setActionId(null);
    }
  };

  const handleDecision = async () => {
    if (!decisionUser) return;
    if (decisionType === 'reject') {
      if (!rejectReasonKey) {
        toast.error('Please select a rejection reason');
        return;
      }
      const reason = decisionNote.trim();
      if (reason.length < 5) {
        toast.error(
          rejectReasonKey === REJECT_REASON_CUSTOM
            ? 'Please enter a custom rejection reason (at least 5 characters)'
            : 'Please select a rejection reason'
        );
        return;
      }
    }
    try {
      setActionId(decisionUser._id);
      if (decisionType === 'approve') {
        const { data } = await userService.approveAffiliate(decisionUser._id, {
          note: decisionNote.trim(),
        });
        const approved = data?.data?.user;
        const password = approved?.affiliateIssuedPassword || '';
        setIssuedCredentials({
          name: displayName(approved || decisionUser),
          email: approved?.email || decisionUser.email,
          password,
          discountCode: approved?.affiliateDiscountCode || '',
          discountPercent: approved?.affiliateDiscountPercent || 20,
        });
        toast.success(
          `Approved — credentials emailed to ${approved?.email || decisionUser.email}`
        );
      } else {
        await userService.rejectAffiliate(decisionUser._id, {
          reason: decisionNote.trim(),
        });
        toast.success('Affiliate rejected — reason emailed to the applicant');
      }
      setDecisionUser(null);
      setDecisionNote('');
      setRejectReasonKey('');
      loadRows(pagination.page);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to update application'));
    } finally {
      setActionId(null);
    }
  };

  const copyText = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Unable to copy ${label.toLowerCase()}`);
    }
  };

  const totalPages = Math.max(1, pagination.pages || 1);
  const actionBtn =
    'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-semibold transition disabled:opacity-50';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[28px] font-semibold tracking-tight text-[#101828]">
          Pending Affiliates
        </h1>
        <p className="mt-1 text-sm text-[#667085]">
          Review registration requests, send a Google Meet interview link, then approve or reject.
          Affiliates can sign in only after approval.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#ECEFF3] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex flex-col gap-3 border-b border-[#F2F4F7] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="inline-flex items-center gap-2 text-base font-semibold text-[#101828]">
            <Handshake size={18} style={{ color: ACCENT }} />
            Pending approvals
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-[240px] flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email, phone"
                className="h-10 w-full rounded-lg border border-[#D0D5DD] bg-white pl-9 pr-3 text-sm text-[#101828] outline-none placeholder:text-[#98A2B3] focus:border-[#021A54] focus:ring-1 focus:ring-[#021A54]"
              />
            </div>
            <select
              value={stage}
              onChange={(event) => setStage(event.target.value)}
              className="h-10 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#344054] outline-none focus:border-[#021A54] focus:ring-1 focus:ring-[#021A54]"
            >
              {STAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#F9FAFB] text-[12px] font-semibold uppercase tracking-[0.04em] text-[#667085]">
              <tr>
                <th className="px-5 py-3">Applicant</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Details</th>
                <th className="px-5 py-3">Stage</th>
                <th className="px-5 py-3">Applied</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-[#667085]">
                    Loading pending affiliates...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-[#667085]">
                    No pending affiliate requests
                  </td>
                </tr>
              ) : (
                rows.map((affiliate) => {
                  const busy = actionId === affiliate._id;
                  const isInterview =
                    affiliate.affiliateApprovalStatus ===
                    AFFILIATE_APPROVAL_STATUS.INTERVIEW_SCHEDULED;
                  const isOnHold =
                    affiliate.affiliateApprovalStatus === AFFILIATE_APPROVAL_STATUS.ON_HOLD;
                  const awaitingSignedAgreement =
                    Boolean(affiliate.signedAgreementOnboardingSentAt) &&
                    !affiliate.signedAgreementUploadedAt;
                  const canApprove =
                    !awaitingSignedAgreement &&
                    (isInterview ||
                      (isOnHold && Boolean(affiliate.signedAgreementUploadedAt)));
                  return (
                    <tr key={affiliate._id} className="border-t border-[#F2F4F7]">
                      <td className="px-5 py-4 align-top">
                        <p className="font-semibold text-[#101828]">{displayName(affiliate)}</p>
                        <p className="mt-0.5 text-[13px] text-[#667085]">
                          {affiliate.email || '—'}
                        </p>
                        <p className="mt-0.5 text-[12px] text-[#98A2B3]">
                          Email {affiliate.isEmailVerified ? 'verified' : 'not verified'}
                        </p>
                      </td>
                      <td className="px-5 py-4 align-top text-[#344054]">
                        {getAffiliateTypeLabel(affiliate.affiliateType)}
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="text-[13px] text-[#344054] break-all">
                          {getAffiliateExtraSummary(affiliate)}
                        </p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium ${
                            isOnHold
                              ? 'bg-orange-50 text-orange-700'
                              : isInterview
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-sky-50 text-sky-700'
                          }`}
                        >
                          {isOnHold ? (
                            <PauseCircle size={12} />
                          ) : isInterview ? (
                            <Video size={12} />
                          ) : (
                            <Clock3 size={12} />
                          )}
                          {getAffiliateApprovalLabel(affiliate.affiliateApprovalStatus)}
                        </span>
                        {affiliate.interviewAt ? (
                          <p className="mt-1.5 text-[12px] text-[#667085]">
                            {formatDateTime(affiliate.interviewAt)}
                          </p>
                        ) : null}
                        {affiliate.signedAgreementUploadedAt ? (
                          <p className="mt-1.5 text-[12px] font-medium text-emerald-700">
                            Signed agreement uploaded
                          </p>
                        ) : affiliate.signedAgreementOnboardingSentAt ? (
                          <p className="mt-1.5 text-[12px] text-[#667085]">
                            Onboarding link sent
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 align-top text-[#344054]">
                        {formatDate(affiliate.createdAt)}
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={busy || viewLoading}
                            onClick={() => handleView(affiliate)}
                            className={actionBtn}
                            style={{ borderColor: ACCENT, color: ACCENT }}
                          >
                            <Eye size={14} />
                            View
                          </button>
                          <button
                            type="button"
                            disabled={busy || !affiliate.isEmailVerified}
                            onClick={() => {
                              setInterviewUser(affiliate);
                              setMeetLink(affiliate.interviewMeetLink || '');
                              setInterviewAt(toDatetimeLocalValue(affiliate.interviewAt));
                              setInterviewNote(affiliate.interviewNote || '');
                            }}
                            className={actionBtn}
                            style={{ borderColor: ACCENT, color: ACCENT }}
                            title={
                              affiliate.isEmailVerified
                                ? undefined
                                : 'Email must be verified first'
                            }
                          >
                            <Video size={14} />
                            {isInterview ? 'Reschedule' : 'Schedule interview'}
                          </button>
                          {isOnHold ? (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleResume(affiliate)}
                                className={`${actionBtn} border-orange-200 text-orange-700 hover:bg-orange-50`}
                              >
                                <PlayCircle size={14} />
                                Resume
                              </button>
                              <button
                                type="button"
                                disabled={busy || !affiliate.isEmailVerified}
                                onClick={() => handleOnboarding(affiliate)}
                                className={`${actionBtn} border-sky-200 text-sky-700 hover:bg-sky-50`}
                                title={
                                  affiliate.isEmailVerified
                                    ? 'Email a new upload link (use if the previous document was wrong)'
                                    : 'Email must be verified first'
                                }
                              >
                                <FileSignature size={14} />
                                Resend upload link
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                setHoldUser(affiliate);
                                setHoldNote('');
                              }}
                              className={`${actionBtn} border-orange-200 text-orange-700 hover:bg-orange-50`}
                            >
                              <PauseCircle size={14} />
                              Hold approval
                            </button>
                          )}
                          {canApprove ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                setDecisionUser(affiliate);
                                setDecisionType('approve');
                                setDecisionNote('');
                                setRejectReasonKey('');
                              }}
                              className={`${actionBtn} border-emerald-200 text-emerald-700 hover:bg-emerald-50`}
                              title={
                                affiliate.signedAgreementUploadedAt
                                  ? 'Signed agreement on file'
                                  : undefined
                              }
                            >
                              <CheckCircle2 size={14} />
                              Approve
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setDecisionUser(affiliate);
                              setDecisionType('reject');
                              setDecisionNote('');
                              setRejectReasonKey('');
                            }}
                            className={`${actionBtn} border-red-200 text-red-600 hover:bg-red-50`}
                          >
                            <XCircle size={14} />
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-[#F2F4F7] px-5 py-3">
          <p className="text-[13px] text-[#667085]">
            Page {pagination.page} of {totalPages} · {pagination.total} total
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1 || loading}
              onClick={() => loadRows(pagination.page - 1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D0D5DD] text-[#344054] disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              disabled={pagination.page >= totalPages || loading}
              onClick={() => loadRows(pagination.page + 1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D0D5DD] text-[#344054] disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {viewUser ? (
        <ModalShell title="Affiliate application" onClose={() => setViewUser(null)} wide>
          <DetailRow label="Name" value={displayName(viewUser)} />
          <DetailRow label="Email" value={viewUser.email} />
          <DetailRow label="Phone" value={viewUser.phone} />
          <DetailRow label="Type" value={getAffiliateTypeLabel(viewUser.affiliateType)} />
          {viewUser.affiliateType === AFFILIATE_TYPES.STUDENT ? (
            <>
              <DetailRow label="College" value={viewUser.collegeName} />
              <DetailRow label="University" value={viewUser.universityName} />
            </>
          ) : null}
          {viewUser.affiliateType === AFFILIATE_TYPES.SOCIAL_MEDIA_CREATOR ? (
            <DetailRow label="Social media" value={viewUser.socialMediaAccount} />
          ) : null}
          <DetailRow label="Why join" value={viewUser.joinReason} />
          <DetailRow
            label="Stage"
            value={getAffiliateApprovalLabel(viewUser.affiliateApprovalStatus)}
          />
          <DetailRow label="Meet link" value={viewUser.interviewMeetLink} />
          <DetailRow label="Interview time" value={formatDateTime(viewUser.interviewAt)} />
          <DetailRow label="Interview note" value={viewUser.interviewNote} />
          <DetailRow label="Hold note" value={viewUser.affiliateHoldNote} />
          <DetailRow label="Held at" value={formatDateTime(viewUser.affiliateHeldAt)} />
          <DetailRow
            label="Onboarding sent"
            value={formatDateTime(viewUser.signedAgreementOnboardingSentAt)}
          />
          <DetailRow
            label="Signed agreement"
            value={
              viewUser.signedAgreementUploadedAt
                ? `${viewUser.signedAgreementDocumentName || 'Uploaded'} · ${formatDateTime(
                    viewUser.signedAgreementUploadedAt
                  )}`
                : 'Not uploaded'
            }
          />
          <div className="mt-3 rounded-[10px] border border-sky-200 bg-sky-50 px-4 py-3">
            <p className="text-[13px] font-semibold text-[#021A54]">Login credentials</p>
            <p className="mt-1.5 text-[13px] text-[#344054]">
              Email:{' '}
              <span className="font-medium text-[#101828]">{viewUser.email || '—'}</span>
            </p>
            <p className="mt-1 text-[13px] text-[#344054]">
              Password:{' '}
              <code className="rounded bg-white px-1.5 py-0.5 text-[13px] font-semibold text-[#101828]">
                {viewUser.affiliateIssuedPassword ||
                  (viewUser.affiliateApprovalStatus === 'approved'
                    ? 'Not issued — use Resend login email'
                    : 'Issued on approval')}
              </code>
            </p>
            {viewUser.affiliateCredentialsIssuedAt ? (
              <p className="mt-1 text-[12px] text-[#667085]">
                Issued {formatDateTime(viewUser.affiliateCredentialsIssuedAt)}
              </p>
            ) : null}
          </div>
          {viewUser.affiliateDiscountCode ? (
            <div className="mt-3 rounded-[10px] border border-indigo-200 bg-indigo-50 px-4 py-3">
              <p className="text-[13px] font-semibold text-[#021A54]">Affiliate Discount Code</p>
              <p className="mt-1.5 text-[13px] text-[#344054]">
                Code:{' '}
                <code className="rounded bg-white px-1.5 py-0.5 text-[13px] font-semibold text-[#101828]">
                  {viewUser.affiliateDiscountCode}
                </code>
              </p>
              <p className="mt-1 text-[12px] text-[#667085]">
                Partner #{viewUser.affiliatePartnerNumber || '—'} ·{' '}
                {viewUser.affiliateDiscountPercent || 20}% off all plans
              </p>
            </div>
          ) : null}
          <DetailRow
            label="Verification"
            value={`${getVerificationDocLabel(
              viewUser.verificationDocumentKind || viewUser.affiliateType
            )} · ${viewUser.verificationStatus || 'pending'}`}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {viewUser.verificationDocument ? (
              <button
                type="button"
                onClick={() =>
                  openDocument(
                    viewUser.verificationDocument,
                    getVerificationDocLabel(viewUser.verificationDocumentKind)
                  )
                }
                className="h-9 rounded-lg px-3 text-[13px] font-semibold text-white"
                style={{ backgroundColor: ACCENT }}
              >
                View {getVerificationDocLabel(viewUser.verificationDocumentKind)}
              </button>
            ) : null}
            {viewUser.resumeDocument ? (
              <button
                type="button"
                onClick={() => openDocument(viewUser.resumeDocument, 'Resume')}
                className="h-9 rounded-lg border px-3 text-[13px] font-semibold"
                style={{ borderColor: ACCENT, color: ACCENT }}
              >
                View resume
              </button>
            ) : null}
            {viewUser.signedAgreementDocument ? (
              <button
                type="button"
                onClick={() =>
                  openDocument(
                    viewUser.signedAgreementDocument,
                    viewUser.signedAgreementDocumentName || 'Signed agreement'
                  )
                }
                className="h-9 rounded-lg border px-3 text-[13px] font-semibold border-emerald-200 text-emerald-700"
              >
                View signed agreement
              </button>
            ) : null}
          </div>
        </ModalShell>
      ) : null}

      {interviewUser ? (
        <ModalShell
          title="Schedule interview"
          onClose={() => {
            if (!actionId) setInterviewUser(null);
          }}
        >
          <p className="mb-4 text-sm text-[#344054]">
            Accept <span className="font-semibold">{displayName(interviewUser)}</span> for
            interview. Set the meeting time and Google Meet link — the affiliate gets an email,
            and super admins get a notification.
          </p>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
                Interview date & time *
              </label>
              <input
                type="datetime-local"
                className={inputClass}
                value={interviewAt}
                onChange={(e) => setInterviewAt(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
                Google Meet link *
              </label>
              <input
                className={inputClass}
                value={meetLink}
                onChange={(e) => setMeetLink(e.target.value)}
                placeholder="https://meet.google.com/abc-defg-hij"
              />
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
                Note (optional)
              </label>
              <textarea
                className={textareaClass}
                value={interviewNote}
                onChange={(e) => setInterviewNote(e.target.value)}
                placeholder="Extra instructions for the affiliate"
              />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              disabled={Boolean(actionId)}
              onClick={() => setInterviewUser(null)}
              className="h-10 rounded-lg border border-[#D0D5DD] px-4 text-sm font-semibold text-[#344054]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={Boolean(actionId)}
              onClick={handleScheduleInterview}
              className="h-10 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: ACCENT }}
            >
              {actionId === interviewUser._id ? 'Sending…' : 'Send Meet link'}
            </button>
          </div>
        </ModalShell>
      ) : null}

      {holdUser ? (
        <ModalShell
          title="Hold approval"
          onClose={() => {
            if (!actionId) {
              setHoldUser(null);
              setHoldNote('');
            }
          }}
        >
          <p className="mb-4 text-sm text-[#344054]">
            Put <span className="font-semibold">{displayName(holdUser)}</span> on hold? We will
            email the Affiliate Partner Agreement (PDF) plus a secure link to upload the signed copy.
            Login stays blocked until you approve (after a valid upload) or reject.
          </p>
          <div>
            <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
              Internal note (optional)
            </label>
            <textarea
              className={textareaClass}
              value={holdNote}
              onChange={(e) => setHoldNote(e.target.value)}
              placeholder="Why is this on hold?"
            />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              disabled={Boolean(actionId)}
              onClick={() => {
                setHoldUser(null);
                setHoldNote('');
              }}
              className="h-10 rounded-lg border border-[#D0D5DD] px-4 text-sm font-semibold text-[#344054]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={Boolean(actionId)}
              onClick={handleHold}
              className="h-10 rounded-lg bg-orange-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {actionId === holdUser._id ? 'Sending…' : 'Hold & send agreement + upload link'}
            </button>
          </div>
        </ModalShell>
      ) : null}

      {issuedCredentials ? (
        <ModalShell title="Approval complete — share login details" onClose={() => setIssuedCredentials(null)}>
          <p className="mb-3 text-sm text-[#344054]">
            Congratulations email was sent to{' '}
            <span className="font-semibold text-[#101828]">{issuedCredentials.email}</span>.
            College inboxes sometimes filter these mails — copy and share the details below if needed.
          </p>
          <div className="space-y-3 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] p-4">
            <p className="text-[13px] font-semibold text-[#065F46]">
              {issuedCredentials.name}
            </p>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium text-[#667085]">Email</p>
                <p className="text-sm font-semibold text-[#101828] break-all">
                  {issuedCredentials.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyText(issuedCredentials.email, 'Email')}
                className="shrink-0 rounded-md border border-[#D0D5DD] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#344054]"
              >
                Copy
              </button>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium text-[#667085]">Temporary password</p>
                <p className="font-mono text-sm font-semibold text-[#101828]">
                  {issuedCredentials.password || '—'}
                </p>
              </div>
              {issuedCredentials.password ? (
                <button
                  type="button"
                  onClick={() => copyText(issuedCredentials.password, 'Password')}
                  className="shrink-0 rounded-md border border-[#D0D5DD] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#344054]"
                >
                  Copy
                </button>
              ) : null}
            </div>
            {issuedCredentials.discountCode ? (
              <div className="flex items-start justify-between gap-3 border-t border-[#A7F3D0] pt-3">
                <div>
                  <p className="text-[12px] font-medium text-[#667085]">Affiliate Discount Code</p>
                  <p className="font-mono text-sm font-semibold text-[#101828]">
                    {issuedCredentials.discountCode}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[#667085]">
                    {issuedCredentials.discountPercent || 20}% off all plans
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyText(issuedCredentials.discountCode, 'Discount code')}
                  className="shrink-0 rounded-md border border-[#D0D5DD] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#344054]"
                >
                  Copy
                </button>
              </div>
            ) : null}
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setIssuedCredentials(null)}
              className="h-10 rounded-lg bg-[#021A54] px-4 text-sm font-semibold text-white"
            >
              Done
            </button>
          </div>
        </ModalShell>
      ) : null}

      {decisionUser ? (
        <ModalShell
          title={decisionType === 'approve' ? 'Approve affiliate' : 'Reject affiliate'}
          onClose={() => {
            if (!actionId) {
              setDecisionUser(null);
              setRejectReasonKey('');
            }
          }}
          wide={decisionType === 'reject'}
        >
          <p className="mb-4 text-sm text-[#344054]">
            {decisionType === 'approve'
              ? `Approve ${displayName(decisionUser)}? They will get a congratulations email with login credentials and their Affiliate Discount Code (20% on all plans).`
              : `Reject ${displayName(decisionUser)}? Choose a preset reason or write a custom one — it will be emailed to the affiliate partner.`}
          </p>

          {decisionType === 'approve' ? (
            <div>
              <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
                Note (optional)
              </label>
              <textarea
                className={textareaClass}
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                placeholder="Welcome note or next steps"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
                  Rejection reason *
                </label>
                <select
                  className={inputClass}
                  value={rejectReasonKey}
                  onChange={(e) => {
                    const key = e.target.value;
                    setRejectReasonKey(key);
                    if (key === REJECT_REASON_CUSTOM) {
                      setDecisionNote('');
                      return;
                    }
                    if (key === '') {
                      setDecisionNote('');
                      return;
                    }
                    const index = Number(key);
                    setDecisionNote(REJECT_REASON_PRESETS[index] || '');
                  }}
                >
                  <option value="">Select a reason</option>
                  {REJECT_REASON_PRESETS.map((reason, index) => (
                    <option key={reason} value={String(index)}>
                      {reason}
                    </option>
                  ))}
                  <option value={REJECT_REASON_CUSTOM}>Write a custom reason…</option>
                </select>
              </div>

              {rejectReasonKey === REJECT_REASON_CUSTOM ? (
                <div>
                  <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
                    Custom reason *
                  </label>
                  <textarea
                    className={textareaClass}
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                    placeholder="Explain why the application was not approved"
                    required
                  />
                </div>
              ) : rejectReasonKey !== '' ? (
                <div className="rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] px-3 py-2.5 text-[13px] text-[#344054]">
                  {decisionNote}
                </div>
              ) : null}
            </div>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              disabled={Boolean(actionId)}
              onClick={() => {
                setDecisionUser(null);
                setRejectReasonKey('');
              }}
              className="h-10 rounded-lg border border-[#D0D5DD] px-4 text-sm font-semibold text-[#344054]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={Boolean(actionId)}
              onClick={handleDecision}
              className={`h-10 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50 ${
                decisionType === 'approve' ? 'bg-emerald-600' : 'bg-red-600'
              }`}
            >
              {actionId === decisionUser._id
                ? 'Saving…'
                : decisionType === 'approve'
                  ? 'Approve & send credentials'
                  : 'Reject application'}
            </button>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
