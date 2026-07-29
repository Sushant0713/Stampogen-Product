'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Handshake,
  Mail,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import { userService } from '@/services/user.service';
import { affiliateSettingsService } from '@/services/affiliateSettings.service';
import { ROLES } from '@/constants';
import {
  AFFILIATE_TYPES,
  AFFILIATE_TYPE_OPTIONS,
  getAffiliateTypeLabel,
  getAffiliateExtraSummary,
  getRequiredVerificationKind,
  getVerificationDocLabel,
} from '@/constants/affiliateTypes';
import { AFFILIATE_APPROVAL_STATUS } from '@/constants/affiliateApproval';
import { VerificationDocumentField } from '@/components/forms/VerificationDocumentField';
import { getErrorMessage } from '@/utils';

const EMPTY_ADD_FORM = {
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  phone: '',
  affiliateType: '',
  collegeName: '',
  universityName: '',
  socialMediaAccount: '',
  joinReason: '',
  verificationDocument: '',
  verificationDocumentName: '',
  resumeDocument: '',
  resumeDocumentName: '',
  verificationStatus: 'verified',
  isActive: true,
};

const PAGE_SIZE = 10;
const ACCENT = '#021A54';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Suspended' },
];

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

function displayName(user) {
  return (
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    '—'
  );
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-[#ECEFF3] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[13px] font-medium text-[#667085]">{label}</p>
          <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight text-[#101828]">
            {value}
          </p>
        </div>
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${ACCENT}18`, color: ACCENT }}
        >
          <Icon size={18} />
        </span>
      </div>
    </div>
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

function formatMoney(value) {
  const n = Number(value) || 0;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function ModalShell({ title, onClose, children, wide = false, xl = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white shadow-xl ${
          xl ? 'max-w-4xl' : wide ? 'max-w-2xl' : 'max-w-lg'
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

export function AffiliateList() {
  const [affiliates, setAffiliates] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    pages: 1,
  });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);

  const [viewUser, setViewUser] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deleteUser, setDeleteUser] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM);
  const [addSaving, setAddSaving] = useState(false);
  const [issuedCredentials, setIssuedCredentials] = useState(null);
  const [enabledTypeOptions, setEnabledTypeOptions] = useState(AFFILIATE_TYPE_OPTIONS);
  const [typeSettings, setTypeSettings] = useState({});
  const [portfolio, setPortfolio] = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioSearch, setPortfolioSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    affiliateSettingsService
      .get()
      .then(({ data }) => {
        if (cancelled) return;
        const types = data?.data?.settings?.types || {};
        setTypeSettings(types);
        const enabled = AFFILIATE_TYPE_OPTIONS.filter((opt) => types[opt.value]?.enabled !== false);
        setEnabledTypeOptions(enabled.length ? enabled : AFFILIATE_TYPE_OPTIONS);
      })
      .catch(() => {
        if (!cancelled) setEnabledTypeOptions(AFFILIATE_TYPE_OPTIONS);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadStats = useCallback(async ({ silent = false } = {}) => {
    try {
      const { data } = await userService.getAffiliateStats();
      const s = data?.data?.stats || {};
      setStats({
        total: s.total || 0,
        active: s.active || 0,
        inactive: s.inactive || 0,
      });
    } catch (error) {
      if (!silent) toast.error(getErrorMessage(error, 'Unable to load affiliate stats'));
    }
  }, []);

  const loadAffiliates = useCallback(
    async (page = 1, { silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);
        const { data } = await userService.getAll({
          role: ROLES.AFFILIATE,
          affiliateApprovalStatus: 'approved',
          page,
          limit: PAGE_SIZE,
          search: debouncedSearch || undefined,
          isActive: status || undefined,
        });

        setAffiliates(data.data.users || []);
        setPagination(data.data.pagination || { page: 1, limit: PAGE_SIZE, total: 0, pages: 1 });
      } catch (error) {
        if (!silent) toast.error(getErrorMessage(error, 'Unable to load affiliates'));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [debouncedSearch, status]
  );

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadAffiliates(1);
  }, [loadAffiliates]);

  const openDocument = (doc, title = 'Document') => {
    if (!doc) {
      toast.error(`${title} not found`);
      return;
    }
    const win = window.open();
    if (!win) {
      toast.error('Pop-up blocked — allow pop-ups to view the document');
      return;
    }
    if (String(doc).startsWith('data:application/pdf')) {
      win.document.write(
        `<iframe src="${doc}" title="${title}" style="border:0;width:100%;height:100%"></iframe>`
      );
    } else {
      win.document.write(
        `<img src="${doc}" alt="${title}" style="max-width:100%;height:auto;display:block;margin:24px auto" />`
      );
    }
  };

  const handleView = async (affiliate) => {
    try {
      setViewLoading(true);
      const { data } = await userService.getById(affiliate._id);
      setViewUser(data.data.user);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to load affiliate'));
    } finally {
      setViewLoading(false);
    }
  };

  const handleViewClients = async (affiliate) => {
    try {
      setPortfolioLoading(true);
      setActionId(affiliate._id);
      setPortfolioSearch('');
      const { data } = await userService.getAffiliateClients(affiliate._id);
      setPortfolio(data.data);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to load affiliate clients'));
      setPortfolio(null);
    } finally {
      setPortfolioLoading(false);
      setActionId(null);
    }
  };

  const handleResendCredentials = async (affiliate) => {
    try {
      setActionId(affiliate._id);
      const { data } = await userService.resendAffiliateCredentials(affiliate._id);
      const user = data?.data?.user;
      setIssuedCredentials({
        name:
          user?.fullName ||
          [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
          affiliate.fullName ||
          'Affiliate',
        email: user?.email || affiliate.email,
        password: user?.affiliateIssuedPassword || '',
        discountCode: user?.affiliateDiscountCode || '',
        discountPercent: user?.affiliateDiscountPercent || 20,
      });
      toast.success(`Login email sent to ${user?.email || affiliate.email}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to send credentials email'));
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

  const handleEditOpen = async (affiliate) => {
    try {
      setActionId(affiliate._id);
      const { data } = await userService.getById(affiliate._id);
      const user = data.data.user;
      const typeCfg = typeSettings[user.affiliateType] || {};
      const typeDiscount = Number(typeCfg.defaultDiscountPercent) || 20;
      const typeEarning = Number(typeCfg.earningPercent ?? typeDiscount) || 20;
      const typeTarget = Number(typeCfg.minimumTargetValue) || 0;
      setEditUser(user);
      setEditForm({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
        affiliateType: user.affiliateType || '',
        collegeName: user.collegeName || '',
        universityName: user.universityName || '',
        socialMediaAccount: user.socialMediaAccount || '',
        joinReason: user.joinReason || '',
        verificationStatus: user.verificationStatus || 'pending',
        isActive: Boolean(user.isActive),
        affiliateDiscountPercent:
          user.affiliateDiscountPercent != null ? user.affiliateDiscountPercent : typeDiscount,
        affiliateEarningPercent:
          user.affiliateEarningPercent != null ? user.affiliateEarningPercent : typeEarning,
        affiliateMinimumTargetValue:
          user.affiliateMinimumTargetValue != null
            ? user.affiliateMinimumTargetValue
            : typeTarget,
      });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to load affiliate'));
    } finally {
      setActionId(null);
    }
  };

  const handleEditSave = async () => {
    if (!editUser || !editForm) return;
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      toast.error('First and last name are required');
      return;
    }
    if (!editForm.affiliateType) {
      toast.error('Affiliate type is required');
      return;
    }
    if (editForm.affiliateType === AFFILIATE_TYPES.STUDENT && !editForm.collegeName.trim()) {
      toast.error('College is required');
      return;
    }
    if (
      editForm.affiliateType === AFFILIATE_TYPES.SOCIAL_MEDIA_CREATOR &&
      !editForm.socialMediaAccount.trim()
    ) {
      toast.error('Social media account is required');
      return;
    }
    if (!editForm.joinReason.trim() || editForm.joinReason.trim().length < 5) {
      toast.error('Please provide a valid join reason');
      return;
    }

    const discountPct = Number(editForm.affiliateDiscountPercent);
    if (Number.isNaN(discountPct) || discountPct < 0 || discountPct > 100) {
      toast.error('Partner discount must be 0–100%');
      return;
    }
    const earningPct = Number(editForm.affiliateEarningPercent);
    if (Number.isNaN(earningPct) || earningPct < 0 || earningPct > 100) {
      toast.error('Affiliate earning must be 0–100%');
      return;
    }
    const minTarget = Number(editForm.affiliateMinimumTargetValue);
    if (Number.isNaN(minTarget) || minTarget < 0) {
      toast.error('Minimum target must be 0 or greater');
      return;
    }

    try {
      setEditSaving(true);
      const payload = {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        phone: editForm.phone.trim(),
        affiliateType: editForm.affiliateType,
        collegeName:
          editForm.affiliateType === AFFILIATE_TYPES.STUDENT ? editForm.collegeName.trim() : '',
        universityName:
          editForm.affiliateType === AFFILIATE_TYPES.STUDENT
            ? editForm.universityName.trim()
            : '',
        socialMediaAccount:
          editForm.affiliateType === AFFILIATE_TYPES.SOCIAL_MEDIA_CREATOR
            ? editForm.socialMediaAccount.trim()
            : '',
        joinReason: editForm.joinReason.trim(),
        verificationStatus: editForm.verificationStatus,
        isActive: editForm.isActive,
        affiliateDiscountPercent: discountPct,
        affiliateEarningPercent: earningPct,
        affiliateMinimumTargetValue: minTarget,
      };
      const { data } = await userService.update(editUser._id, payload);
      const updated = data.data.user;
      setAffiliates((rows) =>
        rows.map((row) => (row._id === updated._id ? { ...row, ...updated } : row))
      );
      toast.success('Affiliate updated');
      setEditUser(null);
      setEditForm(null);
      loadStats({ silent: true });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to update affiliate'));
    } finally {
      setEditSaving(false);
    }
  };

  const handleAddOpen = () => {
    setAddForm(EMPTY_ADD_FORM);
    setAddOpen(true);
  };

  const handleAddSave = async () => {
    if (!addForm.firstName.trim() || !addForm.middleName.trim() || !addForm.lastName.trim()) {
      toast.error('First, middle and last name are required');
      return;
    }
    if (!addForm.phone.trim() || addForm.phone.trim().length < 8) {
      toast.error('Mobile number is required');
      return;
    }
    if (!addForm.email.trim()) {
      toast.error('Email is required');
      return;
    }
    if (!addForm.affiliateType) {
      toast.error('Affiliate type is required');
      return;
    }
    if (!addForm.verificationDocument) {
      toast.error(`${getVerificationDocLabel(addForm.affiliateType)} is required`);
      return;
    }
    if (addForm.affiliateType === AFFILIATE_TYPES.STUDENT && !addForm.collegeName.trim()) {
      toast.error('College is required');
      return;
    }
    if (
      addForm.affiliateType === AFFILIATE_TYPES.SOCIAL_MEDIA_CREATOR &&
      !addForm.socialMediaAccount.trim()
    ) {
      toast.error('Social media account is required');
      return;
    }
    if (
      addForm.affiliateType === AFFILIATE_TYPES.FREELANCER_DIGITAL_MARKETER &&
      !addForm.resumeDocument
    ) {
      toast.error('Resume is required');
      return;
    }
    if (!addForm.joinReason.trim() || addForm.joinReason.trim().length < 5) {
      toast.error('Please provide a valid join reason');
      return;
    }

    try {
      setAddSaving(true);
      const payload = {
        firstName: addForm.firstName.trim(),
        middleName: addForm.middleName.trim(),
        lastName: addForm.lastName.trim(),
        email: addForm.email.trim(),
        phone: addForm.phone.trim(),
        affiliateType: addForm.affiliateType,
        verificationDocument: addForm.verificationDocument,
        verificationDocumentName: addForm.verificationDocumentName,
        collegeName:
          addForm.affiliateType === AFFILIATE_TYPES.STUDENT ? addForm.collegeName.trim() : '',
        universityName:
          addForm.affiliateType === AFFILIATE_TYPES.STUDENT
            ? addForm.universityName.trim()
            : '',
        socialMediaAccount:
          addForm.affiliateType === AFFILIATE_TYPES.SOCIAL_MEDIA_CREATOR
            ? addForm.socialMediaAccount.trim()
            : '',
        resumeDocument:
          addForm.affiliateType === AFFILIATE_TYPES.FREELANCER_DIGITAL_MARKETER
            ? addForm.resumeDocument
            : undefined,
        resumeDocumentName:
          addForm.affiliateType === AFFILIATE_TYPES.FREELANCER_DIGITAL_MARKETER
            ? addForm.resumeDocumentName
            : undefined,
        joinReason: addForm.joinReason.trim(),
        verificationStatus: addForm.verificationStatus,
        isActive: addForm.isActive,
      };
      const { data } = await userService.createAffiliate(payload);
      const user = data?.data?.user;
      if (user?.affiliateIssuedPassword || user?.affiliateDiscountCode) {
        setIssuedCredentials({
          name:
            user.fullName ||
            [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
            'Affiliate',
          email: user.email,
          password: user.affiliateIssuedPassword || '',
          discountCode: user.affiliateDiscountCode || '',
          discountPercent: user.affiliateDiscountPercent || 20,
        });
      }
      toast.success('Affiliate created — login credentials emailed');
      setAddOpen(false);
      setAddForm(EMPTY_ADD_FORM);
      loadAffiliates(1);
      loadStats({ silent: true });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to create affiliate'));
    } finally {
      setAddSaving(false);
    }
  };

  const handleSuspendToggle = async (affiliate) => {
    const id = affiliate._id;
    const nextActive = !affiliate.isActive;
    setActionId(id);
    const previous = affiliate.isActive;
    setAffiliates((rows) =>
      rows.map((row) => (row._id === id ? { ...row, isActive: nextActive } : row))
    );

    try {
      await userService.update(id, { isActive: nextActive });
      toast.success(nextActive ? 'Affiliate activated' : 'Affiliate suspended');
      loadStats({ silent: true });
    } catch (error) {
      setAffiliates((rows) =>
        rows.map((row) => (row._id === id ? { ...row, isActive: previous } : row))
      );
      toast.error(getErrorMessage(error, 'Unable to update affiliate'));
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    const id = deleteUser._id;
    try {
      setActionId(id);
      await userService.delete(id);
      setAffiliates((rows) => rows.filter((row) => row._id !== id));
      toast.success('Affiliate deleted');
      setDeleteUser(null);
      loadStats({ silent: true });
      if (affiliates.length <= 1 && pagination.page > 1) {
        loadAffiliates(pagination.page - 1, { silent: true });
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to delete affiliate'));
    } finally {
      setActionId(null);
    }
  };

  const totalPages = Math.max(1, pagination.pages || 1);
  const actionBtn =
    'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-semibold transition disabled:opacity-50';

  const verificationKind = getRequiredVerificationKind(addForm.affiliateType);
  const verificationLabel = getVerificationDocLabel(addForm.affiliateType);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-[#101828]">
            Affiliates
          </h1>
          <p className="mt-1 text-sm text-[#667085]">
            View and manage affiliate partner accounts.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddOpen}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition hover:opacity-90"
          style={{ backgroundColor: ACCENT }}
        >
          <Plus size={18} />
          Add Affiliate
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Affiliates" value={stats.total} icon={Users} />
        <StatCard label="Active" value={stats.active} icon={UserCheck} />
        <StatCard label="Suspended" value={stats.inactive} icon={UserMinus} />
      </div>

      <div className="overflow-hidden rounded-xl border border-[#ECEFF3] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex flex-col gap-3 border-b border-[#F2F4F7] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="inline-flex items-center gap-2 text-base font-semibold text-[#101828]">
            <Handshake size={18} style={{ color: ACCENT }} />
            Affiliate list
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
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-10 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#344054] outline-none focus:border-[#021A54] focus:ring-1 focus:ring-[#021A54]"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
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
                <th className="px-5 py-3">Affiliate</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Details</th>
                <th className="px-5 py-3">Verification</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Joined</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[#667085]">
                    Loading affiliates...
                  </td>
                </tr>
              ) : affiliates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[#667085]">
                    No affiliates found
                  </td>
                </tr>
              ) : (
                affiliates.map((affiliate) => {
                  const busy = actionId === affiliate._id;
                  const docLabel = getVerificationDocLabel(
                    affiliate.verificationDocumentKind || affiliate.affiliateType
                  );
                  return (
                    <tr key={affiliate._id} className="border-t border-[#F2F4F7]">
                      <td className="px-5 py-4 align-top">
                        <p className="font-semibold text-[#101828]">{displayName(affiliate)}</p>
                        <p className="mt-0.5 text-[13px] text-[#667085]">
                          {affiliate.email || '—'}
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
                        {affiliate.verificationDocumentKind ? (
                          <div className="space-y-1">
                            <p className="text-[13px] font-medium text-[#101828]">{docLabel}</p>
                            <p className="text-[12px] capitalize text-[#667085]">
                              {affiliate.verificationStatus || 'pending'}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[#98A2B3]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 align-top">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-medium ${
                            affiliate.isActive
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {affiliate.isActive ? 'Active' : 'Suspended'}
                        </span>
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
                            disabled={busy || portfolioLoading}
                            onClick={() => handleViewClients(affiliate)}
                            className={actionBtn}
                            style={{ borderColor: ACCENT, color: ACCENT }}
                            title="Clients who joined with this affiliate’s code"
                          >
                            <Users size={14} />
                            Clients
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleEditOpen(affiliate)}
                            className={actionBtn}
                            style={{ borderColor: ACCENT, color: ACCENT }}
                          >
                            <Pencil size={14} />
                            Edit
                          </button>
                          {affiliate.affiliateApprovalStatus ===
                            AFFILIATE_APPROVAL_STATUS.APPROVED ||
                          !affiliate.affiliateApprovalStatus ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleResendCredentials(affiliate)}
                              className={`${actionBtn} border-sky-200 text-sky-700 hover:bg-sky-50`}
                              title="Email a new temporary password"
                            >
                              <Mail size={14} />
                              Resend login email
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleSuspendToggle(affiliate)}
                            className={actionBtn}
                            style={{ borderColor: ACCENT, color: ACCENT }}
                          >
                            {affiliate.isActive ? 'Suspend' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setDeleteUser(affiliate)}
                            className={`${actionBtn} border-red-200 text-red-600 hover:bg-red-50`}
                          >
                            <Trash2 size={14} />
                            Delete
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
              onClick={() => loadAffiliates(pagination.page - 1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D0D5DD] text-[#344054] disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              disabled={pagination.page >= totalPages || loading}
              onClick={() => loadAffiliates(pagination.page + 1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D0D5DD] text-[#344054] disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {addOpen ? (
        <ModalShell
          title="Add Affiliate"
          onClose={() => {
            if (!addSaving) {
              setAddOpen(false);
              setAddForm(EMPTY_ADD_FORM);
            }
          }}
          wide
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
                First name *
              </label>
              <input
                className={inputClass}
                value={addForm.firstName}
                onChange={(e) => setAddForm((p) => ({ ...p, firstName: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
                Middle name *
              </label>
              <input
                className={inputClass}
                value={addForm.middleName}
                onChange={(e) => setAddForm((p) => ({ ...p, middleName: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
                Last name *
              </label>
              <input
                className={inputClass}
                value={addForm.lastName}
                onChange={(e) => setAddForm((p) => ({ ...p, lastName: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-semibold text-[#101828]">Email *</label>
              <input
                type="email"
                className={inputClass}
                value={addForm.email}
                onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-semibold text-[#101828]">Mobile *</label>
              <input
                className={inputClass}
                value={addForm.phone}
                onChange={(e) => setAddForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2 rounded-[10px] border border-[#E4E7EC] bg-[#F9FAFB] px-3 py-2.5 text-[13px] text-[#344054]">
              A login password will be generated and emailed to the affiliate after creation. You can
              also see it under View.
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
                Affiliate type *
              </label>
              <select
                className={inputClass}
                value={addForm.affiliateType}
                onChange={(e) =>
                  setAddForm((p) => ({
                    ...p,
                    affiliateType: e.target.value,
                    verificationDocument: '',
                    verificationDocumentName: '',
                    resumeDocument: '',
                    resumeDocumentName: '',
                  }))
                }
              >
                <option value="">Select type</option>
                {enabledTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {addForm.affiliateType === AFFILIATE_TYPES.STUDENT ? (
              <>
                <div>
                  <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
                    College *
                  </label>
                  <input
                    className={inputClass}
                    value={addForm.collegeName}
                    onChange={(e) => setAddForm((p) => ({ ...p, collegeName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
                    University
                  </label>
                  <input
                    className={inputClass}
                    value={addForm.universityName}
                    onChange={(e) => setAddForm((p) => ({ ...p, universityName: e.target.value }))}
                  />
                </div>
              </>
            ) : null}

            {addForm.affiliateType === AFFILIATE_TYPES.SOCIAL_MEDIA_CREATOR ? (
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
                  Social media account *
                </label>
                <input
                  className={inputClass}
                  value={addForm.socialMediaAccount}
                  onChange={(e) =>
                    setAddForm((p) => ({ ...p, socialMediaAccount: e.target.value }))
                  }
                  placeholder="e.g. Instagram @username or profile URL"
                />
              </div>
            ) : null}

            {addForm.affiliateType === AFFILIATE_TYPES.FREELANCER_DIGITAL_MARKETER ? (
              <div className="sm:col-span-2">
                <VerificationDocumentField
                  label="Resume"
                  value={addForm.resumeDocument}
                  fileName={addForm.resumeDocumentName}
                  onChange={({ verificationDocument, verificationDocumentName }) =>
                    setAddForm((p) => ({
                      ...p,
                      resumeDocument: verificationDocument,
                      resumeDocumentName: verificationDocumentName,
                    }))
                  }
                  required
                />
              </div>
            ) : null}

            {verificationKind ? (
              <div className="sm:col-span-2">
                <VerificationDocumentField
                  label={verificationLabel}
                  value={addForm.verificationDocument}
                  fileName={addForm.verificationDocumentName}
                  onChange={({ verificationDocument, verificationDocumentName }) =>
                    setAddForm((p) => ({
                      ...p,
                      verificationDocument,
                      verificationDocumentName,
                    }))
                  }
                  required
                />
              </div>
            ) : null}

            <div className="sm:col-span-2">
              <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
                Why do you join with us? *
              </label>
              <textarea
                className={textareaClass}
                value={addForm.joinReason}
                onChange={(e) => setAddForm((p) => ({ ...p, joinReason: e.target.value }))}
                placeholder="Give a valid answer"
              />
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
                Verification status
              </label>
              <select
                className={inputClass}
                value={addForm.verificationStatus}
                onChange={(e) =>
                  setAddForm((p) => ({ ...p, verificationStatus: e.target.value }))
                }
              >
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
                Account status
              </label>
              <select
                className={inputClass}
                value={addForm.isActive ? 'active' : 'suspended'}
                onChange={(e) =>
                  setAddForm((p) => ({ ...p, isActive: e.target.value === 'active' }))
                }
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              disabled={addSaving}
              onClick={() => {
                setAddOpen(false);
                setAddForm(EMPTY_ADD_FORM);
              }}
              className="h-10 rounded-lg border border-[#D0D5DD] px-4 text-sm font-semibold text-[#344054] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={addSaving}
              onClick={handleAddSave}
              className="h-10 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: ACCENT }}
            >
              {addSaving ? 'Creating…' : 'Create affiliate'}
            </button>
          </div>
        </ModalShell>
      ) : null}

      {viewUser ? (
        <ModalShell title="Affiliate details" onClose={() => setViewUser(null)} wide>
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
            label="Signed agreement"
            value={
              viewUser.signedAgreementUploadedAt
                ? `${viewUser.signedAgreementDocumentName || 'Uploaded'} · ${formatDate(
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
                {viewUser.affiliateIssuedPassword || 'Not issued — use Resend login email'}
              </code>
            </p>
            {viewUser.affiliateCredentialsIssuedAt ? (
              <p className="mt-1 text-[12px] text-[#667085]">
                Issued {formatDate(viewUser.affiliateCredentialsIssuedAt)}
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
          <DetailRow
            label="Email verified"
            value={viewUser.isEmailVerified ? 'Yes' : 'No'}
          />
          <DetailRow label="Status" value={viewUser.isActive ? 'Active' : 'Suspended'} />
          <DetailRow label="Last login" value={formatDate(viewUser.lastLogin)} />
          <DetailRow label="Joined" value={formatDate(viewUser.createdAt)} />

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
                className="h-9 rounded-lg border border-emerald-200 px-3 text-[13px] font-semibold text-emerald-700"
              >
                View signed agreement
              </button>
            ) : null}
          </div>
        </ModalShell>
      ) : null}

      {editUser && editForm ? (
        <ModalShell
          title="Edit affiliate"
          onClose={() => {
            setEditUser(null);
            setEditForm(null);
          }}
          wide
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
                First name
              </label>
              <input
                className={inputClass}
                value={editForm.firstName}
                onChange={(e) => setEditForm((p) => ({ ...p, firstName: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
                Last name
              </label>
              <input
                className={inputClass}
                value={editForm.lastName}
                onChange={(e) => setEditForm((p) => ({ ...p, lastName: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-semibold text-[#101828]">Phone</label>
              <input
                className={inputClass}
                value={editForm.phone}
                onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
                Affiliate type
              </label>
              <select
                className={inputClass}
                value={editForm.affiliateType}
                onChange={(e) => setEditForm((p) => ({ ...p, affiliateType: e.target.value }))}
              >
                <option value="">Select type</option>
                {AFFILIATE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {editForm.affiliateType === AFFILIATE_TYPES.STUDENT ? (
              <>
                <div>
                  <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
                    College
                  </label>
                  <input
                    className={inputClass}
                    value={editForm.collegeName}
                    onChange={(e) => setEditForm((p) => ({ ...p, collegeName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
                    University
                  </label>
                  <input
                    className={inputClass}
                    value={editForm.universityName}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, universityName: e.target.value }))
                    }
                  />
                </div>
              </>
            ) : null}

            {editForm.affiliateType === AFFILIATE_TYPES.SOCIAL_MEDIA_CREATOR ? (
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
                  Social media account
                </label>
                <input
                  className={inputClass}
                  value={editForm.socialMediaAccount}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, socialMediaAccount: e.target.value }))
                  }
                />
              </div>
            ) : null}

            <div className="sm:col-span-2">
              <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
                Why do you join with us?
              </label>
              <textarea
                className={textareaClass}
                value={editForm.joinReason}
                onChange={(e) => setEditForm((p) => ({ ...p, joinReason: e.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
                Verification status
              </label>
              <select
                className={inputClass}
                value={editForm.verificationStatus}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, verificationStatus: e.target.value }))
                }
              >
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
                Account status
              </label>
              <select
                className={inputClass}
                value={editForm.isActive ? 'active' : 'suspended'}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, isActive: e.target.value === 'active' }))
                }
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            <div className="sm:col-span-2 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-4">
              <p className="text-[13px] font-semibold text-[#101828]">Special affiliate rates</p>
              <p className="mt-0.5 text-[12px] text-[#667085]">
                Overrides Affiliate Settings defaults for this affiliate only.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-[#344054]">
                    Partner discount (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    className={inputClass}
                    value={editForm.affiliateDiscountPercent}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        affiliateDiscountPercent: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-[#344054]">
                    Affiliate earning (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    className={inputClass}
                    value={editForm.affiliateEarningPercent}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        affiliateEarningPercent: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-[#344054]">
                    Minimum target (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className={inputClass}
                    value={editForm.affiliateMinimumTargetValue}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        affiliateMinimumTargetValue: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditUser(null);
                setEditForm(null);
              }}
              className="h-10 rounded-lg border border-[#D0D5DD] px-4 text-sm font-semibold text-[#344054]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={editSaving}
              onClick={handleEditSave}
              className="h-10 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: ACCENT }}
            >
              {editSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </ModalShell>
      ) : null}

      {issuedCredentials ? (
        <ModalShell
          title="Login details — share with affiliate"
          onClose={() => setIssuedCredentials(null)}
        >
          <p className="mb-3 text-sm text-[#344054]">
            Email was sent to{' '}
            <span className="font-semibold text-[#101828]">{issuedCredentials.email}</span>.
            Some inboxes filter these mails — copy and share below if needed.
          </p>
          <div className="space-y-3 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] p-4">
            <p className="text-[13px] font-semibold text-[#065F46]">{issuedCredentials.name}</p>
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
              className="h-10 rounded-lg px-4 text-sm font-semibold text-white"
              style={{ backgroundColor: ACCENT }}
            >
              Done
            </button>
          </div>
        </ModalShell>
      ) : null}

      {deleteUser ? (
        <ModalShell title="Delete affiliate" onClose={() => setDeleteUser(null)}>
          <p className="text-sm text-[#344054]">
            Delete <span className="font-semibold text-[#101828]">{displayName(deleteUser)}</span>{' '}
            ({deleteUser.email})? This cannot be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteUser(null)}
              className="h-10 rounded-lg border border-[#D0D5DD] px-4 text-sm font-semibold text-[#344054]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={actionId === deleteUser._id}
              onClick={handleDelete}
              className="h-10 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {actionId === deleteUser._id ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </ModalShell>
      ) : null}

      {portfolio || portfolioLoading ? (
        <ModalShell
          xl
          title={
            portfolio?.affiliate
              ? `Portfolio — ${portfolio.affiliate.fullName || portfolio.affiliate.email}`
              : 'Affiliate portfolio'
          }
          onClose={() => {
            setPortfolio(null);
            setPortfolioSearch('');
          }}
        >
          {portfolioLoading && !portfolio ? (
            <p className="py-10 text-center text-sm text-[#667085]">Loading clients…</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#667085]">
                <span>
                  Code{' '}
                  <code className="rounded bg-[#F2F4F7] px-1.5 py-0.5 font-mono text-[12px] font-semibold text-[#021A54]">
                    {portfolio?.affiliate?.discountCode || '—'}
                  </code>
                </span>
                <span className="text-[#D0D5DD]">·</span>
                <span>
                  Earning {portfolio?.summary?.earningPercent ?? 20}% of plan (ex-GST)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#667085]">
                    Clients joined
                  </p>
                  <p className="mt-1 text-xl font-semibold text-[#021A54]">
                    {portfolio?.summary?.clientCount ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#667085]">
                    Payments
                  </p>
                  <p className="mt-1 text-xl font-semibold text-[#101828]">
                    {portfolio?.summary?.paymentCount ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#667085]">
                    Client revenue
                  </p>
                  <p className="mt-1 text-xl font-semibold text-[#101828]">
                    {formatMoney(portfolio?.summary?.lifetimeTaxableRevenue)}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E5E7EB] bg-[#ECFDF5] px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#067085]">
                    Affiliate earning
                  </p>
                  <p className="mt-1 text-xl font-semibold text-[#065F46]">
                    {formatMoney(portfolio?.summary?.lifetimeAffiliateEarning)}
                  </p>
                </div>
              </div>

              <div className="relative">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]"
                />
                <input
                  className="h-10 w-full rounded-lg border border-[#D0D5DD] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#021A54] focus:ring-1 focus:ring-[#021A54]"
                  placeholder="Search client, email, plan…"
                  value={portfolioSearch}
                  onChange={(e) => setPortfolioSearch(e.target.value)}
                />
              </div>

              {(() => {
                const q = portfolioSearch.trim().toLowerCase();
                const rows = (portfolio?.clients || []).filter((c) => {
                  if (!q) return true;
                  return [c.tenantName, c.ownerName, c.ownerEmail, c.planName]
                    .join(' ')
                    .toLowerCase()
                    .includes(q);
                });

                if (!rows.length) {
                  return (
                    <p className="rounded-xl border border-dashed border-[#E5E7EB] px-4 py-8 text-center text-sm text-[#667085]">
                      {portfolio?.summary?.clientCount
                        ? 'No clients match this search.'
                        : 'No clients have joined with this affiliate’s discount code yet.'}
                    </p>
                  );
                }

                return (
                  <div className="overflow-hidden rounded-xl border border-[#E5E7EB]">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-[#F8FAFC] text-[12px] uppercase tracking-wide text-[#667085]">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Client</th>
                          <th className="px-4 py-3 font-semibold">Plan</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          <th className="px-4 py-3 font-semibold">Revenue</th>
                          <th className="px-4 py-3 font-semibold">Earning</th>
                          <th className="px-4 py-3 font-semibold">Joined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((client) => (
                          <tr
                            key={client.ownerEmail || client.tenantId}
                            className="border-t border-[#F2F4F7]"
                          >
                            <td className="px-4 py-3 align-top">
                              <p className="font-semibold text-[#101828]">
                                {client.tenantName || client.ownerName || 'Client'}
                              </p>
                              <p className="mt-0.5 text-[12px] text-[#667085]">
                                {client.ownerEmail || '—'}
                              </p>
                            </td>
                            <td className="px-4 py-3 align-top text-[#344054]">
                              {client.planName || '—'}
                              {client.paymentCount > 1 ? (
                                <span className="mt-0.5 block text-[11px] text-[#98A2B3]">
                                  {client.paymentCount} payments
                                </span>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 align-top">
                              {client.tenantStatus ? (
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                                    client.tenantStatus === 'active'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : 'bg-[#F2F4F7] text-[#667085]'
                                  }`}
                                >
                                  {client.tenantStatus}
                                </span>
                              ) : (
                                <span className="text-[#98A2B3]">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 align-top font-medium text-[#101828]">
                              {formatMoney(client.taxableTotal)}
                            </td>
                            <td className="px-4 py-3 align-top font-medium text-[#065F46]">
                              {formatMoney(client.affiliateEarningTotal)}
                            </td>
                            <td className="px-4 py-3 align-top text-[#667085]">
                              {formatDate(client.firstPaidAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}
        </ModalShell>
      ) : null}
    </div>
  );
}
