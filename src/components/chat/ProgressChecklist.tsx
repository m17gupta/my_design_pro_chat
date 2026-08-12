"use client";

import { episodeById } from "./flow";
import { CHECKLIST } from "./types";

interface ProgressChecklistProps {
  completed: ReadonlySet<string>;
  currentId: string | null;
}

export default function ProgressChecklist({
  completed,
  currentId,
}: ProgressChecklistProps) {
  const doneCount = CHECKLIST.filter((c) => completed.has(c.id)).length;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Intake checklist
        </h2>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          {doneCount}/{CHECKLIST.length}
        </span>
      </div>

      <ol className="space-y-1">
        {CHECKLIST.map((item) => {
          const isDone = completed.has(item.id);
          // currentId is an episode apiKey — highlight via its checklist item.
          const activeChecklistId = currentId
            ? episodeById(currentId).checklistId ?? null
            : null;
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
                  {item.label}
                </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
