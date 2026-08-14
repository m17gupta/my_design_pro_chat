import {
  createSelector,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import type { AnswerValue } from "../components/chat/types";
import { buildEpisodes, getApiQuestions } from "../components/chat/flow";
import {
  buildApiPayload,
  buildQuestionItem,
  type ApiBriefItem,
  type ApiBriefPayload,
  type BriefContext,
  type RevisionComment,
} from "../lib/apiBrief";

/**
 * Brief state mirrors the schema.md payload: one fully-assembled item
 * `{ name, question, answer }` per apiKey (question in the exact HTML/plain
 * format the API expects). Unanswered questions simply have no item yet — the
 * selector fills them with empty defaults so all 8 keys are always present.
 */
export interface BriefState {
  id:number |null,
  watermark: string |null;
  work_type: string |null;
  image_url: string |null;
  value: string |null;
  original: Record<string, ApiBriefItem>;
  revision_comment: RevisionComment;
}

const initialState: BriefState = {
  id:null,
  watermark: null,
  work_type: null,
  image_url: "",
  value: null,
  original: {}, 
  revision_comment: { files: [], notes: "" },
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
      // Resolve question text from the current work type so the stored item
      // (and the payload it feeds) carries the right wording.
      const meta = getApiQuestions(buildEpisodes(state.work_type ?? undefined)).find(
        (q) => q.apiKey === action.payload.apiKey
      );
      if (meta) {
        state.original[meta.apiKey] = buildQuestionItem(meta, action.payload.answer);
      }
    },
    
    /** Merge top-level context fields (id / watermark / work_type / image_url / value). */
    setContext(state, action: PayloadAction<BriefContext>) {
      if (action.payload.id !== undefined) state.id = action.payload.id;
      if (action.payload.watermark !== undefined) state.watermark = action.payload.watermark;
      if (action.payload.work_type !== undefined) state.work_type = action.payload.work_type;
      if (action.payload.image_url !== undefined) state.image_url = action.payload.image_url;
      if (action.payload.value !== undefined) state.value = action.payload.value;
    },
    /** Record the 1786514733.png"revision comments (files + notes) from the feedback step. */
    setRevision(state, action: PayloadAction<RevisionComment>) {
      state.revision_comment = action.payload;
    },
    /** Wipe items + context (Start Over / Make Changes). */
    resetBrief(state) {
      state.original = {}
      state.revision_comment={ files: [], notes: "" }
    }
  },
});

export const { answerQuestion, setContext, setRevision, resetBrief } = briefSlice.actions;
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
    buildApiPayload(getApiQuestions(buildEpisodes(brief.work_type ?? undefined)), brief.original, {
      id: brief?.id??0,
      watermark: brief.watermark??"",
      work_type: brief.work_type??"",
      image_url: brief.image_url??"",
      value: brief.value??"",
      revision: brief.revision_comment,
    })
);
