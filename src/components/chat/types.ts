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


export type AnswerValue =
  | string
  | string[]
  | { files: string[]; notes: string }
  | { value: string[]; notes: string };

/** How a question's answer is serialized for the design API. */
export type ApiAnswerShape = "urls" | "text" | "files-notes" | "value-notes";

export const WORK_TYPES = [
  "front_yard",
  "rear_yard",
  "whole_property",
  "color_material",
  "arc_addition",
  "custom",
  "value_added_services",
] as const;

/** The canonical work_type values the intake flow supports. */
export type WorkType = (typeof WORK_TYPES)[number];

/**
 * Normalize a raw host/API work_type (e.g. "front-yard") to a known WorkType.
 * Returns null when absent or not a recognized value.
 */
export function toWorkType(raw: string | null | undefined): WorkType | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase().replace(/-/g, "_");
  return (WORK_TYPES as readonly string[]).includes(normalized)
    ? (normalized as WorkType)
    : null;
}

/**
 * API-facing metadata attached to a card episode. `apiKey` is the episode's
 * identifier (hoisted from the episode in flow.ts) and the exact snake_case
 * key the API expects — always matching schema.md.
 */
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
  /** Choice buttons rendered under the message (overview). */
  options?: string[];
  /** Question card rendered in place of a bubble. */
  card?: QuestionCardSpec;
  /** Restored answer from Redux to hydrate the QuestionCard inputs. */
  initialAnswer?: AnswerValue;
  /** When set, render the 8-item intake checklist as a list in the bubble. */
  showChecklist?: boolean;
  /** The checklist item this episode collects an answer for. */
  checklistId?: string;
  /**
   * When true, this message was restored from the persisted session (sessionStorage).
   * Animated components (typewriter, enter transitions) should skip their
   * animations so the restored chat appears instantly.
   */
  isRestored?: boolean;
  /** Optional headline for summary-kind messages (AllQuestion-driven flows). */
  title?: string;
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

/**
 * Checklist for the color/material question set — same ids (so completion /
 * restore state stays compatible), with the three topic labels swapped.
 */
export const COLOR_MATERIAL_CHECKLIST: ChecklistItem[] = [
  { id: "photos", number: 1, label: "Additional property photos upload" },
  { id: "files", number: 2, label: "Supporting files (survey and similar)" },
  { id: "goals", number: 3, label: "High level project goals" },
  { id: "styles", number: 4, label: "Exterior color & material style" },
  { id: "hardscape", number: 5, label: "Primary material preferences" },
  { id: "softscape", number: 6, label: "Color preferences" },
  { id: "budget", number: 7, label: "Budget" },
  { id: "restrictions", number: 8, label: "Property restrictions (HOA requirements)" },
];

/**
 * Checklist for the arc-addition question set — same ids (so completion /
 * restore state stays compatible), with the three topic labels swapped.
 */
export const ARC_CHECKLIST: ChecklistItem[] = [
  { id: "photos", number: 1, label: "Additional property photos upload" },
  { id: "files", number: 2, label: "Supporting files (survey and similar)" },
  { id: "goals", number: 3, label: "High level project goals" },
  { id: "styles", number: 4, label: "Type of architectural project" },
  { id: "hardscape", number: 5, label: "Architectural style preference" },
  { id: "softscape", number: 6, label: "Exterior materials & finishes" },
  { id: "budget", number: 7, label: "Budget" },
  { id: "restrictions", number: 8, label: "Property restrictions (HOA requirements)" },
];


export interface SummaryCopy {
  title: string;
  description: string;
}

export const SUMMARY_COPY: Record<string, SummaryCopy> = {
  front_yard: {
    title: "Front Yard Design Summary",
    description:
      "Amazing, I have logged our discussion based on the project details, preferences, and uploaded information you’ve shared with me! Can you please confirm?",
  },
  rear_yard: {
    title: "Rear Yard Design Summary",
    description:
      "Amazing, I have logged our discussion for your rear yard based on the project details, preferences, and uploaded information you’ve shared with me! Can you please confirm?",
  },
  whole_property: {
    title: "Whole Property Design Summary",
    description:
      "Amazing, I have logged our discussion for your entire property based on the project details, preferences, and uploaded information you’ve shared with me! Can you please confirm?",
  },
  color_material: {
    title: "Color & Material Summary",
    description:
      "Amazing, I have logged our discussion about your exterior color and material preferences based on the details and inspiration you’ve shared with me! Can you please confirm?",
  },
  arc_addition: {
    title: "Architectural Addition Summary",
    description:
      "Amazing, I have logged our discussion about your architectural project based on the details, preferences, and uploaded information you’ve shared with me! Can you please confirm?",
  },
  value_added_services: {
    title: "Value Added Services Summary",
    description:
      "Amazing, I have logged our discussion about the value added services based on the project details, preferences, and uploaded information you’ve shared with me! Can you please confirm?",
  },
  custom: {
    title: "Custom Design Summary",
    description:
      "Let me generate an initial rendering based on my understanding of what you are looking for.",
  },
};

/** Resolve summary title/description copy for a work type. */
export function summaryCopyForWorkType(workType?: string): SummaryCopy {
  const normalized = (workType ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  return SUMMARY_COPY[normalized] ?? SUMMARY_COPY.front_yard;
}

/**
 * Pick the intake checklist for a work type: the color/material and
 * arc-addition variants get their own topic labels; everything else keeps the
 * landscape ones.
 */
export function checklistForWorkType(workType?: string): ChecklistItem[] {
  const normalized = (workType ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  if (normalized === "color_material") return COLOR_MATERIAL_CHECKLIST;
  if (normalized === "arc_addition") return ARC_CHECKLIST;
  return CHECKLIST;
}
