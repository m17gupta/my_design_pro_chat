# Next.js Subscription Monitoring & Management Page — Detailed Implementation Plan

> **Goal:** Build a modern, responsive Next.js frontend page (App Router) to monitor, view, and manage vendor subscription plans, expiry countdowns, status indicators, and manual trigger notifications.

---

## 1. Architectural Overview

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   NEXT.JS FRONTEND                                     │
├───────────────────────────────────┬────────────────────────────────────────────────────┤
│         Vendor Portal             │                   Admin Dashboard                  │
│    `/dashboard/subscription`      │                `/admin/subscriptions`              │
│  • View Current Plan & Status     │  • Master Vendor Subscription Table                │
│  • Expiry Countdown & Progress    │  • Filter Expiring (≤ 15 days) & Expired Vendors    │
│  • Renewal Banner & CTA Button    │  • Trigger Manual Email Expiry Check Button        │
└─────────────────┬─────────────────┴─────────────────────────┬──────────────────────────┘
                  │                                           │
                  ▼                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                  FASTAPI BACKEND                                       │
│  • GET /api/v1/subscriptions/my-status                                                 │
│  • GET /api/v1/subscriptions/all (Admin)                                             │
│  • POST /api/v1/subscriptions/trigger-expiry-check (Admin)                            │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Required Backend API Endpoints

To support the Next.js page, ensure the following endpoints are available:

| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/api/v1/subscriptions/my-status` | `GET` | Vendor | Returns logged-in vendor's plan, status, `current_period_end`, and calculated `days_remaining`. |
| `/api/v1/subscriptions/all` | `GET` | Admin | Returns list of all vendor subscriptions with filters (`status`, `expiring_within_days`, `search`). |
| `/api/v1/subscriptions/trigger-expiry-check` | `POST` | Admin | Manually triggers the daily email check job on demand. |

---

## 3. Data Models & TypeScript Interfaces

Create a type definition file in Next.js at `types/subscription.ts`:

```typescript
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
```

---

## 4. Next.js Page Structure (App Router)

```
app/
├── (admin)/
│   └── admin/
│       └── subscriptions/
│           └── page.tsx            # Admin Master Monitoring Table Page
├── (vendor)/
│   └── dashboard/
│       └── subscription/
│           └── page.tsx            # Vendor Self-Service Plan & Expiry Page
components/
├── subscription/
│   ├── SubscriptionStatusBadge.tsx  # Color-coded badge (Active, Expiring Soon, Expired)
│   ├── ExpiryProgressBar.tsx        # Days remaining progress bar
│   ├── VendorSubscriptionTable.tsx  # Admin filterable & searchable data table
│   ├── ManualTriggerButton.tsx      # Admin trigger button with modal confirmation
│   └── RenewalBanner.tsx            # Warning banner for vendors when days ≤ 15
```

---

## 5. UI/UX Component Specifications

### 5.1 Vendor Subscription Page (`/dashboard/subscription`)

* **Hero Card:**
  * Plan Name (e.g. *Enterprise Tier Pro*)
  * Status Badge (`ACTIVE`, `EXPIRING SOON`, `EXPIRED`)
  * Current Period End Date (e.g. *25 September 2026*)
* **Expiry Progress Indicator:**
  * Visual progress bar showing elapsed vs. remaining subscription period.
  * Counter: `X days remaining`.
* **Warning Banner (Conditional when `days_remaining <= 15`):**
  * Orange/Yellow alert for 1–15 days remaining.
  * Red alert when `days_remaining <= 0` (Expired).
  * Direct CTA button: `"Renew Subscription Now"`.

### 5.2 Admin Monitoring Dashboard (`/admin/subscriptions`)

* **Top Analytics KPI Cards:**
  1. Total Active Subscriptions
  2. Expiring in ≤ 15 Days (Orange)
  3. Already Expired (Red)
  4. Emails Sent in Last 24 Hours
* **Action Toolbar:**
  * Search bar (by Company Name or Email)
  * Status Filter dropdown (*All*, *Active*, *Expiring Soon*, *Expired*)
  * **"Trigger Daily Email Check Now"** button with a loading state and toast notification.
* **Data Table Columns:**
  * Vendor / Company Name
  * Contact Email
  * Current Plan
  * Status Badge
  * Period End Date
  * Days Remaining
  * Last Email Notified At
  * Actions (View Details, Manual Email Send)

---

## 6. Color Coding & Design Tokens

| Status | Badge Color | Progress Bar Color | Meaning |
|---|---|---|---|
| **Active (> 15 days)** | Emerald Green (`#10B981`) | Blue/Emerald | Healthy subscription |
| **Expiring Soon (1–15 days)** | Amber/Orange (`#F59E0B`) | Amber/Orange | Email warning sent, action required |
| **Expired (≤ 0 days)** | Rose Red (`#EF4444`) | Red / 0% | Suspended access, immediate renewal needed |
| **Inactive** | Slate Gray (`#64748B`) | Gray | Terminated / Inactive |

---

## 7. Step-by-Step Implementation Guide

### Step 1: Create API Client Service (`services/subscriptionApi.ts`)
Implement `fetchMySubscription()`, `fetchAllSubscriptions()`, and `triggerExpiryCheck()` using `fetch` or `axios` with standard Bearer authorization headers.

### Step 2: Build `SubscriptionStatusBadge` Component
Render a styled tag with dynamic Tailwind / CSS classes based on `days_remaining` and `status`.

### Step 3: Build `ExpiryProgressBar` Component
Calculate percentage:
$$\text{Percentage} = \max\left(0, \min\left(100, \frac{\text{days\_remaining}}{30} \times 100\right)\right)$$
Display animated bar with custom colors based on urgency.

### Step 4: Build Admin Table & Manual Trigger Action
Add a confirmation modal when clicking **"Trigger Daily Email Check Now"**, calling `POST /api/v1/subscriptions/trigger-expiry-check` and displaying a success toast with total emails dispatched.

### Step 5: Test & Validate
* Verify responsive layout on Mobile, Tablet, and Desktop.
* Test states for: Healthy vendor (>15 days), Expiring vendor (5 days), Expired vendor (-2 days).

---

*Document created: 2026-09-02*
