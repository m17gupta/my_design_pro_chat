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
  /** True while the engage designer host action is pending */
  isEngagingDesigner?: boolean;
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
  isEngagingDesigner = false,
  onAllINeed,
  onRegenerate,
  onEngageDesigner,
}: DesignResultCardProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const { entries } = useSelector((state: RootState) => state.enterprise);
  const { revision_comment } = useSelector((state: RootState) => state.chat);
  const {dc_name}= useSelector((state:RootState)=>state.chat)
  const revision = entries.filter((item) => item.type == "revision");
  const hasRevisionComment =
    revision_comment.notes !== "" || revision_comment.files.length > 0;
  const interactive =
    !disabled && !submittedAction && !isEngagingDesigner && (revision.length <= 4 || hasRevisionComment);

  const isRegenerateDisabled =
    isRegenerating || hasRevisionComment || !interactive;

  const handleDownload = async () => {
  if (!imageUrl) return;

  try {
    const response = await fetch(imageUrl, {
      mode: "cors",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const blob = await response.blob();

    const blobUrl = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = "luna-design-render.jpg";
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
    }, 2000);

  } catch (error) {
    console.error("Download failed:", error);

    // IMPORTANT:
    // Do NOT use imageUrl directly here.
    // That is what causes the current page to navigate to the image.

    alert("Unable to download the image. Please try again.");
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
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
            Before I get this project over to{" "}
            <strong className="font-bold text-zinc-900 dark:text-zinc-50">
              {dc_name || "your design coordinator"}
            </strong>
            , I have taken the liberty of generating an initial render of how I interpreted your requests.
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

        <div className="relative mt-4 overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Generated design preview of your front yard"
            loading="lazy"
            decoding="async"
            className="block h-auto w-full object-cover"
          />
          {imageUrl && (
            <button
              type="button"
              onClick={handleDownload}
              title="Download Image"
              aria-label="Download design image"
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
              whileHover={interactive && !isEngagingDesigner ? { scale: 1.03 } : undefined}
              whileTap={interactive && !isEngagingDesigner ? { scale: 0.95 } : undefined}
              className={BUTTON_CLASS}
              disabled={hasRevisionComment || !interactive || isEngagingDesigner}
            >
              {isEngagingDesigner ? (
                <svg
                  className="h-3.5 w-3.5 animate-spin text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
              ) : (
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
              )}
              {isEngagingDesigner ? "Engaging Designer..." : "Engage Designer"}
            </motion.button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
