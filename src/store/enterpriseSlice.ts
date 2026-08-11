import { createSlice } from "@reduxjs/toolkit";
import {
  fetchEnterpriseStatus,
  generateEnterpriseDesign,
  type EnterpriseResponse,
  type EnterpriseStatusResult,
} from "./enterpriseThunk";

/**
 * Enterprise design-generation state. Mirrors the FastAPI response model:
 * `task_id`/`message` are returned immediately; `generatedImage` fills in
 * when the background task completes (or is polled later).
 */
export interface EnterpriseState extends EnterpriseResponse {
  /** Lifecycle of the last `generateEnterpriseDesign` dispatch. */
  status: "idle" | "loading" | "succeeded" | "failed" | "pending";
  error: string | null;
  /** Task lifecycle from the status endpoint: queued | processing | completed | failed. */
  taskStatus: string;
  /** Full status `result` block (null until the task completes). */
  result: EnterpriseStatusResult | null;
}

const initialState: EnterpriseState = {
  task_id: "",
  message: "",
  generatedImage: "",
  count: 0,
  prompt: "",
  status: "idle",
  error: null,
  taskStatus: "",
  result: null,
};

const enterpriseSlice = createSlice({
  name: "enterprise",
  initialState,
  reducers: {
    /** Clear the last generation result (e.g. on Start Over). */
    resetEnterprise() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(generateEnterpriseDesign.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(generateEnterpriseDesign.fulfilled, (state, action) => {
        state.status = "pending";
        state.error = null;
        state.task_id = action.payload.task_id;
        state.message = action.payload.message;
        state.generatedImage = action.payload.generatedImage;
        state.count = action.payload.count;
        state.prompt = action.payload.prompt;
        // Fresh submission — clear any status from a previous task.
        state.taskStatus = "";
        state.result = null;
      })
      .addCase(generateEnterpriseDesign.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? "Failed to submit the design brief";
      })
      .addCase(fetchEnterpriseStatus.fulfilled, (state, action) => {
        // Keep the store in sync with the backend task lifecycle until it
        // reaches a terminal state (completed / failed).
        state.taskStatus = action.payload.status;
        state.result = action.payload.result;
        if (action.payload.error) {
          state.error = action.payload.error;
        }
        if (action.payload.status === "completed") {
          state.status = "succeeded";
          if (action.payload.result?.generated_image_url) {
            state.generatedImage = action.payload.result.generated_image_url;
          }
        } else if (action.payload.status === "failed") {
          state.status = "failed";
        }
      })
      .addCase(fetchEnterpriseStatus.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? "Failed to fetch design status";
      });
  },
});

export const { resetEnterprise } = enterpriseSlice.actions;
export default enterpriseSlice.reducer;
