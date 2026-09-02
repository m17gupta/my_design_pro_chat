"use client";

import React, { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import { fetchMySubscriptionThunk } from "../../../store/subscription/subscriptionThunks";
import SubscriptionStatusBadge from "../../../components/subscription/SubscriptionStatusBadge";
import ExpiryProgressBar from "../../../components/subscription/ExpiryProgressBar";
import RenewalBanner from "../../../components/subscription/RenewalBanner";

export default function VendorSubscriptionPage() {
  const dispatch = useAppDispatch();
  const { data: subscription, loading, error } = useAppSelector(
    (s) => s.subscription.mySubscription
  );

  useEffect(() => {
    dispatch(fetchMySubscriptionThunk());
  }, [dispatch]);

  const formatDate = (isoString?: string) => {
    if (!isoString) return "N/A";
    try {
      return new Date(isoString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  if (loading && !subscription) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-zinc-200 border-t-emerald-500" />
          <span className="text-xs font-semibold text-zinc-500">Loading subscription details…</span>
        </div>
      </div>
    );
  }

  const sub = subscription || {
    id: "sub_demo",
    vendor_id: "vendor_demo",
    company_name: "Demo Enterprise Vendor",
    contact_email: "vendor@demo.com",
    plan_id: "plan_enterprise",
    plan: {
      id: "plan_enterprise",
      name: "Enterprise Pro Tier",
      description: "Unlimited AI renders, 3D floorplan generation, & priority rendering speed",
      api_call_limit: 50000,
    },
    status: "active" as const,
    current_period_end: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
    last_expiry_notified_at: null,
    days_remaining: 12,
  };

  return (
    <main className="min-h-screen w-full bg-zinc-50/70 p-4 sm:p-8 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Navigation Breadcrumb & Header */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
              <span>Vendor Dashboard</span>
              <span>/</span>
              <span className="text-emerald-600 dark:text-emerald-400">Subscription & Billing</span>
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight">
              Subscription Monitoring
            </h1>
          </div>

          <button
            type="button"
            onClick={() => dispatch(fetchMySubscriptionThunk())}
            className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-xs hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M23 4v6h-6" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            <span>Refresh Status</span>
          </button>
        </div>

        {/* Warning Banner (Shown if days <= 15) */}
        <RenewalBanner daysRemaining={sub.days_remaining} />

        {/* Hero Card: Current Active Plan */}
        <div className="relative overflow-hidden rounded-3xl border border-zinc-200/90 bg-white p-6 sm:p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-6 dark:border-zinc-800">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                  {sub.plan.name}
                </h2>
                <SubscriptionStatusBadge
                  status={sub.status}
                  daysRemaining={sub.days_remaining}
                />
              </div>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                {sub.plan.description}
              </p>
            </div>

            <div className="text-left sm:text-right space-y-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Current Period Ends
              </span>
              <div className="text-base font-extrabold text-zinc-800 dark:text-zinc-200">
                {formatDate(sub.current_period_end)}
              </div>
            </div>
          </div>

          {/* Progress Bar Component */}
          <ExpiryProgressBar daysRemaining={sub.days_remaining} />

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-2">
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800/80 dark:bg-zinc-800/40">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                API Request Limit
              </span>
              <div className="mt-1 text-lg font-bold text-zinc-900 dark:text-white font-mono">
                {sub.plan.api_call_limit.toLocaleString()} / mo
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800/80 dark:bg-zinc-800/40">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Registered Vendor
              </span>
              <div className="mt-1 text-sm font-bold text-zinc-900 dark:text-white truncate">
                {sub.company_name}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800/80 dark:bg-zinc-800/40">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Notification Email
              </span>
              <div className="mt-1 text-sm font-bold text-zinc-900 dark:text-white truncate">
                {sub.contact_email}
              </div>
            </div>
          </div>
        </div>

        {/* Feature Entitlements Card */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <h3 className="text-base font-bold text-zinc-900 dark:text-white">
            Plan Features & Entitlements
          </h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              "High-Resolution AI Interior & Exterior Renders",
              "Automated 3D Floorplan Reconstruction",
              "Priority Queue Access (Sub-15s Generation)",
              "Multi-User Workspace & Team Roles",
              "Custom Branding & Watermark Removal",
              "Dedicated 24/7 Priority Support",
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  ✓
                </span>
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
