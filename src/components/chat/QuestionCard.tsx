"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { UploadResult } from "../../lib/upload";
import { renderInline } from "./formatText";
import UploadZone from "./UploadZone";
import type { AnswerValue, QuestionCardSpec } from "./types";
import EditAddressModal from "./EditAddressModal";
import type { ProjectAddress } from "../../lib/apiBrief";

export interface CardResult {
  /** Human-readable text for the chat bubble / summary. */
  answerText: string;
  files: Record<number, File[]>;
  /** field index → fileKey → S3 URL of each successfully uploaded file. */
  fileUrls: Record<number, Record<string, string>>;
  /** Structured answer value for the design API, per the card's fields. */
  answer: AnswerValue;
}

interface QuestionCardProps {
  spec: QuestionCardSpec;
  filesByField?: Record<number, File[]>;
  initialAnswer?: AnswerValue;
  disabled?: boolean;
  onSubmit: (result: CardResult) => void;
  /** Hide the title/description block when Luna already typed it in a bubble. */
  showHeader?: boolean;
  onCancel?: () => void;
  /** When true (e.g. revision comment step), text is compulsory and image upload is optional. */
  isRevision?: boolean;
  questionId?: string;
}

function QuestionCard({
  spec,
  filesByField = {},
  initialAnswer,
  disabled = false,
  onSubmit,
  showHeader = true,
  onCancel,
  isRevision = false,
  questionId,
}: QuestionCardProps) {

  // console.log("spec--",spec)

  const [showAddressModal, setShowAddressModal] = useState(false);

  const isPropertyVerified =
    questionId === "property_verified" ||
    questionId?.startsWith("property_verified") ||
    spec.id === "property_verified" ||
    Boolean(spec.is_property_address);

  const handleAddressSaved = (_updatedAddress: ProjectAddress) => {
    // Switch the radio selection to the "Yes" option after address is saved
    spec.fields.forEach((f, i) => {
      if (f.kind === "radio") {
        const yesOption = f.options.find((o) =>
          o.toLowerCase().startsWith("yes")
        );
        if (yesOption) {
          setRadioByField((prev) => ({ ...prev, [i]: yesOption }));
        }
      }
    });
  };

  // Compute initial states from initialAnswer
  const initTextByField = useMemo(() => {
    if (!initialAnswer) return {};
    const map: Record<number, string> = {};
    if (typeof initialAnswer === "string") {
      const idx = spec.fields.findIndex((f) => f.kind === "textarea");
      if (idx >= 0) map[idx] = initialAnswer;
    } else if (typeof initialAnswer === "object" && !Array.isArray(initialAnswer)) {
      if ("notes" in initialAnswer && typeof initialAnswer.notes === "string") {
        const idx = spec.fields.findIndex((f) => f.kind === "textarea");
        if (idx >= 0) map[idx] = initialAnswer.notes;
      }
      spec.fields.forEach((f, i) => {
        if (f.kind === "textarea") {
          const key = "id" in f && f.id ? f.id : String(i);
          const val = (initialAnswer as Record<string, unknown>)[key];
          if (typeof val === "string") map[i] = val;
        }
      });
    }
    return map;
  }, [initialAnswer, spec.fields]);

  const initRadioByField = useMemo(() => {
    const map: Record<number, string> = {};
    if (!initialAnswer) return map;
    if (typeof initialAnswer === "string") {
      const idx = spec.fields.findIndex((f) => f.kind === "radio");
      if (idx >= 0) map[idx] = initialAnswer;
      return map;
    }
    if (typeof initialAnswer === "object" && !Array.isArray(initialAnswer)) {
      spec.fields.forEach((f, i) => {
        if (f.kind === "radio") {
          const key = "id" in f && f.id ? f.id : String(i);
          const val = (initialAnswer as Record<string, unknown>)[key];
          if (typeof val === "string") map[i] = val;
        }
      });
    }
    return map;
  }, [initialAnswer, spec.fields]);

  const initChecksByField = useMemo(() => {
    const map: Record<number, Set<string>> = {};
    if (!initialAnswer) return map;
    if (Array.isArray(initialAnswer)) {
      const idx = spec.fields.findIndex((f) => f.kind === "checkbox");
      if (idx >= 0) map[idx] = new Set(initialAnswer);
      return map;
    }
    if (typeof initialAnswer === "object") {
      if ("value" in initialAnswer && Array.isArray((initialAnswer as { value?: unknown }).value)) {
        const idx = spec.fields.findIndex((f) => f.kind === "checkbox");
        if (idx >= 0) map[idx] = new Set((initialAnswer as { value: string[] }).value);
        return map;
      }
      spec.fields.forEach((f, i) => {
        if (f.kind === "checkbox") {
          const key = "id" in f && f.id ? f.id : String(i);
          const val = (initialAnswer as Record<string, unknown>)[key];
          if (Array.isArray(val)) {
            map[i] = new Set(val.map(String));
          } else if (typeof val === "string") {
            map[i] = new Set([val]);
          }
        }
      });
    }
    return map;
  }, [initialAnswer, spec.fields]);

  const initNotes = useMemo((): string => {
    if (
      typeof initialAnswer === "object" &&
      !Array.isArray(initialAnswer) &&
      "notes" in initialAnswer &&
      typeof initialAnswer.notes === "string"
    ) {
      return initialAnswer.notes;
    }
    return "";
  }, [initialAnswer]);

  const initUrlsByField = useMemo(() => {
    const map: Record<number, Record<string, UploadResult>> = {};
    if (!initialAnswer) return map;

    const urls: string[] = Array.isArray(initialAnswer)
      ? initialAnswer
      : typeof initialAnswer === "object" &&
        !Array.isArray(initialAnswer) &&
        "files" in initialAnswer &&
        Array.isArray(initialAnswer.files)
      ? (initialAnswer.files as string[])
      : [];

    urls.forEach((url: string, i: number) => {
      const slot = i % 4; // Distribute across slots
      if (!map[slot]) {
        map[slot] = {};
      }
      const key = `restored-${i}`;
      map[slot][key] = { url, key: "" };
    });

    return map;
  }, [initialAnswer]);

  const [uploads, setUploads] = useState<Record<number, File[]>>(filesByField);
  const [urlsByField, setUrlsByField] = useState<
    Record<number, Record<string, UploadResult>>
  >(initUrlsByField);
  const [textByField, setTextByField] = useState<Record<number, string>>(initTextByField);
  const [radioByField, setRadioByField] = useState<Record<number, string>>(initRadioByField);
  const [checksByField, setChecksByField] = useState<Record<number, Set<string>>>(initChecksByField);
  const [notes, setNotes] = useState<string>(initNotes);
  const [uploadingSlots, setUploadingSlots] = useState<Record<number, boolean>>({});
  const textareaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});

  const autoResize = (index: number) => {
    const el = textareaRefs.current[index];
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  const prevDisabledRef = useRef(disabled);
  useEffect(() => {
    if (prevDisabledRef.current && !disabled) {
      setUrlsByField(initUrlsByField);
      setTextByField(initTextByField);
      setRadioByField(initRadioByField);
      setChecksByField(initChecksByField);
      setNotes(initNotes);
    }
    prevDisabledRef.current = disabled;
  }, [disabled, initUrlsByField, initTextByField, initRadioByField, initChecksByField, initNotes]);

  useEffect(() => {
    spec.fields.forEach((f, i) => {
      if (f.kind === "textarea") autoResize(i);
    });
  }, [textByField, spec.fields]);

  const isAnyUploading = Object.values(uploadingSlots).some(Boolean);

  // Continue/Next button is disabled until answer is given.
  // When multiple sub-questions are present (e.g. multi_questions),
  // Next is not active until every required sub-question has an answer.
  const isRequired = spec.required ?? true;

  const canContinue =
    !disabled &&
    !isAnyUploading &&
    (() => {
      const hasUploadGrid = spec.fields.some((f) => f.kind === "upload-grid");
      const hasTextarea = spec.fields.some((f) => f.kind === "textarea");

      // Combined Textarea + Upload-Grid fields (e.g. style/color preferences, revision):
      if (hasTextarea && hasUploadGrid) {
        const hasText = spec.fields.some(
          (f, i) => f.kind === "textarea" && (textByField[i] ?? "").trim().length > 0
        );
        const hasUpload = Object.values(urlsByField).some(
          (slotMap) => Object.keys(slotMap ?? {}).length > 0
        );

        const isRevisionCard =
          isRevision ||
          spec.title?.toLowerCase().includes("revision") ||
          spec.description?.toLowerCase().includes("revision");

        const textareaRequired =
          isRevisionCard ||
          spec.fields.some((f) => f.kind === "textarea" && f.required === true);

        if (textareaRequired) {
          return hasText;
        }

        if (hasText || hasUpload) return true;
        return !isRequired;
      }

      // Validate each field individually
      for (let i = 0; i < spec.fields.length; i++) {
        const field = spec.fields[i];
        const fieldRequired = field.required !== undefined ? field.required : isRequired;
        if (!fieldRequired) continue;

        if (field.kind === "radio") {
          if (!radioByField[i]) return false;
        } else if (field.kind === "checkbox") {
          const checks = checksByField[i];
          const hasCheck = (checks?.size ?? 0) > 0;
          const hasNote = field.notesPlaceholder ? notes.trim().length > 0 : false;
          if (!hasCheck && !hasNote) return false;
        } else if (field.kind === "textarea") {
          const text = (textByField[i] ?? "").trim();
          if (text.length === 0) return false;
        } else if (field.kind === "upload-grid") {
          const hasUpload = Object.values(urlsByField).some(
            (slotMap) => Object.keys(slotMap ?? {}).length > 0
          );
          if (!hasUpload) return false;
        }
      }

      return true;
    })();

  const hasOnlyUploads = spec.fields.every((f) => f.kind === "upload-grid");

  // Stable per-slot handlers (keyed by slot index) so memoized UploadZone
  // instances aren't re-rendered on every keystroke/state change.
  // const urlsHandlers = useMemo(() => {
  //   const handlers = new Map<
  //     number,
  //     (map: Record<string, UploadResult>) => void
  //   >();
  //   spec.fields.forEach((field) => {
  //     if (field.kind === "upload-grid") {
  //       Array.from({ length: field.count ?? 4 }).forEach((_, slot) => {
  //         handlers.set(slot, (map) =>
  //           setUrlsByField((prev) => ({ ...prev, [slot]: map }))
  //         );
  //       });
  //     }
  //   });
  //   return handlers;
  // }, [spec.fields]);
  const urlsHandlers = useMemo(() => {
  const handlers = new Map<
    string,
    (map: Record<string, UploadResult>) => void
  >();

  spec.fields.forEach((field, fieldIndex) => {
    if (field.kind !== "upload-grid") return;

    Array.from({ length: field.count ?? 4 }).forEach((_, slot) => {
      const key = `${fieldIndex}-${slot}`;

      handlers.set(key, (map) => {
        setUrlsByField((prev) => ({
          ...prev,
          [key]: map,
        }));
      });
    });
  });

  return handlers;
}, [spec.fields, setUrlsByField]);

  const uploadingHandlers = useMemo(() => {
    const handlers = new Map<number, (isUploading: boolean) => void>();
    spec.fields.forEach((field) => {
      if (field.kind === "upload-grid") {
        Array.from({ length: field.count ?? 4 }).forEach((_, slot) => {
          handlers.set(slot, (isUploading) =>
            setUploadingSlots((prev) => {
              if (prev[slot] === isUploading) return prev;
              return { ...prev, [slot]: isUploading };
            })
          );
        });
      }
    });
    return handlers;
  }, [spec.fields]);

  /**
   * Assemble the structured API answer from this card's fields:
   * upload-only → urls, textarea-only → text, radio → text,
   * checkbox → { value, notes }, textarea + upload → { files, notes },
   * multi-field / multi_questions → Record<string, string | string[]>.
   */
  const buildAnswer = (): AnswerValue => {
    const allUrls = () =>
      Object.values(urlsByField).flatMap((slotMap) =>
        Object.values(slotMap ?? {}).map((r) => r.url)
      );

    if (spec.fields.length === 1) {
      const field = spec.fields[0];
      if (field.kind === "upload-grid") return allUrls();
      if (field.kind === "textarea") return (textByField[0] ?? "").trim();
      if (field.kind === "radio") return radioByField[0] ?? "";
      if (field.kind === "checkbox")
        return { value: [...(checksByField[0] ?? [])], notes: notes.trim() };
    }

    const textIdx = spec.fields.findIndex((f) => f.kind === "textarea");
    const uploadIdx = spec.fields.findIndex((f) => f.kind === "upload-grid");
    if (uploadIdx >= 0 && textIdx >= 0) {
      return {
        files: allUrls(),
        notes: (textByField[textIdx] ?? "").trim(),
      };
    }

    const result: Record<string, string | string[]> = {};
    spec.fields.forEach((field, i) => {
      const key = "id" in field && field.id ? field.id : `field_${i}`;
      if (field.kind === "checkbox") {
        result[key] = Array.from(checksByField[i] ?? []);
      } else if (field.kind === "radio") {
        result[key] = radioByField[i] ?? "";
      } else if (field.kind === "textarea") {
        result[key] = (textByField[i] ?? "").trim();
      }
    });
    return result;
  };

  const submit = () => {
    if (!canContinue) return;

    // When the question is property_verified and user selected "No",
    // open the edit address modal instead of proceeding immediately.
    if (isPropertyVerified) {
      const isNoOption = Object.values(radioByField).some(
        (r) =>
          r?.toLowerCase().includes("no") ||
          r === "No, this is not the correct property"
      );

      if (isNoOption) {
        setShowAddressModal(true);
        return;
      }
    }

    const parts: string[] = [];
    const uploadTotal = Object.values(urlsByField).reduce(
      (sum, map) => sum + Object.keys(map ?? {}).length,
      0
    );

    const isMultiField = spec.fields.length > 1;

    spec.fields.forEach((field, i) => {
      const fieldTitle = "label" in field && field.label ? field.label : "";
      if (field.kind === "textarea") {
        const v = (textByField[i] ?? "").trim();
        if (v) parts.push(isMultiField && fieldTitle ? `${fieldTitle}: ${v}` : v);
      } else if (field.kind === "radio") {
        const r = radioByField[i];
        if (r) parts.push(isMultiField && fieldTitle ? `${fieldTitle}: ${r}` : r);
      } else if (field.kind === "checkbox") {
        const selected = [...(checksByField[i] ?? [])];
        const trimmedNotes = notes.trim();
        if (selected.length && trimmedNotes) {
          const line = `${selected.join(", ")} — ${trimmedNotes}`;
          parts.push(isMultiField && fieldTitle ? `${fieldTitle}: ${line}` : line);
        } else if (selected.length) {
          const line = selected.join(", ");
          parts.push(isMultiField && fieldTitle ? `${fieldTitle}: ${line}` : line);
        } else if (trimmedNotes) {
          parts.push(isMultiField && fieldTitle ? `${fieldTitle}: ${trimmedNotes}` : trimmedNotes);
        }
      }
    });

    let answerText = parts.join("\n");
    if (spec.fields.some((f) => f.kind === "upload-grid")) {
      if (!answerText) {
        answerText =
          uploadTotal > 0
            ? `${uploadTotal} file${uploadTotal > 1 ? "s" : ""} uploaded`
            : "Skipped for now";
      } else if (uploadTotal > 0) {
        answerText = `${uploadTotal} file${uploadTotal > 1 ? "s" : ""} uploaded\n${answerText}`;
      }
    }

    // Reduce to just the URLs (fileKey → url) for the submitted result.
    const fileUrls: Record<number, Record<string, string>> = {};
    Object.entries(urlsByField).forEach(([fieldIdx, map]) => {
      const urls = Object.fromEntries(
        Object.entries(map).map(([key, res]) => [key, res.url])
      );
      if (Object.keys(urls).length > 0) fileUrls[Number(fieldIdx)] = urls;
    });

    onSubmit({
      answerText: answerText || "No answer",
      files: uploads,
      fileUrls,
      answer: buildAnswer(),
    });
  };

  return (
    <div className="w-full rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
      {showHeader && (
        <div className="w-full">
          {spec.title!=="" && (
            <h3 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mb-2">
              {spec.title}
            </h3>
          )}
          <div className="question-details space-y-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            {renderInline(spec.description)}
          </div>
        </div>
      )}

      <div className="question-fields mt-4 w-full space-y-5">
        {spec.fields.map((field, i) => {
          const fieldLabel = "label" in field ? field.label : undefined;
          const isFieldDivider = spec.fields.length > 1 && i > 0;

          return (
            <div
              key={i}
              className={`space-y-2.5 ${
                isFieldDivider ? "border-t border-zinc-100 pt-4 dark:border-zinc-800" : ""
              }`}
            >
              {fieldLabel && (
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {fieldLabel}
                </div>
              )}

              {field.kind === "upload-grid" && (
                <div
                  className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3"
                  role="group"
                  aria-label="Upload files"
                >
                  {Array.from({ length: field.count ?? 4 }).map((_, slot) => (
                    <UploadZone
                      key={slot}
                      compact
                      spec={{
                        label: "Upload file",
                        accept: field.accept,
                        multiple: true,
                      }}
                      initialUrls={
                        field.kind === "upload-grid"
                          ? Object.values(urlsByField[slot] ?? {}).map((r) => r.url)
                          : undefined
                      }
                      files={disabled ? [] : uploads[slot] ?? []}
                      disabled={disabled}
                      onChange={(files) =>
                        setUploads((prev) => ({ ...prev, [slot]: files }))
                      }
                      onUrlsChange={urlsHandlers.get(slot)}
                      onUploadingChange={uploadingHandlers.get(slot)}
                    />
                  ))}
                </div>
              )}

              {field.kind === "textarea" && (
                <textarea
                  ref={(el) => {
                    textareaRefs.current[i] = el;
                  }}
                  rows={field.rows ?? 3}
                  value={textByField[i] ?? ""}
                  onChange={(e) => {
                    setTextByField((prev) => ({ ...prev, [i]: e.target.value }));
                  }}
                  placeholder={field.placeholder}
                  aria-label={field.placeholder}
                  disabled={disabled}
                  className="w-full resize-none rounded-xl border border-zinc-300/80 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-zinc-800 shadow-sm outline-none transition-all duration-150 placeholder:text-zinc-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/15 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              )}

              {field.kind === "radio" && (
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={fieldLabel || "Options"}>
                  {field.options.map((option) => {
                    const selected = radioByField[i] === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setRadioByField((prev) => ({ ...prev, [i]: option }))}
                        disabled={disabled}
                        className={`rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
                          selected
                            ? "border-emerald-500 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25"
                            : "border-emerald-200 bg-white text-emerald-800 hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-500/30 dark:bg-zinc-950 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              )}

              {field.kind === "checkbox" && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2" role="group" aria-label={fieldLabel || "Options"}>
                    {field.options.map((option) => {
                      const selected = Boolean(checksByField[i]?.has(option));
                      return (
                        <button
                          key={option}
                          type="button"
                          role="checkbox"
                          aria-checked={selected}
                          onClick={() => {
                            setChecksByField((prev) => {
                              const current = prev[i] ? new Set(prev[i]) : new Set<string>();
                              if (current.has(option)) current.delete(option);
                              else current.add(option);
                              return { ...prev, [i]: current };
                            });
                          }}
                          disabled={disabled}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium shadow-sm transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
                            selected
                              ? "border-emerald-500 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25"
                              : "border-emerald-200 bg-white text-emerald-800 hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-500/30 dark:bg-zinc-950 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
                          }`}
                        >
                          {selected && (
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          )}
                          {option}
                        </button>
                      );
                    })}
                  </div>
                  {field.notesPlaceholder && (
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={field.notesPlaceholder}
                      aria-label={field.notesPlaceholder}
                      disabled={disabled}
                      className="w-full resize-none rounded-xl border border-zinc-300/80 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-zinc-800 shadow-sm outline-none transition-all duration-150 placeholder:text-zinc-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/15 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!disabled && (
        <div className="mt-4 flex items-center justify-end gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={!canContinue || isAnyUploading}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-zinc-700 to-zinc-900 px-5 py-2 text-sm font-semibold text-white shadow-md transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none dark:from-zinc-200 dark:to-zinc-100 dark:text-zinc-900"
          >
            {isAnyUploading ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Uploading…
              </>
            ) : (
              onCancel ? "Save Changes" : hasOnlyUploads ? "Continue →" : "Next →"
            )}
          </button>
        </div>
      )}

      {showAddressModal && (
        <EditAddressModal
          isOpen={showAddressModal}
          onClose={() => setShowAddressModal(false)}
          onSave={handleAddressSaved}
        />
      )}
    </div>
  );
}

export default memo(QuestionCard);
