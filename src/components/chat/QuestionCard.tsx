"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { UploadResult } from "../../lib/upload";
import { renderInline } from "./formatText";
import UploadZone from "./UploadZone";
import type { AnswerValue, QuestionCardSpec } from "./types";


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
}

function QuestionCard({
  spec,
  filesByField = {},
  initialAnswer,
  disabled = false,
  onSubmit,
  showHeader = true,
  onCancel,
}: QuestionCardProps) {

  // console.log("spec--",spec)

  // Compute initial states from initialAnswer
  const initTextByField = useMemo(() => {
    if (!initialAnswer) return {};
    const map: Record<number, string> = {};
    if (typeof initialAnswer === "string") {
      const idx = spec.fields.findIndex(f => f.kind === "textarea" || f.kind === "radio");
      if (idx >= 0 && spec.fields[idx].kind === "textarea") map[idx] = initialAnswer;
    } else if (typeof initialAnswer === "object" && !Array.isArray(initialAnswer) && "notes" in initialAnswer) {
      const idx = spec.fields.findIndex(f => f.kind === "textarea");
      if (idx >= 0) map[idx] = initialAnswer.notes;
    }
    return map;
  }, [initialAnswer, spec.fields]);

  const initRadio = useMemo(() => {
    if (typeof initialAnswer === "string") {
      if (spec.fields.some(f => f.kind === "radio")) return initialAnswer;
    }
    return null;
  }, [initialAnswer, spec.fields]);

  const initChecks = useMemo(() => {
    if (typeof initialAnswer === "object" && !Array.isArray(initialAnswer) && "value" in initialAnswer) {
      return new Set(initialAnswer.value);
    }
    return new Set<string>();
  }, [initialAnswer]);

  const initNotes = useMemo(() => {
    if (typeof initialAnswer === "object" && !Array.isArray(initialAnswer) && "notes" in initialAnswer) {
      return initialAnswer.notes;
    }
    return "";
  }, [initialAnswer]);

  // const initUrls = useMemo(() => {
  //   if (!initialAnswer) return [];
  //   if (Array.isArray(initialAnswer)) return initialAnswer;
  //   if (typeof initialAnswer === "object" && "files" in initialAnswer) return initialAnswer.files;
  //   return [];
  // }, [initialAnswer]);

  const initUrlsByField = useMemo(() => {
    const map: Record<number, Record<string, UploadResult>> = {};
    if (!initialAnswer) return map;

    const urls = Array.isArray(initialAnswer)
      ? initialAnswer
      : typeof initialAnswer === "object" && "files" in initialAnswer
      ? initialAnswer.files
      : [];

    urls.forEach((url, i) => {
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
  const [radio, setRadio] = useState<string | null>(initRadio);
  const [checks, setChecks] = useState<Set<string>>(initChecks);
  const [notes, setNotes] = useState(initNotes);
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
      setRadio(initRadio);
      setChecks(initChecks);
      setNotes(initNotes);
    }
    prevDisabledRef.current = disabled;
  }, [disabled, initUrlsByField, initTextByField, initRadio, initChecks, initNotes]);

  useEffect(() => {
    spec.fields.forEach((f, i) => {
      if (f.kind === "textarea") autoResize(i);
    });
  }, [textByField, spec.fields]);

  const isAnyUploading = Object.values(uploadingSlots).some(Boolean);

  // Continue/Next button is disabled until answer is given.
  // - Radio fields: disabled until an option is selected.
  // - Checkbox fields: disabled until at least one option is checked or notes are typed.
  // - Combined Textarea + Upload-Grid fields: enabled if EITHER text is entered OR an image is uploaded.
  // - Standalone Textarea: disabled until text is entered.
  // - Standalone Upload-Grid: disabled until at least one image is uploaded.
  const isRequired = spec.required ?? true;

  const canContinue =
    !disabled &&
    !isAnyUploading &&
    (() => {
      // 1. Radio fields: MUST have an option selected if required
      const hasRadio = spec.fields.some((f) => f.kind === "radio");
      if (hasRadio && radio === null) {
        return !isRequired;
      }

      // 2. Checkbox fields: MUST have a check or notes if required
      const hasCheckbox = spec.fields.some((f) => f.kind === "checkbox");
      if (hasCheckbox && checks.size === 0 && notes.trim().length === 0) {
        return !isRequired;
      }

      const hasTextarea = spec.fields.some((f) => f.kind === "textarea");
      const hasUploadGrid = spec.fields.some((f) => f.kind === "upload-grid");

      // 3. Combined Textarea + Upload-Grid fields: if user gives answer to EITHER text OR upload image, Next button is active!
      if (hasTextarea && hasUploadGrid) {
        const hasText = spec.fields.some(
          (f, i) => f.kind === "textarea" && (textByField[i] ?? "").trim().length > 0
        );
        const hasUpload = Object.values(urlsByField).some(
          (slotMap) => Object.keys(slotMap ?? {}).length > 0
        );
        if (hasText || hasUpload) return true;
        return !isRequired;
      }

      // 4. Standalone Textarea card
      if (hasTextarea) {
        const hasText = spec.fields.some(
          (f, i) => f.kind === "textarea" && (textByField[i] ?? "").trim().length > 0
        );
        if (hasText) return true;
        return !isRequired;
      }

      // 5. Standalone Upload-Grid card
      if (hasUploadGrid) {
        const hasUpload = Object.values(urlsByField).some(
          (slotMap) => Object.keys(slotMap ?? {}).length > 0
        );
        if (hasUpload) return true;
        return !isRequired;
      }

      return true;
    })();

  const hasOnlyUploads = spec.fields.every((f) => f.kind === "upload-grid");

  // Stable per-slot handlers (keyed by slot index) so memoized UploadZone
  // instances aren't re-rendered on every keystroke/state change.
  const urlsHandlers = useMemo(() => {
    const handlers = new Map<
      number,
      (map: Record<string, UploadResult>) => void
    >();
    spec.fields.forEach((field) => {
      if (field.kind === "upload-grid") {
        Array.from({ length: field.count ?? 4 }).forEach((_, slot) => {
          handlers.set(slot, (map) =>
            setUrlsByField((prev) => ({ ...prev, [slot]: map }))
          );
        });
      }
    });
    return handlers;
  }, [spec.fields]);

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
   * checkbox → { value, notes }, textarea + upload → { files, notes }.
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
      if (field.kind === "radio") return radio ?? "";
      if (field.kind === "checkbox") return { value: [...checks], notes: notes.trim() };
    }
    const textIdx = spec.fields.findIndex((f) => f.kind === "textarea");
    const uploadIdx = spec.fields.findIndex((f) => f.kind === "upload-grid");
    return {
      files: uploadIdx >= 0 ? allUrls() : [],
      notes: textIdx >= 0 ? (textByField[textIdx] ?? "").trim() : "",
    };
  };

  const submit = () => {
    if (!canContinue) return;

    const parts: string[] = [];
    let uploadTotal = Object.values(urlsByField).reduce(
      (sum, map) => sum + Object.keys(map ?? {}).length,
      0
    );
    spec.fields.forEach((field, i) => {
      if (field.kind === "textarea") {
        const v = (textByField[i] ?? "").trim();
        if (v) parts.push(v);
      } else if (field.kind === "radio") {
        if (radio) parts.push(radio);
      } else if (field.kind === "checkbox") {
        const selected = [...checks];
        const trimmedNotes = notes.trim();
        if (selected.length && trimmedNotes) parts.push(`${selected.join(", ")} — ${trimmedNotes}`);
        else if (selected.length) parts.push(selected.join(", "));
        else if (trimmedNotes) parts.push(trimmedNotes);
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

  const toggleCheck = (option: string) => {
    setChecks((prev) => {
      const next = new Set(prev);
      if (next.has(option)) next.delete(option);
      else next.add(option);
      return next;
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

      <div className="question-fields mt-4 w-full space-y-4">
        {spec.fields.map((field, i) => {
          if (field.kind === "upload-grid") {
            return (
              <div
                key={i}
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
            );
          }

          if (field.kind === "textarea") {
            return (
              <textarea
                key={i}
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
            );
          }

          if (field.kind === "radio") {
            return (
              <div key={i} className="flex flex-wrap gap-2" role="radiogroup" aria-label="Budget">
                {field.options.map((option) => {
                  const selected = radio === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setRadio(option)}
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
            );
          }

          // checkbox
          return (
            <div key={i} className="space-y-3">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Property information">
                {field.options.map((option) => {
                  const selected = checks.has(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      role="checkbox"
                      aria-checked={selected}
                      onClick={() => toggleCheck(option)}
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
    </div>
  );
}

export default memo(QuestionCard);
