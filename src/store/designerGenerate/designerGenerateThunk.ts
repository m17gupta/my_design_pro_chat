import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  normalizeDesignerStatus,
  type DesignerGenerateInitResponse,
  type DesignerGenerateResult,
  type DesignerTaskStatusResponse,
  type FetchDesignerTaskStatusArg,
  type FetchDesignerTaskStatusReturn,
  type GenerateAndPollDesignerArg,
  type GenerateAndPollDesignerReturn,
  type SubmitDesignerGenerateArg,
  type SubmitDesignerGenerateReturn,
} from "./designerGenerateType";

export const DESIGNER_GENERATE_ENDPOINT = "/api/designer-generate";
export const DESIGNER_TASK_STATUS_BASE = "/api/designer-generate/tasks";

const DEFAULT_POLL_INTERVAL_MS = 15_000;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Polling aborted"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("Polling aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function extractErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj.error === "string" && obj.error.trim()) return obj.error.trim();
    if (typeof obj.detail === "string" && obj.detail.trim()) return obj.detail.trim();
    if (typeof obj.message === "string" && obj.message.trim()) return obj.message.trim();
  }
  return fallback;
}

/**
 * POST /api/designer-generate -> proxies to ${DESIGN_API_URL}/api/v1/luna/designer-generate
 */
export const submitDesignerGenerate = createAsyncThunk<
  SubmitDesignerGenerateReturn,
  SubmitDesignerGenerateArg,
  { rejectValue: { versionId: string; message: string; httpStatus?: number; rawResponse?: unknown } }
>(
  "designerGenerate/submit",
  async ({ versionId, payload }, { rejectWithValue, signal }) => {
    const url = DESIGNER_GENERATE_ENDPOINT;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          accept: "*/*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal,
      });

      const data = (await res.json().catch(() => ({}))) as DesignerGenerateInitResponse;

      if (!res.ok) {
        return rejectWithValue({
          versionId,
          httpStatus: res.status,
          rawResponse: data,
          message: extractErrorMessage(data, `Designer generate API error (HTTP ${res.status})`),
        });
      }

      const taskId =
        typeof data?.result?.task_id === "string" && data.result.task_id.trim()
          ? data.result.task_id.trim()
          : null;

      return {
        versionId,
        taskId,
        status: data?.status ?? "processing",
        httpStatus: res.status,
        rawResponse: data,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error submitting designer generate";
      return rejectWithValue({ versionId, message });
    }
  }
);

/**
 * GET /api/designer-generate/tasks/{task_id} -> proxies to ${DESIGN_API_URL}/api/v1/tasks/{task_id}
 */
export const fetchDesignerTaskStatus = createAsyncThunk<
  FetchDesignerTaskStatusReturn,
  FetchDesignerTaskStatusArg,
  { rejectValue: { versionId: string; taskId: string; message: string } }
>(
  "designerGenerate/fetchTaskStatus",
  async ({ versionId, taskId }, { rejectWithValue, signal }) => {
    const url = `${DESIGNER_TASK_STATUS_BASE}/${encodeURIComponent(taskId)}`;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          accept: "*/*",
        },
        cache: "no-store",
        signal,
      });

      const data = (await res.json().catch(() => ({}))) as DesignerTaskStatusResponse;

      if (!res.ok) {
        return rejectWithValue({
          versionId,
          taskId,
          message: extractErrorMessage(data, `Task status API error (HTTP ${res.status})`),
        });
      }

      return {
        versionId,
        taskId,
        response: data,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error polling task status";
      return rejectWithValue({ versionId, taskId, message });
    }
  }
);

/**
 * Orchestrator thunk:
 * 1. Calls POST /api/v1/luna/designer-generate
 * 2. If status is "processing", polls GET /api/v1/tasks/{task_id} until status === "completed"
 * 3. Resolves with the completed DesignerGenerateResult (and updates the slice at every step)
 */
export const generateAndPollDesignerDesign = createAsyncThunk<
  GenerateAndPollDesignerReturn,
  GenerateAndPollDesignerArg,
  { rejectValue: { versionId: string; taskId?: string | null; message: string } }
>(
  "designerGenerate/generateAndPoll",
  async (
    { versionId, payload, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS },
    { dispatch, rejectWithValue, signal }
  ) => {
    // Step 1: Submit generation request
    const submitAction = await dispatch(submitDesignerGenerate({ versionId, payload }));
      console.log("submitAction0000",submitAction)
    if (submitDesignerGenerate.rejected.match(submitAction)) {
      return rejectWithValue({
        versionId,
        message: submitAction.payload?.message ?? submitAction.error.message ?? "Failed to start generation",
      });
    }

    const { taskId, status, rawResponse } = submitAction.payload;
    const normalizedInitial = normalizeDesignerStatus(status);

    // Handle immediate completion if backend ever returns completed synchronously
    if (
      normalizedInitial === "completed" &&
      rawResponse.result &&
      typeof rawResponse.result.generated_image_url === "string"
    ) {
      return {
        versionId,
        taskId: taskId ?? rawResponse.result.task_id,
        result: rawResponse.result as DesignerGenerateResult,
        rawResponse,
      };
    }

    if (normalizedInitial === "failed") {
      return rejectWithValue({
        versionId,
        taskId,
        message: extractErrorMessage(rawResponse, `Generation failed with status: ${status}`),
      });
    }

    if (!taskId) {
      return rejectWithValue({
        versionId,
        message: "Designer generate API did not return a task_id",
      });
    }

    // Step 2: Poll GET /api/v1/tasks/{task_id} while status is processing (no timeout)
    while (!signal.aborted) {
      try {
        await sleep(pollIntervalMs, signal);
      } catch {
        return rejectWithValue({
          versionId,
          taskId,
          message: "Polling aborted",
        });
      }

      const pollAction = await dispatch(fetchDesignerTaskStatus({ versionId, taskId }));

      if (fetchDesignerTaskStatus.rejected.match(pollAction)) {
        return rejectWithValue({
          versionId,
          taskId,
          message: pollAction.payload?.message ?? pollAction.error.message ?? "Status polling failed",
        });
      }

      const taskResponse = pollAction.payload.response;
      const normalizedPoll = normalizeDesignerStatus(taskResponse.status);

      if (normalizedPoll === "completed") {
        if (!taskResponse.result) {
          return rejectWithValue({
            versionId,
            taskId,
            message: "Task completed without a result payload",
          });
        }
        return {
          versionId,
          taskId,
          result: taskResponse.result,
          rawResponse: taskResponse,
        };
      }

      if (normalizedPoll === "failed") {
        return rejectWithValue({
          versionId,
          taskId,
          message:
            taskResponse.error ??
            `Task ${taskId} ended with status: ${taskResponse.status}`,
        });
      }
    }

    return rejectWithValue({
      versionId,
      taskId,
      message: "Polling aborted",
    });
  }
);
