import type { ApiBriefItem } from "../../lib/apiBrief";
import { answerToText, isAnswerEmpty } from "../../lib/briefDisplay";
import type {
  AnswerValue,
  ApiQuestionMeta,
  EpisodeKind,
  Message,
  QuestionCardSpec,
} from "./types";
import type { EnterpriseEntry } from "../../store/enterprise/enterpriseType";
import questionsJson from "../../docs/Questions.json";

export interface Episode {
  /**
   * Single identifier for this step. For API-bound episodes this IS the
   * backend schema key (schema.md), so the chat never re-keys the API.
   */
  apiKey: string;
  kind: EpisodeKind;
  /** Spoken text — unused on card episodes, which render `card.title` instead. */
  content?: string;
  /** Checklist item completed by answering this episode. */
  checklistId?: string;
  options?: string[];
  card?: QuestionCardSpec;
  showChecklist?: boolean;
  /** Whether the user may edit this episode's answer (default true). */
  editable?: boolean;
  /**
   * API-facing metadata — set on card episodes whose answer is sent upstream.
   * `apiKey` lives on the episode itself (omitted here); `question` is the final
   * question string sent to the API (HTML for the two upload steps, plain text
   * elsewhere); keep it in sync with `card.description`.
   */
  api?: Omit<ApiQuestionMeta, "apiKey">;
}

/**
 * The Luna intake flow: welcome → overview → eight question cards
 * (transcribed from design.md) → Design Summary.
 */
const EPISODES: Episode[] = [
  {
    apiKey: "welcome",
    kind: "ready",
    content:
      "Hi! I'm **Luna**, and I'll help get your project started. I'll quickly gather and organize the information your designer, **Brooke Edwards**, will need to review your request and guide you through the next steps.",
    options: ["I am ready to proceed →"],
    editable: false,
  },
  {
    apiKey: "overview",
    kind: "ready",
    content:
      "To give you an overview of what information I will be gathering so you know what to expect, I will be touching on the following:",
    showChecklist: true,
    options: ["Next →"],
    editable: false,
  },
  {
    apiKey: "photos",
    kind: "ready",
    content:
      "First, do you have any additional photo angles of the front yard that you think are helpful for us to see?",
    checklistId: "photos",
    options: ["Yes I do", "No I don't"],
  },
  {
    apiKey: "additional_images_upload",
    kind: "card",
    card: {
      title: "Additional House Photos (Optional)",
      description:
        "Great, your main photo has been received! If you have additional photos of **this same side of your home taken** from different angles, distances, or perspectives (such as closer shots or views from the left or right while still facing this same elevation), please upload them here.\n\nThese additional photos help us better understand your home's architecture and create the most accurate design possible.",
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
    card: {
      title: "Revision Comments",
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

const BY_ID = new Map(EPISODES.map((e) => [e.apiKey, e]));

/**
 * Normalize a work_type value: "front-yard" → "front_yard".
 * @see normalizeWorkType
 */
function normalizeWorkType(workType: string | undefined): string {
  return (workType ?? "front_yard").trim().toLowerCase().replace(/-/g, "_");
}

/** True when the work type selects the color/material question set. */
export function isColorMaterialWorkType(workType: string | undefined): boolean {
  return normalizeWorkType(workType) === "color_material";
}

/**
 * The color/material question set (Questions.json → color-material →
 * color_material). Structurally identical to the landscape flow except the
 * three topic cards — exterior style / primary materials / color preferences
 * replace the landscape style / hardscape / softscape cards. Wording is
 * overlaid from Questions.json by `buildEpisodes`, these defaults only pin
 * the apiKeys, field layouts, and answer shapes.
 */
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

/** Swap the three landscape topic cards for the color/material ones. */
const COLOR_MATERIAL_TOPIC_SWAP: Record<string, Episode> = {
  landscape_design_style_preference: COLOR_MATERIAL_EXTERIOR_STYLE,
  hardscape_material_preferences: COLOR_MATERIAL_PRIMARY_MATERIALS,
  softscape_planting_preferences: COLOR_MATERIAL_COLOR_PREFERENCES,
};

/** The color/material episodes list — same flow, three different topic cards. */
export function buildColorMaterialEpisodes(): Episode[] {
  return EPISODES.map((ep) => COLOR_MATERIAL_TOPIC_SWAP[ep.apiKey] ?? ep);
}

/**
 * The eight API-bound intake questions, in EPISODES (schema) order.
 * `apiKey` is hoisted from the episode itself so the payload keys always
 * match schema.md. Consumed by the design-brief payload builder.
 * @deprecated Use `getApiQuestions(episodes)` when using a dynamic episode list.
 */
export const API_QUESTIONS: ApiQuestionMeta[] = EPISODES.filter(
  (e) => e.api !== undefined
).map((e) => ({ ...(e.api as ApiQuestionMeta), apiKey: e.apiKey }));

/**
 * Return the API questions for a given episodes list (dynamic or static).
 * Replaces the static `API_QUESTIONS` export when using `buildEpisodes()`.
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
 * Collect the override questions for a work type from Questions.json. Searches
 * the `landscape-design` and `color-material` categories (in that order) and
 * merges the `questions` arrays of every phase in the matched work-type
 * section, so overrides are found regardless of which phase a question lives in.
 */
function collectWorkTypeOverrides(workType: string | undefined): QJsonQuestion[] {
  const normalized = normalizeWorkType(workType);
  const root = questionsJson as Record<string, unknown>;

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
 * Build a work-type-specific episodes list by overlaying the question wording
 * from Questions.json onto the shared base EPISODES structure.
 *
 * The apiKeys and field layouts never change — only description / question text
 * is swapped per work type. Falls back to the base EPISODES when no override
 * is found for a given id.
 *
 * Lookup path in Questions.json (work-type keys may use "-" or "_"):
 *   ["landscape-design"][workType][phase*]["questions"]  (landscape variants)
 *   ["color-material"][workType][phase*]["questions"]     (exterior variants)
 *
 * @param workType  The `work_type` from the URL params (e.g. "front_yard",
 *                  "front-yard", "rear_yard", "color-material").
 */
export function buildEpisodes(workType: string | undefined): Episode[] {
  const overrides = collectWorkTypeOverrides(workType);
  if (overrides.length === 0) {
    // No overrides found — return the base episodes unchanged.
    return EPISODES;
  }

  // color-material swaps the three topic cards; landscape variants (front
  // yard / rear yard / whole property / …) keep the base EPISODES structure.
  const base = isColorMaterialWorkType(workType)
    ? buildColorMaterialEpisodes()
    : EPISODES;

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

export { EPISODES };

/**
 * Look up an episode by its apiKey. Accepts an optional custom episodes list
 * (from `buildEpisodes()`) so work-type-specific text overrides propagate.
 * Falls back to the static BY_ID map when no list is provided.
 */
export function episodeById(apiKey: string, episodes?: Episode[]): Episode {
  if (episodes) {
    const ep = episodes.find((e) => e.apiKey === apiKey);
    if (!ep) throw new Error(`Unknown episode: ${apiKey}`);
    return ep;
  }
  const ep = BY_ID.get(apiKey);
  if (!ep) throw new Error(`Unknown episode: ${apiKey}`);
  return ep;
}

/**
 * Resolve the next episode apiKey after the user answers the current one.
 * The linear chain is derived from the episodes list order, so the color/
 * material question set routes correctly without a second hardcoded switch.
 * The two Yes/No branch points stay explicit — they depend on the answer.
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
      return answer === "Yes I do" ? "additional_images_upload" : "files";
    case "files":
      return answer === "Yes I do"
        ? "supporting_files_upload"
        : "project_goals_or_brief_description";
    default:
      return next;
  }
}

/** Build the assistant Message for an episode. */
export function buildMessage(episode: Episode): Message {
  return {
    id: `ep-${episode.apiKey}`,
    role: "assistant",
    content:
      episode.kind === "card" && episode.card
        ? episode.card.title
        : episode.content ?? "",
    kind: episode.kind,
    options: episode.options,
    card: episode.card,
    showChecklist: episode.showChecklist,
    checklistId: episode.checklistId,
  };
}

/**
 * Canonical message id for an episode. Round 1 keeps the base id
 * (`ep-revision`, `ep-revision-summary`); later rounds get a counter suffix
 * (`ep-revision-2`, `ep-revision-summary-2`, …) so every loop iteration of
 * the revision flow renders as a distinct message in the transcript.
 */
export function episodeMessageId(apiKey: string, round?: number): string {
  const base = `ep-${apiKey}`;
  return round === undefined || round <= 1 ? base : `${base}-${round}`;
}

/**
 * Number of revision-comment cards (`ep-revision`, `ep-revision-2`, …) in a
 * transcript. Summaries (`ep-revision-summary[-N]`) are deliberately excluded
 * so the count always reflects how many loop rounds have been started.
 */
export function countRevisionRounds(messages: Pick<Message, "id">[]): number {
  return messages.filter(
    (m) => m.id === "ep-revision" || /^ep-revision-\d+$/.test(m.id)
  ).length;
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
  revisionComment: { files: string[]; notes: string } = { files: [], notes: "" }
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

  // Nothing restored → a fresh welcome screen, exactly like today.
  const anyAnswered = Object.values(original).some(
    (item) => item !== undefined && !isAnswerEmpty(item.answer)
  );
  if (!anyAnswered) {
    return {
      messages: [buildMessage(episodeById("welcome", episodes))],
      messageEpisodes: {},
      answers: {},
      currentId: "welcome",
      completed: new Set(),
    };
  }

  // Fixed intro
  pushAssistant(episodeById("welcome", episodes));
  pushAssistant(episodeById("overview", episodes));

  let lastId = "overview";
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

  // photos branch: shown whenever any question was answered (the flow is
  // linear, so reaching a later card implies the user answered this one).
  const photosEp = episodeById("photos", episodes);
  const photoUploaded = isAnswered("additional_images_upload");
  mark(photosEp, photoUploaded ? "Yes I do" : "No I don't");
  if (photoUploaded) {
    const upEp = episodeById("additional_images_upload", episodes);
    const item = original["additional_images_upload"] as ApiBriefItem;
    pushAssistant(upEp, item?.answer);      pushUserAnswer(upEp, answerToText(item));
      advance(upEp.apiKey);
  }

  // files branch: only if the user got past photos (any later key answered).
  // Derived from the episodes list so color-material keys count too.
  const laterKeys = (episodes ?? EPISODES)
    .filter((e) => e.api !== undefined && e.apiKey !== "additional_images_upload")
    .map((e) => e.apiKey);
  if (laterKeys.some(isAnswered)) {
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

  // Remaining card episodes, in flow order, only when answered.
  for (const ep of episodes ?? EPISODES) {
    if (!ep.api) continue;
    const key = ep.apiKey;
    if (key === "additional_images_upload" || key === "supporting_files_upload") {
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
  let currentId = nextEpisodeId(lastId, lastAnswer, episodes);

  const revisionEntries = entries.filter((e) => e.type === "revision");
  // A revision comment exists in the store but hasn't been turned into an
  // entry yet (refresh mid-revision, before the design was regenerated). In
  // that case the revision summary must still be restored, or the user's
  // comments would silently vanish from the transcript.
  const hasPendingComment =
    revisionComment.notes !== "" ||
    (revisionComment.files && revisionComment.files.length > 0);

  if (currentId === "summary" && (revisionEntries.length > 0 || hasPendingComment)) {
    const summaryMsg = buildMessage(episodeById("summary", episodes));
    summaryMsg.isRestored = true;
    messages.push(summaryMsg);

    // One revision round = assistant comment card → user's comment → summary.
    const pushRevisionRound = (round: number, notes: string) => {
      // 1. Assistant revision card
      const revCard = buildMessage(episodeById("revision", episodes));
      const cardMsgId = episodeMessageId("revision", round);
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
      messageEpisodes[userMsgId] = "revision";

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
    const resumeMsg = currentId === "summary"
      ? buildMessage(episodeById("summary", episodes))
      : buildMessage(episodeById(currentId, episodes));
    resumeMsg.isRestored = true;
    messages.push(resumeMsg);
  }

  return { messages, messageEpisodes, answers, currentId, completed };
}
