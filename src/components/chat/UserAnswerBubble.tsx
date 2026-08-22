"use client";

import { memo, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useAppSelector } from "../../store/hooks";
import { selectBriefPayload } from "../../store/briefSlice";
import { answerToText, itemUrls } from "../../lib/briefDisplay";

function getFileExt(nameOrUrl: string): string {
  if (!nameOrUrl) return "";
  const clean = nameOrUrl.split("?")[0].split("#")[0];
  const parts = clean.split(".");
  if (parts.length <= 1) return "";
  return "." + parts.pop()!.toLowerCase();
}

type FileCategory = "image" | "pdf" | "doc" | "cad" | "other";

function getFileCategory(nameOrUrl: string): FileCategory {
  const ext = getFileExt(nameOrUrl);
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)) return "image";
  if (ext === ".pdf") return "pdf";
  if ([".doc", ".docx"].includes(ext)) return "doc";
  if ([".dwg", ".rvt", ".skp"].includes(ext)) return "cad";
  return "other";
}

interface UserAnswerBubbleProps {
  /** The episode apiKey to read Redux original state from. */
  apiKey?: string;
  /** The plain-text answer (fallback when Redux item is absent). */
  content: string;
  /** Image URLs already uploaded as part of this answer (fallback). */
  imageUrls?: string[];
  /** True while the inline text edit textarea is active. */
  editing?: boolean;
  /** For Yes/No option-question edits — shows pill buttons instead of a textarea. */
  editOptions?: string[];
  onEditStart?: () => void;
  onEditSave?: (text: string) => void;
  onEditCancel?: () => void;
  /** Skip enter animations for restored (hydrated) messages. */
  isRestored?: boolean;
}

/**
 * Right-aligned chat bubble that shows the user's submitted answer.
 * Renders text, a grid of image thumbnails, or both intelligently.
 * Reads answer text and uploaded image URLs directly from Redux briefPayload.original.
 * The pencil icon triggers the parent's edit flow (QuestionCard reopen).
 */
function UserAnswerBubble({
  apiKey,
  content,
  imageUrls = [],
  editing = false,
  editOptions,
  onEditStart,
  onEditSave,
  onEditCancel,
  isRestored = false,
}: UserAnswerBubbleProps) {
  const briefPayload = useAppSelector(selectBriefPayload);
  const item = apiKey ? briefPayload.original[apiKey] : undefined;

  const finalContent = item ? answerToText(item) : content;
  const finalImageUrls = item ? itemUrls(item) : imageUrls;

  const editRef = useRef<HTMLTextAreaElement>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const isOptionEdit = Boolean(editing && editOptions?.length);
  const hasText = finalContent.trim().length > 0;
  const hasImages = finalImageUrls.length > 0;
  // Auto-resize textarea
  useEffect(() => {
    if (editing && editRef.current) {
      const el = editRef.current;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, [editing]);

  const handleSave = () => {
    if (editRef.current) {
      onEditSave?.(editRef.current.value);
    }
  };

  const handleCancel = () => {
    onEditCancel?.();
  };

  // Determine display mode
  const mode: "text" | "images" | "both" =
    hasText && hasImages ? "both" : hasImages ? "images" : "text";

  return (
    <>
      {/* Lightbox overlay */}
      {lightboxUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxUrl}
              alt="Full size preview"
              className="max-h-[85vh] max-w-[85vw] rounded-2xl object-contain shadow-2xl"
            />
            <button
              type="button"
              aria-label="Close preview"
              onClick={() => setLightboxUrl(null)}
              className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg text-zinc-700 hover:bg-zinc-100 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <motion.div
        initial={
          isRestored
            ? { opacity: 1, y: 0, filter: 'blur(0px)' }
            : { opacity: 0, y: 12, scale: 0.97, filter: 'blur(4px)' }
        }
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
        transition={
          isRestored
            ? { duration: 0 }
            : { type: 'spring', stiffness: 420, damping: 28, mass: 0.85 }
        }
        className="flex w-full justify-end"
      >
        <div className="flex max-w-[85%] flex-col items-end gap-1 sm:max-w-[75%]">
          {/* ── Main answer bubble ── */}
          <div
            className={`rounded-2xl rounded-br-md shadow-sm overflow-hidden bg-zinc-900 dark:bg-zinc-100 ${
              editing && !isOptionEdit ? 'ring-2 ring-zinc-600/50' : ''
            }`}
          >
            {/* ── Edit mode: text textarea ── */}
            {editing && !isOptionEdit && (
              <div className="bg-zinc-900 dark:bg-zinc-100 p-3">
                <textarea
                  ref={editRef}
                  defaultValue={finalContent}
                  aria-label="Edit your answer"
                  rows={Math.max(2, Math.min(6, finalContent.split("\n").length + 1))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSave();
                    } else if (e.key === "Escape") {
                      handleCancel();
                    }
                  }}
                  onChange={(e) => {
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
                  }}
                  className="w-full resize-none rounded-xl bg-white/10 px-3 py-2 text-[15px] leading-relaxed text-white dark:text-zinc-900 outline-none ring-1 ring-white/20 placeholder:text-white/50 focus:bg-white/15 focus:ring-2 focus:ring-white/40"
                />
              </div>
            )}

            {/* ── Display mode ── */}
            {!editing && (
              <>
                {/* Image / File grid */}
                {hasImages && (
                  <div
                    className={`grid gap-1.5 p-2 ${
                      finalImageUrls.length === 1
                        ? "grid-cols-1"
                        : finalImageUrls.length === 2
                        ? "grid-cols-2"
                        : finalImageUrls.length === 3
                        ? "grid-cols-3"
                        : "grid-cols-2 sm:grid-cols-4"
                    }`}
                  >
                    {finalImageUrls.slice(0, 8).map((url, idx) => {
                      const category = getFileCategory(url);
                      const fileName = url.split("/").pop()?.replace(/^\d+-[a-z0-9]+-/, "") || `File ${idx + 1}`;

                      if (category === "image") {
                        return (
                          <button
                            key={idx}
                            type="button"
                            aria-label={`View uploaded file ${idx + 1}`}
                            onClick={() => setLightboxUrl(url)}
                            className="group relative h-16 w-16 overflow-hidden rounded-xl border border-white/20 bg-zinc-100 dark:bg-zinc-800 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          >
                            <img
                              src={url}
                              alt={`Uploaded file ${idx + 1}`}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                            {/* Expand hint on hover */}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                              </svg>
                            </div>
                            {/* Overflow count badge */}
                            {idx === 7 && finalImageUrls.length > 8 && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white">
                                +{finalImageUrls.length - 8}
                              </div>
                            )}
                          </button>
                        );
                      }

                      // Non-image file rendering (PDF, Word, CAD, etc.)
                      const iconClass =
                        category === "pdf"
                          ? "bi bi-file-earmark-pdf text-red-400 text-2xl"
                          : category === "doc"
                          ? "bi bi-file-earmark-word text-blue-400 text-2xl"
                          : "bi bi-file text-zinc-300 text-2xl";

                      return (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Open ${fileName}`}
                          className="group relative flex h-16 w-16 flex-col items-center justify-center rounded-xl border border-white/20 bg-black/30 p-1 transition-transform hover:scale-105 hover:bg-black/50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        >
                          <i className={`${iconClass} transition-transform group-hover:scale-110`} />
                          <span className="w-full truncate text-[9px] font-medium leading-tight text-white/90 text-center px-0.5 mt-0.5">
                            {fileName}
                          </span>
                          {idx === 7 && finalImageUrls.length > 8 && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-xl text-sm font-semibold text-white">
                              +{finalImageUrls.length - 8}
                            </div>
                          )}
                        </a>
                      );
                    })}
                  </div>
                )}

                {/* Text content */}
                {hasText && (
                  <p
                    className={`whitespace-pre-wrap break-words px-4 py-2.5 text-[15px] leading-relaxed text-zinc-100 dark:text-zinc-900 ${
                      hasImages ? 'border-t border-white/10' : ''
                    }`}
                  >
                    {finalContent}
                  </p>
                )}

                {/* Image/File fallback label when no text at all */}
                {!hasText && hasImages && (
                  <p className="px-3 pb-2 text-xs text-zinc-400 dark:text-zinc-500">
                    {finalImageUrls.length} file{finalImageUrls.length > 1 ? 's' : ''} uploaded
                  </p>
                )}
              </>
            )}
          </div>

          {/* ── Option edit: pills are shown on the assistant message; just hint user ── */}
          {isOptionEdit && (
            <p className="mt-1 mr-1 text-xs text-zinc-400 dark:text-zinc-500 text-right">
              ↑ Choose a new answer above
            </p>
          )}

          {/* ── Action row: edit icon / save+cancel buttons ── */}
          <div className="mt-0.5 flex items-center gap-1.5">
            {editing ? (
              <>
                {/* For text edits: Save button. For option edits: only Cancel (save via assistant message buttons) */}
                {!isOptionEdit && (
                  <button
                    type="button"
                    onClick={handleSave}
                    className="rounded-full bg-zinc-900 px-3.5 py-1 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    Save
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-full border border-zinc-300 px-3.5 py-1 text-xs font-medium text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  Cancel
                </button>
              </>
            ) : onEditStart ? (
              <button
                type="button"
                onClick={onEditStart}
                aria-label={`Edit answer: ${finalContent || "uploaded images"}`}
                title="Edit answer"
                className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400"
              >
                <svg
                  width="12"
                  height="12"
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
              </button>
            ) : null}
          </div>
        </div>
      </motion.div>
    </>
  );
}

export default memo(UserAnswerBubble);
