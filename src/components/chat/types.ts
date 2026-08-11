export type Role = "user" | "assistant";

export type EpisodeKind = "ready" | "options" | "card" | "summary";

/** A file-upload drop zone attached to a message. */
export interface UploadSpec {
  label: string;
  hint?: string;
  accept?: string;
  multiple?: boolean;
}

/** A grid of compact upload boxes (e.g. 4 photo slots). */
export interface UploadGridField {
  kind: "upload-grid";
  /** Number of upload boxes (default 4). */
  count?: number;
  accept?: string;
}

/** A free-text textarea. */
export interface TextareaField {
  kind: "textarea";
  placeholder: string;
  rows?: number;
  /** When true, the continue button stays disabled until text is entered. */
  required?: boolean;
}

/** Single-select radio pill row. */
export interface RadioField {
  kind: "radio";
  options: string[];
  required?: boolean;
}

/** Multi-select checkbox pills with optional notes field. */
export interface CheckboxField {
  kind: "checkbox";
  options: string[];
  notesPlaceholder?: string;
}

export type QuestionField = UploadGridField | TextareaField | RadioField | CheckboxField;

/**
 * The structured answer value the design API expects for a question.
 * The shape is determined by the question's `answerShape`:
 * - "urls"         → string[]  (upload-only questions)
 * - "text"         → string    (textarea / radio questions)
 * - "files-notes"  → { files, notes } (textarea + upload questions)
 * - "value-notes"  → { value, notes } (checkbox questions)
 */
export type AnswerValue =
  | string
  | string[]
  | { files: string[]; notes: string }
  | { value: string[]; notes: string };

/** How a question's answer is serialized for the design API. */
export type ApiAnswerShape = "urls" | "text" | "files-notes" | "value-notes";

/** API-facing metadata attached to a card episode. */
export interface ApiQuestionMeta {
  /** Exact snake_case key the API expects (e.g. "additional_images_upload"). */
  apiKey: string;
  /** Display name, mirrors the card title. */
  name: string;
  /** Final question string sent to the API (HTML for upload steps, plain otherwise). */
  question: string;
  /** How `answer` is serialized. */
  answerShape: ApiAnswerShape;
  /** Checklist item this question's answer maps to (for Handoff / restore display). */
  checklistId?: string;
  /** Whether the edit UI may offer an edit affordance for this question (default true). */
  editable?: boolean;
}

/** One intake question card (transcribed from design.md). */
export interface QuestionCardSpec {
  title: string;
  description: string;
  fields: QuestionField[];
}

/**
 * A message in the chat transcript. Assistant messages may carry an
 * interactive attachment (option buttons, a question card, or the summary).
 */
export interface Message {
  id: string;
  role: Role;
  content: string;
  /** Which kind of interactive attachment this message carries. */
  kind?: EpisodeKind;
  /** Choice buttons rendered under the message (welcome / overview). */
  options?: string[];
  /** Question card rendered in place of a bubble. */
  card?: QuestionCardSpec;
  /** Restored answer from Redux to hydrate the QuestionCard inputs. */
  initialAnswer?: AnswerValue;
  /** When set, render the 8-item intake checklist as a list in the bubble. */
  showChecklist?: boolean;
  /** The checklist item this episode collects an answer for. */
  checklistId?: string;
}

/** One item of the persistent intake checklist. */
export interface ChecklistItem {
  id: string;
  number: number;
  label: string;
}

export const CHECKLIST: ChecklistItem[] = [
  { id: "photos", number: 1, label: "Additional property photos upload" },
  { id: "files", number: 2, label: "Supporting files (survey and similar)" },
  { id: "goals", number: 3, label: "High level project goals" },
  { id: "styles", number: 4, label: "Landscape style preferences" },
  { id: "hardscape", number: 5, label: "Hardscape preferences/requirements" },
  { id: "softscape", number: 6, label: "Softscape preferences" },
  { id: "budget", number: 7, label: "Budget" },
  { id: "restrictions", number: 8, label: "Property restrictions (HOA requirements)" },
];
