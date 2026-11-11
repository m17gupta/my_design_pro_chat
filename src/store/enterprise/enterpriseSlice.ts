import { EnterpriseEntry, isRevisionEntry, normalizeTaskStatus } from "./enterpriseType";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  buildRevisionQuestion,
  fetchEnterpriseStatus,
  generateEnterpriseDesign,
  type EnterpriseMaskStats,
} from "./enterpriseThunk";


export interface EnterpriseState {
  /** Design history — each entry mirrors one revisonSchema.md array item. */
  entries: EnterpriseEntry[];
  /** Lifecycle of the last `generateEnterpriseDesign`/`fetchEnterpriseStatus` dispatch. */
  lifecycle: "idle" | "loading" | "succeeded" | "failed" | "pending";
  error: string | null;
  editId: string | null;
  isSkipped?: boolean;
}

const initialState: EnterpriseState = {
  entries: [],
  lifecycle: "idle",
  error: null,
  editId: null,
  isSkipped: false,
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
    /** Replace the design history (used when restoring a project from the DB). */
    setEntries(state, action: PayloadAction<EnterpriseEntry[]>) {
      state.entries = action.payload;
      state.lifecycle = "idle";
      state.error = null;
    },
    setEditId(state, action: PayloadAction<string | null>) {
      state.editId = action.payload;
    }, 
    resetEditId(state) {
      state.editId = null;
    },
    setIsSkipped(state, action: PayloadAction<boolean>) {
      state.isSkipped = action.payload;
      if (action.payload) {
        state.lifecycle = "idle";
      }
    },
    removeFailedRevision(state, action: PayloadAction<{ round?: number; id?: string } | undefined>) {
      const round = action?.payload?.round;
      const id = action?.payload?.id;
      if (id) {
        state.entries = state.entries.filter((e) => e.id !== id);
      } else if (round !== undefined && round > 0) {
        const revisions = state.entries.filter((e) => isRevisionEntry(e));
        const target = revisions[round - 1];
        if (target) {
          state.entries = state.entries.filter((e) => e !== target);
        }
      }
      state.entries = state.entries.filter(
        (e) => !e.id.startsWith("pending-revision-") && (!isRevisionEntry(e) || e.status !== "failed")
      );
      state.lifecycle = "idle";
      state.error = null;
    },
    /**
     * Apply a task status update received via WebSocket (task:status event).
     * This mirrors the fetchEnterpriseStatus.fulfilled logic but is dispatched
     * synchronously by the useTaskSocket hook — no HTTP round-trip needed.
     */
    applyWsTaskStatus(
      state,
      action: PayloadAction<{
        task_id: string;
        status: string;
        result: {
          generated_image_url?: string;
          original_image_url?: string;
          response_type?: string;
          answer?: string;
          watermark_status?: string | null;
          pipeline?: string;
          model?: string;
          work_type?: string;
          mask_stats?: EnterpriseMaskStats | null;
          [key: string]: unknown;
        } | null;
        error: string | null;
      }>
    ) {
      const { task_id, result, error } = action.payload;
      const normalizedStatus = normalizeTaskStatus(action.payload.status);
      const entryIdx = state.entries.findIndex(
        (e) => e.id === task_id || (e.task_id && e.task_id === task_id)
      );
      if (entryIdx >= 0) {
        const entry = state.entries[entryIdx];
        if (normalizedStatus === "failed") {
          if (isRevisionEntry(entry)) {
            state.entries.splice(entryIdx, 1);
          } else {
            entry.status = "failed";
          }
        } else {
          entry.status = normalizedStatus;
          if (result) {
            if (result.generated_image_url) {
              entry.url = result.generated_image_url;
              entry.generated_image_url = result.generated_image_url;
            }
            if (result.original_image_url) {
              entry.original_image_url = result.original_image_url;
            }
            if (result.response_type === "text_answer" || result.answer) {
              entry.type = "text_answer";
              entry.response_type = "text_answer";
              if (result.answer) entry.answer = result.answer;
            }
            if (result.watermark_status) entry.watermark_status = result.watermark_status;
            if (result.pipeline) entry.pipeline = result.pipeline;
            if (result.model) entry.model = result.model;
            if (result.work_type) entry.work_type = result.work_type;
            if (result.mask_stats) entry.mask_stats = result.mask_stats;
          }
        }
      }
      if (normalizedStatus === "completed") {
        state.error = null;
        state.lifecycle = "succeeded";
      } else if (normalizedStatus === "failed") {
        state.error = error ?? "Design generation failed";
        state.lifecycle = "failed";
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(generateEnterpriseDesign.pending, (state, action) => {
        state.lifecycle = "loading";
        state.error = null;

        const { payload, round } = action.meta.arg;
        const hasCompletedOriginal = state.entries.some(
          (e) => e.type === "original" && normalizeTaskStatus(e.status) === "completed"
        );
        const isRevision =
          (round !== undefined && round > 0) || hasCompletedOriginal;

        if (isRevision) {
          const revisionQuestion = buildRevisionQuestion(payload.revision_comment);
          const pendingEntry: EnterpriseEntry = {
            id: `pending-revision-${round ?? Date.now()}`,
            url: "",
            status: "pending",
            type: "revision",
            questions: [revisionQuestion],
          };

          if (round !== undefined && round > 0) {
            const revisions = state.entries.filter((e) => isRevisionEntry(e));
            const prev = revisions[round - 1];
            if (prev && prev.status !== "completed") {
              const idx = state.entries.indexOf(prev);
              if (idx >= 0) {
                state.entries[idx] = pendingEntry;
                return;
              }
            }
          }

          const pendingIdx = state.entries.findIndex((e) =>
            e.id.startsWith("pending-revision-")
          );
          if (pendingIdx >= 0) {
            state.entries[pendingIdx] = pendingEntry;
          } else {
            state.entries.push(pendingEntry);
          }
        } else {
          // Restarting original design generation — clear any previous failed original entry
          state.entries = [];
        }
      })
      .addCase(generateEnterpriseDesign.fulfilled, (state, action) => {
        const entry = action.payload;
        const isCompleted = normalizeTaskStatus(entry.status) === "completed";
        state.lifecycle = isCompleted ? "succeeded" : "pending";
        state.error = null;

        const round = action.meta.arg.round;
        if (round !== undefined && round > 0) {
          const revisions = state.entries.filter((e) => isRevisionEntry(e));
          const prev = revisions[round - 1];
          if (prev && prev.status !== "completed") {
            const idx = state.entries.indexOf(prev);
            if (idx >= 0) {
              state.entries[idx] = entry;
              return;
            }
          }
        }

        const pendingIdx = state.entries.findIndex((e) =>
          e.id.startsWith("pending-revision-")
        );
        if (pendingIdx >= 0) {
          state.entries[pendingIdx] = entry;
        } else if (entry.type === "original") {
          const origIdx = state.entries.findIndex((e) => e.type === "original");
          if (origIdx >= 0) {
            state.entries[origIdx] = entry;
          } else {
            state.entries.unshift(entry);
          }
        } else {
          // Append the freshly-submitted entry to the design history.
          state.entries.push(entry);
        }
      })
      .addCase(generateEnterpriseDesign.rejected, (state, action) => {
        state.lifecycle = "failed";
        state.error = action.payload ?? "Failed to submit the design brief";
        const round = action.meta.arg.round;
        if (round !== undefined && round > 0) {
          const revisions = state.entries.filter((e) => isRevisionEntry(e));
          const prev = revisions[round - 1];
          if (prev) {
            const idx = state.entries.indexOf(prev);
            if (idx >= 0) {
              state.entries.splice(idx, 1);
              return;
            }
          }
        }
        const pendingIdx = state.entries.findIndex((e) =>
          e.id.startsWith("pending-revision-")
        );
        if (pendingIdx >= 0) {
          state.entries.splice(pendingIdx, 1);
        } else if (
          state.entries.length > 0 &&
          isRevisionEntry(state.entries[state.entries.length - 1])
        ) {
          state.entries.pop();
        }
      })
      .addCase(fetchEnterpriseStatus.fulfilled, (state, action) => {
        // Keep the matching entry in sync with the backend task lifecycle
        // until it reaches a terminal state (completed / failed).
        const normalizedStatus = normalizeTaskStatus(action.payload.status);
        const entryIdx = state.entries.findIndex(
          (e) => e.id === action.meta.arg || (e.task_id && e.task_id === action.meta.arg)
        );
        if (entryIdx >= 0) {
          const entry = state.entries[entryIdx];
          if (normalizedStatus === "failed") {
            if (isRevisionEntry(entry)) {
              state.entries.splice(entryIdx, 1);
            } else {
              entry.status = "failed";
            }
          } else {
            entry.status = normalizedStatus;
            if (action.payload.result) {
              const res = action.payload.result;
              if (res.generated_image_url) {
                entry.url = res.generated_image_url;
                entry.generated_image_url = res.generated_image_url;
              }
              if (res.original_image_url) {
                entry.original_image_url = res.original_image_url;
              }
              if (res.response_type === "text_answer" || res.answer) {
                entry.type = "text_answer";
                entry.response_type = "text_answer";
                if (res.answer) entry.answer = res.answer;
              }
              if (res.watermark_status) entry.watermark_status = res.watermark_status;
              if (res.pipeline) entry.pipeline = res.pipeline;
              if (res.model) entry.model = res.model;
              if (res.work_type) entry.work_type = res.work_type;
            }
          }
        }
        if (normalizedStatus === "completed") {
          // Clear any stale error on success — the backend may include a
          // non-null `error` field even in a completed response (e.g. a
          // diagnostic/connection note). Never surface that as a UI error.
          state.error = null;
          state.lifecycle = "succeeded";
        } else if (normalizedStatus === "failed") {
          // Only record the error from the payload on a true failure.
          state.error = action.payload.error ?? "Design generation failed";
          state.lifecycle = "failed";
        }
      })
      .addCase(fetchEnterpriseStatus.rejected, (state, action) => {
        // Only record the error — do NOT remove the entry. A rejected poll is
        // usually a transient network blip; destroying the entry here would
        // make the UI lose track of an in-progress revision task.
        state.error = action.payload ?? "Failed to fetch design status";
      });
  },
});

export const { resetEnterprise, setEntries, setEditId, resetEditId, setIsSkipped, removeFailedRevision, applyWsTaskStatus } = enterpriseSlice.actions;

export const selectEditId = (state: { enterprise: EnterpriseState }) => state.enterprise.editId;

export default enterpriseSlice.reducer;
