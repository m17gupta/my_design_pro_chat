"use client";

import { RootState } from "@/store";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setIsSkipped } from "@/store/enterprise/enterpriseSlice";
import AiConceptSkippedCard from "./AiConceptSkippedCard";

interface DesignGeneratingCardProps {
  /** Backend task lifecycle: queued | processing ("" before the first poll). */
  status?: string;
  onSkip?: () => void;
  onGoToPortfolio?: () => void;
}


const GENERATING_MESSAGES = [
  "Thanks! I'm putting everything together...",
  "Logging our conversation...",
  "Organizing your ideas...",
  "Making sure I didn't miss a thing...",
  "One last pass before we're done...",
  "Don't leave, I'm finishing up.",
  "Almost there! Just a few more seconds.",
];

export default function DesignGeneratingCard({
  status = "",
  onSkip,
  onGoToPortfolio,
}: DesignGeneratingCardProps) {
  const dispatch = useDispatch();
  const reduceMotion = useReducedMotion() ?? false;
  const { entries, isSkipped } = useSelector((state: RootState) => state.enterprise);
  const original = entries.find((entry) => entry.type === "original");
  const {dc_name}= useSelector((state:RootState)=>state.chat)
  const currentStatus = original?.status || status;
  const isGenerating =
    original &&
    (currentStatus === "pending" ||
      currentStatus === "queued" ||
      currentStatus === "processing" ||
      currentStatus === "");

  const [messageIndex, setMessageIndex] = useState(0);

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

  const handleSkip = () => {
    dispatch(setIsSkipped(true));
    onSkip?.();
  };

  if (isSkipped) {
    return <AiConceptSkippedCard dcName={dc_name ?? undefined} onGoToPortfolio={onGoToPortfolio} />;
  }

  if (!isGenerating) {
    return null;
  }

  return (
    <>
{  isGenerating &&  <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="mt-3 w-full overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div role="status" aria-live="polite" className="p-4 sm:p-5">
        {/* Status row */}
        <div className="flex items-center gap-3">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
            <span
              aria-hidden="true"
              className="absolute h-full w-full animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600 dark:border-emerald-500/20 dark:border-t-emerald-400"
            />
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400"
            />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-normal text-zinc-700 dark:text-zinc-300">
              I’ll send everything over to{" "}
              <strong className="font-bold text-zinc-900 dark:text-zinc-50">
                {dc_name ? `${dc_name}.` : ""}
              </strong>{" "}
              Before I do, I would love to show you a quick design idea based on everything you’ve shared with me.
            </p>
          </div>
        </div>

        {/* Skip AI Concept section */}
        <div className="mt-4 flex flex-col items-center justify-center gap-1.5 text-center">
          <button
            type="button"
            onClick={handleSkip}
            className="min-w-[190px] sm:min-w-[210px] rounded-xl border border-[#8B2C5D] bg-white px-8 py-2.5 text-xs font-medium text-[#8B2C5D] shadow-sm transition hover:bg-[#8B2C5D]/5 active:scale-95 dark:border-[#B24D7E] dark:bg-zinc-900 dark:text-[#E07A9E] dark:hover:bg-[#8B2C5D]/15"
          >
            Skip AI Concept
          </button>
          <div className="flex items-center justify-center gap-1 text-[11.5px] sm:text-xs text-zinc-500 dark:text-zinc-400">
            <svg
              className="h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>AI concepts are optional and will not affect your designer&apos;s review.</span>
          </div>
        </div>

        {/* Image-shaped placeholder skeleton */}
        <div className="relative mt-4 overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex aspect-[16/10] w-full items-center justify-center">
            {/* Shimmer sweep */}
            <div
              aria-hidden="true"
              className="absolute inset-0 -translate-x-full animate-pulse bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/10"
            />
            <div className="relative flex flex-col items-center gap-2 text-zinc-400 dark:text-zinc-500">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="animate-spin text-emerald-500 dark:text-emerald-400"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <AnimatePresence mode="wait">
                <motion.span
                  key={messageIndex}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3 }}
                  transition={{ duration: 0.25 }}
                  className="px-4 text-center text-sm font-medium text-zinc-600 dark:text-zinc-300"
                >
                  {subtitle}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Indeterminate progress bar */}
        <div
          aria-label="Design generation in progress"
          className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
        >
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
            initial={{ x: "-100%" }}
            animate={reduceMotion ? undefined : { x: "100%" }}
            transition={{
              duration: 1.6,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>
      </div>
    </motion.div>}
    </>
  );
}
