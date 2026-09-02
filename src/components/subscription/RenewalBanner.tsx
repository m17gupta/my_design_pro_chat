import React from "react";

interface RenewalBannerProps {
  daysRemaining: number;
  onRenew?: () => void;
}

export const RenewalBanner: React.FC<RenewalBannerProps> = ({
  daysRemaining,
  onRenew,
}) => {
  if (daysRemaining > 15) return null;

  const isExpired = daysRemaining <= 0;

  const handleRenew = () => {
    if (onRenew) {
      onRenew();
    } else {
      alert("Redirecting to subscription renewal & checkout portal...");
    }
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 transition-all shadow-sm ${
        isExpired
          ? "border-rose-500/30 bg-rose-50/90 dark:border-rose-900/50 dark:bg-rose-950/40 text-rose-950 dark:text-rose-100"
          : "border-amber-500/30 bg-amber-50/90 dark:border-amber-900/50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div
            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-inner ${
              isExpired
                ? "bg-rose-500 text-white"
                : "bg-amber-500 text-white"
            }`}
          >
            {isExpired ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            )}
          </div>

          <div className="space-y-1">
            <h4 className="text-base font-bold leading-tight">
              {isExpired
                ? "Your Vendor Subscription Has Expired!"
                : `Subscription Expiring in ${daysRemaining} Day${daysRemaining === 1 ? "" : "s"}`}
            </h4>
            <p className="text-xs sm:text-sm opacity-85 leading-relaxed max-w-xl">
              {isExpired
                ? "Your access to premium AI generation tools and API endpoints has been suspended. Please renew your plan immediately to resume uninterrupted service."
                : "Your subscription renewal window is now open. Renew today to keep your API quotas, priority rendering speed, and active projects intact."}
            </p>
          </div>
        </div>

        <div className="shrink-0 pt-2 sm:pt-0">
          <button
            type="button"
            onClick={handleRenew}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
              isExpired
                ? "bg-rose-600 hover:bg-rose-700 shadow-rose-500/20"
                : "bg-amber-600 hover:bg-amber-700 shadow-amber-500/20"
            }`}
          >
            <span>Renew Subscription Now</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default RenewalBanner;
