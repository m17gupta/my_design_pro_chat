"use client";

import { memo, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { uploadFile, type UploadResult } from "../../lib/upload";
import { useAppSelector } from "../../store/hooks";
import type { CardResult } from "./QuestionCard";
import type { AnswerValue, QuestionCardSpec } from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────
const ACCEPTED_TYPES = "image/*,.jpg,.jpeg,.png,.webp,.gif";
const MAX_SLOTS = 8;   // maximum images allowed
const MIN_UPLOADED = 1; // minimum successfully-uploaded images to enable Continue

interface SlotItem {
  id: string;
  file?: File;
  previewUrl: string;
  s3Url?: string;
  isUploading: boolean;
  error?: string;
}

interface AdditionalImagesUploadCardProps {
  spec?: QuestionCardSpec;
  filesByField?: Record<number, File[]>;
  initialAnswer?: AnswerValue;
  disabled?: boolean;
  onSubmit: (result: CardResult) => void;
  onCancel?: () => void;
}

function AdditionalImagesUploadCard({
  filesByField = {},
  initialAnswer,
  disabled = false,
  onSubmit,
  onCancel,
}: AdditionalImagesUploadCardProps) {
  const projectId = useAppSelector((s) => s.chat.id);
  const addMoreInputRef = useRef<HTMLInputElement | null>(null);
  const slotInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Initialize slots from initialAnswer (URLs) or filesByField
  const initialSlots = useMemo(() => {
    const slots: Record<number, SlotItem | null> = {
      0: null,
      1: null,
      2: null,
    };

    const restoredUrls: string[] = Array.isArray(initialAnswer)
      ? initialAnswer
      : typeof initialAnswer === "object" && initialAnswer !== null && "files" in initialAnswer && Array.isArray((initialAnswer as any).files)
      ? (initialAnswer as any).files
      : [];

    restoredUrls.forEach((url, index) => {
      slots[index] = {
        id: `restored-${index}-${url}`,
        previewUrl: url,
        s3Url: url,
        isUploading: false,
      };
    });

    // Also check filesByField
    Object.entries(filesByField).forEach(([slotStr, files]) => {
      const slotIndex = Number(slotStr);
      if (files && files[0] && !slots[slotIndex]) {
        const file = files[0];
        slots[slotIndex] = {
          id: `${file.name}-${file.size}`,
          file,
          previewUrl: URL.createObjectURL(file),
          isUploading: false,
        };
      }
    });

    return slots;
  }, [initialAnswer, filesByField]);

  const [slots, setSlots] = useState<Record<number, SlotItem | null>>(initialSlots);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

  // Sync if initialAnswer changes on re-edit
  useEffect(() => {
    setSlots(initialSlots);
  }, [initialSlots]);

  // Upload a single file into a given slot index
  const handleUploadFileForSlot = useCallback(
    async (slotIndex: number, file: File) => {
      const fileId = `${file.name}-${file.size}-${Date.now()}`;
      const objectUrl = URL.createObjectURL(file);

      setSlots((prev) => ({
        ...prev,
        [slotIndex]: {
          id: fileId,
          file,
          previewUrl: objectUrl,
          isUploading: true,
        },
      }));

      try {
        const result: UploadResult = await uploadFile(file, undefined, projectId);
        setSlots((prev) => {
          const current = prev[slotIndex];
          if (!current || current.id !== fileId) return prev;
          return {
            ...prev,
            [slotIndex]: {
              ...current,
              s3Url: result.url,
              isUploading: false,
            },
          };
        });
      } catch (err: any) {
        toast.error(`Failed to upload ${file.name}`);
        setSlots((prev) => {
          const current = prev[slotIndex];
          if (!current || current.id !== fileId) return prev;
          return {
            ...prev,
            [slotIndex]: {
              ...current,
              isUploading: false,
              error: err?.message || "Upload failed",
            },
          };
        });
      }
    },
    [projectId]
  );

  // Distribute newly selected files to empty slots or starting at targetSlot
  const handleFilesAdded = useCallback(
    (newFiles: FileList | File[], targetSlot?: number) => {
      const fileArray = Array.from(newFiles).filter(
        (f) => f.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name)
      );
      if (fileArray.length === 0) {
        toast.error("Please upload valid image files (JPG, PNG, WEBP, etc.)");
        return;
      }

      const currentSlots = slots;
      const totalFilled = Object.values(currentSlots).filter(Boolean).length;
      const available = MAX_SLOTS - totalFilled;
      if (available <= 0) {
        toast.error(`Maximum ${MAX_SLOTS} images allowed.`);
        return;
      }

      const capped = fileArray.slice(0, available);
      let fileIdx = 0;

      // Fill target slot first (Replace or direct click)
      if (targetSlot !== undefined && fileIdx < capped.length) {
        handleUploadFileForSlot(targetSlot, capped[fileIdx++]);
      }

      // Fill remaining empty slots 0–2
      for (let i = 0; i < 3 && fileIdx < capped.length; i++) {
        if (i === targetSlot) continue;
        if (!currentSlots[i]) {
          handleUploadFileForSlot(i, capped[fileIdx++]);
        }
      }

      // Overflow: add new slots beyond 2, up to MAX_SLOTS
      if (fileIdx < capped.length) {
        let nextSlotIndex = Math.max(...Object.keys(currentSlots).map(Number), 2) + 1;
        while (fileIdx < capped.length && nextSlotIndex < MAX_SLOTS) {
          handleUploadFileForSlot(nextSlotIndex++, capped[fileIdx++]);
        }
      }

      if (fileIdx < fileArray.length) {
        toast.error(`Only ${MAX_SLOTS} images allowed. Some files were skipped.`);
      }
    },
    [slots, handleUploadFileForSlot]
  );

  const handleRemoveSlot = useCallback((slotIndex: number) => {
    setSlots((prev) => {
      const next = { ...prev };
      delete next[slotIndex];
      // Keep at least slots 0, 1, 2 visible in the UI
      if (slotIndex < 3) {
        next[slotIndex] = null;
      }
      return next;
    });
  }, []);

  const isAnyUploading = Object.values(slots).some((s) => s?.isUploading);

  const uploadedCount = Object.values(slots).filter(
    (s) => s && s.s3Url && !s.isUploading && !s.error
  ).length;

  const canContinue = !isAnyUploading && uploadedCount >= MIN_UPLOADED;

  const totalSlotCount = Object.values(slots).filter(Boolean).length;
  const canAddMore = totalSlotCount < MAX_SLOTS && !disabled;

  const handleSubmit = () => {
    if (disabled || !canContinue) return;

    const uploadedUrls: string[] = [];
    const filesRecord: Record<number, File[]> = {};
    const fileUrlsRecord: Record<number, Record<string, string>> = { 0: {} };

    Object.entries(slots).forEach(([slotStr, item]) => {
      const idx = Number(slotStr);
      if (item && item.s3Url) {
        uploadedUrls.push(item.s3Url);
        fileUrlsRecord[0][item.id] = item.s3Url;
        if (item.file) {
          filesRecord[idx] = [item.file];
        }
      }
    });

    const totalCount = uploadedUrls.length;
    const answerText =
      totalCount > 0
        ? `${totalCount} photo${totalCount > 1 ? "s" : ""} uploaded`
        : "Skipped for now";

    onSubmit({
      answerText,
      files: filesRecord,
      fileUrls: fileUrlsRecord,
      answer: uploadedUrls,
    });
  };

  // Visible slot indices (at minimum 0, 1, 2)
  const slotIndices = useMemo(() => {
    const keys = Object.keys(slots).map(Number);
    const maxKey = Math.max(...keys, 2);
    const indices: number[] = [];
    for (let i = 0; i <= maxKey; i++) {
      indices.push(i);
    }
    return indices;
  }, [slots]);

  return (
    <div className="w-full rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
      {/* Hidden file input for "Add More" */}
      <input
        ref={addMoreInputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFilesAdded(e.target.files);
            e.target.value = "";
          }
        }}
      />

      {/* Grid of upload slots */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-3.5">
        {slotIndices.map((slotIndex) => {
          const item = slots[slotIndex];

          return (
            <div key={slotIndex} className="relative aspect-square w-full">
              {/* Hidden file input for this specific slot */}
              <input
                ref={(el) => {
                  slotInputRefs.current[slotIndex] = el;
                }}
                type="file"
                multiple={false}
                accept={ACCEPTED_TYPES}
                className="hidden"
                disabled={disabled}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFilesAdded(e.target.files, slotIndex);
                    e.target.value = "";
                  }
                }}
              />

              {item ? (
                /* ── Filled slot ── */
                <div className="group relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.s3Url || item.previewUrl}
                    alt="Upload preview"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />

                  {/* Uploading overlay */}
                  {item.isUploading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[2px] text-white">
                      <span className="h-7 w-7 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      <span className="mt-2 text-[11px] font-medium tracking-wide">Uploading…</span>
                    </div>
                  )}

                  {/* Error overlay with Retry */}
                  {item.error && !item.isUploading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-red-900/70 backdrop-blur-[2px] text-white p-2">
                      <svg className="h-5 w-5 shrink-0 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                      <span className="text-[10px] font-medium leading-tight text-center">Upload failed</span>
                      {!disabled && item.file && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleUploadFileForSlot(slotIndex, item.file!); }}
                          className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-semibold hover:bg-white/30 transition-colors"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  )}

                  {/* Controls: Remove + Replace (hover-revealed when idle) */}
                  {!disabled && !item.isUploading && !item.error && (
                    <div className="absolute inset-0 flex items-start justify-between p-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      {/* Remove */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleRemoveSlot(slotIndex); }}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white shadow-md backdrop-blur-sm transition-all hover:bg-red-600 hover:scale-110"
                        title="Remove image"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      {/* Replace */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); slotInputRefs.current[slotIndex]?.click(); }}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white shadow-md backdrop-blur-sm transition-all hover:bg-blue-600 hover:scale-110"
                        title="Replace image"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* Success tick badge */}
                  {item.s3Url && !item.isUploading && !item.error && (
                    <span className="absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 shadow pointer-events-none">
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  )}
                </div>
              ) : (
                /* Empty slot: Dashed dropzone */
                <div
                  role="button"
                  tabIndex={disabled ? -1 : 0}
                  onClick={() => {
                    if (!disabled) {
                      slotInputRefs.current[slotIndex]?.click();
                    }
                  }}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && !disabled) {
                      e.preventDefault();
                      slotInputRefs.current[slotIndex]?.click();
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!disabled) setDragOverSlot(slotIndex);
                  }}
                  onDragLeave={() => setDragOverSlot(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverSlot(null);
                    if (!disabled && e.dataTransfer.files.length > 0) {
                      handleFilesAdded(e.dataTransfer.files, slotIndex);
                    }
                  }}
                  className={`flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-3 text-center transition-all duration-150 select-none ${
                    dragOverSlot === slotIndex
                      ? "border-emerald-500 bg-emerald-50/70 dark:border-emerald-400 dark:bg-emerald-500/10 scale-[1.02]"
                      : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/60 dark:border-zinc-700 dark:bg-zinc-900/80 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/60"
                  } ${disabled ? "pointer-events-none opacity-50" : ""}`}
                >
                  {/* Upload icon matching screenshot */}
                  <div className="mb-2 text-slate-500 dark:text-zinc-400">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mx-auto"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>

                  <span className="text-xs font-semibold leading-snug text-slate-700 dark:text-zinc-200">
                    Drag & drop files here
                  </span>
                  <span className="mt-0.5 text-[10.5px] leading-tight text-slate-400 dark:text-zinc-400">
                    (or click to select file)
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {/* "Add More" slot — hidden once MAX_SLOTS is reached */}
        {canAddMore && (
          <div className="relative aspect-square w-full">
            <div
              role="button"
              tabIndex={0}
              onClick={() => addMoreInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  addMoreInputRef.current?.click();
                }
              }}
              onDragOver={(e) => { e.preventDefault(); setDragOverSlot(999); }}
              onDragLeave={() => setDragOverSlot(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverSlot(null);
                if (e.dataTransfer.files.length > 0) handleFilesAdded(e.dataTransfer.files);
              }}
              className={`flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-3 text-center transition-all duration-150 select-none ${
                dragOverSlot === 999
                  ? "border-emerald-500 bg-emerald-50/70 dark:border-emerald-400 dark:bg-emerald-500/10 scale-[1.02]"
                  : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/60 dark:border-zinc-700 dark:bg-zinc-900/80 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/60"
              }`}
            >
              <div className="mb-1 text-slate-500 dark:text-zinc-400">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="mx-auto">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Add More</span>
              {/* <span className="mt-0.5 text-[10px] text-slate-400 dark:text-zinc-500">{totalSlotCount}/{MAX_SLOTS}</span> */}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {!disabled && (
        <div className="mt-5 flex items-center justify-between gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          {/* Upload progress hint */}
          <span className="text-xs text-slate-400 dark:text-zinc-500">
            {isAnyUploading
              ? "Uploading…"
              : uploadedCount > 0
              ? `${uploadedCount} image${uploadedCount > 1 ? "s" : ""} ready`
              : "Upload at least 1 image to continue"}
          </span>

          <div className="flex items-center gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-full border border-zinc-300 px-4 py-2 text-xs sm:text-sm font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-800 dark:border-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canContinue}
              className="flex items-center justify-center gap-1.5 rounded-full bg-zinc-900 hover:bg-zinc-700 px-6 py-2.5 text-xs sm:text-sm font-medium text-white shadow-sm transition-all hover:shadow disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {isAnyUploading ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Uploading…
                </>
              ) : onCancel ? (
                "Save Changes"
              ) : (
                "Continue →"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(AdditionalImagesUploadCard);
