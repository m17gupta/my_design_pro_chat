import React from "react";

interface ExpiryProgressBarProps {
  daysRemaining: number;
  totalCycleDays?: number;
}

export const ExpiryProgressBar: React.FC<ExpiryProgressBarProps> = ({
  daysRemaining,
  totalCycleDays = 30,
}) => {
  // Percentage = max(0, min(100, (days_remaining / totalCycleDays) * 100))
  const rawPercentage = (daysRemaining / totalCycleDays) * 100;
  const percentage = Math.max(0, Math.min(100, rawPercentage));

  // Determine bar color based on urgency
  let barGradient = "bg-emerald-500";
  let textClass = "text-emerald-600 dark:text-emerald-400";

  if (daysRemaining <= 0) {
    barGradient = "bg-rose-500";
    textClass = "text-rose-600 dark:text-rose-400 font-bold";
  } else if (daysRemaining <= 5) {
    barGradient = "bg-rose-500";
    textClass = "text-rose-600 dark:text-rose-400 font-semibold";
  } else if (daysRemaining <= 15) {
    barGradient = "bg-amber-500";
    textClass = "text-amber-600 dark:text-amber-400 font-semibold";
  }

  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-zinc-600 dark:text-zinc-400">
          Billing Cycle Progress
        </span>
        <span className={`font-mono ${textClass}`}>
          {daysRemaining > 0
            ? `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`
            : daysRemaining === 0
            ? "Expires Today"
            : `Expired ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? "" : "s"} ago`}
        </span>
      </div>

      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barGradient}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default ExpiryProgressBar;
