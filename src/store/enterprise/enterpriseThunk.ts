import { createAsyncThunk } from "@reduxjs/toolkit";
import type { ApiBriefPayload, RevisionComment } from "../../lib/apiBrief";
import { fetchDesignStatus, submitDesignBrief } from "../../lib/designApi";
import { EnterpriseEntry, EnterpriseQuestion, EnterpriseResponse, EnterpriseStatusResponse, normalizeTaskStatus } from "./enterpriseType";



/** Vision-model analysis of the property photo (see status API response). */
export interface EnterpriseVisionData {
  houseHeightPercent: number;
  houseTopPercent: number;
  houseWidthPercent: number;
  architecturalStyle: string;
  rooflineType: string;
  roofShape: string;
  exteriorColors: string[];
  keyFeatures: string[];
  landscapeFeatures: string[];
  hardscapeFeatures: string[];
  preservationNotes: string;
}

/** Mask statistics describing what portion of the image is editable. */
export interface EnterpriseMaskStats {
  size: [number, number];
  editable_ratio: number;
  preserved_ratio: number;
}

/** The `result` block of a completed (or in-flight) generation task. */
export interface EnterpriseStatusResult {
  task_id: string;
  generated_image_url: string | null;
  original_image_url?: string | null;
  work_type?: string | null;
  pipeline?: string | null;
  model?: string | null;
  reference_image_urls?: string[];
  prompt_used_preview?: string;
  prompt_used_full?: string;
  // vision_data: EnterpriseVisionData;
  mask_stats?: EnterpriseMaskStats | null;
  structure_warning?: string | null;
  repaint_verification?: Record<string, unknown>;
  watermark_status?: string | null;
  response_type?: string;
  answer?: string;
}


/** Minimal slice of root state the thunk reads (avoids a circular import). */
interface EnterpriseThunkState {
  enterprise: {
    entries: EnterpriseEntry[];
  };
}

/** Revision-question boilerplate, matching revisonSchema.md exactly. */
const REVISION_QUESTION = {
  name: "Revision Comments",
  type: "files_with_description",
  details:
    "Please share your revision requests, I will incorporate them into the design.",
} as const;

/**
 * Sanitize revision upload URLs: trim each entry, drop empty/whitespace-only
 * values, and dedupe. Used both when building the API entry and when counting
 * files on the UI, so the displayed count always matches what is persisted.
 */
export function sanitizeRevisionFiles(files: string[]): string[] {
  return Array.from(new Set(files.map((f) => f.trim()).filter(Boolean)));
}

/**
 * Build the revision question carried by a `type: "revision"` entry.
 * `answer.notes` comes from the revision feedback text; `answer.files` is
 * included only when image uploads exist (matching revisonSchema.md).
 */
export function buildRevisionQuestion(revision: RevisionComment): EnterpriseQuestion {
  const files = sanitizeRevisionFiles(revision.files);
  const answer: EnterpriseQuestion["answer"] = { notes: revision.notes };
  if (files.length > 0) {
    answer.files = files;
  }
  return { ...REVISION_QUESTION, answer };
}


/**
 * Generate (or regenerate) a design. The thunk arg carries the brief payload
 * plus an optional `round` — the 1-based revision round this generate belongs
 * to. `round` is not persisted on the entry; the slice reads it from
 * `action.meta.arg` to decide whether to replace that round's previous entry.
 */
export const generateEnterpriseDesign = createAsyncThunk<
  EnterpriseEntry,
  { payload: ApiBriefPayload; round?: number },
  { rejectValue: string }
>(
  "enterprise/generateDesign",
  async ({ payload, round }, { getState, rejectWithValue, requestId }) => {
    const { enterprise } = getState() as EnterpriseThunkState;
    try {
      const isRevision = (round !== undefined && round > 0) || enterprise.entries.length > 0;
      const result = await submitDesignBrief(payload, { revision: isRevision });
      const data = result.data as EnterpriseResponse;
      if (!data || typeof data !== "object") throw new Error("Invalid design API response");
      const dataObj = data as unknown as Record<string, unknown>;
      const resultObj =
        dataObj.result && typeof dataObj.result === "object" && !Array.isArray(dataObj.result)
          ? (dataObj.result as Record<string, unknown>)
          : null;

      const responseType = (resultObj?.response_type ?? dataObj.response_type) as string | undefined;

      const rawStatus =
        (typeof dataObj.status === "string" ? dataObj.status : null) ??
        (typeof resultObj?.status === "string" ? resultObj.status : null) ??
        "";
      const normalizedStatus = normalizeTaskStatus(rawStatus);

      if (responseType === "text_answer") {
        const answer = (resultObj?.answer ?? dataObj.answer) as string | undefined;
        const taskId =
          (typeof resultObj?.task_id === "string" && resultObj.task_id.trim() ? resultObj.task_id.trim() : null) ??
          (typeof dataObj.task_id === "string" && dataObj.task_id.trim() ? dataObj.task_id.trim() : null);

        const isProcessing = normalizedStatus === "processing" || normalizedStatus === "queued";

        if (!isRevision) {
          throw new Error("Invalid text answer from the design API");
        }
        if (!isProcessing && !taskId && (typeof answer !== "string" || !answer.trim())) {
          throw new Error("Invalid text answer from the design API");
        }

        const effectiveTaskId = taskId ?? `text-answer-${requestId}`;

        const entryStatus =
          normalizedStatus ||
          (answer ? "completed" : "processing");

        const originalImageUrl =
          (typeof resultObj?.original_image_url === "string" ? resultObj.original_image_url : null) ??
          (typeof dataObj.original_image_url === "string" ? dataObj.original_image_url : null);

        const generatedImageUrl =
          (typeof resultObj?.generated_image_url === "string" ? resultObj.generated_image_url : null) ??
          (typeof dataObj.generated_image_url === "string" ? dataObj.generated_image_url : null) ??
          "";

        return {
          id: effectiveTaskId,
          task_id: taskId,
          type: "text_answer",
          response_type: "text_answer",
          answer: typeof answer === "string" ? answer : "",
          url: generatedImageUrl,
          generated_image_url: typeof resultObj?.generated_image_url === "string" ? resultObj.generated_image_url : null,
          status: entryStatus,
          original_image_url: originalImageUrl,
          pipeline: typeof resultObj?.pipeline === "string" ? resultObj.pipeline : null,
          model: typeof resultObj?.model === "string" ? resultObj.model : null,
          work_type: typeof resultObj?.work_type === "string" ? resultObj.work_type : null,
          reference_image_urls: Array.isArray(resultObj?.reference_image_urls) ? (resultObj.reference_image_urls as string[]) : [],
          vision_data: resultObj?.vision_data ?? null,
          mask_stats: (resultObj?.mask_stats as EnterpriseMaskStats | null) ?? null,
          watermark_status: typeof resultObj?.watermark_status === "string" ? resultObj.watermark_status : null,
          questions: [buildRevisionQuestion(payload.revision_comment)],
        };
      }

      const taskId =
        (typeof resultObj?.task_id === "string" && resultObj.task_id.trim() ? resultObj.task_id.trim() : null) ??
        (typeof dataObj.task_id === "string" && dataObj.task_id.trim() ? dataObj.task_id.trim() : null);

      if (!taskId) {
        throw new Error("The design API did not return a valid task ID");
      }
      // First submission is the "original" design; every later call is a revision.
      const type: EnterpriseEntry["type"] =
        isRevision ? "revision" : "original";

      const generatedImageUrl =
        (typeof resultObj?.generated_image_url === "string" ? resultObj.generated_image_url : null) ??
        (typeof dataObj.generatedImage === "string" ? (dataObj.generatedImage as string) : null) ??
        (typeof dataObj.generated_image_url === "string" ? (dataObj.generated_image_url as string) : null) ??
        "";

      const originalImageUrl =
        (typeof resultObj?.original_image_url === "string" ? resultObj.original_image_url : null) ??
        (typeof dataObj.original_image_url === "string" ? (dataObj.original_image_url as string) : null);

      const status =
        normalizedStatus ||
        (generatedImageUrl ? "completed" : "processing");

      return {
        id: taskId,
        task_id: taskId,
        url: generatedImageUrl,
        generated_image_url: generatedImageUrl || null,
        status,
        type,
        response_type: (resultObj?.response_type ?? dataObj.response_type ?? "image_generation") as string,
        original_image_url: originalImageUrl,
        pipeline: typeof resultObj?.pipeline === "string" ? resultObj.pipeline : null,
        model: typeof resultObj?.model === "string" ? resultObj.model : null,
        work_type: typeof resultObj?.work_type === "string" ? resultObj.work_type : null,
        reference_image_urls: Array.isArray(resultObj?.reference_image_urls) ? (resultObj.reference_image_urls as string[]) : [],
        vision_data: resultObj?.vision_data ?? null,
        mask_stats: (resultObj?.mask_stats as EnterpriseMaskStats | null) ?? null,
        watermark_status: typeof resultObj?.watermark_status === "string" ? resultObj.watermark_status : null,
        questions:
          type === "original"
            ? []
            : [buildRevisionQuestion(payload.revision_comment)],
      };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error
          ? error.message
          : "Failed to submit the design brief"
      );
    }
  }
);

//fetch the status based on the task_id 
export const fetchEnterpriseStatus = createAsyncThunk<
  EnterpriseStatusResponse,
  string,
  { rejectValue: string }
>("enterprise/fetchStatus", async (taskId, { rejectWithValue }) => {
  try {
    const raw = (await fetchDesignStatus(taskId)) as EnterpriseStatusResponse;
    if (raw && typeof raw === "object") {
      return {
        ...raw,
        status: normalizeTaskStatus(raw.status),
      };
    }
    return raw;
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : "Failed to fetch design status"
    );
  }
});
