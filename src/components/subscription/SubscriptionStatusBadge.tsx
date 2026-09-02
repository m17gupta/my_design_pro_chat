import React from "react";
import type { SubscriptionStatus } from "../../types/subscription";

interface SubscriptionStatusBadgeProps {
  status: SubscriptionStatus;
  daysRemaining: number;
  showDaysText?: boolean;
}

export const SubscriptionStatusBadge: React.FC<SubscriptionStatusBadgeProps> = ({
  status,
  daysRemaining,
  showDaysText = true,
}) => {
  // Determine badge type based on status & daysRemaining
  let type: "active" | "expiring" | "expired" | "cancelling" | "inactive" = "active";

  if (status === "inactive") {
    type = "inactive";
  } else if (status === "cancelling") {
    type = "cancelling";
  } else if (daysRemaining <= 0 || status === "expired") {
    type = "expired";
  } else if (daysRemaining <= 15) {
    type = "expiring";
  } else {
    type = "active";
  }

  const styles = {
    active: {
      bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      dot: "bg-emerald-500",
      label: "Active",
    },
    expiring: {
      bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      dot: "bg-amber-500 animate-pulse",
      label: "Expiring Soon",
    },
    expired: {
      bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      dot: "bg-rose-500",
      label: "Expired",
    },
    cancelling: {
      bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      dot: "bg-purple-500",
      label: "Cancelling",
    },
    inactive: {
      bg: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
      dot: "bg-zinc-400",
      label: "Inactive",
    },
  }[type];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide transition-all ${styles.bg}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
      <span>{styles.label}</span>
      {showDaysText && type === "expiring" && (
        <span className="font-mono text-[11px] opacity-80">({daysRemaining}d left)</span>
      )}
      {showDaysText && type === "expired" && (
        <span className="font-mono text-[11px] opacity-80">
          ({Math.abs(daysRemaining)}d ago)
        </span>
      )}
    </span>
  );
};

export default SubscriptionStatusBadge;
