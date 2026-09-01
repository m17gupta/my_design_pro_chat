"use client";

import { memo, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { uploadFile, type UploadResult } from "../../lib/upload";
import { useAppSelector } from "../../store/hooks";
import type { CardResult } from "./QuestionCard";
import type { AnswerValue, QuestionCardSpec } from "./types";

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

const ACCEPTED_TYPES = "image/*,.jpg,.jpeg,.png,.webp,.gif";

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
      const fileArray = Array.from(newFiles).filter((f) =>
        f.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name)
      );
      if (fileArray.length === 0) {
        toast.error("Please upload valid image files (JPG, PNG, WEBP, etc.)");
        return;
      }

      setSlots((currentSlots) => {
        let nextSlots = { ...currentSlots };
        let fileIdx = 0;

        // If a specific target slot was selected, fill it first
        if (targetSlot !== undefined && fileIdx < fileArray.length) {
          handleUploadFileForSlot(targetSlot, fileArray[fileIdx]);
          fileIdx++;
        }

        // Fill remaining slots
        for (let i = 0; i < 3 && fileIdx < fileArray.length; i++) {
          if (i === targetSlot) continue;
          if (!nextSlots[i]) {
            handleUploadFileForSlot(i, fileArray[fileIdx]);
            fileIdx++;
          }
        }

        // If user uploaded more than 3, allow dynamic expansion or fill available slots
        while (fileIdx < fileArray.length) {
          const highestSlot = Math.max(...Object.keys(nextSlots).map(Number), 2);
          const newSlotIndex = highestSlot + 1;
          handleUploadFileForSlot(newSlotIndex, fileArray[fileIdx]);
          fileIdx++;
        }

        return nextSlots;
      });
    },
    [handleUploadFileForSlot]
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

  const handleSubmit = () => {
    if (disabled || isAnyUploading) return;

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
                /* Filled slot: Image preview */
                <div className="group relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.s3Url || item.previewUrl}
                    alt="Upload preview"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />

                  {/* Uploading overlay */}
                  {item.isUploading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[1px] text-white">
                      <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      <span className="mt-1.5 text-[11px] font-medium tracking-wide">Uploading...</span>
                    </div>
                  )}

                  {/* Remove button */}
                  {!disabled && !item.isUploading && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSlot(slotIndex);
                      }}
                      className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white shadow-md backdrop-blur-sm transition-all hover:bg-red-600 hover:scale-110"
                      title="Remove image"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
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

        {/* 4th Box: "Add More" Slot */}
        <div className="relative aspect-square w-full">
          <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            onClick={() => {
              if (!disabled) {
                addMoreInputRef.current?.click();
              }
            }}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !disabled) {
                e.preventDefault();
                addMoreInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (!disabled) setDragOverSlot(999);
            }}
            onDragLeave={() => setDragOverSlot(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverSlot(null);
              if (!disabled && e.dataTransfer.files.length > 0) {
                handleFilesAdded(e.dataTransfer.files);
              }
            }}
            className={`flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-3 text-center transition-all duration-150 select-none ${
              dragOverSlot === 999
                ? "border-emerald-500 bg-emerald-50/70 dark:border-emerald-400 dark:bg-emerald-500/10 scale-[1.02]"
                : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/60 dark:border-zinc-700 dark:bg-zinc-900/80 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/60"
            } ${disabled ? "pointer-events-none opacity-50" : ""}`}
          >
            <div className="mb-1 text-slate-700 dark:text-zinc-200">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mx-auto"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
              Add More
            </span>
          </div>
        </div>
      </div>

      {/* Footer / Continue button matching screenshot */}
      {!disabled && (
        <div className="mt-5 flex items-center justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
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
            disabled={isAnyUploading}
            className="flex items-center justify-center gap-1.5 rounded-full bg-[#8e98a4] hover:bg-[#7b8591] px-6 py-2.5 text-xs sm:text-sm font-medium text-white shadow-sm transition-all hover:shadow disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-600 dark:hover:bg-zinc-500"
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
      )}
    </div>
  );
}

export default memo(AdditionalImagesUploadCard);
