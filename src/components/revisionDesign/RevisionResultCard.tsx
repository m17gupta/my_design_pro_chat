"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { EnterpriseEntry } from "@/store/enterprise/enterpriseType";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

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

const GENERATING_MESSAGES = [
  "Thanks! I'm putting everything together...",
  "Logging our conversation...",
  "Organizing your ideas...",
  "Making sure I didn't miss a thing...",
  "One last pass before we're done...",
  "Don't leave; I'm finishing up.",
  "Almost there! Just a few more seconds.",
];

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
  const [regenerateClicked, setRegenerateClicked] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const hasImage = Boolean(entry.url);
  const done = entry.status === "completed" || hasImage;
  const failed = entry.status === "failed";
  const { entries } = useSelector((state: RootState) => state.enterprise);
  const getRevison = entries.filter((item) => item.type === "revision");

  const isGenerating =
    entry.status === "pending" ||
    entry.status === "queued" ||
    entry.status === "processing" ||
    (!done && !failed);

  useEffect(() => {
    if (!isGenerating) {
      setMessageIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setMessageIndex((prev) =>
        prev < GENERATING_MESSAGES.length - 1 ? prev + 1 : prev
      );
    }, 5000);

    return () => clearInterval(interval);
  }, [isGenerating]);

  const subtitle = GENERATING_MESSAGES[messageIndex];

  const hideButtons =
    isGenerating ||
    !done ||
    (getRevison.length > round && getRevison[round]?.status === "completed");
  const interactive = !locked && !submittedAction && !isGenerating && !regenerateClicked;

const handleDownload = async () => {
  if (!entry.url) return;

  try {
    const response = await fetch(entry.url, {
      mode: "cors",
      credentials: "omit",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const blob = await response.blob();

    const blobUrl = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `luna-design-revision-${round}.jpg`;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Don't revoke immediately — allow browser to start download
    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
    }, 3000);
  } catch (error) {
    console.error("Image download failed:", error);

    // Don't navigate to entry.url as fallback.
    // That would open the image in the current window.
    alert(
      "Unable to download this image. Please check the image server's CORS settings."
    );
  }
};

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
        {/* <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          Thanks for the feedback — I&apos;ve applied your revision comments and
          generated an updated concept below.
        </p> */}

        {/* Revision image — loading placeholder until the task completes. */}
        <div className="relative mt-4 overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950">
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
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={entry.url}
                alt={`Revised design preview — revision ${round}`}
                loading="lazy"
                decoding="async"
                className="block h-auto w-full object-cover"
              />
              {entry.url && (
                <button
                  type="button"
                  onClick={handleDownload}
                  title="Download Image"
                  aria-label="Download revised design image"
                  className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-xl bg-black/60 text-white backdrop-blur-md transition-all duration-150 hover:bg-black/80 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-400 shadow-lg"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 px-4 py-10">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-emerald-500" />
              <AnimatePresence mode="wait">
                <motion.p
                  key={messageIndex}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3 }}
                  transition={{ duration: 0.25 }}
                  className="px-4 text-center text-sm font-medium text-zinc-600 dark:text-zinc-300"
                >
                  {subtitle}
                </motion.p>
              </AnimatePresence>
            </div>
          )}
        </div>

     

        {/* Three actions — the only exit points from the revision loop. */}
        {!hideButtons && (
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
              onClick={() => {
                setRegenerateClicked(true);
                onRegenerate();
              }}
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
        )}

        {!hideButtons && regenerateDisabled && interactive && (
          <p className="mt-2.5 text-xs text-amber-600 dark:text-amber-400">
            You&apos;ve reached the revision limit — engage your designer for
            further changes.
          </p>
        )}
      </div>
    </motion.div>
  );
}
