import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  fetchDesignerTaskStatus,
  generateAndPollDesignerDesign,
  submitDesignerGenerate,
} from "./designerGenerateThunk";
import {
  normalizeDesignerStatus,
  type DesignerGenerateState,
  type DesignerTaskItem,
} from "./designerGenerateType";

const initialState: DesignerGenerateState = {
  tasks: {},
  taskOrder: [],
  activeVersionId: null,
  latestResult: null,
  lastRequestPayload: null,
  lastHttpStatus: null,
  lastApiResponse: null,
  lifecycle: "idle",
  error: null,
};

function recomputeLifecycle(tasks: Record<string, DesignerTaskItem>): DesignerGenerateState["lifecycle"] {
  const items = Object.values(tasks);
  if (items.length === 0) return "idle";
  if (items.some((t) => t.status === "submitting")) return "submitting";
  if (items.some((t) => t.status === "processing")) return "processing";
  if (items.some((t) => t.status === "completed")) return "completed";
  if (items.every((t) => t.status === "failed")) return "failed";
  return "idle";
}

const designerGenerateSlice = createSlice({
  name: "designerGenerate",
  initialState,
  reducers: {
    resetDesignerGenerate() {
      return initialState;
    },
    setActiveDesignerVersionId(state, action: PayloadAction<string | null>) {
      state.activeVersionId = action.payload;
    },
    clearDesignerError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // POST /api/v1/luna/designer-generate
      .addCase(submitDesignerGenerate.pending, (state, action) => {
        const { versionId, payload } = action.meta.arg;
        state.lastRequestPayload = payload;
        state.error = null;

        state.tasks[versionId] = {
          versionId,
          taskId: null,
          status: "submitting",
          rawStatus: "submitting",
          httpStatus: null,
          requestPayload: payload,
          result: null,
          rawResponse: null,
          error: null,
          pollCount: 0,
          startedAt: Date.now(),
          completedAt: null,
        };

        if (!state.taskOrder.includes(versionId)) {
          state.taskOrder.push(versionId);
        }
        if (!state.activeVersionId) {
          state.activeVersionId = versionId;
        }
        state.lifecycle = recomputeLifecycle(state.tasks);
      })
      .addCase(submitDesignerGenerate.fulfilled, (state, action) => {
        const { versionId, taskId, status, httpStatus, rawResponse } = action.payload;
        const normalized = normalizeDesignerStatus(status);

        state.lastHttpStatus = httpStatus;
        state.lastApiResponse = rawResponse;

        const existing = state.tasks[versionId];
        if (existing) {
          existing.taskId = taskId;
          existing.status = normalized;
          existing.rawStatus = status;
          existing.httpStatus = httpStatus;
          existing.rawResponse = rawResponse;

          if (normalized === "completed" && rawResponse.result?.generated_image_url) {
            existing.result = rawResponse.result as DesignerTaskItem["result"];
            existing.completedAt = Date.now();
            state.latestResult = existing.result;
          } else if (normalized === "failed") {
            existing.error = rawResponse.error ?? `Generation failed (${status})`;
            state.error = existing.error;
          }
        }

        state.lifecycle = recomputeLifecycle(state.tasks);
      })
      .addCase(submitDesignerGenerate.rejected, (state, action) => {
        const versionId = action.payload?.versionId ?? action.meta.arg.versionId;
        const message = action.payload?.message ?? action.error.message ?? "Failed to submit generation";

        if (action.payload?.httpStatus !== undefined) {
          state.lastHttpStatus = action.payload.httpStatus;
        }
        if (action.payload?.rawResponse) {
          state.lastApiResponse = action.payload.rawResponse as DesignerGenerateState["lastApiResponse"];
        }

        const existing = state.tasks[versionId];
        if (existing) {
          existing.status = "failed";
          existing.rawStatus = "failed";
          existing.httpStatus = action.payload?.httpStatus ?? existing.httpStatus;
          existing.error = message;
          existing.completedAt = Date.now();
        }

        state.error = message;
        state.lifecycle = recomputeLifecycle(state.tasks);
      })

      // GET /api/v1/tasks/{task_id}
      .addCase(fetchDesignerTaskStatus.fulfilled, (state, action) => {
        const { versionId, taskId, response } = action.payload;
        const normalized = normalizeDesignerStatus(response.status);

        state.lastApiResponse = response;

        const existing = state.tasks[versionId];
        if (existing) {
          existing.taskId = existing.taskId ?? taskId;
          existing.pollCount += 1;
          existing.rawStatus = response.status;
          existing.status = normalized;
          existing.rawResponse = response;

          if (normalized === "completed" && response.result) {
            existing.result = response.result;
            existing.error = null;
            existing.completedAt = Date.now();
            state.latestResult = response.result;
            state.error = null;
          } else if (normalized === "failed") {
            existing.error = response.error ?? `Task ended with status: ${response.status}`;
            existing.completedAt = Date.now();
            state.error = existing.error;
          }
        }

        state.lifecycle = recomputeLifecycle(state.tasks);
      })
      .addCase(fetchDesignerTaskStatus.rejected, (state, action) => {
        const versionId = action.payload?.versionId ?? action.meta.arg.versionId;
        const message = action.payload?.message ?? action.error.message ?? "Failed to fetch task status";

        const existing = state.tasks[versionId];
        if (existing) {
          existing.status = "failed";
          existing.rawStatus = "failed";
          existing.error = message;
          existing.completedAt = Date.now();
        }

        state.error = message;
        state.lifecycle = recomputeLifecycle(state.tasks);
      })

      // Orchestrator thunk
      .addCase(generateAndPollDesignerDesign.fulfilled, (state, action) => {
        const { versionId, taskId, result, rawResponse } = action.payload;
        const existing = state.tasks[versionId];
        if (existing) {
          existing.taskId = taskId;
          existing.status = "completed";
          existing.rawStatus = "completed";
          existing.result = result;
          existing.rawResponse = rawResponse;
          existing.error = null;
          existing.completedAt = existing.completedAt ?? Date.now();
        }
        state.latestResult = result;
        state.lastApiResponse = rawResponse;
        state.error = null;
        state.lifecycle = recomputeLifecycle(state.tasks);
      })
      .addCase(generateAndPollDesignerDesign.rejected, (state, action) => {
        const versionId = action.payload?.versionId ?? action.meta.arg.versionId;
        const message = action.payload?.message ?? action.error.message ?? "Designer generation failed";
        const existing = state.tasks[versionId];
        if (existing && existing.status !== "failed") {
          existing.status = "failed";
          existing.rawStatus = "failed";
          existing.error = message;
          existing.completedAt = Date.now();
        }
        state.error = message;
        state.lifecycle = recomputeLifecycle(state.tasks);
      });
  },
});

export const {
  resetDesignerGenerate,
  setActiveDesignerVersionId,
  clearDesignerError,
} = designerGenerateSlice.actions;

export const selectDesignerTasks = (state: { designerGenerate: DesignerGenerateState }) =>
  state.designerGenerate.tasks;
export const selectDesignerTaskByVersionId =
  (versionId: string) => (state: { designerGenerate: DesignerGenerateState }) =>
    state.designerGenerate.tasks[versionId] ?? null;
export const selectLatestDesignerResult = (state: { designerGenerate: DesignerGenerateState }) =>
  state.designerGenerate.latestResult;
export const selectDesignerPallets = (state: { designerGenerate: DesignerGenerateState }) =>
  state.designerGenerate.latestResult?.pallets ?? [];
export const selectDesignerLifecycle = (state: { designerGenerate: DesignerGenerateState }) =>
  state.designerGenerate.lifecycle;
export const selectDesignerError = (state: { designerGenerate: DesignerGenerateState }) =>
  state.designerGenerate.error;
export const selectDesignerLastHttpStatus = (state: { designerGenerate: DesignerGenerateState }) =>
  state.designerGenerate.lastHttpStatus;
export const selectDesignerLastApiResponse = (state: { designerGenerate: DesignerGenerateState }) =>
  state.designerGenerate.lastApiResponse;

export default designerGenerateSlice.reducer;
