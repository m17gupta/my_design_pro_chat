import React from "react";
import type { SubscriptionListResponse } from "../../types/subscription";

interface SubscriptionKpiCardsProps {
  data: SubscriptionListResponse | null;
  loading?: boolean;
}

export const SubscriptionKpiCards: React.FC<SubscriptionKpiCardsProps> = ({
  data,
  loading = false,
}) => {
  const activeCount = data?.active_count ?? 0;
  const expiringCount = data?.expiring_count ?? 0;
  const expiredCount = data?.expired_count ?? 0;
  const totalCount = data?.total ?? 0;

  const kpis = [
    {
      title: "Active Subscriptions",
      value: activeCount,
      subtitle: "Healthy (>15d remaining)",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      iconBg: "bg-emerald-500 text-white",
      border: "border-emerald-200 dark:border-emerald-800/40",
      valueColor: "text-emerald-700 dark:text-emerald-400",
    },
    {
      title: "Expiring Soon",
      value: expiringCount,
      subtitle: "Warning (1–15d remaining)",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      bg: "bg-amber-50 dark:bg-amber-950/30",
      iconBg: "bg-amber-500 text-white",
      border: "border-amber-200 dark:border-amber-800/40",
      valueColor: "text-amber-700 dark:text-amber-400",
    },
    {
      title: "Already Expired",
      value: expiredCount,
      subtitle: "Action Required (≤ 0d)",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      ),
      bg: "bg-rose-50 dark:bg-rose-950/30",
      iconBg: "bg-rose-500 text-white",
      border: "border-rose-200 dark:border-rose-800/40",
      valueColor: "text-rose-700 dark:text-rose-400",
    },
    {
      title: "Total Vendor Accounts",
      value: totalCount,
      subtitle: "Across all plan tiers",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      bg: "bg-slate-50 dark:bg-zinc-800/50",
      iconBg: "bg-slate-700 dark:bg-zinc-600 text-white",
      border: "border-slate-200 dark:border-zinc-700",
      valueColor: "text-slate-900 dark:text-white",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi, idx) => (
        <div
          key={idx}
          className={`flex items-center justify-between rounded-2xl border p-4 sm:p-5 shadow-sm transition-all hover:shadow-md ${kpi.bg} ${kpi.border}`}
        >
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {kpi.title}
            </span>
            <div className="flex items-baseline gap-2">
              {loading ? (
                <div className="h-8 w-12 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
              ) : (
                <span className={`text-2xl sm:text-3xl font-extrabold ${kpi.valueColor}`}>
                  {kpi.value}
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {kpi.subtitle}
            </p>
          </div>

          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ${kpi.iconBg}`}
          >
            {kpi.icon}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SubscriptionKpiCards;
