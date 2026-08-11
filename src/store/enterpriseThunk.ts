import { createAsyncThunk } from "@reduxjs/toolkit";
import { API_QUESTIONS } from "../components/chat/flow";
import type { ApiBriefItem } from "../lib/apiBrief";
import { buildApiPayload } from "../lib/apiBrief";
import { fetchDesignStatus, submitDesignBrief } from "../lib/designApi";

/**
 * Response the FastAPI enterprise endpoint returns after kicking off a
 * design generation (see schema.md). `generatedImage` may be empty until
 * the background task completes; `count`/`prompt` describe the job.
 */
export interface EnterpriseResponse {
  task_id: string;
  message: string;
  generatedImage: string;
  count: number;
  prompt: string;
}

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
  generated_image_url: string;
  work_type: string;
  reference_image_urls: string[];
  prompt_used_preview: string;
  prompt_used_full: string;
  vision_data: EnterpriseVisionData;
  mask_stats: EnterpriseMaskStats;
  structure_warning: string | null;
  repaint_verification: Record<string, unknown>;
}

/**
 * Status poll response from the FastAPI backend
 * (GET /api/v1/luna/status/{task_id}):
 * `status` — e.g. "queued" | "processing" | "completed" | "failed";
 * `result` — null until the task completes; `error` — failure reason.
 */
export interface EnterpriseStatusResponse {
  status: string;
  result: EnterpriseStatusResult | null;
  error: string | null;
}

/** Minimal slice of root state the thunk reads (avoids a circular import). */
interface EnterpriseThunkState {
  chat: {
    watermark: string;
    work_type: string;
    image_url: string;
    original: Record<string, ApiBriefItem>;
  };
}

/**
 * POST the fully-assembled design brief to the FastAPI backend and return
 * the enterprise response (`task_id`, `message`, …). The payload is built
 * from the current store state, so nothing needs to be passed in. Rejects
 * with a message on config/network/HTTP errors.
 */
export const generateEnterpriseDesign = createAsyncThunk<
  EnterpriseResponse,
  void,
  { rejectValue: string }
>("enterprise/generateDesign", async (_, { getState, rejectWithValue }) => {
  const { chat } = getState() as EnterpriseThunkState;
  const payload = buildApiPayload(API_QUESTIONS, chat.original, {
    watermark: chat.watermark,
    work_type: chat.work_type,
    image_url: chat.image_url,
  });
  try {
    const result = await submitDesignBrief(payload);
    return result.data as EnterpriseResponse;
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : "Failed to submit the design brief"
    );
  }
});

/**
 * Poll the status of a design generation task by its `task_id`.
 * Returns the typed `EnterpriseStatusResponse` (`status`, `result`, `error`)
 * or rejects with a message on config/network/HTTP errors.
 */
export const fetchEnterpriseStatus = createAsyncThunk<
  EnterpriseStatusResponse,
  string,
  { rejectValue: string }
>("enterprise/fetchStatus", async (taskId, { rejectWithValue }) => {
  try {
    return (await fetchDesignStatus(taskId)) as EnterpriseStatusResponse;
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : "Failed to fetch design status"
    );
  }
});
