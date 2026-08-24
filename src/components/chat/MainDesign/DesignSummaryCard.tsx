"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { summaryCopyForWorkType } from "../types";
import { buildEpisodesFromContext } from "../flow";

import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { isAnswerEmpty, answerToText } from "@/lib/briefDisplay";
import { selectQuestionnaireSequence } from "@/store/questionnaires/questionnaireSlice";

// ── File-type helpers ─────────────────────────────────────────────────────────
type FileCategory = "image" | "pdf" | "doc" | "cad" | "other";

function getFileExt(nameOrUrl: string): string {
  if (!nameOrUrl) return "";
  const clean = nameOrUrl.split("?")[0].split("#")[0];
  const parts = clean.split(".");
  if (parts.length <= 1) return "";
  return "." + parts.pop()!.toLowerCase();
}

function getFileCategory(nameOrUrl: string): FileCategory {
  const ext = getFileExt(nameOrUrl);
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"].includes(ext)) return "image";
  if (ext === ".pdf") return "pdf";
  if ([".doc", ".docx"].includes(ext)) return "doc";
  if ([".dwg", ".rvt", ".skp"].includes(ext)) return "cad";
  return "other";
}

const FILE_ICON: Record<Exclude<FileCategory, "image">, { icon: string; bg: string; text: string; label: string }> = {
  pdf:   { icon: "bi bi-file-earmark-pdf-fill", bg: "bg-red-50 dark:bg-red-950/40",       text: "text-red-500 dark:text-red-400",       label: "PDF"  },
  doc:   { icon: "bi bi-file-earmark-word-fill",bg: "bg-blue-50 dark:bg-blue-950/40",     text: "text-blue-500 dark:text-blue-400",     label: "DOC"  },
  cad:   { icon: "bi bi-rulers",                bg: "bg-violet-50 dark:bg-violet-950/40", text: "text-violet-500 dark:text-violet-400", label: "CAD"  },
  other: { icon: "bi bi-file-earmark-fill",     bg: "bg-zinc-100 dark:bg-zinc-800",       text: "text-zinc-500 dark:text-zinc-400",     label: "File" },
};

// ── Image modal (portal — escapes overflow/transform parents) ────────────────
function ImageModal({ url, onClose }: { url: string; onClose: () => void }) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Full size preview"
          className="max-h-[85vh] max-w-[85vw] rounded-2xl object-contain shadow-2xl"
        />
        <button
          type="button"
          aria-label="Close preview"
          onClick={onClose}
          className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg text-zinc-700 hover:bg-zinc-100 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>,
    document.body
  );
}
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Programmatic download that works for cross-origin URLs (e.g. S3).
 * The `download` attribute on <a> is silently ignored by browsers for
 * cross-origin resources — fetching as a blob and using a local object URL
 * is the only reliable approach.
 */
async function triggerDownload(url: string, fileName: string) {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    // Fallback: open in new tab so the user can save manually
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/** Single URL rendered as image thumbnail (opens modal) or file chip (triggers download). */
function FileThumbnail({ url, idx, onImageClick }: { url: string; idx: number; onImageClick: (url: string) => void }) {
  const [downloading, setDownloading] = useState(false);
  const category = getFileCategory(url);
  const fileName = url.split("/").pop()?.replace(/^\d+-[a-z0-9]+-/, "") || `File ${idx + 1}`;

  if (category === "image") {
    return (
      <button
        type="button"
        data-opt="show-me"
        title="View image"
        onClick={() => onImageClick(url)}
        className="group relative h-8 w-8 shrink-0 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-400"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`thumbnail ${idx + 1}`} className="h-full w-full object-cover" />
        {/* Expand hint on hover */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-hover:opacity-100">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </div>
      </button>
    );
  }

  const cfg = FILE_ICON[category];
  return (
    <button
      type="button"
      disabled={downloading}
      title={downloading ? "Downloading…" : `Download ${fileName}`}
      onClick={async () => {
        setDownloading(true);
        await triggerDownload(url, fileName);
        setDownloading(false);
      }}
      className={`flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800 ${cfg.bg} transition-transform hover:scale-105 disabled:opacity-60 disabled:cursor-wait`}
    >
      {downloading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-60" />
      ) : (
        <>
          <i className={`${cfg.icon} ${cfg.text} text-[15px] leading-none`} />
          <span className={`mt-0.5 text-[8px] font-semibold uppercase leading-none ${cfg.text}`}>
            {cfg.label}
          </span>
        </>
      )}
    </button>
  );
}


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

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

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

  const title = "Design Summary";
  const description = "Let me generate an initial rendering based on my understanding of what you are looking for.";

  return (
    <>
      {/* ── Portal image modal ── */}
      {lightboxUrl && (
        <ImageModal url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}

      <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="w-full rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h3 className="text-base font-semibold tracking-tight text-emerald-700 dark:text-emerald-400">
        {title}
      </h3>
      {/* <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
        {description}
      </p> */}

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
                <div className="min-w-0 flex-1 max-w-[30%]">
                  <p className="text-sm  font-semibold text-zinc-500 dark:text-zinc-400">
                    {name}
                  </p>
                 </div>
               
                {isEmpty ? (
                  <p className="min-w-0 max-w-[60%] text-right text-sm text-zinc-800 dark:text-zinc-100">
                    <span className="italic text-zinc-400 dark:text-zinc-500">
                      Not answered
                    </span>
                  </p>
                ) : typeof answer === "string" ? (
                  <p className="min-w-0 max-w-[60%]  text-left text-sm text-zinc-800 dark:text-zinc-100" title={answer}>
                    {answer}
                  </p>
                ) : isArray ? (
                  <div className="flex flex-wrap gap-1 justify-start max-w-[50%]">
                    {answer.map((url, idx) => (
                      <FileThumbnail key={idx} url={url} idx={idx} onImageClick={setLightboxUrl} />
                    ))}
                  </div>
                ) : isObject ? (
                  (() => {
                    const notes = "notes" in answer ? answer.notes : "";
                    const files = "files" in answer ? answer.files : [];
                    const value = "value" in answer ? answer.value : [];
                    return (
                      <div className="flex flex-col gap-1 max-w-[60%]">
                        {notes.trim() && (
                          <p className="text-left text-sm text-zinc-800 dark:text-zinc-100  w-full" title={notes}>
                            {notes}
                          </p>
                        )}
                        {value.length > 0 && (
                          <p className="text-left text-xs text-zinc-500 dark:text-zinc-400  w-full" title={value.join(", ")}>
                            {value.join(", ")}
                          </p>
                        )}
                        {files.length > 0 && (
                          <div className="flex flex-wrap gap-1 justify-start">
                            {files.map((url, idx) => (
                              <FileThumbnail key={idx} url={url} idx={idx} onImageClick={setLightboxUrl} />
                            ))}
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
    </>
  );
}
