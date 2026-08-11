import {
  createSelector,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import type { AnswerValue } from "../components/chat/types";
import { API_QUESTIONS } from "../components/chat/flow";
import {
  buildApiPayload,
  buildQuestionItem,
  type ApiBriefItem,
  type ApiBriefPayload,
  type BriefContext,
} from "../lib/apiBrief";

/**
 * Brief state mirrors the schema.md payload: one fully-assembled item
 * `{ name, question, answer }` per apiKey (question in the exact HTML/plain
 * format the API expects). Unanswered questions simply have no item yet — the
 * selector fills them with empty defaults so all 8 keys are always present.
 */
export interface BriefState {
  watermark: string;
  work_type: string;
  image_url: string;
  original: Record<string, ApiBriefItem>;
  revision_comment: Record<string, never>;
}

const initialState: BriefState = {
  watermark: "http://mydesigns.pro/img/luna-logo.png",
  work_type: "front-yard",
  image_url: "https://mydesigns.pro/tmp/image-_2__1786340041.png",
  original: {}, 
  revision_comment: {},
};

const briefSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    /** Record (or override, e.g. on edit) one question's full payload item. */
    answerQuestion(
      state,
      action: PayloadAction<{ apiKey: string; answer: AnswerValue }>
    ) {
      const meta = API_QUESTIONS.find((q) => q.apiKey === action.payload.apiKey);
      if (meta) {
        state.original[meta.apiKey] = buildQuestionItem(meta, action.payload.answer);
      }
    },
    /** Merge top-level context fields (watermark / work_type / image_url). */
    setContext(state, action: PayloadAction<BriefContext>) {
      if (action.payload.watermark !== undefined) state.watermark = action.payload.watermark;
      if (action.payload.work_type !== undefined) state.work_type = action.payload.work_type;
      if (action.payload.image_url !== undefined) state.image_url = action.payload.image_url;
    },
    /** Wipe items + context (Start Over / Make Changes). */
    resetBrief() {
      return initialState;
    },
  },
});

export const { answerQuestion, setContext, resetBrief } = briefSlice.actions;
export default briefSlice.reducer;

/** Shape used by selectors (a slice of the root state). */
export interface BriefSliceState {
  chat: BriefState;
}

/**
 * The complete design-brief payload in the exact schema.md shape — all 8
 * questions always present (stored items + empty defaults for the rest).
 * Memoized so the same items/context yield a stable reference (avoids
 * needless re-renders of consumers like ChatWindow).
 */
export const selectBriefPayload = createSelector(
  (state: BriefSliceState) => state.chat,
  (brief): ApiBriefPayload =>
    buildApiPayload(API_QUESTIONS, brief.original, {
      watermark: brief.watermark,
      work_type: brief.work_type,
      image_url: brief.image_url,
    })
);
