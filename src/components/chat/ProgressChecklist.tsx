"use client";

import { CHECKLIST, type ChecklistItem } from "./types";
import type { Episode } from "./flow";
import { useLineByLineTypewriter } from "./useLineByLineTypewriter";

interface ProgressChecklistProps {
  completed: ReadonlySet<string>;
  currentId: string | null;
  /** Active episodes for the current work type (falls back to static EPISODES). */
  episodes?: Episode[];
  /** Checklist items for the current work type (falls back to landscape CHECKLIST). */
  checklist?: ChecklistItem[] | null;
  animate?: boolean;
  /** Typing speed per word token in ms (default: 40ms). */
  speedMs?: number;
  /** Time gap / pause between lines in ms (default: 150ms). */
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
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <span>Loading checklist...</span>
        </div>
      </div>
    );
  }
  const doneCount = checklist.filter((c) => completed.has(c.id)).length;

  // currentId is an episode apiKey — highlight via its checklist item.
  // Resolved from the passed episodes list so work-type-specific episode
  // keys (e.g. color-material's) never hit the static map (which would throw).
  const activeChecklistId = currentId
    ? episodes?.find((e) => e.apiKey === currentId)?.checklistId ?? null
    : null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Intake checklist
        </h2>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          {doneCount}/{checklist.length}
        </span>
      </div>

      <ol className="space-y-1">
        {visibleItems.map(({ item, displayText, isTyping }) => {
          const isDone = completed.has(item.id);
          const isActive = activeChecklistId === item.id && !isDone;
          return (
            <li
              key={item.id}
              className={`flex items-start gap-2.5 rounded-xl px-2.5 py-2 transition-colors duration-150 ${
                  isActive
                    ? "bg-emerald-50 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:ring-emerald-500/30"
                    : "hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-colors duration-150 ${
                    isDone
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : isActive
                        ? "border-emerald-400 bg-white text-emerald-600 dark:bg-zinc-900"
                        : "border-zinc-300 text-zinc-400 dark:border-zinc-700 dark:text-zinc-500"
                  }`}
                >
                  {isDone ? (
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : (
                    item.number
                  )}
                </span>
                <span
                  aria-current={isActive ? "step" : undefined}
                  className={`text-[13px] leading-snug transition-colors duration-150 ${
                    isDone
                      ? "text-zinc-400 line-through decoration-emerald-300/70 dark:text-zinc-500"
                      : isActive
                        ? "font-semibold text-emerald-900 dark:text-emerald-100"
                        : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  {displayText}
                  {isTyping && (
                    <span
                      aria-hidden="true"
                      className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse rounded-sm bg-emerald-500 align-middle dark:bg-emerald-400"
                    />
                  )}
                </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
