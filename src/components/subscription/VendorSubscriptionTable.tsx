import React from "react";
import SubscriptionStatusBadge from "./SubscriptionStatusBadge";
import type { VendorSubscription, SubscriptionStatus } from "../../types/subscription";

interface VendorSubscriptionTableProps {
  subscriptions: VendorSubscription[];
  loading?: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: SubscriptionStatus | "all";
  onStatusFilterChange: (status: SubscriptionStatus | "all") => void;
}

export const VendorSubscriptionTable: React.FC<VendorSubscriptionTableProps> = ({
  subscriptions,
  loading = false,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}) => {
  const formatDate = (isoString: string | null) => {
    if (!isoString) return "Never";
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  const handleSendSingleEmail = (company: string, email: string) => {
    alert(`Sending manual expiry notice to ${company} (${email})...`);
  };

  let filtered = subscriptions || [];

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (s: any) =>
        (s.company_name && s.company_name.toLowerCase().includes(q)) ||
        (s.contact_email && s.contact_email.toLowerCase().includes(q)) ||
        (s.website && s.website.toLowerCase().includes(q))
    );
  }

  if (statusFilter && statusFilter !== "all") {
    filtered = filtered.filter((s: any) => {
      const isAct = s.status ? s.status === "active" : s.is_active;
      if (statusFilter === "active") return isAct;
      if (statusFilter === "expired" || statusFilter === "inactive") return !isAct;
      return true;
    });
  }

  return (
    <div className="w-full space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
          {(["all", "active", "expired"] as const).map((filterKey) => {
            const isActive = statusFilter === filterKey;

            return (
              <button
                key={filterKey}
                type="button"
                onClick={() => onStatusFilterChange(filterKey as any)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
                  isActive
                    ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-700 dark:text-white"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                }`}
              >
                {filterKey}
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search company or email…"
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-4 text-xs text-zinc-900 placeholder-zinc-400 transition-colors focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white dark:placeholder-zinc-500 dark:focus:border-emerald-400"
          />
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute left-3 top-2.5 text-zinc-400"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400 font-semibold uppercase tracking-wider">
            <tr>
              <th className="p-3.5">Vendor / Company</th>
              <th className="p-3.5">Plan Tier</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5">Website</th>
              <th className="p-3.5">S3 Bucket</th>
              <th className="p-3.5 text-right">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-normal text-zinc-800 dark:text-zinc-200">
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="p-3.5">
                    <div className="h-4 w-36 rounded bg-zinc-200 dark:bg-zinc-700 mb-1" />
                    <div className="h-3 w-28 rounded bg-zinc-100 dark:bg-zinc-800" />
                  </td>
                  <td className="p-3.5"><div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-700" /></td>
                  <td className="p-3.5"><div className="h-5 w-20 rounded-full bg-zinc-200 dark:bg-zinc-700" /></td>
                  <td className="p-3.5"><div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-700" /></td>
                  <td className="p-3.5"><div className="h-4 w-12 rounded bg-zinc-200 dark:bg-zinc-700" /></td>
                  <td className="p-3.5 text-right"><div className="h-6 w-16 rounded bg-zinc-200 dark:bg-zinc-700 ml-auto" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-zinc-500 dark:text-zinc-400">
                  No vendor subscriptions found matching your filters.
                </td>
              </tr>
            ) : (
              filtered.map((sub: any) => {
                const planName = sub.subscription_plan || sub.plan?.name || "Pro Plan";
                const isAct = sub.is_active ?? (sub.status === "active");
                const status = isAct ? "active" : "inactive";
                const website = sub.website || "N/A";
                const s3Bucket = sub.vendor_s3_bucket || "N/A";

                return (
                  <tr
                    key={sub.id}
                    className="transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40"
                  >
                    {/* Vendor Name & Email */}
                    <td className="p-3.5">
                      <div className="font-bold text-zinc-900 dark:text-white">
                        {sub.company_name}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {sub.contact_email}
                      </div>
                    </td>

                    {/* Plan Tier */}
                    <td className="p-3.5">
                      <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {planName}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="p-3.5">
                      <SubscriptionStatusBadge
                        status={status as any}
                        showDaysText={false}
                      />
                    </td>

                    {/* Website */}
                    <td className="p-3.5 font-medium whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                      {website !== "N/A" ? (
                        <a
                          href={website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          {website}
                        </a>
                      ) : (
                        "N/A"
                      )}
                    </td>

                    {/* S3 Bucket */}
                    <td className="p-3.5 font-mono text-[11px] text-zinc-600 dark:text-zinc-300">
                      {s3Bucket}
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleSendSingleEmail(sub.company_name, sub.contact_email)}
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-700 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        title="Send instant notification email to vendor"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                          <polyline points="22,6 12,13 2,6" />
                        </svg>
                        <span>Notify</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VendorSubscriptionTable;
