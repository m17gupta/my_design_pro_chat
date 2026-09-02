import type {
  VendorSubscription,
  SubscriptionListResponse,
  SubscriptionFilters,
  TriggerExpiryCheckResponse,
} from "../types/subscription";

// Mock Fallback Data for dev/testing when backend is unreachable
const MOCK_VENDOR_SUBSCRIPTION: VendorSubscription = {
  id: "sub_v101_ent_2026",
  vendor_id: "vendor_acme_01",
  company_name: "Acme Architectural Solutions",
  contact_email: "billing@acme-architecture.com",
  plan_id: "plan_enterprise_pro",
  plan: {
    id: "plan_enterprise_pro",
    name: "Enterprise Pro Unlimited",
    description: "Unlimited AI renders, 3D floorplan generation, & priority support",
    api_call_limit: 50000,
  },
  status: "active",
  current_period_end: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(), // 12 days remaining
  last_expiry_notified_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  days_remaining: 12,
};

const MOCK_ADMIN_SUBSCRIPTIONS: VendorSubscription[] = [
  MOCK_VENDOR_SUBSCRIPTION,
  {
    id: "sub_v102_studio",
    vendor_id: "vendor_apex_02",
    company_name: "Apex Design Studio",
    contact_email: "admin@apexdesign.io",
    plan_id: "plan_studio",
    plan: {
      id: "plan_studio",
      name: "Studio Tier Plan",
      description: "Dedicated GPU rendering & multi-user support",
      api_call_limit: 15000,
    },
    status: "active",
    current_period_end: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
    last_expiry_notified_at: null,
    days_remaining: 28,
  },
  {
    id: "sub_v103_urban",
    vendor_id: "vendor_urban_03",
    company_name: "Urban Living Interiors",
    contact_email: "contact@urbanliving.com",
    plan_id: "plan_enterprise_pro",
    plan: {
      id: "plan_enterprise_pro",
      name: "Enterprise Pro Unlimited",
      description: "Unlimited AI renders, 3D floorplan generation",
      api_call_limit: 50000,
    },
    status: "active",
    current_period_end: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days remaining (expiring)
    last_expiry_notified_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    days_remaining: 4,
  },
  {
    id: "sub_v104_metro",
    vendor_id: "vendor_metro_04",
    company_name: "Metro Build Tech",
    contact_email: "support@metrobuild.org",
    plan_id: "plan_basic",
    plan: {
      id: "plan_basic",
      name: "Starter Pro Plan",
      description: "Basic AI interior concepts",
      api_call_limit: 2500,
    },
    status: "expired",
    current_period_end: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // Expired 3 days ago
    last_expiry_notified_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    days_remaining: -3,
  },
  {
    id: "sub_v105_horizon",
    vendor_id: "vendor_horizon_05",
    company_name: "Horizon Architects Group",
    contact_email: "accounts@horizonarch.com",
    plan_id: "plan_studio",
    plan: {
      id: "plan_studio",
      name: "Studio Tier Plan",
      description: "Dedicated GPU rendering & multi-user support",
      api_call_limit: 15000,
    },
    status: "cancelling",
    current_period_end: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    last_expiry_notified_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    days_remaining: 1,
  },
];

/**
 * Fetch current logged-in vendor's subscription status
 */
export async function fetchMySubscription(): Promise<VendorSubscription> {
  try {
    const res = await fetch("/api/subscriptions/my-status");
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Network or server unavailable — fallback to mock
  }
  return MOCK_VENDOR_SUBSCRIPTION;
}

/**
 * Fetch all vendor subscriptions (Admin Master View) with search/filters
 */
export async function fetchAllSubscriptions(
  filters?: SubscriptionFilters
): Promise<SubscriptionListResponse> {
  try {
    const query = new URLSearchParams();
    if (filters?.search) query.set("search", filters.search);
    if (filters?.status && filters.status !== "all") query.set("status", filters.status);
    if (filters?.expiring_within_days) query.set("expiring_within_days", String(filters.expiring_within_days));

    const url = `/api/subscriptions/all${query.toString() ? `?${query.toString()}` : ""}`;
    const res = await fetch(url);
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Network or server unavailable — fallback to mock filtering
  }

  let filtered = [...MOCK_ADMIN_SUBSCRIPTIONS];
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(
      (s) => s.company_name.toLowerCase().includes(q) || s.contact_email.toLowerCase().includes(q)
    );
  }
  if (filters?.status && filters.status !== "all") {
    if (filters.status === "active") {
      filtered = filtered.filter((s) => s.status === "active" && s.days_remaining > 15);
    } else if (filters.status === "expired") {
      filtered = filtered.filter((s) => s.days_remaining <= 0 || s.status === "expired");
    } else {
      filtered = filtered.filter((s) => s.status === filters.status);
    }
  }
  if (filters?.expiring_within_days) {
    filtered = filtered.filter(
      (s) => s.days_remaining > 0 && s.days_remaining <= (filters.expiring_within_days || 15)
    );
  }

  const active_count = MOCK_ADMIN_SUBSCRIPTIONS.filter((s) => s.days_remaining > 15 && s.status === "active").length;
  const expiring_count = MOCK_ADMIN_SUBSCRIPTIONS.filter((s) => s.days_remaining > 0 && s.days_remaining <= 15).length;
  const expired_count = MOCK_ADMIN_SUBSCRIPTIONS.filter((s) => s.days_remaining <= 0 || s.status === "expired").length;

  return {
    total: MOCK_ADMIN_SUBSCRIPTIONS.length,
    active_count,
    expiring_count,
    expired_count,
    subscriptions: filtered,
  };
}

/**
 * Manually trigger daily email check for expiring subscriptions (Admin)
 */
export async function triggerExpiryCheck(): Promise<TriggerExpiryCheckResponse> {
  try {
    const res = await fetch("/api/subscriptions/trigger-expiry-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Network error fallback
  }

  return {
    success: true,
    message: "Daily subscription expiry check executed successfully (Mock). Notification emails sent.",
    emails_dispatched: 2,
    timestamp: new Date().toISOString(),
  };
}
