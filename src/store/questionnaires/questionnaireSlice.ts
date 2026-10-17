import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { QuestionnairesResponse, QuestionnairesState } from "./questionnaireType";
import { fetchQuestionnaires } from "./questionnaireThunk";

const initialState: QuestionnairesState = {
  data: null,
  signature: null,
  questionnaireSequence: [],
  lifecycle: "idle",
  error: null,
  lastFetchedAt: null,
};

/**
 * Stable content signature for a questionnaires payload. JSON key order from
 * the backend is stable, so a plain stringify is a correct equality check and
 * lets us skip swapping `data` (and re-rendering the flow) on identical refills.
 */
export function computeQuestionnaireSignature(
  data: QuestionnairesResponse | null
): string | null {
  if (data === null || typeof data !== "object") return null;
  try {
    return JSON.stringify(data);
  } catch {
    return null;
  }
}

const questionnaireSlice = createSlice({
  name: "questionnaires",
  initialState,
  reducers: {
    setQuestionnaires(state, action: PayloadAction<QuestionnairesResponse>) {
      state.data = action.payload;
      state.signature = computeQuestionnaireSignature(action.payload);
      state.lifecycle = "succeeded";
      state.error = null;
      state.lastFetchedAt = Date.now();
    },
    setQuestionnaireSequence(state, action: PayloadAction<string[]>) {
      state.questionnaireSequence = action.payload;
    },
    resetQuestionnaires(state) {
      state.data = null;
      state.signature = null;
      state.questionnaireSequence = [];
      state.lifecycle = "idle";
      state.error = null;
      state.lastFetchedAt = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchQuestionnaires.pending, (state) => {
        state.lifecycle = "loading";
        state.error = null;
      })
      .addCase(fetchQuestionnaires.fulfilled, (state, action) => {
        const signature = computeQuestionnaireSignature(action.payload);
        state.lifecycle = "succeeded";
        state.error = null;
        state.lastFetchedAt = Date.now();
        // Only swap the payload reference when the content actually changed so
        // the episodes memo / reconcile effect don't churn on identical refetches.
        if (state.signature !== signature) {
          state.data = action.payload;
          state.signature = signature;
        }
      })
      .addCase(fetchQuestionnaires.rejected, (state, action) => {
        state.lifecycle = "failed";
        state.error = action.payload ?? "Failed to fetch questionnaires";
      });
  },
});

export const { setQuestionnaires, setQuestionnaireSequence, resetQuestionnaires } = questionnaireSlice.actions;

/** Selectors */
export const selectQuestionnairesData = (state: { questionnaires: QuestionnairesState }) =>
  state.questionnaires?.data ?? null;

export const selectQuestionnaireSequence = (state: { questionnaires: QuestionnairesState }) =>
  state.questionnaires?.questionnaireSequence ?? [];

export const selectQuestionnairesState = (state: { questionnaires: QuestionnairesState }) =>
  state.questionnaires;

export default questionnaireSlice.reducer;

