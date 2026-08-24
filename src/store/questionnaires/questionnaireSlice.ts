import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { QuestionnairesResponse, QuestionnairesState } from "./questionnaireType";
import { fetchQuestionnaires } from "./questionnaireThunk";

const initialState: QuestionnairesState = {
  data: null,
  questionnaireSequence: [],
  lifecycle: "idle",
  error: null,
  lastFetchedAt: null,
};

const questionnaireSlice = createSlice({
  name: "questionnaires",
  initialState,
  reducers: {
    setQuestionnaires(state, action: PayloadAction<QuestionnairesResponse>) {
      state.data = action.payload;
      state.lifecycle = "succeeded";
      state.error = null;
      state.lastFetchedAt = Date.now();
    },
    setQuestionnaireSequence(state, action: PayloadAction<string[]>) {
      state.questionnaireSequence = action.payload;
    },
    resetQuestionnaires(state) {
      state.data = null;
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
        state.lifecycle = "succeeded";
        state.data = action.payload;
        state.error = null;
        state.lastFetchedAt = Date.now();
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

