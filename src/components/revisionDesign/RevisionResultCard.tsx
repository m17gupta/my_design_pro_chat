"use client";

import { motion } from "framer-motion";
import type { EnterpriseEntry } from "@/store/enterprise/enterpriseType";

/** Terminal project actions sent to the host via postMessage. */
export type SubmitAction = "this_is_all_i_need" | "engage_designer";

interface RevisionResultCardProps {
  /** The revision entry this round renders from (id, url, status, questions). */
  entry: EnterpriseEntry;
  /** 1-based loop round — shown as the "Revision N" badge. */
  round: number;
  /** 0 = unrated; 1–5 once the user picks a satisfaction level. */
  rating: number;
  onRate: (value: number) => void;
  /** History rounds (and everything after a submit) are read-only. */
  locked?: boolean;
  /** True once the round cap is reached — hides the regenerate action. */
  regenerateDisabled?: boolean;
  /** Set once a terminal action was submitted — locks buttons + confirms. */
  submittedAction?: SubmitAction | null;
  onAllINeed: (rating: number) => void;
  onRegenerate: () => void;
  onEngageDesigner: (rating: number) => void;
}

const RATING_EMOJIS = ["😞", "🙁", "😐", "🙂", "🤩"] as const;
const RATING_LABELS = [
  "Not at all satisfied",
  "Slightly satisfied",
  "Neutral",
  "Satisfied",
  "Very satisfied",
] as const;

const BUTTON_CLASS =
  "inline-flex items-center gap-1.5 rounded-xl bg-[#37474f] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-colors enabled:hover:bg-[#263238] disabled:cursor-not-allowed disabled:opacity-40 disabled:saturate-50 disabled:shadow-none dark:bg-[#546e7a] enabled:dark:hover:bg-[#455a64]";

/**
 * "What you got" — renders exactly one revision round from its own
 * `EnterpriseEntry` (never from the original entry / store). Reads nothing
 * from Redux; every piece of data and every action arrives via props.
 */
export default function RevisionResultCard({
  entry,
  round,
  rating,
  onRate,
  locked = false,
  regenerateDisabled = false,
  submittedAction = null,
  onAllINeed,
  onRegenerate,
  onEngageDesigner,
}: RevisionResultCardProps) {
  const hasImage = Boolean(entry.url);
  const done = entry.status === "completed" || hasImage;
  const failed = entry.status === "failed";
  const interactive = !locked && !submittedAction;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="w-full overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            Revision {round}
          </span>
          {submittedAction && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Submitted to your design team
            </span>
          )}
        </div>

        <h3 className="mt-2 text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Your Revised Design
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          Thanks for the feedback — I&apos;ve applied your revision comments and
          generated an updated concept below.
        </p>

        {/* Revision image — loading placeholder until the task completes. */}
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950">
          {failed ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="text-red-400"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                This revision could not be generated.
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Use &quot;Generate My Design&quot; above to try again.
              </p>
            </div>
          ) : done ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.url}
              alt={`Revised design preview — revision ${round}`}
              loading="lazy"
              decoding="async"
              className="block h-auto w-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 px-4 py-10">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-emerald-500" />
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                Luna is preparing your revision…
              </p>
            </div>
          )}
        </div>

        {/* Satisfaction rating — stored per entry, keyed by entry.id. */}
        <div className="mt-4">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
            Overall, how satisfied are you with this concept?
          </p>
          <div
            className="mt-2 flex items-center gap-1.5"
            role="radiogroup"
            aria-label="Satisfaction rating"
          >
            {RATING_EMOJIS.map((emoji, idx) => {
              const value = idx + 1;
              const selected = rating === value;
              return (
                <motion.button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${RATING_LABELS[idx]} (${value}/5)`}
                  title={RATING_LABELS[idx]}
                  onClick={() => onRate(value)}
                  disabled={!interactive}
                  whileHover={interactive ? { scale: 1.12, y: -2 } : undefined}
                  whileTap={interactive ? { scale: 0.9 } : undefined}
                  className={`flex h-11 w-11 items-center justify-center rounded-full border text-xl transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected
                      ? "border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-500/20 dark:bg-emerald-500/10"
                      : "border-zinc-200 bg-white hover:border-emerald-300 dark:border-zinc-700 dark:bg-zinc-900"
                  }`}
                >
                  {emoji}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Three actions — the only exit points from the revision loop. */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <motion.button
            type="button"
            onClick={() => onAllINeed(rating)}
            disabled={!interactive}
            whileHover={interactive ? { scale: 1.03 } : undefined}
            whileTap={interactive ? { scale: 0.95 } : undefined}
            className={BUTTON_CLASS}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
            This is All I Need
          </motion.button>

          <motion.button
            type="button"
            onClick={onRegenerate}
            disabled={!interactive || regenerateDisabled}
            whileHover={interactive && !regenerateDisabled ? { scale: 1.03 } : undefined}
            whileTap={interactive && !regenerateDisabled ? { scale: 0.95 } : undefined}
            className={BUTTON_CLASS}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
            Regenerate With Comments
          </motion.button>

          <motion.button
            type="button"
            onClick={() => onEngageDesigner(rating)}
            disabled={!interactive}
            whileHover={interactive ? { scale: 1.03 } : undefined}
            whileTap={interactive ? { scale: 0.95 } : undefined}
            className={BUTTON_CLASS}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Engage Designer
          </motion.button>
        </div>

        {regenerateDisabled && interactive && (
          <p className="mt-2.5 text-xs text-amber-600 dark:text-amber-400">
            You&apos;ve reached the revision limit — engage your designer for
            further changes.
          </p>
        )}
      </div>
    </motion.div>
  );
}
