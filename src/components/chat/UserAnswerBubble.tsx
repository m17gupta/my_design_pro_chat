"use client";

import { memo, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface UserAnswerBubbleProps {
  /** The plain-text answer (may be empty for image-only answers). */
  content: string;
  /** Image URLs already uploaded as part of this answer. */
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
 * The pencil icon triggers the parent's edit flow (QuestionCard reopen).
 */
function UserAnswerBubble({
  content,
  imageUrls = [],
  editing = false,
  editOptions,
  onEditStart,
  onEditSave,
  onEditCancel,
  isRestored = false,
}: UserAnswerBubbleProps) {
  const editRef = useRef<HTMLTextAreaElement>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const isOptionEdit = Boolean(editing && editOptions?.length);
  const hasText = content.trim().length > 0;
  const hasImages = imageUrls.length > 0;
 console.log("content",content)
 console.log("editing",editing)
 console.log("imageUrls",imageUrls)
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
        initial={isRestored ? { opacity: 1, y: 0 } : { opacity: 0, y: 10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
        transition={
          isRestored ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 30 }
        }
        className="flex w-full justify-end"
      >
        <div className="flex max-w-[85%] flex-col items-end gap-1 sm:max-w-[75%]">
          {/* ── Main answer bubble ── */}
          <div
            className={`rounded-2xl rounded-br-md shadow-md shadow-emerald-500/20 overflow-hidden ${
              editing && !isOptionEdit ? "ring-2 ring-emerald-400/70" : ""
            } ${mode === "text" && !editing ? "bg-gradient-to-r from-emerald-500 to-teal-600" : "bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800"}`}
          >
            {/* ── Edit mode: text textarea ── */}
            {editing && !isOptionEdit && (
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-3">
                <textarea
                  ref={editRef}
                  defaultValue={content}
                  aria-label="Edit your answer"
                  rows={Math.max(2, Math.min(6, content.split("\n").length + 1))}
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
                  className="w-full resize-none rounded-xl bg-white/15 px-3 py-2 text-[15px] leading-relaxed text-white outline-none ring-1 ring-white/30 placeholder:text-white/60 focus:bg-white/20 focus:ring-2 focus:ring-white/60"
                />
              </div>
            )}

            {/* ── Display mode ── */}
            {!editing && (
              <>
                {/* Image grid */}
                {hasImages && (
                  <div
                    className={`grid gap-1.5 p-2 ${
                      imageUrls.length === 1
                        ? "grid-cols-1"
                        : imageUrls.length === 2
                        ? "grid-cols-2"
                        : imageUrls.length === 3
                        ? "grid-cols-3"
                        : "grid-cols-2 sm:grid-cols-4"
                    }`}
                  >
                    {imageUrls.slice(0, 8).map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        aria-label={`View uploaded image ${idx + 1}`}
                        onClick={() => setLightboxUrl(url)}
                        className="group relative h-16 w-16 overflow-hidden rounded-xl border border-white/20 bg-zinc-100 dark:bg-zinc-800 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      >
                        <img
                          src={url}
                          alt={`Uploaded image ${idx + 1}`}
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
                        {idx === 7 && imageUrls.length > 8 && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white">
                            +{imageUrls.length - 8}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Text content */}
                {hasText && (
                  <p
                    className={`whitespace-pre-wrap break-words px-4 py-2.5 text-[15px] leading-relaxed ${
                      mode === "text"
                        ? "text-white"
                        : "text-zinc-800 dark:text-zinc-100 border-t border-zinc-100 dark:border-zinc-800"
                    }`}
                  >
                    {content}
                  </p>
                )}

                {/* Image-only fallback label when no text at all */}
                {!hasText && hasImages && (
                  <p className="px-3 pb-2 text-xs text-zinc-400 dark:text-zinc-500">
                    {imageUrls.length} image{imageUrls.length > 1 ? "s" : ""} uploaded
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
                    className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-3.5 py-1 text-xs font-semibold text-white shadow-sm transition-colors hover:brightness-110"
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
                aria-label={`Edit answer: ${content || "uploaded images"}`}
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
