"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { summaryCopyForWorkType } from "../types";
import { buildEpisodesFromContext } from "../flow";

import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { isAnswerEmpty, answerToText } from "@/lib/briefDisplay";
import { selectQuestionnaireSequence } from "@/store/questionnaires/questionnaireSlice";

interface DesignSummaryCardProps {
  answers: Record<string, string>;
  uploadTotal: number;
  /** True while the brief POST to the design API is in flight. */
  generating?: boolean;
  /** Disabled comes from the original entry's status (never read from Redux). */
  disabled?: boolean;
  /**
   * Hide the action buttons while keeping the summary grid in the chat
   * (e.g. once the design has been generated — the result card takes over).
   */
  showActions?: boolean;

  /** Override the summary headline (AllQuestion-driven flows). */
  summaryTitle?: string;
  /** Override the summary body (AllQuestion-driven flows). */
  summaryText?: string;
  onGenerate: () => void;
  onChanges: () => void;
}

export default function DesignSummaryCard({
  answers,
  uploadTotal,
  generating = false,
  disabled = false,
  showActions = true,

  summaryTitle,
  summaryText,
  onGenerate,
  onChanges,
}: DesignSummaryCardProps) {

  const { original, work_type, role, user_type, question_sets } = useSelector((state: RootState) => state.chat);
  const { data: questionnaire } = useSelector((state: RootState) => state.questionnaires);
  const questionnaireSequence = useSelector(selectQuestionnaireSequence);

  const orderedKeys = useMemo(() => {
    if (!original || Object.keys(original).length === 0) return [];
    
    if (questionnaireSequence && questionnaireSequence.length > 0) {
      const presentKeys = questionnaireSequence.filter((key) => key in original);
      const remainingKeys = Object.keys(original).filter(
        (key) => !presentKeys.includes(key)
      );
      return [...presentKeys, ...remainingKeys];
    }

    // Fallback: calculate episodes if questionnaireSequence is not populated (e.g. page refresh)
    const episodes = buildEpisodesFromContext(
      {
        work_type: work_type ?? undefined,
        user_type: user_type ?? undefined,
        role: role ?? undefined,
        question_sets: question_sets ?? undefined,
      },
      questionnaire ?? undefined
    );

    const episodeKeys = episodes.map((ep) => ep.apiKey);
    const presentEpisodeKeys = episodeKeys.filter((key) => key in original);
    const remainingKeys = Object.keys(original).filter(
      (key) => !presentEpisodeKeys.includes(key)
    );

    return [...presentEpisodeKeys, ...remainingKeys];
  }, [original, work_type, user_type, role, question_sets, questionnaire, questionnaireSequence]);

  const title ="Design Summary";
  const description =  "Let me generate an initial rendering based on my understanding of what you are looking for.";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="w-full rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h3 className="text-base font-semibold tracking-tight text-emerald-700 dark:text-emerald-400">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
        {description}
      </p>

      <div className="mt-4 overflow-scroll max-h-[calc(100vh-330px)] rounded-xl border border-zinc-200/80 dark:border-zinc-800">

        { orderedKeys.length > 0 &&
          orderedKeys.map((key, i) => {
            const item = original[key];
        
            if (!item) return null;
            const { answer, name } = item;
            
            const isArray = Array.isArray(answer);
            const isObject = typeof answer === "object" && answer !== null && !isArray;
            const isEmpty = isAnswerEmpty(answer);
            
            return (
              <div
                key={key}
                className={`flex items-center gap-3 px-3.5 py-2.5 ${
                  i > 0 ? "border-t border-zinc-200/80 dark:border-zinc-800" : ""
                }`}
              >
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
                  <path d="M3 10.5L12 3l9 7.5" />
                  <path d="M5 9.5V21h14V9.5" />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {name}
                  </p>
                </div>
                {isEmpty ? (
                  <p className="min-w-0 max-w-[45%] truncate text-right text-sm text-zinc-800 dark:text-zinc-100">
                    <span className="italic text-zinc-400 dark:text-zinc-500">
                      Not answered
                    </span>
                  </p>
                ) : typeof answer === "string" ? (
                  <p className="min-w-0 max-w-[45%] truncate text-right text-sm text-zinc-800 dark:text-zinc-100" title={answer}>
                    {answer}
                  </p>
                ) : isArray ? (
                  <div className="flex flex-wrap gap-1 justify-end max-w-[50%]">
                    {answer.map((url, idx) => {
                      const isImage = /\.(jpeg|jpg|gif|png|webp|svg)/i.test(url) || url.startsWith("data:image");
                      if (isImage) {
                        return (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 transition-transform hover:scale-105"
                          >
                            <img src={url} alt="thumbnail" className="h-full w-full object-cover" />
                          </a>
                        );
                      } else {
                        return (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex h-8 px-2 shrink-0 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-[10px] font-medium text-zinc-500 hover:bg-zinc-100"
                          >
                            File {idx + 1}
                          </a>
                        );
                      }
                    })}
                  </div>
                ) : isObject ? (
                  (() => {
                    const notes = "notes" in answer ? answer.notes : "";
                    const files = "files" in answer ? answer.files : [];
                    const value = "value" in answer ? answer.value : [];
                    return (
                      <div className="flex flex-col gap-1 items-end max-w-[60%]">
                        {notes.trim() && (
                          <p className="text-right text-sm text-zinc-800 dark:text-zinc-100 truncate w-full" title={notes}>
                            {notes}
                          </p>
                        )}
                        {value.length > 0 && (
                          <p className="text-right text-xs text-zinc-500 dark:text-zinc-400 truncate w-full" title={value.join(", ")}>
                            {value.join(", ")}
                          </p>
                        )}
                        {files.length > 0 && (
                          <div className="flex flex-wrap gap-1 justify-end">
                            {files.map((url, idx) => {
                              const isImage = /\.(jpeg|jpg|gif|png|webp|svg)/i.test(url) || url.startsWith("data:image");
                              if (isImage) {
                                return (
                                  <a
                                    key={idx}
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 transition-transform hover:scale-105"
                                  >
                                    <img src={url} alt="thumbnail" className="h-full w-full object-cover" />
                                  </a>
                                );
                              } else {
                                return (
                                  <a
                                    key={idx}
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex h-8 px-2 shrink-0 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-[10px] font-medium text-zinc-500 hover:bg-zinc-100"
                                  >
                                    File {idx + 1}
                                  </a>
                                );
                              }
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : null}
              </div>
            );
          })
        }
        {uploadTotal > 0 && (
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
              {uploadTotal} file{uploadTotal > 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>

      {showActions && (
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
            {generating ? "Generating…" : "Proceed"}
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
