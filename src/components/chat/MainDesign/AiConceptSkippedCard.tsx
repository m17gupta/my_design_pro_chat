"use client";

import { motion, useReducedMotion } from "framer-motion";
import LunaAvatar from "../LunaAvatar";
import { postToHost, HOST_ACTION_SUBMIT_PROJECT } from "@/lib/hostBridge";

interface AiConceptSkippedCardProps {
  dcName?: string;
  onGoToPortfolio?: () => void;
}

export default function AiConceptSkippedCard({
  dcName,
  onGoToPortfolio,
}: AiConceptSkippedCardProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const designerName = dcName ? dcName.replace(/\.$/, "") : "Brooke";

  const handleGoToPortfolio = () => {
    if (onGoToPortfolio) {
      onGoToPortfolio();
      return;
    }
    try {
      postToHost({
        action: HOST_ACTION_SUBMIT_PROJECT,
        data: {
          id: null,
          original: {},
          design: [],
          rating: 0,
          action: "go_to_portfolio",
        },
      });
    } catch {
      // safe fallback if not running in embedded iframe
    }
  };

  return (
    <div className="w-full">
      {/* ── Top Status Card (Screen 2 Top Box) ── */}
      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className="mt-3 w-full overflow-hidden rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex aspect-[16/10] sm:aspect-[16/9] w-full flex-col items-center justify-center rounded-xl bg-[#EAF5EC] dark:bg-emerald-950/20">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#A5D6A7] text-white shadow-sm dark:bg-emerald-700">
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <span className="mt-2.5 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            AI concept skipped
          </span>
        </div>
      </motion.div>

      {/* ── Follow-up Assistant Bubble (Screen 2 Bottom Box) ── */}
      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 30, delay: 0.12 }}
        className="mt-4 flex items-start gap-3 w-full"
      >
        <div className="mt-0.5 shrink-0">
          <LunaAvatar size="sm" />
        </div>
        <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tl-sm border border-zinc-200/80 bg-white p-4 sm:p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            Thank you. I have stopped the concept generation and will forward everything to{" "}
            <strong className="font-bold text-zinc-900 dark:text-zinc-50">
              {designerName}.
            </strong>
          </p>
          <p className="mt-2.5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            She will get back to you within one business day with any questions and/or a quote to execute your request.
          </p>
          <div className="mt-4">
            <button
              type="button"
              onClick={handleGoToPortfolio}
              className="rounded-full bg-[#37474F] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#263238] active:scale-95 dark:bg-zinc-700 dark:hover:bg-zinc-600"
            >
              Go to Portfolio
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
