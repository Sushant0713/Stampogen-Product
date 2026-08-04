'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import { tenantService } from '@/services/tenant.service';
import { planService } from '@/services/plan.service';
import { paymentService } from '@/services/payment.service';
import { getErrorMessage } from '@/utils';
import { subscribeClientsChanged, notifyClientsChanged } from '@/utils/clientsSync';
import { SHOP_CATEGORIES, SHOP_CATEGORY_OPTIONS } from '@/constants';
import {
  BillingAddressFields,
  composeBillingAddress,
} from '@/components/forms/BillingAddressFields';

const PAGE_SIZE = 10;
const ACCENT = '#021A54';

const EMPTY_ADD_FORM = {
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  phone: '',
  name: '',
  category: '',
  customCategory: '',
  street: '',
  city: '',
  state: '',
  stateCode: '',
  pin: '',
  gstin: '',
  pan: '',
  planId: '',
  password: '',
  discountCode: '',
};

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'pending', label: 'Pending' },
];

const actionBtnClass =
  'inline-flex h-8 w-full items-center justify-center gap-1 rounded-md border bg-white px-3 text-[12px] font-semibold transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50';

const inputClass =
  'h-10 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none focus:border-[#021A54] focus:ring-1 focus:ring-[#021A54]';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatMoney(amount = 0) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
}

function accountLabel(status) {
  if (status === 'suspended') return 'Suspended';
  if (status === 'inactive') return 'Inactive';
  if (status === 'pending') return 'Pending';
  return 'Active';
}

function accountBadgeClass(status) {
  if (status === 'suspended') return 'bg-red-50 text-red-700';
  if (status === 'inactive') return 'bg-gray-100 text-gray-600';
  if (status === 'pending') return 'bg-amber-50 text-amber-700';
  return 'bg-emerald-50 text-emerald-700';
}

function ownerDisplayName(owner = {}) {
  return (
    owner.fullName ||
    [owner.firstName, owner.lastName].filter(Boolean).join(' ') ||
    '—'
  );
}

function formatClientAddress(client) {
  const bp = client?.billingProfile || {};
  if (String(bp.address || '').trim()) {
    return String(bp.address).trim();
  }
  const line = [bp.street, bp.city, bp.state, bp.pin]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');
  return line || '—';
}

function DetailRow({ label, value }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-[#F2F4F7] py-2.5 last:border-b-0">
      <p className="text-[13px] font-medium text-[#667085]">{label}</p>
      <p className="break-words text-[13px] text-[#101828]">{value || '—'}</p>
    </div>
  );
}

function ModalShell({ title, onClose, children, wide = false, footer = null }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white shadow-xl ${
          wide ? 'max-w-2xl' : 'max-w-lg'
        }`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
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
        {footer ? (
          <div className="sticky bottom-0 border-t border-[#F2F4F7] bg-white px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
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

export function ClientManagement() {
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState({
    totalClients: 0,
    active: 0,
    suspended: 0,
    activeSubscriptions: 0,
  });
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
  const [assignablePlans, setAssignablePlans] = useState([]);
  const [viewClient, setViewClient] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [planClient, setPlanClient] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [planSaving, setPlanSaving] = useState(false);
  const [trialModal, setTrialModal] = useState(null);
  const [trialPlanId, setTrialPlanId] = useState('');
  const [trialDays, setTrialDays] = useState('14');
  const [trialSaving, setTrialSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM);
  const [addSaving, setAddSaving] = useState(false);
  const [discountApplying, setDiscountApplying] = useState(false);
  const [discountApplied, setDiscountApplied] = useState(null);
  const [issuedCredentials, setIssuedCredentials] = useState(null);
  const pageRef = useRef(1);

  useEffect(() => {
    pageRef.current = pagination.page;
  }, [pagination.page]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await planService.getAll({ limit: 200, lite: true });
        if (cancelled) return;
        const plans = (data?.data?.plans || []).filter(
          (plan) =>
            plan.enabled !== false &&
            plan.status !== 'Inactive' &&
            !plan.priceCustom &&
            plan.visibleSuperAdmin !== false
        );
        setAssignablePlans(plans);
      } catch (error) {
        if (!cancelled) {
          toast.error(getErrorMessage(error, 'Unable to load plans'));
          setAssignablePlans([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadStats = useCallback(async ({ silent = false } = {}) => {
    try {
      const { data } = await tenantService.getStats();
      setStats(data.data.stats);
    } catch (error) {
      if (!silent) toast.error(getErrorMessage(error, 'Unable to load client stats'));
    }
  }, []);

  const loadClients = useCallback(
    async (page = 1, { silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);
        const { data } = await tenantService.getAll({
          page,
          limit: PAGE_SIZE,
          search: debouncedSearch || undefined,
          status: status || undefined,
        });

        setClients(data.data.tenants || []);
        setPagination(data.data.pagination || { page: 1, limit: PAGE_SIZE, total: 0, pages: 1 });
      } catch (error) {
        if (!silent) toast.error(getErrorMessage(error, 'Unable to load clients'));
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
    loadClients(1);
  }, [loadClients]);

  // Soft refresh on payment broadcast / focus — no aggressive interval
  useEffect(() => {
    let focusTimer;

    const refresh = () => {
      loadClients(pageRef.current, { silent: true });
      loadStats({ silent: true });
    };

    const unsubscribe = subscribeClientsChanged(refresh);

    const onFocus = () => {
      window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(refresh, 600);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onFocus();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearTimeout(focusTimer);
      unsubscribe();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loadClients, loadStats]);

  const rangeLabel = useMemo(() => {
    if (!pagination.total) return '0 clients';
    const start = (pagination.page - 1) * pagination.limit + 1;
    const end = Math.min(pagination.page * pagination.limit, pagination.total);
    return `${start}–${end} of ${pagination.total}`;
  }, [pagination]);

  const handleView = async (client) => {
    try {
      setViewLoading(true);
      setViewClient(client);
      const { data } = await tenantService.getById(client._id);
      setViewClient(data?.data?.tenant || client);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to load client'));
      setViewClient(null);
    } finally {
      setViewLoading(false);
    }
  };

  const openChangePlan = (client) => {
    setPlanClient(client);
    setSelectedPlanId('');
  };

  const closeChangePlan = () => {
    if (planSaving) return;
    setPlanClient(null);
    setSelectedPlanId('');
  };

  const openTrialModal = (client, mode) => {
    const currentName = String(
      client.trial?.planName || client.currentPlan?.name || client.billing?.planName || ''
    ).toLowerCase();
    const matched = assignablePlans.find(
      (plan) => String(plan.name || '').toLowerCase() === currentName
    );
    setTrialModal({ client, mode });
    setTrialPlanId(matched ? String(matched.id || matched._id) : '');
    setTrialDays(mode === 'extend' ? '7' : '14');
  };

  const closeTrialModal = () => {
    if (trialSaving) return;
    setTrialModal(null);
    setTrialPlanId('');
    setTrialDays('14');
  };

  const handleTrialSubmit = async () => {
    if (!trialModal?.client) return;
    const days = Number(trialDays);
    if (!Number.isFinite(days) || days < 1 || days > 3650) {
      toast.error('Days must be between 1 and 3650');
      return;
    }

    if (trialModal.mode !== 'extend') {
      if (!trialPlanId) {
        toast.error('Select a plan first');
        return;
      }
    }

    try {
      setTrialSaving(true);
      setActionId(trialModal.client._id);
      if (trialModal.mode === 'extend') {
        await tenantService.extendTrial(trialModal.client._id, { days });
        toast.success(`Trial extended by ${days} day${days === 1 ? '' : 's'}`);
      } else {
        const selected = assignablePlans.find(
          (plan) => String(plan.id || plan._id) === String(trialPlanId)
        );
        if (!selected) {
          toast.error('Selected plan is unavailable');
          return;
        }
        await tenantService.grantTrial(trialModal.client._id, {
          planId: selected.id || selected._id,
          planName: selected.name,
          planCode: selected.code,
          days,
        });
        toast.success(
          trialModal.mode === 'change'
            ? `Trial changed to ${selected.name} (${days} days)`
            : `Trial granted: ${selected.name} for ${days} days`
        );
      }
      setTrialModal(null);
      setTrialPlanId('');
      setTrialDays('14');
      await Promise.all([loadClients(pagination.page), loadStats()]);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to update trial'));
    } finally {
      setTrialSaving(false);
      setActionId(null);
    }
  };

  const handleChangePlan = async () => {
    if (!planClient || !selectedPlanId) {
      toast.error('Select a plan first');
      return;
    }
    const selected = assignablePlans.find(
      (plan) => String(plan.id || plan._id) === String(selectedPlanId)
    );
    if (!selected) {
      toast.error('Selected plan is unavailable');
      return;
    }

    try {
      setPlanSaving(true);
      setActionId(planClient._id);
      const { data } = await tenantService.changePlan(planClient._id, {
        planId: selected.id || selected._id,
        planName: selected.name,
        planCode: selected.code,
      });
      const invoice = data?.data?.tenant?.invoice;
      if (invoice?.invoiceNumber) {
        toast.success(
          invoice.emailed
            ? `Plan changed to ${selected.name}. Invoice ${invoice.invoiceNumber} emailed.`
            : `Plan changed to ${selected.name}. Invoice ${invoice.invoiceNumber} generated.`
        );
      } else {
        toast.success(`Plan changed to ${selected.name}`);
      }
      setPlanClient(null);
      setSelectedPlanId('');
      await Promise.all([loadClients(pagination.page), loadStats()]);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to change plan'));
    } finally {
      setPlanSaving(false);
      setActionId(null);
    }
  };

  const planOptionsForClient = useMemo(() => {
    if (!planClient) return [];
    const currentName = String(planClient.billing?.planName || '').toLowerCase();
    return assignablePlans.filter(
      (plan) => String(plan.name || '').toLowerCase() !== currentName
    );
  }, [assignablePlans, planClient]);

  const handleSuspend = async (client) => {
    const nextStatus = client.status === 'suspended' ? 'active' : 'suspended';
    const previousClients = clients;
    const previousStats = stats;
    const previousPagination = pagination;
    const stillMatchesFilter = !status || status === nextStatus;
    const hasPlan =
      Boolean(client.billing?.planName) && client.billing.planName !== 'No plan';

    const patchedClient = {
      ...client,
      status: nextStatus,
      billing: client.billing
        ? {
            ...client.billing,
            subscription: hasPlan
              ? nextStatus === 'suspended'
                ? 'Paused'
                : 'Active'
              : client.billing.subscription,
          }
        : client.billing,
    };

    setActionId(client._id);

    // Update the row (or drop it from a filtered view) immediately — no full reload
    if (stillMatchesFilter) {
      setClients((prev) => prev.map((row) => (row._id === client._id ? patchedClient : row)));
    } else {
      setClients((prev) => prev.filter((row) => row._id !== client._id));
      setPagination((prev) => ({
        ...prev,
        total: Math.max(0, (prev.total || 0) - 1),
      }));
    }

    setStats((prev) => {
      const next = { ...prev };
      if (nextStatus === 'suspended') {
        if (client.status === 'active') next.active = Math.max(0, (next.active || 0) - 1);
        next.suspended = (next.suspended || 0) + 1;
        if (client.billing?.subscription === 'Active') {
          next.activeSubscriptions = Math.max(0, (next.activeSubscriptions || 0) - 1);
        }
      } else {
        next.suspended = Math.max(0, (next.suspended || 0) - 1);
        if (nextStatus === 'active') next.active = (next.active || 0) + 1;
        if (hasPlan) next.activeSubscriptions = (next.activeSubscriptions || 0) + 1;
      }
      return next;
    });

    try {
      await tenantService.update(client._id, { status: nextStatus });
      toast.success(nextStatus === 'suspended' ? 'Client suspended' : 'Client activated');
      loadStats({ silent: true });
    } catch (error) {
      setClients(previousClients);
      setStats(previousStats);
      setPagination(previousPagination);
      toast.error(getErrorMessage(error, 'Unable to update client'));
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (client) => {
    const confirmed = window.confirm(
      `Delete client "${client.name}"?\n\nThis permanently removes the shop and the admin account (${client.owner?.email || 'owner'}). This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setActionId(client._id);
      await tenantService.remove(client._id);
      toast.success('Client deleted');
      notifyClientsChanged();
      const nextPage =
        clients.length === 1 && pagination.page > 1 ? pagination.page - 1 : pagination.page;
      await Promise.all([loadClients(nextPage), loadStats()]);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to delete client'));
    } finally {
      setActionId(null);
    }
  };

  const handleAddOpen = () => {
    setAddForm(EMPTY_ADD_FORM);
    setDiscountApplied(null);
    setAddOpen(true);
  };

  const handleApplyDiscount = async () => {
    const code = String(addForm.discountCode || '')
      .trim()
      .toUpperCase();
    if (!code) {
      toast.error('Enter a discount code');
      return;
    }

    try {
      setDiscountApplying(true);
      const email = addForm.email.trim();
      if (addForm.planId) {
        const { data } = await paymentService.preview({
          planId: addForm.planId,
          discountCode: code,
          customerEmail: email || undefined,
          customerState: addForm.state.trim() || undefined,
          customerGstin: addForm.gstin.trim() || undefined,
        });
        const quote = data?.data?.quote;
        if (!quote?.discountCode) {
          throw new Error('Discount could not be applied');
        }
        setAddForm((f) => ({ ...f, discountCode: quote.discountCode }));
        setDiscountApplied({
          code: quote.discountCode,
          discountAmount: Number(quote.discountAmount) || 0,
          payableAmount: Number(quote.payableAmount) || 0,
          listAmount: Number(quote.listAmount) || 0,
        });
        toast.success(
          email
            ? `Discount ${quote.discountCode} applied`
            : `Discount ${quote.discountCode} applied (enter email to confirm first-payment eligibility)`
        );
      } else {
        // No plan yet — reserve code; backend validates on create
        setAddForm((f) => ({ ...f, discountCode: code }));
        setDiscountApplied({ code, discountAmount: null, payableAmount: null, listAmount: null });
        toast.success(`Discount ${code} will be reserved for this client`);
      }
    } catch (error) {
      setDiscountApplied(null);
      toast.error(getErrorMessage(error, 'Unable to apply discount'));
    } finally {
      setDiscountApplying(false);
    }
  };

  const handleAddSave = async () => {
    if (!addForm.firstName.trim() || !addForm.lastName.trim()) {
      toast.error('First and last name are required');
      return;
    }
    if (!addForm.email.trim()) {
      toast.error('Email is required');
      return;
    }
    if (!addForm.phone.trim() || addForm.phone.trim().length < 8) {
      toast.error('Valid phone number is required');
      return;
    }
    if (!addForm.name.trim()) {
      toast.error('Company / shop name is required');
      return;
    }
    if (!addForm.category) {
      toast.error('Shop category is required');
      return;
    }
    if (
      addForm.category === SHOP_CATEGORIES.CUSTOM &&
      addForm.customCategory.trim().length < 2
    ) {
      toast.error('Please enter a custom category');
      return;
    }
    if (!addForm.street.trim()) {
      toast.error('Street address is required');
      return;
    }
    if (!addForm.state.trim() || !addForm.city.trim()) {
      toast.error('State and city are required');
      return;
    }
    if (!/^\d{6}$/.test(addForm.pin.trim())) {
      toast.error('Valid 6-digit PIN is required');
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
        name: addForm.name.trim(),
        category: addForm.category,
        customCategory:
          addForm.category === SHOP_CATEGORIES.CUSTOM
            ? addForm.customCategory.trim()
            : '',
        street: addForm.street.trim(),
        city: addForm.city.trim(),
        state: addForm.state.trim(),
        pin: addForm.pin.trim(),
        address: composeBillingAddress({
          street: addForm.street,
          city: addForm.city,
          state: addForm.state,
          pin: addForm.pin,
        }),
        gstin: addForm.gstin.trim(),
        pan: addForm.pan.trim(),
        ...(addForm.planId ? { planId: addForm.planId } : {}),
        ...(addForm.password.trim() ? { password: addForm.password.trim() } : {}),
        ...(addForm.discountCode.trim()
          ? { discountCode: addForm.discountCode.trim().toUpperCase() }
          : {}),
      };

      const { data } = await tenantService.create(payload);
      const result = data?.data || {};
      if (result.issuedPassword) {
        setIssuedCredentials({
          name:
            [result.owner?.firstName, result.owner?.lastName].filter(Boolean).join(' ') ||
            addForm.firstName,
          email: result.owner?.email || addForm.email,
          password: result.issuedPassword,
          shopName: result.tenant?.name || addForm.name,
          loginUrl: result.loginUrl || '',
        });
      }
      toast.success('Client created');
      notifyClientsChanged();
      setAddOpen(false);
      setAddForm(EMPTY_ADD_FORM);
      await Promise.all([loadClients(1), loadStats()]);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to create client'));
    } finally {
      setAddSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-[#101828]">
            Client Management
          </h1>
          <p className="mt-1 text-sm text-[#667085]">
            Manage client accounts, subscriptions, and company profiles
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddOpen}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition hover:opacity-90"
          style={{ backgroundColor: ACCENT }}
        >
          <Plus size={18} />
          Add Client
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Clients" value={stats.totalClients} icon={Users} />
        <StatCard label="Active" value={stats.active} icon={UserCheck} />
        <StatCard label="Suspended" value={stats.suspended} icon={UserMinus} />
        <StatCard
          label="Active Subscriptions"
          value={stats.activeSubscriptions}
          icon={CreditCard}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-[#ECEFF3] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex flex-col gap-3 border-b border-[#F2F4F7] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-base font-semibold text-[#101828]">All Clients</h2>
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
                placeholder="Search name, email, company"
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
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Company</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Subscription</th>
                <th className="px-5 py-3">Account</th>
                <th className="px-5 py-3">No. of Cycles</th>
                <th className="px-5 py-3">Discount coupon</th>
                <th className="px-5 py-3">Revenue</th>
                <th className="px-5 py-3">Joined</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-[#667085]">
                    Loading clients...
                  </td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-[#667085]">
                    No clients found
                  </td>
                </tr>
              ) : (
                clients.map((client) => {
                  const owner = client.owner || {};
                  const ownerName =
                    owner.fullName ||
                    [owner.firstName, owner.lastName].filter(Boolean).join(' ') ||
                    '—';
                  const busy = actionId === client._id;
                  const billing = client.billing || {
                    planName: 'No plan',
                    pricePerCycle: 0,
                    subscription: 'None',
                    cycles: 0,
                    revenue: 0,
                  };
                  const onTrial =
                    client.subscriptionSource === 'trial' || Boolean(client.trial?.active);

                  return (
                    <tr key={client._id} className="border-t border-[#F2F4F7]">
                      <td className="px-5 py-4 align-top">
                        <p className="font-semibold text-[#101828]">{ownerName}</p>
                        <p className="mt-0.5 text-[13px] text-[#667085]">{owner.email || '—'}</p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="font-semibold text-[#101828]">{client.name}</p>
                        <p className="mt-0.5 text-[13px] text-[#667085]">{owner.email || '—'}</p>
                      </td>
                      <td className="px-5 py-4 align-top text-[#344054]">
                        <p className="font-medium text-[#101828]">
                          {billing.planName && billing.planName !== 'No plan'
                            ? billing.planName
                            : 'No plan'}
                        </p>
                        {onTrial ? (
                          <span className="mt-1 inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
                            Trial
                          </span>
                        ) : null}
                        {billing.planName &&
                        billing.planName !== 'No plan' &&
                        Number(billing.pricePerCycle) >= 0 ? (
                          <p className="mt-0.5 text-[12px] text-[#667085]">
                            {formatMoney(billing.pricePerCycle)} / cycle
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 align-top">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-medium ${
                            billing.subscription === 'Active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : billing.subscription === 'Paused'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-[#F2F4F7] text-[#667085]'
                          }`}
                        >
                          {billing.subscription}
                        </span>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${accountBadgeClass(client.status)}`}
                        >
                          {accountLabel(client.status)}
                        </span>
                        <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.04em] text-[#98A2B3]">
                          Email sign-up{' '}
                          <span className="text-[#2E90FA]">
                            {owner.isEmailVerified ? 'Verified' : 'Unverified'}
                          </span>
                        </p>
                      </td>
                      <td className="px-5 py-4 align-top font-semibold text-[#101828]">
                        {billing.cycles}
                      </td>
                      <td className="px-5 py-4 align-top">
                        {billing.discountCode ||
                        (Array.isArray(billing.discountCodes) &&
                          billing.discountCodes.length > 0) ? (
                          <div>
                            <code className="rounded bg-[#F2F4F7] px-1.5 py-0.5 text-[12px] font-semibold text-[#021A54]">
                              {billing.discountCode || billing.discountCodes[0]}
                            </code>
                            {Number(billing.discountAmount) > 0 ? (
                              <p className="mt-1 text-[12px] text-[#667085]">
                                −{formatMoney(billing.discountAmount)}
                              </p>
                            ) : Number(billing.discountTotal) > 0 ? (
                              <p className="mt-1 text-[12px] text-[#667085]">
                                −{formatMoney(billing.discountTotal)} total
                              </p>
                            ) : null}
                            {Array.isArray(billing.discountCodes) &&
                            billing.discountCodes.length > 1 ? (
                              <p className="mt-0.5 text-[11px] text-[#98A2B3]">
                                +{billing.discountCodes.length - 1} more
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-[13px] text-[#98A2B3]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="font-semibold text-[#101828]">
                          {formatMoney(billing.revenue)}
                        </p>
                        {Number(billing.listTotal) > Number(billing.revenue) ? (
                          <p className="mt-0.5 text-[12px] text-[#667085]">
                            After discount · list {formatMoney(billing.listTotal)}
                          </p>
                        ) : billing.paymentCount > 0 ? (
                          <p className="mt-0.5 text-[12px] text-[#667085]">
                            Paid amount
                          </p>
                        ) : billing.cycles > 0 && billing.pricePerCycle > 0 ? (
                          <p className="mt-0.5 text-[12px] text-[#667085]">
                            Ledger · {formatMoney(billing.pricePerCycle)}/cycle
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 align-top text-[#344054]">
                        {formatDate(client.createdAt)}
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex min-w-[120px] flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => handleView(client)}
                            disabled={busy || viewLoading}
                            className={actionBtnClass}
                            style={{ borderColor: ACCENT, color: ACCENT }}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => openChangePlan(client)}
                            disabled={busy || assignablePlans.length === 0}
                            className={actionBtnClass}
                            style={{ borderColor: ACCENT, color: ACCENT }}
                            title={
                              assignablePlans.length === 0
                                ? 'No assignable plans available'
                                : `Change plan for ${client.name}`
                            }
                          >
                            Change plan
                            <ChevronDown size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openTrialModal(client, onTrial ? 'change' : 'grant')}
                            disabled={busy || assignablePlans.length === 0}
                            className={actionBtnClass}
                            style={{ borderColor: ACCENT, color: ACCENT }}
                          >
                            {onTrial ? 'Change trial' : 'Grant trial'}
                          </button>
                          {onTrial ? (
                            <button
                              type="button"
                              onClick={() => openTrialModal(client, 'extend')}
                              disabled={busy}
                              className={actionBtnClass}
                              style={{ borderColor: ACCENT, color: ACCENT }}
                            >
                              Extend trial
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleSuspend(client)}
                            disabled={busy}
                            className={actionBtnClass}
                            style={{ borderColor: ACCENT, color: ACCENT }}
                          >
                            {client.status === 'suspended' ? 'Activate' : 'Suspend'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(client)}
                            disabled={busy}
                            className="inline-flex h-8 w-full items-center justify-center rounded-md bg-[#D92D20] text-white transition hover:bg-[#B42318] disabled:opacity-50"
                            aria-label={`Delete ${client.name}`}
                          >
                            <Trash2 size={14} />
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

        <div className="flex flex-col gap-3 border-t border-[#F2F4F7] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#667085]">{rangeLabel}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || pagination.page <= 1}
              onClick={() => loadClients(pagination.page - 1)}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium text-[#344054] transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <span className="min-w-[88px] text-center text-sm font-medium text-[#344054]">
              Page {pagination.page} of {pagination.pages}
            </span>
            <button
              type="button"
              disabled={loading || pagination.page >= pagination.pages}
              onClick={() => loadClients(pagination.page + 1)}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium text-[#344054] transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {viewClient ? (
        <ModalShell
          title="Client details"
          wide
          onClose={() => {
            if (!viewLoading) setViewClient(null);
          }}
        >
          {viewLoading ? (
            <p className="py-8 text-center text-sm text-[#667085]">Loading client...</p>
          ) : (
            <div>
              <DetailRow label="Client" value={ownerDisplayName(viewClient.owner)} />
              <DetailRow label="Email" value={viewClient.owner?.email} />
              <DetailRow
                label="Phone"
                value={viewClient.owner?.phone || viewClient.billingProfile?.phone}
              />
              <DetailRow label="Company" value={viewClient.name} />
              <DetailRow label="Slug" value={viewClient.slug} />
              <DetailRow label="Address" value={formatClientAddress(viewClient)} />
              <DetailRow label="Account" value={accountLabel(viewClient.status)} />
              <DetailRow
                label="Email sign-up"
                value={viewClient.owner?.isEmailVerified ? 'Verified' : 'Unverified'}
              />
              <DetailRow
                label="Plan"
                value={
                  viewClient.billing?.planName && viewClient.billing.planName !== 'No plan'
                    ? `${viewClient.billing.planName} · ${formatMoney(
                        viewClient.billing.pricePerCycle || 0
                      )} / cycle`
                    : 'No plan'
                }
              />
              <DetailRow
                label="Trial"
                value={
                  viewClient.subscriptionSource === 'trial' || viewClient.trial?.active
                    ? `Active · ends ${formatDate(viewClient.trial?.endsAt || viewClient.currentPlan?.endsAt)}`
                    : viewClient.trial?.endsAt
                      ? `Ended ${formatDate(viewClient.trial.endsAt)}`
                      : '—'
                }
              />
              <DetailRow
                label="Subscription"
                value={viewClient.billing?.subscription || 'None'}
              />
              <DetailRow label="Cycles" value={String(viewClient.billing?.cycles ?? 0)} />
              <DetailRow
                label="Discount"
                value={
                  viewClient.billing?.discountCode ||
                  (Array.isArray(viewClient.billing?.discountCodes) &&
                  viewClient.billing.discountCodes.length
                    ? viewClient.billing.discountCodes.join(', ')
                    : '') ||
                  viewClient.reservedDiscountCode ||
                  '—'
                }
              />
              <DetailRow
                label="Revenue"
                value={formatMoney(viewClient.billing?.revenue || 0)}
              />
              <DetailRow label="Joined" value={formatDate(viewClient.createdAt)} />
            </div>
          )}
        </ModalShell>
      ) : null}

      {planClient ? (
        <ModalShell
          title="Change plan"
          onClose={closeChangePlan}
          footer={
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeChangePlan}
                disabled={planSaving}
                className="h-10 rounded-lg border border-[#D0D5DD] px-4 text-sm font-semibold text-[#344054] transition hover:bg-[#F9FAFB] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleChangePlan}
                disabled={planSaving || !selectedPlanId || planOptionsForClient.length === 0}
                className="h-10 rounded-lg px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: ACCENT }}
              >
                {planSaving ? 'Updating...' : 'Confirm change'}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-[#101828]">{planClient.name}</p>
              <p className="mt-0.5 text-[13px] text-[#667085]">
                Current plan:{' '}
                <span className="font-medium text-[#344054]">
                  {planClient.billing?.planName && planClient.billing.planName !== 'No plan'
                    ? planClient.billing.planName
                    : 'No plan'}
                </span>
              </p>
            </div>

            {planOptionsForClient.length === 0 ? (
              <p className="rounded-lg border border-[#F2F4F7] bg-[#F9FAFB] px-3 py-3 text-sm text-[#667085]">
                No other assignable plans are available for this client.
              </p>
            ) : (
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
                  New plan
                </span>
                <select
                  value={selectedPlanId}
                  onChange={(event) => setSelectedPlanId(event.target.value)}
                  disabled={planSaving}
                  className="h-11 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none focus:border-[#021A54] focus:ring-1 focus:ring-[#021A54] disabled:opacity-50"
                >
                  <option value="">Select a plan</option>
                  {planOptionsForClient.map((plan) => {
                    const id = plan.id || plan._id;
                    const priceLabel = plan.priceCustom
                      ? 'Custom'
                      : formatMoney(plan.priceAmount || 0);
                    return (
                      <option key={id} value={id}>
                        {plan.name} · {priceLabel}
                        {plan.billing ? ` / ${String(plan.billing).toLowerCase()}` : ''}
                      </option>
                    );
                  })}
                </select>
              </label>
            )}
          </div>
        </ModalShell>
      ) : null}

      {trialModal ? (
        <ModalShell
          title={
            trialModal.mode === 'extend'
              ? 'Extend trial'
              : trialModal.mode === 'change'
                ? 'Change trial'
                : 'Grant trial'
          }
          onClose={closeTrialModal}
          footer={
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeTrialModal}
                disabled={trialSaving}
                className="h-10 rounded-lg border border-[#D0D5DD] px-4 text-sm font-semibold text-[#344054] transition hover:bg-[#F9FAFB] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTrialSubmit}
                disabled={
                  trialSaving ||
                  (trialModal.mode !== 'extend' && (!trialPlanId || assignablePlans.length === 0))
                }
                className="h-10 rounded-lg px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: ACCENT }}
              >
                {trialSaving
                  ? 'Saving...'
                  : trialModal.mode === 'extend'
                    ? 'Extend'
                    : trialModal.mode === 'change'
                      ? 'Update trial'
                      : 'Grant trial'}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-[#101828]">{trialModal.client.name}</p>
              <p className="mt-0.5 text-[13px] text-[#667085]">
                No new registration — trial applies to this shop account.
              </p>
            </div>

            {trialModal.mode !== 'extend' ? (
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
                  Trial plan
                </span>
                <select
                  value={trialPlanId}
                  onChange={(event) => setTrialPlanId(event.target.value)}
                  disabled={trialSaving}
                  className="h-11 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none focus:border-[#021A54] focus:ring-1 focus:ring-[#021A54] disabled:opacity-50"
                >
                  <option value="">Select a plan</option>
                  {assignablePlans.map((plan) => {
                    const id = plan.id || plan._id;
                    return (
                      <option key={id} value={id}>
                        {plan.name}
                        {plan.billing ? ` · ${plan.billing}` : ''}
                      </option>
                    );
                  })}
                </select>
              </label>
            ) : null}

            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
                {trialModal.mode === 'extend' ? 'Extra days' : 'Trial days'}
              </span>
              <input
                type="number"
                min={1}
                max={3650}
                value={trialDays}
                onChange={(event) => setTrialDays(event.target.value)}
                disabled={trialSaving}
                className="h-11 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none focus:border-[#021A54] focus:ring-1 focus:ring-[#021A54] disabled:opacity-50"
              />
            </label>
          </div>
        </ModalShell>
      ) : null}

      {addOpen ? (
        <ModalShell
          title="Add Client"
          wide
          onClose={() => {
            if (!addSaving) setAddOpen(false);
          }}
          footer={
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                disabled={addSaving}
                className="h-10 rounded-lg border border-[#D0D5DD] px-4 text-sm font-semibold text-[#344054] transition hover:bg-[#F9FAFB] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddSave}
                disabled={addSaving}
                className="h-10 rounded-lg px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: ACCENT }}
              >
                {addSaving ? 'Creating...' : 'Create client'}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
                  First name *
                </span>
                <input
                  className={inputClass}
                  value={addForm.firstName}
                  onChange={(e) => setAddForm((f) => ({ ...f, firstName: e.target.value }))}
                  disabled={addSaving}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
                  Middle name
                </span>
                <input
                  className={inputClass}
                  value={addForm.middleName}
                  onChange={(e) => setAddForm((f) => ({ ...f, middleName: e.target.value }))}
                  disabled={addSaving}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
                  Last name *
                </span>
                <input
                  className={inputClass}
                  value={addForm.lastName}
                  onChange={(e) => setAddForm((f) => ({ ...f, lastName: e.target.value }))}
                  disabled={addSaving}
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
                  Email *
                </span>
                <input
                  type="email"
                  className={inputClass}
                  value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  disabled={addSaving}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
                  Phone *
                </span>
                <input
                  className={inputClass}
                  value={addForm.phone}
                  onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                  disabled={addSaving}
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
                Company / shop name *
              </span>
              <input
                className={inputClass}
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                disabled={addSaving}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
                  Category *
                </span>
                <select
                  className={inputClass}
                  value={addForm.category}
                  onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))}
                  disabled={addSaving}
                >
                  <option value="">Select category</option>
                  {SHOP_CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              {addForm.category === SHOP_CATEGORIES.CUSTOM ? (
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
                    Custom category *
                  </span>
                  <input
                    className={inputClass}
                    value={addForm.customCategory}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, customCategory: e.target.value }))
                    }
                    disabled={addSaving}
                  />
                </label>
              ) : (
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
                    Plan (optional)
                  </span>
                  <select
                    className={inputClass}
                    value={addForm.planId}
                    onChange={(e) => {
                      setDiscountApplied(null);
                      setAddForm((f) => ({ ...f, planId: e.target.value }));
                    }}
                    disabled={addSaving}
                  >
                    <option value="">No plan yet</option>
                    {assignablePlans.map((plan) => {
                      const id = plan.id || plan._id;
                      return (
                        <option key={id} value={id}>
                          {plan.name}
                          {!plan.priceCustom
                            ? ` · ${formatMoney(plan.priceAmount || 0)}`
                            : ' · Custom'}
                        </option>
                      );
                    })}
                  </select>
                </label>
              )}
            </div>

            {addForm.category === SHOP_CATEGORIES.CUSTOM ? (
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
                  Plan (optional)
                </span>
                <select
                  className={inputClass}
                  value={addForm.planId}
                  onChange={(e) => {
                    setDiscountApplied(null);
                    setAddForm((f) => ({ ...f, planId: e.target.value }));
                  }}
                  disabled={addSaving}
                >
                  <option value="">No plan yet</option>
                  {assignablePlans.map((plan) => {
                    const id = plan.id || plan._id;
                    return (
                      <option key={id} value={id}>
                        {plan.name}
                        {!plan.priceCustom
                          ? ` · ${formatMoney(plan.priceAmount || 0)}`
                          : ' · Custom'}
                      </option>
                    );
                  })}
                </select>
              </label>
            ) : null}

            <div>
              <span className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
                Discount code (optional)
              </span>
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  value={addForm.discountCode}
                  onChange={(e) => {
                    setDiscountApplied(null);
                    setAddForm((f) => ({
                      ...f,
                      discountCode: e.target.value.toUpperCase(),
                    }));
                  }}
                  placeholder="Enter code"
                  disabled={addSaving || discountApplying}
                />
                <button
                  type="button"
                  onClick={handleApplyDiscount}
                  disabled={addSaving || discountApplying || !addForm.discountCode.trim()}
                  className="h-10 shrink-0 rounded-lg border border-[#021A54] bg-white px-4 text-sm font-bold text-[#021A54] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {discountApplying ? 'Applying…' : 'Apply'}
                </button>
              </div>
              {discountApplied?.code ? (
                <p className="mt-1.5 text-[12px] font-medium text-emerald-700">
                  Applied {discountApplied.code}
                  {discountApplied.discountAmount != null
                    ? ` · save ${formatMoney(discountApplied.discountAmount)}`
                    : ' · reserved for client checkout'}
                  {discountApplied.payableAmount != null
                    ? ` · payable ${formatMoney(discountApplied.payableAmount)}`
                    : ''}
                </p>
              ) : (
                <p className="mt-1.5 text-[11px] text-[#667085]">
                  Select a plan first to preview savings, or reserve a code for their first payment.
                </p>
              )}
            </div>

            <div>
              <p className="mb-2 text-[13px] font-semibold text-[#344054]">Billing address *</p>
              <BillingAddressFields
                idPrefix="add-client-"
                values={{
                  street: addForm.street,
                  city: addForm.city,
                  state: addForm.state,
                  stateCode: addForm.stateCode,
                  pin: addForm.pin,
                }}
                onChange={(next) =>
                  setAddForm((f) => ({
                    ...f,
                    street: next.street ?? f.street,
                    city: next.city ?? f.city,
                    state: next.state ?? f.state,
                    stateCode: next.stateCode ?? f.stateCode,
                    pin: next.pin ?? f.pin,
                  }))
                }
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
                  GSTIN (optional)
                </span>
                <input
                  className={inputClass}
                  value={addForm.gstin}
                  onChange={(e) => setAddForm((f) => ({ ...f, gstin: e.target.value }))}
                  disabled={addSaving}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
                  PAN (optional)
                </span>
                <input
                  className={inputClass}
                  value={addForm.pan}
                  onChange={(e) => setAddForm((f) => ({ ...f, pan: e.target.value }))}
                  disabled={addSaving}
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
                Temporary password (optional)
              </span>
              <input
                type="text"
                className={inputClass}
                value={addForm.password}
                onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Auto-generated if left blank"
                disabled={addSaving}
              />
            </label>
          </div>
        </ModalShell>
      ) : null}

      {issuedCredentials ? (
        <ModalShell
          title="Client login credentials"
          onClose={() => setIssuedCredentials(null)}
          footer={
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIssuedCredentials(null)}
                className="h-10 rounded-lg px-4 text-sm font-semibold text-white"
                style={{ backgroundColor: ACCENT }}
              >
                Done
              </button>
            </div>
          }
        >
          <div className="space-y-3 text-sm text-[#344054]">
            <p>
              Account created for <strong>{issuedCredentials.shopName}</strong>. Login details
              were emailed when SMTP is configured — copy them below too.
            </p>
            <DetailRow label="Owner" value={issuedCredentials.name} />
            <DetailRow label="Email" value={issuedCredentials.email} />
            <DetailRow label="Password" value={issuedCredentials.password} />
            {issuedCredentials.loginUrl ? (
              <DetailRow label="Login URL" value={issuedCredentials.loginUrl} />
            ) : null}
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
