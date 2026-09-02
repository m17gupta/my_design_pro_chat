export type SubscriptionStatus = 'active' | 'inactive' | 'expired' | 'cancelling';

export interface Plan {
  id: string;
  name: string;
  description: string;
  api_call_limit: number;
}

export interface VendorSubscription {
  id: string;
  vendor_id: string;
  company_name: string;
  contact_email: string;
  plan_id: string;
  plan: Plan;
  status: SubscriptionStatus;
  current_period_end: string; // ISO DateTime string
  last_expiry_notified_at: string | null;
  days_remaining: number;
}

export interface SubscriptionListResponse {
  total: number;
  expiring_count: number;
  expired_count: number;
  active_count: number;
  subscriptions: VendorSubscription[];
}

export interface SubscriptionFilters {
  search?: string;
  status?: SubscriptionStatus | 'all';
  expiring_within_days?: number;
}

export interface TriggerExpiryCheckResponse {
  success: boolean;
  message: string;
  emails_dispatched: number;
  timestamp: string;
}
