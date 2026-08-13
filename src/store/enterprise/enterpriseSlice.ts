import { createSlice } from "@reduxjs/toolkit";
import {
  fetchEnterpriseStatus,
  generateEnterpriseDesign,
 
} from "./enterpriseThunk";
import { EnterpriseEntry } from "./enterpriseType";


export interface EnterpriseState {
  /** Design history — each entry mirrors one revisonSchema.md array item. */
  entries: EnterpriseEntry[];
  /** Lifecycle of the last `generateEnterpriseDesign`/`fetchEnterpriseStatus` dispatch. */
  lifecycle: "idle" | "loading" | "succeeded" | "failed" | "pending";
  error: string | null;
}

const initialState: EnterpriseState = {
  entries: [],
  lifecycle: "idle",
  error: null,
};

/** The most recently submitted design entry, if any. */
export function selectLatestEnterpriseEntry(
  state: EnterpriseState
): EnterpriseEntry | undefined {
  return state.entries[state.entries.length - 1];
}

const enterpriseSlice = createSlice({
  name: "enterprise",
  initialState,
  reducers: {
    /** Clear the design history (e.g. on Start Over). */
    resetEnterprise() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(generateEnterpriseDesign.pending, (state) => {
        state.lifecycle = "loading";
        state.error = null;
      })
      .addCase(generateEnterpriseDesign.fulfilled, (state, action) => {
        state.lifecycle = "pending";
        state.error = null;
        const entry = action.payload;
     
        const round = action.meta.arg.round;
        if (round !== undefined && round > 0) {
          const revisions = state.entries.filter((e) => e.type === "revision");
          const prev = revisions[round - 1];
          if (prev && prev.status !== "completed") {
            const idx = state.entries.indexOf(prev);
            if (idx >= 0) {
              state.entries[idx] = entry;
              return;
            }
          }
        }
        // Append the freshly-submitted entry to the design history.
        state.entries.push(entry);
      })
      .addCase(generateEnterpriseDesign.rejected, (state, action) => {
        state.lifecycle = "failed";
        state.error = action.payload ?? "Failed to submit the design brief";
        const round = action.meta.arg.round;
        if (round !== undefined && round > 0) {
          const revisions = state.entries.filter((e) => e.type === "revision");
          const prev = revisions[round - 1];
          if (prev) {
            const idx = state.entries.indexOf(prev);
            if (idx >= 0) {
              state.entries.splice(idx, 1);
            }
          }
        } else {
          state.entries.pop();
        }
      })
      .addCase(fetchEnterpriseStatus.fulfilled, (state, action) => {
        // Keep the matching entry in sync with the backend task lifecycle
        // until it reaches a terminal state (completed / failed).
        const entryIdx = state.entries.findIndex((e) => e.id === action.meta.arg);
        if (entryIdx >= 0) {
          const entry = state.entries[entryIdx];
          if (action.payload.status === "failed") {
            // Remove failed revision entry from entries
            if (entry.type === "revision") {
              state.entries.splice(entryIdx, 1);
            } else {
              entry.status = "failed";
            }
          } else {
            entry.status = action.payload.status;
            if (
              action.payload.status === "completed" &&
              action.payload.result?.generated_image_url
            ) {
              entry.url = action.payload.result.generated_image_url;
            }
          }
        }
        if (action.payload.error) {
          state.error = action.payload.error;
        }
        if (action.payload.status === "completed") {
          state.lifecycle = "succeeded";
        } else if (action.payload.status === "failed") {
          state.lifecycle = "failed";
        }
      })
      .addCase(fetchEnterpriseStatus.rejected, (state, action) => {
        state.lifecycle = "failed";
        state.error = action.payload ?? "Failed to fetch design status";
        // Remove failed revision entry from entries if network/API fails
        const entryIdx = state.entries.findIndex((e) => e.id === action.meta.arg);
        if (entryIdx >= 0 && state.entries[entryIdx].type === "revision") {
          state.entries.splice(entryIdx, 1);
        }
      });
  },
});

export const { resetEnterprise } = enterpriseSlice.actions;
export default enterpriseSlice.reducer;
