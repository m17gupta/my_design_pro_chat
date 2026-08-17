"use client";

import { RootState } from "@/store";
import { motion } from "framer-motion";
import { useSelector } from "react-redux";

interface RevisionSummaryCardProps {
  /** 1-based revision round — shown as the "Revision N" badge. */
  round?: number;
  /** The revision comments text the user provided in the feedback step. */
  notes: string;
  /** Number of files uploaded alongside the revision comments. */
  filesCount: number;
  /** True while the brief POST to the design API is in flight. */
  generating?: boolean;
  /** Disabled comes from this round's entry status (never read from Redux). */
  disabled?: boolean;
  /** Hide the action buttons (history rounds / completed rounds). */
  showActions?: boolean;
  /** "Generate My Design" — regenerate using the same design API. */
  onGenerate: () => void;
  /** "I'd Like To Make Changes" — go back to edit the revision comments. */
  onChanges: () => void;
}

/**
 * Shown right after the user answers the Revision Comments card. Mirrors the
 * Design Summary card's 3-column grid (icon | label | answer) but summarizes
 * the revision itself — the comments text and any uploaded files — and offers
 * the two actions: regenerate with the same design API, or edit the comments.
 */
export default function RevisionSummaryCard({
  round = 1,
  notes,
  filesCount,
  generating = false,
  disabled = false,
  showActions = true,
  onGenerate,
  onChanges,
}: RevisionSummaryCardProps) {


  const {lifecycle}= useSelector((state:RootState)=>state.enterprise)
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="w-full rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold tracking-tight text-emerald-700 dark:text-emerald-400">
          Revision Summary
        </h3>
        {round > 1 && (
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            Revision {round}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
        Based on your answers, Luna will create a revised design featuring your
        requested changes.
      </p>

      <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200/80 dark:border-zinc-800">
        <div className="flex items-start gap-3 px-3.5 py-2.5">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-emerald-500"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <path d="M8 9h8" />
            <path d="M8 13h5" />
          </svg>
          <p className="min-w-0 flex-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Revision Comments
          </p>
          <p className="min-w-0 max-w-[55%] whitespace-pre-wrap break-words text-right text-sm text-zinc-800 dark:text-zinc-100">
            {notes || (
              <span className="italic text-zinc-400 dark:text-zinc-500">
                Not provided
              </span>
            )}
          </p>
        </div>
        {filesCount > 0 && (
          <div className="flex items-center gap-3 border-t border-zinc-200/80 px-3.5 py-2.5 dark:border-zinc-800">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="shrink-0 text-emerald-500"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
            <p className="flex-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Uploaded files
            </p>
            <p className="text-sm text-zinc-800 dark:text-zinc-100">
              {filesCount} file{filesCount > 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>

      {showActions && (lifecycle=="succeeded"|| lifecycle=="loading")&& (
        <div className="mt-4 flex flex-wrap justify-center gap-3 w-full">
          <motion.button
            type="button"
            onClick={onGenerate}
            disabled={disabled || generating}
            whileHover={disabled || generating ? undefined : { scale: 1.03 }}
            whileTap={disabled || generating ? undefined : { scale: 0.95 }}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/25 transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? (
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
              />
            ) : (
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
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <path d="M22 4L12 14.01l-3-3" />
              </svg>
            )}
            {generating ? "Generating…" : "Generate My Design"}
          </motion.button>
          {/* <motion.button
            type="button"
            onClick={onChanges}
            disabled={disabled}
            whileHover={disabled ? undefined : { scale: 1.03 }}
            whileTap={disabled ? undefined : { scale: 0.95 }}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-white px-5 py-2.5 text-sm font-medium text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-500/40 dark:bg-zinc-900 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
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
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            I’d Like To Make Changes
          </motion.button> */}
        </div>
      )}
    </motion.div>
  );
}
