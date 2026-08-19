import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { PersistenceState } from "./persistenceType";
import {
  deleteProject,
  hydrateProject,
  saveProject,
} from "./persistenceThunk";


const initialState: PersistenceState = {
  luna_data:null,
  projectId: null,
  hydrated: false,
  saving: false,
  lastSavedAt: null,
  isfetched:false,
  error: null,
};

const persistenceSlice = createSlice({
  name: "persistence",
  initialState,
  reducers: {
    /** Mark hydration done without a DB lookup (e.g. no project id in URL). */
    hydrationSkipped(state) {
      state.hydrated = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(hydrateProject.pending, (state) => {
        state.hydrated = false;
        state.error = null;
      })
      .addCase(hydrateProject.fulfilled, (state, action) => {
        state.projectId = action.payload.projectId;
        // state.luna_data = action.payload;
        state.hydrated = true;
        state.error = null;
      })
      .addCase(hydrateProject.rejected, (state, action) => {
        // Never block the chat on a DB failure — restore is best-effort.
        state.hydrated = true;
        state.error = action.payload || "Failed to restore project";
      })
      .addCase(saveProject.pending, (state) => {
        state.saving = true;
      })
      .addCase(saveProject.fulfilled, (state, action) => {
        state.saving = false;
        state.lastSavedAt = action.payload.savedAt;
        state.error = null;
      })
      .addCase(saveProject.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload || "Failed to save project";
      })
      .addCase(deleteProject.fulfilled, (state, action) => {
        state.saving = false;
      })
      .addCase(deleteProject.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload ?? "Failed to delete project";
      });
  },
});

export const { hydrationSkipped } = persistenceSlice.actions;
export default persistenceSlice.reducer;
