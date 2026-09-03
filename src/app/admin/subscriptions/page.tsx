"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import { fetchAllSubscriptionsThunk } from "../../../store/vendorSubscription/vendorSubscriptionThunks";
import { setAdminFilters } from "../../../store/vendorSubscription/vendorSubscriptionSlice";
import SubscriptionKpiCards from "../../../components/subscription/SubscriptionKpiCards";
import VendorSubscriptionTable from "../../../components/subscription/VendorSubscriptionTable";
import type { SubscriptionStatus } from "../../../types/subscription";


export default function AdminSubscriptionsPage() {
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
    dispatch(fetchAllSubscriptionsThunk({ search: searchQuery, status: statusFilter }));
  }, [dispatch, searchQuery, statusFilter]);

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
        {/* Header toolbar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200/80 pb-5 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
              <span>Admin Portal</span>
              <span>/</span>
              <span className="text-emerald-600 dark:text-emerald-400">Subscription Monitoring</span>
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight">
              Vendor Subscription Management
            </h1>
          </div>
        </div>

        {/* KPI Stat Cards */}
        <SubscriptionKpiCards data={kpiData} loading={loading} />

        {/* Filterable Master Vendor Table */}
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

