"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { SubmitAction } from "@/components/revisionDesign/RevisionResultCard";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

interface DesignResultCardProps {
  /** Generated design preview URL from the completed status result. */
  imageUrl: string;
  /** Disabled only while the entry itself is pending/failed — never because a revision exists. */
  disabled?: boolean;
  /** Set once a terminal action was submitted — locks buttons + confirms. */
  submittedAction?: SubmitAction | null;
  onAllINeed: () => void;
  onRegenerate: () => void;
  onEngageDesigner: () => void;
}

const BUTTON_CLASS =
  "inline-flex items-center gap-1.5 rounded-xl bg-[#37474f] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-colors enabled:hover:bg-[#263238] disabled:cursor-not-allowed disabled:opacity-40 disabled:saturate-50 disabled:shadow-none dark:bg-[#546e7a] enabled:dark:hover:bg-[#455a64]";

/**
 * Original (intake) render result card — shown on the `ep-summary` message.
 * Pure presentational: the image, disabled state, and submit confirmation all
 * arrive via props; it never reads the store and never locks itself just
 * because revisions exist (the revision loop lives on its own cards).
 */
export default function DesignResultCard({
  imageUrl,
  disabled = false,
  submittedAction = null,
  onAllINeed,
  onRegenerate,
  onEngageDesigner,
}: DesignResultCardProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const { entries } = useSelector((state: RootState) => state.enterprise);
  const { revision_comment } = useSelector((state: RootState) => state.chat);

  const revision = entries.filter((item) => item.type == "revision");
  const hasRevisionComment =
    revision_comment.notes !== "" || revision_comment.files.length > 0;
  const interactive =
    !disabled && !submittedAction && (revision.length <= 4 || hasRevisionComment);

  const isRegenerateDisabled =
    isRegenerating || hasRevisionComment || !interactive;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="w-full overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
            Before I get this project over to your design coordinator, I have taken the
            liberty of generating an initial render of how I interpreted your requests.
          </p>
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

        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Generated design preview of your front yard"
            loading="lazy"
            decoding="async"
            className="block h-auto w-full object-cover"
          />
        </div>

        {!(revision.length > 0 && revision[0].status === "completed") && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <motion.button
              type="button"
              onClick={onAllINeed}
              whileHover={interactive ? { scale: 1.03 } : undefined}
              whileTap={interactive ? { scale: 0.95 } : undefined}
              className={BUTTON_CLASS}
              disabled={hasRevisionComment || !interactive}
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
                setIsRegenerating(true);
                onRegenerate();
              }}
              whileHover={!isRegenerateDisabled ? { scale: 1.03 } : undefined}
              whileTap={!isRegenerateDisabled ? { scale: 0.95 } : undefined}
              className={BUTTON_CLASS}
              disabled={isRegenerateDisabled}
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
              onClick={onEngageDesigner}
              whileHover={interactive ? { scale: 1.03 } : undefined}
              whileTap={interactive ? { scale: 0.95 } : undefined}
              className={BUTTON_CLASS}
             disabled={hasRevisionComment|| !interactive}
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
      </div>
    </motion.div>
  );
}
