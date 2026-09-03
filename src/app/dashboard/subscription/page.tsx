"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import { fetchAllVendorSubscriptionsThunk } from "../../../store/vendorSubscription/vendorSubscriptionThunks";
import { setAdminFilters } from "../../../store/vendorSubscription/vendorSubscriptionSlice";
import VendorSubscriptionTable from "../../../components/subscription/VendorSubscriptionTable";
import SubscriptionKpiCards from "../../../components/subscription/SubscriptionKpiCards";
import type { SubscriptionStatus } from "../../../types/subscription";

export default function VendorSubscriptionPage() {
  const dispatch = useAppDispatch();
  const [, startTransition] = useTransition();

  const { allVendor, loading, filters } = useAppSelector(
    (s) => s.vendorSubscription
  );

  const [searchQuery, setSearchQuery] = useState(filters.search || "");
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | "all">(
    filters.status || "all"
  );

  useEffect(() => {
    dispatch(fetchAllVendorSubscriptionsThunk());
  }, [dispatch]);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    startTransition(() => {
      dispatch(setAdminFilters({ search: query }));
    });
  };

  const handleStatusFilterChange = (status: SubscriptionStatus | "all") => {
    setStatusFilter(status);
    startTransition(() => {
      dispatch(setAdminFilters({ status }));
    });
  };

  const kpiData = {
    total: allVendor.length,
    active_count: allVendor.filter((v) => v.is_active).length,
    expiring_count: 0,
    expired_count: allVendor.filter((v) => !v.is_active).length,
    allVendor,
  };

  return (
    <main className="min-h-screen w-full bg-zinc-50/70 p-4 sm:p-8 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Navigation Breadcrumb & Header */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200/80 pb-5 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
              <span>Vendor Dashboard</span>
              <span>/</span>
              <span className="text-emerald-600 dark:text-emerald-400">Subscription & Billing</span>
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight">
              Vendor Subscription Master View
            </h1>
          </div>

          <button
            type="button"
            onClick={() => dispatch(fetchAllVendorSubscriptionsThunk())}
            className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-xs hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M23 4v6h-6" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            <span>Refresh Vendors</span>
          </button>
        </div>

        {/* KPI Stat Cards */}
        <SubscriptionKpiCards data={kpiData} loading={loading} />

        {/* Vendor Subscription Table */}
        <VendorSubscriptionTable
          subscriptions={allVendor as any}
          loading={loading}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          statusFilter={statusFilter}
          onStatusFilterChange={handleStatusFilterChange}
        />
      </div>
    </main>
  );
}
