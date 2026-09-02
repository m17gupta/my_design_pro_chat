import React, { useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { triggerExpiryCheckThunk } from "../../store/subscription/subscriptionThunks";
import { clearTriggerResult } from "../../store/subscription/subscriptionSlice";

export const ManualTriggerButton: React.FC = () => {
  const dispatch = useAppDispatch();
  const { triggeringExpiryCheck, triggerResult, triggerError } = useAppSelector(
    (s) => s.subscription
  );
  const [showModal, setShowModal] = useState(false);

  const handleConfirmTrigger = async () => {
    setShowModal(false);
    await dispatch(triggerExpiryCheckThunk());
  };

  const handleCloseToast = () => {
    dispatch(clearTriggerResult());
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        disabled={triggeringExpiryCheck}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all duration-150"
      >
        {triggeringExpiryCheck ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            <span>Executing Check…</span>
          </>
        ) : (
          <>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span>Trigger Daily Email Check Now</span>
          </>
        )}
      </button>

      {/* Trigger Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                Confirm Manual Email Check
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
              This action will scan all vendor subscriptions and immediately dispatch automated email notifications to any vendor whose plan expires within 15 days or has already expired.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmTrigger}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all"
              >
                Run Job Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result Toast Notification */}
      {triggerResult && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-2xl border border-emerald-500/30 bg-emerald-950/90 text-emerald-100 p-4 shadow-xl backdrop-blur-md space-y-2 animate-slide-in-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-emerald-300 text-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Email Check Complete</span>
            </div>
            <button
              onClick={handleCloseToast}
              className="text-emerald-400 hover:text-white text-xs p-1"
            >
              ✕
            </button>
          </div>
          <p className="text-xs leading-relaxed text-emerald-200">
            {triggerResult.message}
          </p>
          <div className="text-[11px] font-mono text-emerald-400">
            Emails dispatched: <strong>{triggerResult.emails_dispatched}</strong>
          </div>
        </div>
      )}

      {/* Error Toast Notification */}
      {triggerError && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-2xl border border-rose-500/30 bg-rose-950/90 text-rose-100 p-4 shadow-xl backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-rose-300 text-sm">
              <span>Trigger Failed</span>
            </div>
            <button
              onClick={handleCloseToast}
              className="text-rose-400 hover:text-white text-xs p-1"
            >
              ✕
            </button>
          </div>
          <p className="text-xs leading-relaxed text-rose-200">{triggerError}</p>
        </div>
      )}
    </>
  );
};

export default ManualTriggerButton;
