"use client";

import { RootState } from "@/store";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";

interface DesignGeneratingCardProps {
  /** Backend task lifecycle: queued | processing ("" before the first poll). */
  status?: string;
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

export default function DesignGeneratingCard({ status = "" }: DesignGeneratingCardProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const { entries } = useSelector((state: RootState) => state.enterprise);
  const original = entries.find((entry) => entry.type === "original");
  
  const currentStatus = original?.status || status;
  const isGenerating =
    original &&
    (currentStatus === "pending" ||
      currentStatus === "queued" ||
      currentStatus === "processing" ||
      currentStatus === "");

  const rendering = currentStatus === "processing";
  const title = rendering ? "Rendering your design…" : "Preparing your design…";

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
    }, 3500);

    return () => clearInterval(interval);
  }, [isGenerating]);

  const subtitle = GENERATING_MESSAGES[messageIndex];

  if (!isGenerating) {
    return null;
  }

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="w-full overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
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
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{title}</p>
            <AnimatePresence mode="wait">
              <motion.p
                key={messageIndex}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.25 }}
                className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400"
              >
                {subtitle}
              </motion.p>
            </AnimatePresence>
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
                width="34"
                height="34"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="opacity-60"
              >
                <path d="M3 12l3-3 4 4 4-4 7 7" />
                <path d="M21 9v6H3V9" />
              </svg>
              <span className="animate-pulse text-xs font-medium">
                Generating preview…
              </span>
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
    </motion.div>
  );
}
