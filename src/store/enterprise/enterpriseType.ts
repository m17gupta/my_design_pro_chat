import { EnterpriseStatusResult } from "./enterpriseThunk";

 
export interface EnterpriseResponse {
  task_id: string;
  message: string;
  generatedImage: string;
  count: number;
  prompt: string;
  status?: string;
}

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
  url: string;
  status: string;
  type: "original" | "revision";
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