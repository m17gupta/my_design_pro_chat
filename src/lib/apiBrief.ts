import type {
  ApiAnswerShape,
  ApiQuestionMeta,
  AnswerValue,
} from "../components/chat/types";

/**
 * Top-level context for the brief payload. These come from the host app / API
 * (the chat itself never collects them); defaults are used until wired up.
 */
export interface BriefContext {
  /** Job id from the host app / API. */
  id?: number;

  /** Logo URL stamped on the generated design. */
  watermark?: string;

  /** e.g. "front-yard". */
  work_type?: string;

  /** Main property photo URL (provided by the host app / API). */
  image_url?: string;

  /** Revision comments from the post-render feedback step. */
  revision?: RevisionComment;
}

export interface ApiBriefItem {
  name: string;
  question: string;
  answer:
    | string
    | string[]
    | { files: string[]; notes: string }
    | { value: string[]; notes: string };
}

/** Revision comments collected after an initial design render. */
export interface RevisionComment {
  files: string[];
  notes: string;
}

/** The exact payload shape the design API expects (see schema.md). */
export interface ApiBriefPayload {
  id: number;
  watermark: string;
  work_type: string;
  image_url: string;
  original: Record<string, ApiBriefItem>;
  revision_comment: RevisionComment;
}

export const DEFAULT_WATERMARK = "http://mydesigns.pro/img/luna-logo.png";
export const DEFAULT_WORK_TYPE = "front-yard";

/** Coerce an unknown value into a string array, dropping non-strings. */
function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

/** Pull the `notes` string out of an object-shaped answer, if present. */
function notesOf(raw: unknown): string {
  if (raw && typeof raw === "object" && "notes" in raw && typeof raw.notes === "string") {
    return raw.notes;
  }
  return "";
}

/**
 * Serialize a raw answer into the shape the API expects for a question.
 * Missing/blank answers degrade to safe defaults (`[]` / `""` / `{files: []}`)
 * so every question is always present in the payload.
 */
export function normalizeAnswer(
  shape: ApiAnswerShape,
  raw?: AnswerValue
): ApiBriefItem["answer"] {
  switch (shape) {
    case "urls":
      return asStringArray(raw);
    case "text":
      // Radio/text answers are plain strings; fall back to notes for safety.
      return typeof raw === "string" ? raw : notesOf(raw);
    case "files-notes":
      return {
        files:
          raw && typeof raw === "object" && "files" in raw
            ? asStringArray(raw.files)
            : [],
        notes: notesOf(raw),
      };
    case "value-notes":
      return {
        value:
          raw && typeof raw === "object" && "value" in raw
            ? asStringArray(raw.value)
            : [],
        notes: notesOf(raw),
      };
  }
}

/**
 * Assemble one fully-formed payload item `{ name, question, answer }` exactly
 * as the API expects (schema.md) — this is the shape stored in Redux.
 * An undefined/blank answer normalizes to the shape's empty default.
 */
export function buildQuestionItem(
  q: ApiQuestionMeta,
  answer?: AnswerValue
): ApiBriefItem {
  return {
    name: q.name,
    question: q.question,
    answer: normalizeAnswer(q.answerShape, answer),
  };
}

/**
 * Assemble the complete design-brief payload from the API question metadata
 * (in order) and the already-assembled items keyed by `apiKey`. Any question
 * without a stored item gets its empty default, so all 8 keys are always present.
 */
export function buildApiPayload(
  questions: ApiQuestionMeta[],
  items: Record<string, ApiBriefItem | undefined>,
  context: BriefContext = {}
): ApiBriefPayload {
  const original: Record<string, ApiBriefItem> = {};
  questions.forEach((q) => {
    const item = items[q.apiKey] ?? buildQuestionItem(q);
    if (Array.isArray(item.answer) && item.answer.length === 0) return;
    original[q.apiKey] = item;
  });

  return {
    id: context.id ?? 0,
    // `||` (not `??`) so an empty-string context value means "not set" → default.
    watermark: context.watermark || DEFAULT_WATERMARK,
    work_type: context.work_type || DEFAULT_WORK_TYPE,
    image_url: context.image_url ?? "",
    original,
    revision_comment: context.revision ?? { files: [], notes: "" },
  };
}
