export type SubscriptionStatus = 'active' | 'inactive' | 'expired' | 'cancelling';

export interface VendorItem {
  id: string;
  company_name: string;
  contact_email: string;
  website: string | null;
  is_active: boolean;
  subscription_plan: string;
  scopes: string[];
  api_key: string | null;
  vendor_s3_bucket: string | null;
  vendor_s3_region: string | null;
  vendor_s3_iam_role_arn: string | null;
  webhook_url: string | null;
  webhook_secret: string | null;
  aws_IAM_access_key: string | null;
  aws_IAM_secret_key: string | null;
  aws_s3_external_id: string | null;
  webhook_access_token: string | null;
}

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
  allVendor: VendorItem[];
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

