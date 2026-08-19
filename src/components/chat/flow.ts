import type { ApiBriefItem } from "../../lib/apiBrief";
import { answerToText, isAnswerEmpty } from "../../lib/briefDisplay";
import {
  summaryCopyForWorkType,
  type AnswerValue,
  type ApiQuestionMeta,
  type ChecklistItem,
  type EpisodeKind,
  type Message,
  type QuestionCardSpec,
} from "./types";
import type { EnterpriseEntry } from "../../store/enterprise/enterpriseType";
import questionsJson from "../../docs/Questions.json";
import customQuestionsJson from "../../docs/CustomQuestions.json";

export interface Episode {

  apiKey: string;
  kind: EpisodeKind;
  content?: string;
  checklistId?: string;
  options?: string[];
  card?: QuestionCardSpec;
  showChecklist?: boolean;
  /** Whether the user may edit this episode's answer (default true). */
  editable?: boolean;
  api?: Omit<ApiQuestionMeta, "apiKey">;
  engageDesigner?: {
    description: string;
    question?: string;
  };

  revisionStep?: boolean;
  /** Optional headline for summary-kind episodes (AllQuestion-driven flows). */
  title?: string;
}


const EPISODES: Episode[] = [
  {
    apiKey: "overview",
    kind: "ready",
    content:
      "To give you an overview of what information I will be gathering so you know what to expect, I will be touching on the following:",
    showChecklist: true,
    options: ["I am ready to proceed  →"],
    editable: false,
  },
  {
    apiKey: "photos",
    kind: "ready",
    content:
      "Perfect! Go ahead and upload any additional angles of the front view. These extra views help us better understand your property.",
    checklistId: "photos",
    options: ["Yes I do", "No I don't"],
  },
  {
    apiKey: "additional_images_upload",
    kind: "card",
    card: {
      title: "Additional House Photos (Optional)",
      description:
        "",
      fields: [{ kind: "upload-grid", count: 4, accept: "image/*" }],
    },
    api: {
      name: "Additional House Photos (Optional)",
      // Exact HTML question the API expects (mirrors card.description).
      question:
        "<p class='mb-3'>Great, your main photo has been received! If you have additional photos of <b>this same side of your home taken</b> from different angles, distances, or perspectives (such as closer shots or views from the left or right while still facing this same elevation), please upload them here.</p> <p>These additional photos help us better understand your home's architecture and create the most accurate design possible.</p>",
      answerShape: "urls",
      checklistId: "photos",
      editable: false,
    },
  },
  {
    apiKey: "files",
    kind: "ready",
    content:
      "Do you have any other file that would be helpful, like a survey, site plan, and inspirational image?",
    checklistId: "files",
    options: ["Yes I do", "No I don't"],
  },
  {
    apiKey: "supporting_files_upload",
    kind: "card",
    card: {
      title: "Supporting Files Upload (Optional)",
      description:
        "Have any project files you'd like to share? Feel free to upload them here!\n\nThis could include **surveys, site plans, PDFs, SketchUp models (.SKP), architectural drawings, inspiration images, or any other documents** that will help us better understand your project.\n\nIf you don't have any supporting files, simply continue to the next step — you can always add them later!",
      fields: [{ kind: "upload-grid", count: 4, accept: ".pdf,.dwg,.dxf,image/*" }],
    },
    api: {
      name: "Supporting Files Upload (Optional)",
      // Exact HTML question the API expects (mirrors card.description).
      question:
        "<p class='mb-3'>Have any project files you'd like to share? Feel free to upload them here!</p> <p class='mb-3'>This could include <b>surveys, site plans, PDFs, SketchUp models (.SKP), architectural drawings, inspiration images, or any other documents</b> that will help us better understand your project.</p> <p>If you don't have any supporting files, simply continue to the next step, you can always add them later!</p>",
      answerShape: "urls",
      checklistId: "files",
    },
  },
  {
    apiKey: "project_goals_or_brief_description",
    kind: "card",
    checklistId: "goals",
    card: {
      title: "Project Goals/Brief Description",
      description:
        "In a few sentences, tell me what you'd love to accomplish with this project. Feel free to share any goals, challenges, or ideas you already have in mind; I'd love to hear them!",
      fields: [{ kind: "textarea", placeholder: "Share your thoughts", rows: 4, required: true }],
    },
    api: {
      name: "Project Goals/Brief Description",
      question:
        "In a few sentences, tell me what you'd love to accomplish with this project. Feel free to share any goals, challenges, or ideas you already have in mind; I'd love to hear them!",
      answerShape: "text",
      checklistId: "goals",
    },
  },
  {
    apiKey: "landscape_design_style_preference",
    kind: "card",
    checklistId: "styles",
    card: {
      title: "Landscape Design Style Preference",
      description:
        "Do you have a preferred landscape style or overall look you're drawn to? For example, you might love something clean and modern, classic and timeless, natural and relaxed, or something completely unique to you!",
      fields: [
        { kind: "textarea", placeholder: "Share your thoughts", rows: 3, required: true },
        { kind: "upload-grid", count: 4, accept: "image/*" },
      ],
    },
    api: {
      name: "Landscape Design Style Preference",
      question:
        "Do you have a preferred landscape style or overall look you're drawn to? For example, you might love something clean and modern, classic and timeless, natural and relaxed, or something completely unique to you!",
      answerShape: "files-notes",
      checklistId: "styles",
    },
  },
  {
    apiKey: "hardscape_material_preferences",
    kind: "card",
    checklistId: "hardscape",
    card: {
      title: "Hardscape / Material Preferences",
      description:
        "Are there any hardscape materials you'd like me to keep in mind for this design? This could include things like pavers, natural stone, brick, concrete, or even a specific color palette or finish you love; I'd be happy to consider it as I put everything together!",
      fields: [
        { kind: "textarea", placeholder: "Share your thoughts", rows: 3, required: true },
        { kind: "upload-grid", count: 4, accept: "image/*" },
      ],
    },
    api: {
      name: "Hardscape / Material Preferences",
      question:
        "Are there any hardscape materials you'd like me to keep in mind for this design? This could include things like pavers, natural stone, brick, concrete, or even a specific color palette or finish you love; I'd be happy to consider it as I put everything together!",
      answerShape: "files-notes",
      checklistId: "hardscape",
    },
  },
  {
    apiKey: "softscape_planting_preferences",
    kind: "card",
    checklistId: "softscape",
    card: {
      title: "Softscape / Planting Preferences",
      description:
        "Are there any plant styles, colors, or types you'd like me to keep in mind? This could include things like low-maintenance plantings, evergreen structure, flowering shrubs, privacy screening, ornamental trees, or any overall look you love. I'd be happy to keep it in mind as I put everything together!",
      fields: [
        { kind: "textarea", placeholder: "Share your thoughts", rows: 3, required: true },
        { kind: "upload-grid", count: 4, accept: "image/*" },
      ],
    },
    api: {
      name: "Softscape / Planting Preferences",
      question:
        "Are there any plant styles, colors, or types you'd like me to keep in mind? This could include things like low-maintenance plantings, evergreen structure, flowering shrubs, privacy screening, ornamental trees, or any overall look you love. I'd be happy to keep it in mind as I put everything together!",
      answerShape: "files-notes",
      checklistId: "softscape",
    },
  },
  {
    apiKey: "budget",
    kind: "card",
    checklistId: "budget",
    card: {
      title: "Budget",
      description:
        "What investment range feels most comfortable for this project? This will help me tailor the design direction to something that feels like the right fit for you!",
      fields: [
        {
          kind: "radio",
          required: true,
          options: [
            "Under $25,000",
            "$25,000-$50,000",
            "$50,000-$75,000",
            "$75,000-$150,000",
            "$150,000+",
          ],
        },
      ],
    },
    api: {
      name: "Budget",
      question:
        "What investment range feels most comfortable for this project? This will help me tailor the design direction to something that feels like the right fit for you!",
      answerShape: "text",
      checklistId: "budget",
    },
  },
  {
    apiKey: "important_proprty_information",
    kind: "card",
    checklistId: "restrictions",
    card: {
      title: "Important Property Information",
      description:
        "Is there anything about your property you'd like me to know before I get started on the design?",
      fields: [
        {
          kind: "checkbox",
          options: [
            "HOA requirements",
            "Easements",
            "Utility lines",
            "Septic field",
            "Planned additions",
            "Accessibility needs",
            "Other Special considerations",
          ],
          notesPlaceholder: "Enter your notes",
        },
      ],
    },
    api: {
      // NB: the API key intentionally mirrors the schema's "proprty" spelling.
      name: "Important Property Information",
      question:
        "Is there anything about your property you'd like me to know before I get started on the design?",
      answerShape: "value-notes",
      checklistId: "restrictions",
    },
  },
  {
    apiKey: "summary",
    kind: "summary",
    content:
      "Amazing, I have logged our discussion based on the project details, preferences, and uploaded information you've shared with me! Can you please confirm?",
  },
  {
    apiKey: "revision",
    kind: "card",
    revisionStep: true,
    card: {
      title: "Revsion Comment",
      description:
        "Please share your revision requests, I will incorporate them into the design.",
      fields: [
        {
          kind: "textarea",
          placeholder: "Describe the changes you'd like",
          rows: 4,
          required: true,
        },
        { kind: "upload-grid", count: 4, accept: "image/*" },
      ],
    },
  },
  {
    apiKey: "revision-summary",
    kind: "summary",
    content:
      "Thanks! I've noted your revision comments. I'm ready to regenerate the design with these changes.",
  },
];

const LANDSCAPE_TOPIC_KEYS = [
  "landscape_design_style_preference",
  "hardscape_material_preferences",
  "softscape_planting_preferences",
] as const;

const COLOR_MATERIAL_TOPIC_KEYS = [
  "exterior_color_and_material_style",
  "primary_material_preferences",
  "color_preferences",
] as const;

const ARC_TOPIC_KEYS = [
  "type_of_architectural_project",
  "architectural_style_preference",
  "exterior_materials_and_finishes",
] as const;

/** The base intake order — the landscape (front-yard) family. */
const BASE_KEYS = EPISODES.map((e) => e.apiKey);

/** The custom work type's episode apiKeys, sourced from CustomQuestions.json. */
const CUSTOM_KEYS = (customQuestionsJson as Episode[]).map((e) => e.apiKey);

/** Swap the three landscape topic slots for another family's topic keys. */
function withTopicFamily(
  keys: readonly string[],
  topics: readonly string[]
): string[] {
  return keys.map((k) => {
    const slot = (LANDSCAPE_TOPIC_KEYS as readonly string[]).indexOf(k);
    return slot >= 0 ? topics[slot] : k;
  });
}

/**
 * The intake question set per work type, as ordered apiKey arrays — the single
 * source of truth for which cards each work type shows. Wording is layered on
 * later from Questions.json via `buildEpisodes`; the `custom` work type reads
 * its keys straight from CustomQuestions.json.
 */
export const WORK_TYPE_API_KEYS: Record<string, string[]> = {
  front_yard: BASE_KEYS,
  rear_yard: BASE_KEYS,
  whole_property: BASE_KEYS,
  custom: CUSTOM_KEYS,
  value_added_services: BASE_KEYS,
  color_material: withTopicFamily(BASE_KEYS, COLOR_MATERIAL_TOPIC_KEYS),
  arc_addition: withTopicFamily(BASE_KEYS, ARC_TOPIC_KEYS),
};

/** Resolve a work type's apiKey array to its episode objects. */
function resolveWorkTypeEpisodes(workType: string | undefined): Episode[] {
  const keys = WORK_TYPE_API_KEYS[normalizeWorkType(workType)] ?? BASE_KEYS;
  return keys.map((k) => CATALOG[k]);
}

/**
 * Normalize a work_type value: "front-yard" → "front_yard".
 * @see normalizeWorkType
 */
export function normalizeWorkType(workType: string | undefined): string {
  return (workType ?? "front_yard").trim().toLowerCase().replace(/-/g, "_");
}

const COLOR_MATERIAL_EXTERIOR_STYLE: Episode = {
  apiKey: "exterior_color_and_material_style",
  kind: "card",
  checklistId: "styles",
  card: {
    title: "Exterior Color & Material Style",
    description:
      "Do you have a preferred exterior style or overall look you're drawn to? For example, clean and modern, classic and timeless, warm and traditional, farmhouse, contemporary, or something completely unique to you. Feel free to upload inspirational images if there's a look you love!",
    fields: [
      { kind: "textarea", placeholder: "Share your thoughts", rows: 3, required: true },
      { kind: "upload-grid", count: 4, accept: "image/*" },
    ],
  },
  api: {
    name: "Exterior Color & Material Style",
    question:
      "Do you have a preferred exterior style or overall look you're drawn to? For example, clean and modern, classic and timeless, warm and traditional, farmhouse, contemporary, or something completely unique to you. Feel free to upload inspirational images if there's a look you love!",
    answerShape: "files-notes",
    checklistId: "styles",
  },
};

const COLOR_MATERIAL_PRIMARY_MATERIALS: Episode = {
  apiKey: "primary_material_preferences",
  kind: "card",
  checklistId: "hardscape",
  card: {
    title: "Primary Material Preferences",
    description:
      "Are there any exterior materials or finishes you'd like me to keep in mind for this design? This could include siding, brick, stone, stucco, wood accents, roofing, windows, garage doors, front doors, trim, shutters, lighting, or a specific finish or color palette you love. I'd be happy to consider it as I put everything together!",
    fields: [
      { kind: "textarea", placeholder: "Share your thoughts", rows: 3, required: true },
      { kind: "upload-grid", count: 4, accept: "image/*" },
    ],
  },
  api: {
    name: "Primary Material Preferences",
    question:
      "Are there any exterior materials or finishes you'd like me to keep in mind for this design? This could include siding, brick, stone, stucco, wood accents, roofing, windows, garage doors, front doors, trim, shutters, lighting, or a specific finish or color palette you love. I'd be happy to consider it as I put everything together!",
    answerShape: "files-notes",
    checklistId: "hardscape",
  },
};

const COLOR_MATERIAL_COLOR_PREFERENCES: Episode = {
  apiKey: "color_preferences",
  kind: "card",
  checklistId: "softscape",
  card: {
    title: "Color Preferences",
    description:
      "Are there any colors, color combinations, or finishes you'd like me to keep in mind? Whether you have favorite paint colors, brick tones, roof colors, trim accents, metal finishes, or an inspiration photo, I'd love to incorporate your preferences into the design!",
    fields: [
      { kind: "textarea", placeholder: "Share your thoughts", rows: 3, required: true },
      { kind: "upload-grid", count: 4, accept: "image/*" },
    ],
  },
  api: {
    name: "Color Preferences",
    question:
      "Are there any colors, color combinations, or finishes you'd like me to keep in mind? Whether you have favorite paint colors, brick tones, roof colors, trim accents, metal finishes, or an inspiration photo, I'd love to incorporate your preferences into the design!",
    answerShape: "files-notes",
    checklistId: "softscape",
  },
};

/** The three arc-addition topic cards (Questions.json → color-material). */
const ARC_TYPE_OF_PROJECT: Episode = {
  apiKey: "type_of_architectural_project",
  kind: "card",
  checklistId: "styles",
  card: {
    title: "Type of Architectural Project",
    description:
      "What type of architectural changes are you considering? Select all that apply?",
    fields: [
      {
        kind: "checkbox",
        options: [
          "Home addition",
          "Front porch",
          "Covered porch",
          "Garage addition",
          "Second story",
          "Dormers",
          "Entry enhancement",
          "Portico",
          "Sunroom",
          "Outdoor living space",
          "Roof modifications",
          "Window changes",
          "Door changes",
          "Exterior facelift",
          "Detached structure",
          "Other",
        ],
        notesPlaceholder: "Enter your notes",
      },
    ],
  },
  api: {
    name: "Type of Architectural Project",
    question:
      "What type of architectural changes are you considering? Select all that apply?",
    answerShape: "value-notes",
    checklistId: "styles",
  },
};

const ARC_STYLE_PREFERENCE: Episode = {
  apiKey: "architectural_style_preference",
  kind: "card",
  checklistId: "hardscape",
  card: {
    title: "Architectural Style Preference",
    description:
      "Do you have a preferred architectural style or overall look you'd like to achieve? For example, modern, transitional, traditional, farmhouse, craftsman, contemporary, colonial, or something uniquely your own.\n\nFeel free to upload inspiration photos if you have them!",
    fields: [
      { kind: "textarea", placeholder: "Share your thoughts", rows: 3, required: true },
      { kind: "upload-grid", count: 4, accept: "image/*" },
    ],
  },
  api: {
    name: "Architectural Style Preference",
    question:
      "Do you have a preferred architectural style or overall look you'd like to achieve? For example, modern, transitional, traditional, farmhouse, craftsman, contemporary, colonial, or something uniquely your own.<br />Feel free to upload inspiration photos if you have them!",
    answerShape: "files-notes",
    checklistId: "hardscape",
  },
};

const ARC_EXTERIOR_MATERIALS: Episode = {
  apiKey: "exterior_materials_and_finishes",
  kind: "card",
  checklistId: "softscape",
  card: {
    title: "Exterior Materials & Finishes",
    description:
      "Are there any exterior materials or finishes you'd like me to incorporate into the design? Select all that apply?",
    fields: [
      {
        kind: "checkbox",
        options: [
          "Brick",
          "Stone",
          "Siding",
          "Stucco",
          "Wood accents",
          "Metal roofing",
          "Decorative columns",
          "Timber beams",
          "Modern windows",
          "Black window frames",
          "Decorative trim",
        ],
        notesPlaceholder: "Enter your notes",
      },
    ],
  },
  api: {
    name: "Exterior Materials & Finishes",
    question:
      "Are there any exterior materials or finishes you'd like me to incorporate into the design? Select all that apply?",
    answerShape: "value-notes",
    checklistId: "softscape",
  },
};

/**
 * Every episode the app can render, keyed by apiKey. Built from the base
 * EPISODES plus the topic cards of every family, so the per-work-type apiKey
 * arrays in `WORK_TYPE_API_KEYS` resolve to real episode objects.
 */
const CATALOG: Record<string, Episode> = Object.fromEntries(
  [
    ...EPISODES,
    COLOR_MATERIAL_EXTERIOR_STYLE,
    COLOR_MATERIAL_PRIMARY_MATERIALS,
    COLOR_MATERIAL_COLOR_PREFERENCES,
    ARC_TYPE_OF_PROJECT,
    ARC_STYLE_PREFERENCE,
    ARC_EXTERIOR_MATERIALS,
  ].map((e) => [e.apiKey, e])
);

/** Lookup map for `episodeById` (all families, not just the base flow). */
const BY_ID = new Map(Object.entries(CATALOG));

/** The color/material episodes list — same flow, three different topic cards. */
export function buildColorMaterialEpisodes(): Episode[] {
  return WORK_TYPE_API_KEYS.color_material.map((k) => CATALOG[k]);
}

/**
 * Return the API questions for a given episodes list (dynamic or static).
 * `apiKey` is hoisted from the episode itself so the payload keys always
 * match schema.md.
 */
export function getApiQuestions(episodes: Episode[]): ApiQuestionMeta[] {
  return episodes
    .filter((e) => e.api !== undefined)
    .map((e) => ({ ...(e.api as ApiQuestionMeta), apiKey: e.apiKey }));
}

/**
 * A single question override from Questions.json. Only the wording fields are
 * used — `id` must match an episode apiKey; `details`/`name` replace the card
 * and API text. Layout/field config comes exclusively from the base EPISODES.
 */
type QJsonQuestion = { id: string; details?: string; name?: string };

/** True when a string contains HTML tags (as used by the API question text). */
function looksLikeHtml(text: string): boolean {
  return /<\/?[a-z][^>]*>/i.test(text);
}

/**
 * Convert the API-facing HTML question text into readable display text for the
 * card (bold → **, paragraphs → blank lines, tags stripped). Plain text passes
 * through unchanged.
 */
function htmlToDisplay(html: string): string {
  if (!looksLikeHtml(html)) return html;
  return html
    .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b>(.*?)<\/b>/gi, "**$1**")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/(p|div|li|ul|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Collect the override questions for a work type. Searches the
 * `landscape-design` and `color-material` categories (in that order) and
 * merges the `questions` arrays of every phase in the matched work-type
 * section, so overrides are found regardless of which phase a question lives in.
 */
function collectWorkTypeOverrides(workType: string | undefined): QJsonQuestion[] {
  const normalized = normalizeWorkType(workType);

  return collectOverridesFromRoot(
    questionsJson as Record<string, unknown>,
    workType,
    normalized
  );
}

/**
 * Scan a JSON root's `landscape-design` / `color-material` categories for the
 * given work type and merge every phase's `questions` array.
 */
function collectOverridesFromRoot(
  root: Record<string, unknown>,
  workType: string | undefined,
  normalized: string
): QJsonQuestion[] {
  for (const category of ["landscape-design", "color-material"]) {
    const categorySection = root[category];
    if (!categorySection || typeof categorySection !== "object") continue;

    const section = categorySection as Record<string, unknown>;
    const workTypeSection = section[normalized] ?? (workType ? section[workType] : undefined);
    if (!workTypeSection || typeof workTypeSection !== "object") continue;

    const overrides: QJsonQuestion[] = [];
    for (const phase of Object.values(workTypeSection)) {
      if (!phase || typeof phase !== "object") continue;
      const questions = (phase as Record<string, unknown>).questions;
      if (Array.isArray(questions)) overrides.push(...(questions as QJsonQuestion[]));
    }
    if (overrides.length > 0) return overrides;
  }

  return [];
}

/**
 * Build a work-type-specific episodes list: resolve the work type's apiKey
 * array from `WORK_TYPE_API_KEYS`, then overlay the question wording from
 * Questions.json onto those episode objects.
 *
 * The apiKeys and field layouts come from the catalog (per work type); only
 * description / question text is swapped per work type from the JSON. Falls
 * back to the front-yard base when no array or no override is found.
 *
 * Lookup path in Questions.json (work-type keys may use "-" or "_"):
 *   ["landscape-design"][workType][phase*]["questions"]  (landscape variants)
 *   ["color-material"][workType][phase*]["questions"]     (exterior variants)
 * The `custom` work type bypasses this entirely: its ordered episode list comes
 * straight from CustomQuestions.json (keys, card layout, and wording).
 *
 * @param workType  The `work_type` from the URL params (e.g. "front_yard",
 *                  "front-yard", "rear_yard", "color-material").
 * @param options   Optional custom-flow flags: `engageDesigner` swaps the
 *                  engage-designer copy from CustomQuestions.json onto the
 *                  custom questions (the `{designer}` token is replaced with
 *                  `dcName`, falling back to "your designer" when blank),
 *                  only applied when `workType === "custom"`.
 */
export const CUSTOM_ENGAGE_CONTINUE_EPISODE: Episode = {
  apiKey: "custom_engage_continue",
  kind: "ready",
  content:
    "Thank you for providing the project information. Please review the details and submit your project to proceed.",
  options: ["Proceed"],
};

export function buildEpisodes(
  workType: string | undefined,
  options?: { engageDesigner?: boolean; dcName?: string }
): Episode[] {
  const normalized = normalizeWorkType(workType);

  if (normalized === "custom") {
    const customEpisodes = (customQuestionsJson as Episode[]).map((ep) =>
      ep.card && ep.card.description
        ? {
            ...ep,
            card: { ...ep.card, description: htmlToDisplay(ep.card.description) },
          }
        : ep
    );
  
    if (options?.engageDesigner) {
      const designer = options.dcName?.trim() || "your designer";
      return customEpisodes.map((ep) => {
        if (ep.apiKey === "summary") {
          return CUSTOM_ENGAGE_CONTINUE_EPISODE;
        }
        const variant = ep.engageDesigner;
        if (!variant) return ep;
        const description = variant.description.replaceAll("{designer}", designer);
        const question = (variant.question ?? variant.description).replaceAll(
          "{designer}",
          designer
        );
        return {
          ...ep,
          ...(ep.card ? { card: { ...ep.card, description } } : {}),
          ...(ep.api ? { api: { ...ep.api, question } } : {}),
        };
      });
    }
    return customEpisodes;
  }
  const base = resolveWorkTypeEpisodes(workType);
  const overrides = collectWorkTypeOverrides(workType);
  if (overrides.length === 0) {
    // No overrides found — return the work type's episodes unchanged.
    return base;
  }

  return base.map((ep) => {
    const override = overrides.find((q) => q.id === ep.apiKey);
    if (!override || !ep.card) return ep;

    // Card description shows readable text; the API question keeps the exact
    // (possibly HTML) wording the backend expects.
    const newDescription = override.details
      ? htmlToDisplay(override.details)
      : ep.card.description;
    return {
      ...ep,
      card: {
        ...ep.card,
        description: newDescription,
        ...(override.name ? { title: override.name } : {}),
      },
      ...(ep.api
        ? {
            api: {
              ...ep.api,
              question: override.details ?? ep.api.question,
              ...(override.name ? { name: override.name } : {}),
            },
          }
        : {}),
    };
  });
}

// -------------------------------------------------------------------------
// AllQuestion.json-driven flows (enterprise / enterprise-client roles)
// -------------------------------------------------------------------------

/**
 * One question from AllQuestion.json. Only the fields the chat renders are
 * typed; unknown/extra fields are ignored.
 */
export interface AllQQuestion {
  id: string;
  type?: string;
  name?: string;
  details?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  max_files?: number;
  max_selection?: number;
  is_ai_design?: boolean;
  is_property_address?: boolean;
  example?: string;
  options?: string[] | Record<string, string>;
  multi_questions?: AllQQuestion[];
}

/** One phase: a titled, ordered list of questions. */
export interface AllQPhase {
  title: string;
  questions: AllQQuestion[];
}

/**
 * Everything the chat knows about the host flow, used to pick the question
 * set from AllQuestion.json (mirrors the BriefState context fields).
 */
export interface FlowContext {
  work_type?: string | null;
  user_type?: string | null;
  role?: string | null;
  question_sets?: { original?: string[]; revision?: string[] } | null;
  engageDesigner?: boolean | null;
  dcName?: string | null;
}

function normalizeRole(role: string | null | undefined): string {
  return (role ?? "").trim().toLowerCase();
}

function normalizeUserType(userType: string | null | undefined): string {
  return (userType ?? "").trim().toLowerCase();
}

/** Default user_type key for a work_type when the host didn't send one. */
function userTypeForWorkType(workType: string | undefined): string {
  const wt = normalizeWorkType(workType);
  if (wt === "color_material" || wt === "arc_addition") return "color-material";
  return "landscape-design";
}

interface ResolvedAllQuestionFlow {
  phases: Record<string, AllQPhase>;
  originalPhases: string[];
  revisionPhases: string[];
}

function resolveAllQuestionFlow(
  ctx: FlowContext,
  questionnaires?: Record<string, unknown> | null
): ResolvedAllQuestionFlow | null {
  const role = normalizeRole(ctx.role);
  if (!role || !questionnaires || typeof questionnaires !== "object" || Object.keys(questionnaires).length === 0) {
    return null;
  }
  const roleSection = questionnaires[role];
  if (!roleSection || typeof roleSection !== "object") return null;
  const roleMap = roleSection as Record<string, unknown>;

  const userType = normalizeUserType(ctx.user_type);
  let phases: Record<string, AllQPhase> | undefined;

  if (role === "enterprise-client") {
    // enterprise-client sections are user_type → phase (no work_type level).
    const section = userType ? roleMap[userType] : undefined;
    if (section && typeof section === "object") {
      phases = section as Record<string, AllQPhase>;
    }
  } else {
    const userTypeKey = userType || userTypeForWorkType(ctx.work_type ?? undefined);
    const userSection = roleMap[userTypeKey];
    if (userSection && typeof userSection === "object") {
      const workTypeKey = normalizeWorkType(ctx.work_type ?? "front_yard");
      const workSection = (userSection as Record<string, unknown>)[workTypeKey];
      if (workSection && typeof workSection === "object") {
        phases = workSection as Record<string, AllQPhase>;
      }
    }
  }
  if (!phases) return null;

  const phaseKeys = Object.keys(phases);
  if (phaseKeys.length === 0) return null;

  const qs = ctx.question_sets;
  let originalPhases =
    qs?.original && qs.original.length > 0 ? qs.original : defaultOriginalPhases(phases);
  let revisionPhases =
    qs?.revision && qs.revision.length > 0
      ? qs.revision
      : defaultRevisionPhases(phases);

  // Keep only phases that exist, preserving JSON order.
  originalPhases = originalPhases.filter((key) => phases && phases[key]);
  revisionPhases = revisionPhases.filter((key) => phases && phases[key]);

  return { phases, originalPhases, revisionPhases };
}

/**
 * Index of the phase holding the design summary / approval question
 * (design_summary, design_direction_approval); -1 when absent.
 */
function summaryPhaseIndex(phases: Record<string, AllQPhase>): number {
  const keys = Object.keys(phases);
  return keys.findIndex((key) =>
    phases[key].questions.some(
      (q) => q.id === "design_summary" || q.id === "design_direction_approval"
    )
  );
}

/**
 * Default intake phases: everything up to & including the phase that holds the
 * design summary / approval question (design_summary, design_direction_approval).
 */
function defaultOriginalPhases(phases: Record<string, AllQPhase>): string[] {
  const keys = Object.keys(phases);
  const summaryIdx = summaryPhaseIndex(phases);
  const end = summaryIdx >= 0 ? summaryIdx + 1 : Math.max(0, keys.length - 1);
  return keys.slice(0, end);
}

/**
 * Default revision phases: everything after the summary/approval phase. The
 * post-approval phases hold the revision-request cards (is_ai_design review
 * phases are skipped when the episodes are built), so picking all remaining
 * phases keeps the revision loop populated for every flow.
 */
function defaultRevisionPhases(phases: Record<string, AllQPhase>): string[] {
  const keys = Object.keys(phases);
  const summaryIdx = summaryPhaseIndex(phases);
  const start = summaryIdx >= 0 ? summaryIdx + 1 : Math.max(0, keys.length - 1);
  return keys.slice(start);
}

/** Normalize options (string[] or {value: label}) into a display label list. */
function normalizeOptions(options: unknown): string[] {
  if (Array.isArray(options)) {
    return options.filter((o): o is string => typeof o === "string");
  }
  if (options && typeof options === "object") {
    return Object.values(options as Record<string, string>).filter(
      (o): o is string => typeof o === "string"
    );
  }
  return [];
}

/** Default summary text when the JSON has no design_summary display question. */
const DEFAULT_SUMMARY_TEXT =
  "manish";

/**
 * Convert one AllQuestion.json question into one or more episodes. The card
 * description is human-readable (HTML converted); the API question keeps the
 * exact HTML the backend expects.
 */
function questionToEpisodes(q: AllQQuestion, checklistId?: string): Episode[] {
  const cardTitle = q.name?.trim() || "";
  const apiName = q.name?.trim() || formatQuestionIdAsName(q.id);
  const details = q.details ?? "";
  const displayDetails = htmlToDisplay(details);
  // Default checklistId to the question's own id so each question maps to
  // its own checklist entry (per-question granularity).
  const cid = checklistId ?? q.id;
  const api = (answerShape: ApiQuestionMeta["answerShape"]): Episode["api"] => ({
    name: apiName,
    question: details || displayDetails,
    answerShape,
    checklistId: cid,
  });
  const base: Episode = { apiKey: q.id, kind: "card", checklistId: cid };

  switch (q.type) {
    case "file":
      return [
        {
          ...base,
          card: {
            title: cardTitle,
            description: displayDetails,
            fields: [
              { kind: "upload-grid", count: q.max_files ?? 4, accept: "image/*" },
            ],
          },
          api: api("urls"),
        },
      ];
    case "textarea":
      return [
        {
          ...base,
          card: {
            title: cardTitle,
            description: displayDetails,
            fields: [
              {
                kind: "textarea",
                placeholder: q.placeholder ?? "Share your thoughts",
                rows: 4,
                required: q.required,
              },
            ],
          },
          api: api("text"),
        },
      ];
    case "radio":
      return [
        {
          ...base,
          card: {
            title: cardTitle,
            description: displayDetails,
            fields: [
              {
                kind: "radio",
                required: q.required,
                options: normalizeOptions(q.options),
              },
            ],
          },
          api: api("text"),
        },
      ];
    case "checkbox":
      return [
        {
          ...base,
          card: {
            title: cardTitle,
            description: displayDetails,
            fields: [{ kind: "checkbox", options: normalizeOptions(q.options) }],
          },
          api: api("value-notes"),
        },
      ];
    case "checkbox_with_notes":
      return [
        {
          ...base,
          card: {
            title: cardTitle,
            description: displayDetails,
            fields: [
              {
                kind: "checkbox",
                options: normalizeOptions(q.options),
                notesPlaceholder: "Enter your notes",
              },
            ],
          },
          api: api("value-notes"),
        },
      ];
    case "files_with_description":
      return [
        {
          ...base,
          card: {
            title: cardTitle,
            description: displayDetails,
            fields: [
              {
                kind: "textarea",
                placeholder: "Share your thoughts",
                rows: 3,
                required: q.required,
              },
              { kind: "upload-grid", count: q.max_files ?? 4, accept: "image/*" },
            ],
          },
          api: api("files-notes"),
        },
      ];
    case "multi_questions":
      // Each child gets its own checklistId (its apiKey) by default.
      return (q.multi_questions ?? []).flatMap((child) =>
        questionToEpisodes(child)
      );
    case "display":
      return [];
    default:
      return [
        {
          ...base,
          card: {
            title: cardTitle,
            description: displayDetails,
            fields: [{ kind: "textarea", placeholder: "Share your thoughts", rows: 4 }],
          },
        },
      ];
  }
}

/**
 * Swap the engage-designer wording (from CustomQuestions.json) onto matching
 * episodes, replacing the `{designer}` token with the host-provided designer
 * name. Only applied to the enterprise custom flow.
 */
function applyEngageDesigner(episodes: Episode[], dcName?: string): Episode[] {
  const designer = dcName?.trim() || "your designer";
  return episodes.map((ep) => {
    const variant = (customQuestionsJson as Episode[]).find(
      (e) => e.apiKey === ep.apiKey
    )?.engageDesigner;
    if (!variant) return ep;
    const description = variant.description.replaceAll("{designer}", designer);
    const question = (variant.question ?? variant.description).replaceAll(
      "{designer}",
      designer
    );
    return {
      ...ep,
      kind: ep.apiKey === "summary" ? "ready" : ep.kind,
      content: ep.apiKey === "summary" ? description : ep.content,
      ...(ep.card ? { card: { ...ep.card, description } } : {}),
      ...(ep.api ? { api: { ...ep.api, question } } : {}),
    };
  });
}

/**
 * Build the episode list for an AllQuestion.json-driven flow (enterprise /
 * enterprise-client roles). The intake comes from `question_sets.original`
 * phases, the summary from the phase's design_summary question, and the
 * revision loop from `question_sets.revision` phases. Falls back to the
 * legacy Questions.json / CustomQuestions.json flow when no AllQuestion.json
 * path matches the context.
 */
export function buildEpisodesFromContext(
  ctx: FlowContext,
  questionnaires?: Record<string, unknown> | null
): Episode[] {
  const resolved = resolveAllQuestionFlow(ctx, questionnaires);
  
  if (!resolved) {
    const role = normalizeRole(ctx.role);
    const isAllQuestionCtx =
      role === "enterprise" ||
      role === "enterprise-client" ||
      Boolean(ctx.question_sets?.original?.length);

    if (isAllQuestionCtx) {
      return [{
        apiKey: "overview",
        kind: "ready",
        content:
          "To give you an overview of what information I will be gathering so you know what to expect, I will be touching on the following:",
        showChecklist: true,
        options: ["I am ready to proceed  →"],
        editable: false,
      }];
    }
    return buildEpisodes(ctx.work_type ?? undefined, {
      engageDesigner: ctx.engageDesigner ?? undefined,
      dcName: ctx.dcName ?? undefined,
    });
  }

  const { phases, originalPhases, revisionPhases } = resolved;

  // Every AllQuestion flow starts with the overview screen so the user sees
  // the dynamic checklist before answering any questions.
  const episodes: Episode[] = [{
    apiKey: "overview",
    kind: "ready",
    content:
      "To give you an overview of what information I will be gathering so you know what to expect, I will be touching on the following:",
    showChecklist: true,
    options: ["I am ready to proceed  →"],
    editable: false,
  }];
  const summaryParts: string[] = [];

  for (const phaseKey of originalPhases) {
    const phase = phases[phaseKey];
    if (!phase) continue;
    for (const q of phase.questions) {
      if (q.id === "design_summary") {
        if (q.details) summaryParts.push(htmlToDisplay(q.details));
        if (q.example) summaryParts.push(htmlToDisplay(q.example));
        continue;
      }
      if (q.id === "design_direction_approval") continue;
      if (q.is_ai_design) continue; // post-design review — rendered by result cards
      episodes.push(...questionToEpisodes(q));
    }
  }

  // Enterprise landscape-design yard flows gate the two upload cards behind
  // the legacy Yes/No intro questions (photos / files).
  if (shouldGateUploads(ctx)) {
    insertUploadGates(episodes);
  }

  const isCustomEngage =
    Boolean(ctx.engageDesigner) &&
    normalizeWorkType(ctx.work_type ?? "") === "custom";

  if (isCustomEngage) {
    episodes.push(CUSTOM_ENGAGE_CONTINUE_EPISODE);
  } else {
    const fallback = summaryCopyForWorkType(
      ctx.work_type ?? undefined,
      ctx.role ?? undefined,
      questionnaires ?? undefined,
      ctx.user_type ?? undefined,
      ctx.question_sets ?? undefined
    );
    episodes.push({
      apiKey: "summary",
      kind: "summary",
      title: fallback.title || "Design Summary",
      content: summaryParts.filter(Boolean).join("\n\n") || fallback.description || DEFAULT_SUMMARY_TEXT,
    });
  }

  for (const phaseKey of revisionPhases) {
    const phase = phases[phaseKey];
    if (!phase) continue;
    for (const q of phase.questions) {
      if (q.is_ai_design) continue; // revision_approval — rendered by result cards
      // Revision summaries are display questions; some phases omit `type` on
      // the summary marker (revision_design_summary), so treat missing types
      // as display too.
      if (q.type === "display" || !q.type) {
        const fallback = summaryCopyForWorkType(
          ctx.work_type ?? undefined,
          ctx.role ?? undefined,
          questionnaires ?? undefined,
          ctx.user_type ?? undefined,
          ctx.question_sets ?? undefined
        );
        const content =
          [q.details, q.example]
            .filter((s): s is string => Boolean(s))
            .map(htmlToDisplay)
            .join("\n\n") || fallback.description || DEFAULT_SUMMARY_TEXT;
        episodes.push({ apiKey: "revision-summary", kind: "summary", title: fallback.title || "Design Summary", content });
        continue;
      }
      for (const ep of questionToEpisodes(q)) {
        // The canonical revision-comments card keeps the "revision" apiKey so
        // the revision loop (regenerate / make-changes / round ids) works
        // unchanged; other revision-phase questions keep their own ids.
        // Revision questions never enter the intake `original` payload.
        episodes.push({
          ...ep,
          apiKey: ep.apiKey === "revision_comments" ? "revision" : ep.apiKey,
          revisionStep: true,
          api: undefined,
          ...(ep.card ? { card: { ...ep.card, title: "" } } : {}),
        });
      }
    }
  }

  if (
    ctx.engageDesigner &&
    normalizeRole(ctx.role) === "enterprise" &&
    normalizeWorkType(ctx.work_type ?? "") === "custom"
  ) {
    return applyEngageDesigner(episodes, ctx.dcName ?? undefined);
  }
  return episodes;
}

/** The apiKey of the first revision-step episode ("revision" when absent). */
export function revisionApiKey(episodes: Episode[]): string {
  return episodes.find((e) => e.revisionStep)?.apiKey ?? "revision";
}

/**
 * Enterprise landscape yard flows gate their upload cards behind the legacy
 * Yes/No intro questions. Restricting this to the three yard work types keeps
 * custom / value_added_services flows (which the host drives with their own
 * question_sets) unchanged.
 */
const GATED_LANDSCAPE_WORK_TYPES = new Set([
  "front_yard",
  "rear_yard",
  "whole_property",
]);

function shouldGateUploads(ctx: FlowContext): boolean {
  return (
    normalizeRole(ctx.role) === "enterprise" &&
    GATED_LANDSCAPE_WORK_TYPES.has(normalizeWorkType(ctx.work_type ?? ""))
  );
}

/**
 * Insert the Yes/No photo & file intro questions (reusing the legacy
 * EPISODES definitions) immediately before their upload cards.
 */
function insertUploadGates(episodes: Episode[]): void {
  const photosGate = EPISODES.find((e) => e.apiKey === "photos");
  const filesGate = EPISODES.find((e) => e.apiKey === "files");
  const hasPhotos = episodes.some((e) => e.apiKey === "additional_images_upload");
  const hasFiles = episodes.some((e) => e.apiKey === "supporting_files_upload");
  if ((!hasPhotos || !photosGate) && (!hasFiles || !filesGate)) return;

  // Clone gates so we can override checklistId without mutating the shared
  // EPISODES objects. The gate shares the target card's checklistId so
  // answering Yes/No marks the same checklist item as the upload card.
  const photosTarget = episodes.find((e) => e.apiKey === "additional_images_upload");
  const filesTarget = episodes.find((e) => e.apiKey === "supporting_files_upload");
  const clonedPhotos = photosGate && photosTarget
    ? { ...photosGate, checklistId: photosTarget.checklistId }
    : photosGate;
  const clonedFiles = filesGate && filesTarget
    ? { ...filesGate, checklistId: filesTarget.checklistId }
    : filesGate;

  const out: Episode[] = [];
  for (const ep of episodes) {
    if (ep.apiKey === "additional_images_upload" && clonedPhotos) out.push(clonedPhotos);
    if (ep.apiKey === "supporting_files_upload" && clonedFiles) out.push(clonedFiles);
    out.push(ep);
  }
  episodes.splice(0, episodes.length, ...out);
}

/**
 * Convert a question id (e.g. `additional_images_upload`) into a human-readable
 * label (e.g. "Additional images upload") when `name` is missing.
 */
export function formatQuestionIdAsName(id: string): string {
  if (!id) return "";
  const cleaned = id.replace(/[_-]+/g, " ").trim();
  if (!cleaned) return id;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Question-level intake checklist for AllQuestion.json-driven flows; null when
 * the context resolves to the legacy flow (callers fall back to the static
 * lists). Each non-display question in the selected original phases becomes
 * one checklist item, keyed by its question id so completion tracks per-
 * question rather than per-phase.
 */
export function checklistFromFlowContext(
  ctx: FlowContext,
  questionnaires?: Record<string, unknown> | null
): ChecklistItem[] | null {
  const resolved = resolveAllQuestionFlow(ctx, questionnaires);
  if (!resolved) return null;
  const { phases, originalPhases } = resolved;
  const items: ChecklistItem[] = [];
  const seen = new Set<string>();
  for (const key of originalPhases) {
    const phase = phases[key];
    if (!phase) continue;
    for (const q of phase.questions) {
      // Skip display-only markers and approval gates — they aren't questions
      // the user answers, so they shouldn't appear in the checklist.
      if (q.type === "display" || q.id === "design_direction_approval") continue;
      if (seen.has(q.id)) continue;
      seen.add(q.id);
      const label = q.name?.trim() || formatQuestionIdAsName(q.id);
      items.push({ id: q.id, number: items.length + 1, label });
    }
  }
  return items.length > 0 ? items : null;
}

export { EPISODES };

/**
 * Look up an episode by its apiKey. Accepts an optional custom episodes list
 * (from `buildEpisodes()`) so work-type-specific text overrides propagate.
 * Falls back to the static BY_ID map when no list is provided.
 */
export function episodeById(apiKey: string, episodes?: Episode[]): Episode {
  if (apiKey === "custom_engage_continue") {
    return CUSTOM_ENGAGE_CONTINUE_EPISODE;
  }
  if (episodes) {
    const ep = episodes.find((e) => e.apiKey === apiKey);
    if (ep) return ep;
  }
  const ep = BY_ID.get(apiKey);
  if (!ep) throw new Error(`Unknown episode: ${apiKey}`);
  return ep;
}

/**
 * Resolve the next episode apiKey after the user answers the current one.
 * The linear chain is derived from the episodes list order, so the color/
 * material question set routes correctly without a second hardcoded switch.
 * The Yes/No branch points stay explicit — they depend on the answer: Yes
 * opens the upload card right after the intro question, No skips straight to
 * the episode after it (derived from the list, so it works for both the
 * legacy EPISODES and the AllQuestion-driven yard flows).
 */
export function nextEpisodeId(
  apiKey: string,
  answer?: string,
  episodes?: Episode[]
): string {
  const list = episodes ?? EPISODES;
  const idx = list.findIndex((e) => e.apiKey === apiKey);
  const next =
    idx >= 0 && idx < list.length - 1 ? list[idx + 1].apiKey : "summary";
  switch (apiKey) {
    case "photos":
      if (answer === "Yes I do" && idx + 1 < list.length) return list[idx + 1].apiKey;
      if (answer !== "Yes I do" && idx + 2 < list.length) return list[idx + 2].apiKey;
      return "files";
    case "files":
      if (answer === "Yes I do" && idx + 1 < list.length) return list[idx + 1].apiKey;
      if (answer !== "Yes I do" && idx + 2 < list.length) return list[idx + 2].apiKey;
      return "project_goals_or_brief_description";
    default:
      return next;
  }
}

/** Build the assistant Message for an episode. */
export function buildMessage(episode: Episode): Message {
  const cardTitle = episode.card?.title?.trim() ?? "";
  const cardDesc = episode.card?.description ?? "";
  return {
    id: `ep-${episode.apiKey}`,
    role: "assistant",
    content:
      episode.kind === "card" && episode.card
        ? cardTitle || cardDesc
        : episode.content ?? "",
    kind: episode.kind,
    options: episode.options,
    card: episode.card,
    showChecklist: episode.showChecklist,
    checklistId: episode.checklistId,
    ...(episode.title ? { title: episode.title } : {}),
  };
}


export function episodeMessageId(apiKey: string, round?: number): string {
  const base = `ep-${apiKey}`;
  return round === undefined || round <= 1 ? base : `${base}-${round}`;
}

/**
 * Number of revision-comment cards (`ep-revision`, `ep-revision-2`, …) in a
 * transcript. Summaries (`ep-revision-summary[-N]`) are deliberately excluded
 * so the count always reflects how many loop rounds have been started.
 * AllQuestion-driven flows may key their revision cards on a different
 * apiKey (the first `revisionStep` episode); pass it via `apiKey`.
 */
export function countRevisionRounds(
  messages: Pick<Message, "id">[],
  apiKey = "revision"
): number {
  const re = new RegExp(`^ep-${apiKey}-\\d+$`);
  return messages.filter((m) => m.id === `ep-${apiKey}` || re.test(m.id)).length;
}

/** 1-based round of a revision-summary message id; 0 when the id is not one. */
export function revisionRoundFromMessage(messageId: string): number {
  if (messageId === "ep-revision-summary") return 1;
  const match = /^ep-revision-summary-(\d+)$/.exec(messageId);
  if (!match) return 0;
  const round = parseInt(match[1], 10);
  return Number.isFinite(round) ? round : 0;
}

/** A transcript reconstructed from the restored Redux brief items. */
export interface RestoredTranscript {
  messages: Message[];
  /** Restored user-bubble id → episode apiKey (for edit gating). */
  messageEpisodes: Record<string, string>;
  /** checklistId → restored answer text (for summary + Handoff). */
  answers: Record<string, string>;
  /** Where the flow resumes: the next episode the user must answer. */
  currentId: string;
  completed: Set<string>;
}


export function buildRestoredTranscript(
  original: Record<string, ApiBriefItem>,
  entries: EnterpriseEntry[] = [],
  episodes?: Episode[],
  revisionComment: { files: string[]; notes: string } = { files: [], notes: "" },
  options?: { engageDesigner?: boolean; work_type?: string }
): RestoredTranscript {
  const isEmpty = (apiKey: string): boolean => {
    const item = original[apiKey];
    return item === undefined || isAnswerEmpty(item.answer);
  };
  const isAnswered = (apiKey: string): boolean => !isEmpty(apiKey);

  const messages: Message[] = [];
  const messageEpisodes: Record<string, string> = {};
  const answers: Record<string, string> = {};
  const completed = new Set<string>();

  const pushAssistant = (ep: Episode, initialAnswer?: AnswerValue) => {
    const msg = buildMessage(ep);
    msg.isRestored = true;
    if (initialAnswer !== undefined) msg.initialAnswer = initialAnswer;
    messages.push(msg);
  };

  const pushUserAnswer = (ep: Episode, text: string) => {
    const id = `m-restored-${ep.apiKey}`;
    messages.push({ id, role: "user", content: text, isRestored: true });
    messageEpisodes[id] = ep.apiKey;
    if (ep.checklistId) {
      answers[ep.checklistId] = text;
      completed.add(ep.checklistId);
    }
  };

  // The episodes list to walk (falls back to the shared base flow).
  const list = episodes ?? EPISODES;
  const hasEpisode = (key: string) => list.some((e) => e.apiKey === key);

  // Nothing restored → show the flow's opening episode: the overview
  // screen for shared flows, or the first intake card for the
  // overview-less custom flow (which starts directly at its first question).
  const hasEntries = Array.isArray(entries) && entries.length > 0;
  const hasPendingComment =
    Boolean(revisionComment?.notes) ||
    (Array.isArray(revisionComment?.files) && revisionComment.files.length > 0);
  const anyAnswered = Object.values(original).some(
    (item) => item !== undefined && !isAnswerEmpty(item.answer)
  );

  if (!anyAnswered && !hasEntries && !hasPendingComment) {
    const first = list[0];
    return {
      messages: [buildMessage(first)],
      messageEpisodes: {},
      answers: {},
      currentId: first.apiKey,
      completed: new Set(),
    };
  }

  // Fixed intro — only shared flows have the overview screen.
  if (hasEpisode("overview")) {
    pushAssistant(episodeById("overview", episodes));
  }

  let lastId: string | undefined;
  let lastAnswer: string | undefined;
  const advance = (epId: string, answer?: string) => {
    lastId = epId;
    lastAnswer = answer;
  };
  const mark = (ep: Episode, userText: string) => {
    pushAssistant(ep);
    pushUserAnswer(ep, userText);
    advance(ep.apiKey, userText);
  };

  // photos branch: only shared flows have the Yes/No photos step. Reaching a
  // later card implies the user answered it (the flow is linear).
  if (hasEpisode("photos")) {
    const photosEp = episodeById("photos", episodes);
    const photoUploaded = isAnswered("additional_images_upload");
    mark(photosEp, photoUploaded ? "Yes I do" : "No I don't");
    if (photoUploaded) {
      const upEp = episodeById("additional_images_upload", episodes);
      const item = original["additional_images_upload"] as ApiBriefItem;
      pushAssistant(upEp, item?.answer);
      pushUserAnswer(upEp, answerToText(item));
      advance(upEp.apiKey);
    }
  }

  // files branch: only shared flows have the Yes/No files step, and only if
  // the user got past photos (any later key answered). Derived from the
  // episodes list so color-material keys count too.
  const laterKeys = list
    .filter((e) => e.api !== undefined && e.apiKey !== "additional_images_upload")
    .map((e) => e.apiKey);
  if (hasEpisode("files") && laterKeys.some(isAnswered)) {
    const filesEp = episodeById("files", episodes);
    const filesUploaded = isAnswered("supporting_files_upload");
    mark(filesEp, filesUploaded ? "Yes I do" : "No I don't");
    if (filesUploaded) {
      const upEp = episodeById("supporting_files_upload", episodes);
      const item = original["supporting_files_upload"] as ApiBriefItem;
      pushAssistant(upEp, item?.answer);
      pushUserAnswer(upEp, answerToText(item));
      advance(upEp.apiKey);
    }
  }

  // Remaining card episodes, in flow order, only when answered. The upload
  // cards are pushed by the photos/files branches above; in overview-less
  // flows (custom) those branches don't exist, so the upload card is an
  // ordinary flow step and is handled here.
  const skipUploadCards = hasEpisode("photos") || hasEpisode("files");
  for (const ep of list) {
    if (!ep.api) continue;
    const key = ep.apiKey;
    if (skipUploadCards && (key === "additional_images_upload" || key === "supporting_files_upload")) {
      continue;
    }
    if (isAnswered(key)) {
      const item = original[key] as ApiBriefItem;
      pushAssistant(ep, item?.answer);
      pushUserAnswer(ep, answerToText(item));
      advance(ep.apiKey);
    }
  }

  // Resume point — the next episode the user must answer.
  // Marked as restored so it renders immediately (no typewriter re-run on refresh).
  let currentId = lastId
    ? nextEpisodeId(lastId, lastAnswer, episodes)
    : list[0].apiKey;

  const revisionEntries = entries.filter((e) => e.type === "revision");
  // A revision comment exists in the store but hasn't been turned into an
  // entry yet (refresh mid-revision, before the design was regenerated). In
  // that case the revision summary must still be restored, or the user's
  // comments would silently vanish from the transcript.
  // (hasPendingComment was declared above)

  if (currentId === "summary" && (revisionEntries.length > 0 || hasPendingComment)) {
    const summaryMsg = buildMessage(episodeById("summary", episodes));
    summaryMsg.isRestored = true;
    messages.push(summaryMsg);

    // The revision loop's card apiKey — the first revisionStep episode, or the
    // canonical "revision" id for legacy flows.
    const revKey = revisionApiKey(list);

    // One revision round = assistant comment card → user's comment → summary.
    const pushRevisionRound = (round: number, notes: string) => {
      // 1. Assistant revision card
      const revCard = buildMessage(episodeById(revKey, episodes));
      const cardMsgId = episodeMessageId(revKey, round);
      revCard.id = cardMsgId;
      revCard.isRestored = true;
      messages.push(revCard);

      // 2. User revision answer
      const userMsgId = `m-restored-${cardMsgId}`;
      messages.push({
        id: userMsgId,
        role: "user",
        content: notes,
        isRestored: true,
      });
      messageEpisodes[userMsgId] = revKey;

      // 3. Assistant revision summary
      const revSummary = buildMessage(episodeById("revision-summary", episodes));
      const summaryMsgId = episodeMessageId("revision-summary", round);
      revSummary.id = summaryMsgId;
      revSummary.isRestored = true;
      messages.push(revSummary);
    };

    revisionEntries.forEach((entry, idx) => {
      const round = idx + 1;
      const notes = entry.questions[0]?.answer.notes ?? "";
      pushRevisionRound(round, notes);
    });

    // Pending round: restore the un-regenerated comment as the next round so
    // the Revision Summary (with its Generate button) stays visible. Skipped
    // when the current comment is already captured by the last completed
    // round's answer (e.g. an edit of that round, not a new one).
    if (hasPendingComment) {
      const lastAnswer = revisionEntries[revisionEntries.length - 1]?.questions[0]?.answer;
      const alreadyCaptured =
        lastAnswer !== undefined &&
        lastAnswer.notes === revisionComment.notes &&
        JSON.stringify(lastAnswer.files ?? []) ===
          JSON.stringify(revisionComment.files ?? []);
      if (!alreadyCaptured) {
        pushRevisionRound(revisionEntries.length + 1, revisionComment.notes);
      }
    }

    currentId = "revision-summary";
  } else {
    const isCustomEngage =
      Boolean(options?.engageDesigner) &&
      normalizeWorkType(options?.work_type) === "custom";

    if (isCustomEngage && (currentId === "summary" || currentId === "custom_engage_continue")) {
      const resumeMsg = buildMessage(CUSTOM_ENGAGE_CONTINUE_EPISODE);
      resumeMsg.isRestored = true;
      messages.push(resumeMsg);
      currentId = "custom_engage_continue";
    } else {
      const resumeMsg = currentId === "summary"
        ? buildMessage(episodeById("summary", episodes))
        : buildMessage(episodeById(currentId, episodes));
      resumeMsg.isRestored = true;
      messages.push(resumeMsg);
    }
  }

  return { messages, messageEpisodes, answers, currentId, completed };
}
