/**
 * Request payload for POST /api/v1/luna/designer-generate
 */
export interface DesignerGenerateExtra {
  project_id: string;
  view_id: number;
}

export interface DesignerGeneratePayload {
  original_image_url: string;
  prompt: string;
  design_direction: string;
  image_style: string;
  preserve_original: boolean;
  reference_files: string[];
  s3_upload_dir: string;
  extra: DesignerGenerateExtra;
}

/**
 * Architectural & visual facts extracted from the source property photo.
 */
export interface DesignerHouseFacts {
  architecture_style: string;
  wall_materials_and_colors: string;
  trim_colors: string;
  roof: string;
  entry_and_garage_door_colors: string;
  railings: string;
  other_fixed_elements: string;
  [key: string]: unknown;
}

export interface DesignerPalletBefore {
  description: string;
  color: string;
}

/**
 * Individual detected material / plant / hardscape pallet entry returned on completion.
 */
export interface DesignerPallet {
  id: string;
  name: string;
  category: string;
  category_source: string | null;
  source: string | null;
  change_type: "added" | "modified" | "removed" | string | null;
  status: "new" | "modified" | "existing" | string | null;
  image: string | null;
  before_image: string | null;
  details: string | null;
  color: string | null;
  color_name: string | null;
  color_hex: string | null;
  color_hex_source: string | null;
  texture: string | null;
  application: string | null;
  style: string | null;
  brand: string | null;
  brand_source: string | null;
  quantity: number | null;
  region: string | null;
  before: DesignerPalletBefore | null;
  bbox: [number, number, number, number] | null;
  applied: boolean;
  confidence: number | null;
  evidence: string | null;
  unauthorized: boolean;
}

export interface DesignerChangesSummary {
  by_category: Record<string, number>;
  plant_count: number;
  house_changes: string[];
}

/**
 * Full completed result object returned inside `result` from GET /api/v1/tasks/{task_id}.
 */
export interface DesignerGenerateResult {
  task_id: string;
  original_image_url: string;
  preserve_original: boolean;
  pipeline: string | null;
  model: string | null;
  prompt: string;
  brief_used: string;
  brief_conflicts: unknown[];
  house_facts: DesignerHouseFacts | null;
  authorized_components: unknown[];
  pallets: DesignerPallet[];
  pallets_total: number;
  pallets_applied_count: number;
  pallets_warning: string | null;
  preservation_warnings: unknown[];
  unauthorized_changes: unknown[];
  changes_summary: DesignerChangesSummary | null;
  generated_image_url: string;
  [key: string]: unknown;
}

/**
 * Initial response from POST /api/v1/luna/designer-generate.
 */
export interface DesignerGenerateInitResponse {
  status: string;
  result: ({ task_id: string } & Partial<DesignerGenerateResult>) | null;
  error?: string | null;
}

/**
 * Polling response from GET /api/v1/tasks/{task_id}.
 */
export interface DesignerTaskStatusResponse {
  status: string;
  result: DesignerGenerateResult | null;
  error: string | null;
}

export type DesignerTaskLifecycle =
  | "idle"
  | "submitting"
  | "processing"
  | "completed"
  | "failed";

/**
 * Per-version / per-task tracking record stored in Redux.
 */
export interface DesignerTaskItem {
  versionId: string;
  taskId: string | null;
  status: DesignerTaskLifecycle;
  rawStatus: string;
  httpStatus: number | null;
  requestPayload: DesignerGeneratePayload;
  result: DesignerGenerateResult | null;
  rawResponse: DesignerGenerateInitResponse | DesignerTaskStatusResponse | null;
  error: string | null;
  pollCount: number;
  startedAt: number;
  completedAt: number | null;
}

export interface DesignerGenerateState {
  /** Tasks indexed by versionId (supports multiple parallel generations). */
  tasks: Record<string, DesignerTaskItem>;
  /** Ordered list of versionIds for the current/latest batch. */
  taskOrder: string[];
  /** Currently focused versionId / task. */
  activeVersionId: string | null;
  /** Most recently completed generation result. */
  latestResult: DesignerGenerateResult | null;
  /** Last submitted payload (useful for API inspector). */
  lastRequestPayload: DesignerGeneratePayload | null;
  /** HTTP status code of the most recent POST /designer-generate call. */
  lastHttpStatus: number | null;
  /** Last raw JSON response from either POST or GET polling. */
  lastApiResponse: DesignerGenerateInitResponse | DesignerTaskStatusResponse | null;
  /** Overall lifecycle status. */
  lifecycle: DesignerTaskLifecycle;
  /** Top-level error message if submission or polling fails. */
  error: string | null;
}

/**
 * Thunk argument shapes.
 */
export interface SubmitDesignerGenerateArg {
  versionId: string;
  payload: DesignerGeneratePayload;
}

export interface SubmitDesignerGenerateReturn {
  versionId: string;
  taskId: string | null;
  status: string;
  httpStatus: number;
  rawResponse: DesignerGenerateInitResponse;
}

export interface FetchDesignerTaskStatusArg {
  versionId: string;
  taskId: string;
}

export interface FetchDesignerTaskStatusReturn {
  versionId: string;
  taskId: string;
  response: DesignerTaskStatusResponse;
}

export interface GenerateAndPollDesignerArg {
  versionId: string;
  payload: DesignerGeneratePayload;
  pollIntervalMs?: number;
}

export interface GenerateAndPollDesignerReturn {
  versionId: string;
  taskId: string;
  result: DesignerGenerateResult;
  rawResponse: DesignerTaskStatusResponse | DesignerGenerateInitResponse;
}

export function normalizeDesignerStatus(raw: unknown): DesignerTaskLifecycle {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "completed" || s === "succeeded" || s === "success" || s === "done") {
    return "completed";
  }
  if (s === "failed" || s === "error" || s === "cancelled" || s === "canceled") {
    return "failed";
  }
  if (s === "processing" || s === "pending" || s === "queued" || s === "in_progress" || s === "running") {
    return "processing";
  }
  return "processing";
}
