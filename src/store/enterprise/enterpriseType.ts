import type { EnterpriseMaskStats, EnterpriseStatusResult } from "./enterpriseThunk";

 
export interface EnterpriseImageResponse {
  response_type?: "image_generation";
  task_id: string;
  message?: string;
  generatedImage?: string;
  generated_image_url?: string | null;
  count?: number;
  prompt?: string;
  status?: string;
}

export interface EnterpriseTextResponse {
  task_id: null | string;
  response_type: "text_answer";
  answer: string;
}

export interface EnterpriseResultData {
  task_id?: string | null;
  original_image_url?: string | null;
  pipeline?: string | null;
  model?: string | null;
  work_type?: string | null;
  reference_image_urls?: string[];
  vision_data?: unknown;
  mask_stats?: EnterpriseMaskStats | null;
  generated_image_url?: string | null;
  watermark_status?: string | null;
  response_type?: "text_answer" | "image_generation" | string;
  answer?: string;
  message?: string;
  prompt?: string;
  status?: string;
}

export interface EnterpriseEnvelopeResponse {
  status: string;
  result: EnterpriseResultData | null;
  error?: string | null;
}

export type EnterpriseResponse =
  | EnterpriseImageResponse
  | EnterpriseTextResponse
  | EnterpriseEnvelopeResponse;

/** One question attached to a revision entry (see revisonSchema.md). */
export interface EnterpriseQuestion {
  name: string;
  type: string;
  details: string;
  answer: { files?: string[]; notes: string };
}

/** A single design-history entry — mirrors one revisonSchema.md array item. */
export interface EnterpriseEntry {
  id: string;
  task_id?: string | null;
  url: string;
  status: string;
  type: "original" | "revision" | "text_answer";
  response_type?: string;
  answer?: string;
  original_image_url?: string | null;
  generated_image_url?: string | null;
  pipeline?: string | null;
  model?: string | null;
  work_type?: string | null;
  reference_image_urls?: string[];
  vision_data?: unknown;
  mask_stats?: EnterpriseMaskStats | null;
  watermark_status?: string | null;
  questions: EnterpriseQuestion[];
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
/** Text answers occupy revision rounds even though they do not create images. */
export function isRevisionEntry(entry: EnterpriseEntry): boolean {
  return entry.type === "revision" || entry.type === "text_answer";
}
