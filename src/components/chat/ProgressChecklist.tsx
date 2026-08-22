"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ChecklistItem } from "./types";
import type { Episode } from "./flow";
import { useLineByLineTypewriter } from "./useLineByLineTypewriter";

interface ProgressChecklistProps {
  completed: ReadonlySet<string>;
  currentId: string | null;
  /** Active episodes for the current work type. */
  episodes?: Episode[];
  /** Checklist items for the current work type. */
  checklist?: ChecklistItem[] | null;
  animate?: boolean;
  /** Typing speed per word token in ms. */
  speedMs?: number;
  /** Time gap between completed lines and the next line. */
  lineDelayMs?: number;
}

export default function ProgressChecklist({
  completed,
  currentId,
  episodes,
  checklist,
  animate = true,
  speedMs = 25,
  lineDelayMs = 900,
}: ProgressChecklistProps) {
  const { visibleItems } = useLineByLineTypewriter(checklist, {
    enabled: animate,
    speedMs,
    lineDelayMs,
  });

  if (!checklist || checklist.length === 0) {
    return (
      <div>
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Intake checklist
          </h2>
        </div>
        <div className="flex items-center gap-2 rounded-xl px-2.5 py-3 text-[13px] text-zinc-400 dark:text-zinc-500 animate-pulse">
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
          <span>Loading checklist...</span>
        </div>
      </div>
    );
  }

  const doneCount = checklist.filter((item) => completed.has(item.id)).length;
  const progressPct = checklist.length > 0 ? doneCount / checklist.length : 0;

  const activeChecklistId = currentId
    ? episodes?.find((episode) => episode.apiKey === currentId)?.checklistId ?? null
    : null;

  return (
    <div>
      {/* Header + counter */}
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Intake checklist
        </h2>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {doneCount}/{checklist.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-3 h-[3px] w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <motion.div
          className="h-full rounded-full bg-zinc-500 dark:bg-zinc-400"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: progressPct }}
          style={{ transformOrigin: "left" }}
          transition={{ type: "spring", stiffness: 180, damping: 28 }}
        />
      </div>

      {/* Items */}
      <ol className="space-y-0.5">
        <AnimatePresence initial={false}>
          {visibleItems.map(({ item, displayText, isTyping }, idx) => {
            const isDone = completed.has(item.id);
            const isActive = activeChecklistId === item.id && !isDone;

            return (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 380,
                  damping: 28,
                  delay: idx * 0.04,
                }}
                className={`flex items-start gap-2.5 rounded-xl px-2.5 py-2 transition-colors duration-150 ${
                  isActive
                    ? "bg-zinc-100/80 ring-1 ring-zinc-200 dark:bg-zinc-800/60 dark:ring-zinc-700/50"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                }`}
              >
                {/* Step badge */}
                <motion.span
                  aria-hidden="true"
                  animate={
                    isDone
                      ? { scale: [1.3, 1], rotate: [-12, 0] }
                      : { scale: 1, rotate: 0 }
                  }
                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-colors duration-200 ${
                    isDone
                      ? "border-zinc-600 bg-zinc-700 text-white dark:border-zinc-300 dark:bg-zinc-200 dark:text-zinc-900"
                      : isActive
                      ? "border-zinc-400 bg-white text-zinc-600 dark:bg-zinc-900 dark:border-zinc-500 dark:text-zinc-300"
                      : "border-zinc-300 text-zinc-400 dark:border-zinc-700 dark:text-zinc-500"
                  }`}
                >
                  {isDone ? (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : (
                    item.number
                  )}
                </motion.span>

                {/* Label */}
                <span
                  aria-current={isActive ? "step" : undefined}
                  className={`text-[13px] leading-snug transition-colors duration-150 ${
                    isDone
                      ? "text-zinc-400 line-through decoration-zinc-300/60 dark:text-zinc-600"
                      : isActive
                      ? "font-semibold text-zinc-800 dark:text-zinc-100"
                      : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  {displayText}
                  {isTyping && (
                    <span
                      aria-hidden="true"
                      className="caret-blink ml-px inline-block h-[1em] w-[2px] rounded-[1px] bg-zinc-400 align-middle dark:bg-zinc-500"
                    />
                  )}
                </span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
    </div>
  );
}