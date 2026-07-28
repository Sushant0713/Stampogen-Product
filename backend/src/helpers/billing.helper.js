const PLAN_RATES = {
  Starter: 999,
  Growth: 2499,
  Business: 4999,
  Enterprise: 9999,
};

function getPlanPrice(planName) {
  return PLAN_RATES[planName] || 0;
}

function countCyclesBetween(startDate, endDate = new Date()) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0;
  }

  const months =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());

  // Include the starting billing month as cycle 1
  return Math.max(1, months + 1);
}

function buildSegment({ planName, pricePerCycle, startDate, endDate = null }) {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;
  const cycles = countCyclesBetween(start, end || new Date());
  const unitPrice = Number(pricePerCycle) || getPlanPrice(planName);

  return {
    planName,
    pricePerCycle: unitPrice,
    startDate: start,
    endDate: end,
    cycles,
    amount: cycles * unitPrice,
  };
}

function refreshOpenSegment(segment, asOf = new Date()) {
  if (!segment || segment.endDate) return segment;

  const cycles = countCyclesBetween(segment.startDate, asOf);
  const price = Number(segment.pricePerCycle) || getPlanPrice(segment.planName);

  return {
    ...segment,
    cycles,
    amount: cycles * price,
  };
}

function summarizeBilling(tenant, asOf = new Date()) {
  const history = Array.isArray(tenant.billingHistory) ? [...tenant.billingHistory] : [];
  const currentPlan = tenant.currentPlan || null;
  const planName = currentPlan?.name || null;

  const segments = history.map((segment) => {
    const plain = typeof segment.toObject === 'function' ? segment.toObject() : { ...segment };
    return plain.endDate ? plain : refreshOpenSegment(plain, asOf);
  });

  const totalCycles = segments.reduce((sum, item) => sum + (Number(item.cycles) || 0), 0);
  const revenue = segments.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const openSegment = segments.find((item) => !item.endDate) || null;

  return {
    planName: planName || openSegment?.planName || 'No plan',
    pricePerCycle: Number(currentPlan?.pricePerCycle) || openSegment?.pricePerCycle || 0,
    subscription: planName
      ? tenant.status === 'suspended'
        ? 'Paused'
        : 'Active'
      : 'None',
    cycles: totalCycles,
    revenue,
    history: segments,
  };
}

function ensureBillingLedger(tenantDoc) {
  const tenant = tenantDoc.toObject ? tenantDoc.toObject() : { ...tenantDoc };
  const hasHistory = Array.isArray(tenant.billingHistory) && tenant.billingHistory.length > 0;
  const hasCurrentPlan = Boolean(tenant.currentPlan?.name);

  if (hasHistory) {
    return {
      tenant,
      billing: summarizeBilling(tenant),
      needsPersist: false,
    };
  }

  // Backfill history from a real assigned plan — never invent a fake "Starter"
  if (hasCurrentPlan) {
    const startDate = tenant.currentPlan.startedAt || tenant.createdAt || new Date();
    const pricePerCycle = Number(tenant.currentPlan.pricePerCycle) || 0;
    tenant.billingHistory = [
      buildSegment({
        planName: tenant.currentPlan.name,
        pricePerCycle,
        startDate,
        endDate: null,
      }),
    ];

    return {
      tenant,
      billing: summarizeBilling(tenant),
      needsPersist: true,
    };
  }

  tenant.currentPlan = tenant.currentPlan || {
    name: null,
    pricePerCycle: 0,
    startedAt: null,
    billing: null,
    endsAt: null,
  };
  tenant.billingHistory = [];

  return {
    tenant,
    billing: summarizeBilling(tenant),
    needsPersist: false,
  };
}

function computePlanEndsAt(startedAt, billing = 'Monthly') {
  if (!startedAt) return null;
  const start = new Date(startedAt);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start);
  const cycle = String(billing || 'Monthly');
  if (cycle === 'Yearly') {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    // Monthly + Custom (fallback)
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}

function calendarDaysRemaining(endsAt, asOf = new Date()) {
  if (!endsAt) return null;
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date(asOf);
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / 86400000);
}

function normalizeBillingCycle(billing) {
  return ['Monthly', 'Yearly', 'Custom'].includes(billing) ? billing : 'Monthly';
}

function getEffectiveEndsAt(plan) {
  if (!plan?.name) return null;
  if (plan.endsAt) {
    const end = new Date(plan.endsAt);
    return Number.isNaN(end.getTime()) ? null : end;
  }
  return computePlanEndsAt(plan.startedAt, plan.billing || 'Monthly');
}

function isPlanActive(plan, asOf = new Date()) {
  if (!plan?.name) return false;
  const endsAt = getEffectiveEndsAt(plan);
  if (!endsAt) return true; // unknown end → treat as active
  return calendarDaysRemaining(endsAt, asOf) >= 0;
}

function clearPendingPlan() {
  return {
    name: null,
    pricePerCycle: 0,
    billing: null,
    startsAt: null,
    endsAt: null,
    purchasedAt: null,
  };
}

/**
 * Subscription summary for admin UI / login toast.
 * Uses stored endsAt when present; otherwise derives from startedAt + billing.
 */
function getSubscriptionView(tenant) {
  const plan = tenant?.currentPlan || {};
  const pending = tenant?.pendingPlan?.name ? tenant.pendingPlan : null;

  if (!plan.name) {
    return {
      planName: null,
      billing: null,
      startedAt: null,
      endsAt: null,
      daysRemaining: null,
      pricePerCycle: 0,
      status: 'none',
      pendingPlan: null,
    };
  }

  const billing = plan.billing || 'Monthly';
  const startedAt = plan.startedAt ? new Date(plan.startedAt) : null;
  const endsAt = getEffectiveEndsAt(plan);
  const daysRemaining = calendarDaysRemaining(endsAt);

  let status = 'active';
  if (daysRemaining != null && daysRemaining < 0) status = 'expired';
  else if (daysRemaining != null && daysRemaining <= 7) status = 'expiring_soon';

  return {
    planName: plan.name,
    billing,
    startedAt,
    endsAt,
    daysRemaining,
    pricePerCycle: Number(plan.pricePerCycle) || 0,
    status,
    pendingPlan: pending
      ? {
          planName: pending.name,
          billing: pending.billing || 'Monthly',
          pricePerCycle: Number(pending.pricePerCycle) || 0,
          startsAt: pending.startsAt ? new Date(pending.startsAt) : null,
          endsAt: pending.endsAt ? new Date(pending.endsAt) : null,
          purchasedAt: pending.purchasedAt ? new Date(pending.purchasedAt) : null,
        }
      : null,
  };
}

function applyPlanChange(
  tenantDoc,
  nextPlanName,
  changedAt = new Date(),
  pricePerCycle,
  billing = 'Monthly'
) {
  const resolvedPrice =
    pricePerCycle !== undefined && pricePerCycle !== null
      ? Number(pricePerCycle)
      : getPlanPrice(nextPlanName);

  if (!nextPlanName || Number.isNaN(resolvedPrice) || resolvedPrice < 0) {
    throw new Error('Invalid plan');
  }

  const cycle = normalizeBillingCycle(billing);
  const tenant = tenantDoc.toObject ? tenantDoc.toObject() : { ...tenantDoc };
  const history = Array.isArray(tenant.billingHistory) ? [...tenant.billingHistory] : [];
  const changeDate = new Date(changedAt);

  const openIndex = history.findIndex((item) => !item.endDate);
  if (openIndex >= 0) {
    const open = { ...history[openIndex] };
    open.endDate = changeDate;
    const closed = buildSegment({
      planName: open.planName,
      pricePerCycle: open.pricePerCycle,
      startDate: open.startDate,
      endDate: changeDate,
    });
    history[openIndex] = closed;
  }

  const nextSegment = buildSegment({
    planName: nextPlanName,
    pricePerCycle: resolvedPrice,
    startDate: changeDate,
    endDate: null,
  });
  history.push(nextSegment);

  const endsAt = computePlanEndsAt(changeDate, cycle);

  tenant.billingHistory = history;
  tenant.currentPlan = {
    name: nextPlanName,
    pricePerCycle: resolvedPrice,
    startedAt: changeDate,
    billing: cycle,
    endsAt,
  };
  tenant.pendingPlan = clearPendingPlan();

  return {
    tenant,
    billing: summarizeBilling(tenant),
  };
}

/**
 * If pendingPlan.startsAt is due, promote it to currentPlan.
 * Returns { tenant, applied }.
 */
function applyDuePendingPlan(tenantDoc, asOf = new Date()) {
  const tenant = tenantDoc.toObject ? tenantDoc.toObject() : { ...tenantDoc };
  const pending = tenant.pendingPlan;
  if (!pending?.name || !pending.startsAt) {
    return { tenant, applied: false };
  }

  const startsAt = new Date(pending.startsAt);
  const now = new Date(asOf);
  if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() > now.getTime()) {
    return { tenant, applied: false };
  }

  const { tenant: updated } = applyPlanChange(
    tenant,
    pending.name,
    startsAt,
    pending.pricePerCycle,
    pending.billing || 'Monthly'
  );

  // Preserve the precomputed endsAt from purchase when present
  if (pending.endsAt) {
    const endsAt = new Date(pending.endsAt);
    if (!Number.isNaN(endsAt.getTime())) {
      updated.currentPlan.endsAt = endsAt;
    }
  }

  return { tenant: updated, applied: true };
}

/**
 * Payment purchase while a plan may already be running:
 * - No active plan → activate immediately
 * - Same plan (renew) → extend current endsAt by one cycle (extra time starts after current end)
 * - Different plan → queue as pendingPlan starting at current endsAt
 */
function scheduleOrApplyPurchase(
  tenantDoc,
  { planName, pricePerCycle, billing = 'Monthly', purchasedAt = new Date() } = {}
) {
  const resolvedPrice =
    pricePerCycle !== undefined && pricePerCycle !== null
      ? Number(pricePerCycle)
      : getPlanPrice(planName);

  if (!planName || Number.isNaN(resolvedPrice) || resolvedPrice < 0) {
    throw new Error('Invalid plan');
  }

  const cycle = normalizeBillingCycle(billing);
  const purchased = new Date(purchasedAt);
  let tenant = tenantDoc.toObject ? tenantDoc.toObject() : { ...tenantDoc };

  const due = applyDuePendingPlan(tenant, purchased);
  tenant = due.tenant;

  const current = tenant.currentPlan || {};
  const active = isPlanActive(current, purchased);

  if (!active) {
    const { tenant: updated } = applyPlanChange(
      tenant,
      planName,
      purchased,
      resolvedPrice,
      cycle
    );
    return {
      tenant: updated,
      billing: summarizeBilling(updated),
      mode: 'activated',
    };
  }

  const currentEndsAt = getEffectiveEndsAt(current);
  const samePlan =
    String(current.name || '').toLowerCase() === String(planName).toLowerCase();

  if (samePlan) {
    // Stack another cycle onto the current end date
    const newEndsAt = computePlanEndsAt(currentEndsAt || purchased, current.billing || cycle);
    tenant.currentPlan = {
      ...current,
      endsAt: newEndsAt,
    };

    // If a different plan is already queued, push its start to the new end
    if (tenant.pendingPlan?.name) {
      const pendingCycle = normalizeBillingCycle(tenant.pendingPlan.billing || 'Monthly');
      tenant.pendingPlan = {
        ...tenant.pendingPlan,
        startsAt: newEndsAt,
        endsAt: computePlanEndsAt(newEndsAt, pendingCycle),
      };
    }

    return {
      tenant,
      billing: summarizeBilling(tenant),
      mode: 'extended',
    };
  }

  // Different plan → schedule after current period
  const startsAt = currentEndsAt || purchased;
  tenant.pendingPlan = {
    name: planName,
    pricePerCycle: resolvedPrice,
    billing: cycle,
    startsAt,
    endsAt: computePlanEndsAt(startsAt, cycle),
    purchasedAt: purchased,
  };

  return {
    tenant,
    billing: summarizeBilling(tenant),
    mode: 'queued',
  };
}

module.exports = {
  PLAN_RATES,
  getPlanPrice,
  countCyclesBetween,
  buildSegment,
  summarizeBilling,
  ensureBillingLedger,
  applyPlanChange,
  scheduleOrApplyPurchase,
  applyDuePendingPlan,
  computePlanEndsAt,
  calendarDaysRemaining,
  getSubscriptionView,
  getEffectiveEndsAt,
  isPlanActive,
};
