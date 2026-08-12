import { createAsyncThunk } from "@reduxjs/toolkit";
import type { ApiBriefPayload, RevisionComment } from "../../lib/apiBrief";
import { fetchDesignStatus, submitDesignBrief } from "../../lib/designApi";
import { EnterpriseEntry, EnterpriseQuestion, EnterpriseResponse, EnterpriseStatusResponse } from "./enterpriseType";



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
  // vision_data: EnterpriseVisionData;
  mask_stats: EnterpriseMaskStats;
  structure_warning: string | null;
  repaint_verification: Record<string, unknown>;
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
function buildRevisionQuestion(revision: RevisionComment): EnterpriseQuestion {
  const files = sanitizeRevisionFiles(revision.files);
  const answer: EnterpriseQuestion["answer"] = { notes: revision.notes };
  if (files.length > 0) {
    answer.files = files;
  }
  return { ...REVISION_QUESTION, answer };
}


export const generateEnterpriseDesign = createAsyncThunk<
  EnterpriseEntry,
  ApiBriefPayload,
  { rejectValue: string }
>("enterprise/generateDesign", async (payload, { getState, rejectWithValue }) => {
  const { enterprise } = getState() as EnterpriseThunkState;
  try {
    const result = await submitDesignBrief(payload);
    const data = result.data as EnterpriseResponse;
    // First submission is the "original" design; every later call is a revision.
    const type: EnterpriseEntry["type"] =
      enterprise.entries.length > 0 ? "revision" : "original";
    return {
      id: data.task_id,
      url: data.generatedImage,
      status: data.status ?? "",
      type,
      questions:
        type === "original"
          ? []
          : [buildRevisionQuestion(payload.revision_comment)],
    };
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : "Failed to submit the design brief"
    );
  }
});

//fetch the status based on the task_id 
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
