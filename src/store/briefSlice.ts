import {
  createSelector,
  createSlice,
  type PayloadAction
} from '@reduxjs/toolkit'
import type { AnswerValue, WorkType } from '../components/chat/types'
import { toWorkType } from '../components/chat/types'
import { buildEpisodesFromContext, getApiQuestions } from '../components/chat/flow'
import {
  buildApiPayload,
  buildQuestionItem,
  type ApiBriefItem,
  type ApiBriefPayload,
  type BriefContext,
  type RevisionComment,
  type QuestionSets
} from '../lib/apiBrief'
import { isAnswerEmpty } from '../lib/briefDisplay'

/**
 * Brief state mirrors the schema.md payload: one fully-assembled item
 * `{ name, question, answer }` per apiKey (question in the exact HTML/plain
 * format the API expects). Unanswered questions simply have no item yet — the
 * selector fills them with empty defaults so all 8 keys are always present.
 */
export interface BriefState {
  id: number | null
  user_type?: string | null
  dc_name?: string | null
  role?: string | null
  custom_engage_designer?: boolean | null
  work_type: WorkType | null
  watermark: string | null
  image_url: string | null
  value: string | null
  original: Record<string, ApiBriefItem>
  revision_comment: RevisionComment
  question_sets?: QuestionSets | null
}

/**
 * Reverse of `payloadFromState`: reconstruct store state from a persisted
 * schema.md-shaped payload. Lossless round-trip — the same payload regenerates.
 * Items with empty (unanswered) answers are dropped so key presence = answered.
 * Lives here (not in the store) so the persistence thunk can restore a project
 * without creating a circular import.
 */
export function stateFromPayload (
  payload: ApiBriefPayload,
  questionnaires?: Record<string, unknown> | null
): BriefState {
  const original: Record<string, ApiBriefItem> = {}
  getApiQuestions(
    buildEpisodesFromContext(
      {
        work_type: payload.work_type ?? undefined,
        user_type: payload.user_type,
        role: payload.role,
        question_sets: payload.question_sets,
        engageDesigner: payload.custom_engage_designer,
        dcName: payload.dc_name ?? undefined,
      },
      questionnaires
    )
  ).forEach(q => {
    const item = payload.original[q.apiKey]
    if (item && !isAnswerEmpty(item.answer)) {
      original[q.apiKey] = item
    }
  })
  return {
    id: payload.projectId,
    original,
    watermark: payload.watermark,
    work_type: toWorkType(payload.work_type),
    image_url: payload.image_url,
    value: payload.value ?? null,
    revision_comment: payload.revision_comment ?? { files: [], notes: '' },
    user_type: payload?.user_type ?? "",
    dc_name: payload?.dc_name ?? "",
    role: payload?.role ?? null,
    custom_engage_designer: payload?.custom_engage_designer ?? null,
    question_sets: payload?.question_sets ?? null,
  }
}

/**
 * Serialize a brief state into the schema.md payload shape for storage /
 * API submission. Lives next to its inverse `stateFromPayload` so the
 * persistence layer and the payload selector share one implementation.
 */
export function payloadFromState (
  state: BriefState,
  questionnaires?: Record<string, unknown> | null
): ApiBriefPayload {
  return buildApiPayload(
    getApiQuestions(
      buildEpisodesFromContext(
        {
          work_type: state.work_type ?? undefined,
          user_type: state.user_type,
          role: state.role,
          question_sets: state.question_sets,
          engageDesigner: state.custom_engage_designer ?? false,
          dcName: state.dc_name ?? undefined,
        },
        questionnaires
      )
    ),
    state.original,
    {
      projectId: state.id ?? 0,
      user_type: state.user_type ?? "",
      dc_name: state.dc_name ?? "",
      role: state.role ?? null,
      custom_engage_designer: state.custom_engage_designer ?? undefined,
      watermark: state.watermark ?? "",
      work_type: state.work_type ?? "",
      image_url: state.image_url ?? "",
      value: state.value ?? "",
      revision: state.revision_comment,
      question_sets: state.question_sets ?? undefined,
    }
  )
}

const initialState: BriefState = {
  id: null,
  user_type: null,
  dc_name: null,
  role: null,
  custom_engage_designer: null,
  watermark: null,
  work_type: null,
  image_url: '',
  value: null,
  original: {},
  revision_comment: { files: [], notes: '' },
  question_sets: null
}

const briefSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    /** Record (or override, e.g. on edit) one question's full payload item. */
    answerQuestion (
      state,
      action: PayloadAction<{
        apiKey: string
        answer: AnswerValue
        questionnaires?: Record<string, unknown> | null
      }>
    ) {
      // Resolve question text from the current flow context so the stored
      // item (and the payload it feeds) carries the right wording.
      const meta = getApiQuestions(
        buildEpisodesFromContext(
          {
            work_type: state.work_type ?? undefined,
            user_type: state.user_type,
            role: state.role,
            question_sets: state.question_sets,
            engageDesigner: state.custom_engage_designer ?? false,
            dcName: state.dc_name ?? undefined,
          },
          action.payload.questionnaires
        )
      ).find(q => q.apiKey === action.payload.apiKey)
      if (meta) {
        state.original[meta.apiKey] = buildQuestionItem(
          meta,
          action.payload.answer
        )
      } else if (state.original[action.payload.apiKey]) {
        state.original[action.payload.apiKey] = {
          ...state.original[action.payload.apiKey],
          answer: action.payload.answer as ApiBriefItem['answer']
        }
      }
    },

    /** Merge top-level context fields (id / watermark / work_type / image_url / value). */
    setContext (state, action: PayloadAction<BriefContext>) {
      if (action.payload.id !== undefined) state.id = action.payload.id
      if (action.payload.user_type !== undefined)
        state.user_type = action.payload.user_type
      if (action.payload.dc_name !== undefined)
        state.dc_name = action.payload.dc_name
      if (action.payload.role !== undefined) state.role = action.payload.role
      if (action.payload.custom_engage_designer !== undefined)
        state.custom_engage_designer = action.payload.custom_engage_designer
      if (action.payload.watermark !== undefined)
        state.watermark = action.payload.watermark
      if (action.payload.work_type !== undefined)
        state.work_type = toWorkType(action.payload.work_type)
      if (action.payload.image_url !== undefined)
        state.image_url = action.payload.image_url
      if (action.payload.value !== undefined) state.value = action.payload.value
      if (action.payload.question_sets !== undefined)
        state.question_sets = action.payload.question_sets
    },
    /** Record the revision comments (files + notes) from the feedback step. */
    setRevision (state, action: PayloadAction<RevisionComment>) {
      state.revision_comment = action.payload
    },
    /** Wipe items + context (Start Over / Make Changes). */
    resetBrief (state) {
      state.original = {}
      state.revision_comment = { files: [], notes: '' }
    },
    /** Replace the whole brief state (used when restoring a project from the DB). */
    setBriefState (_state, action: PayloadAction<BriefState>) {
      return action.payload
    },
    /** Set/update original answered items (e.g. when restoring project data from DB). */
    setOriginal (state, action: PayloadAction<Record<string, ApiBriefItem>>) {
      state.original = action.payload
    }
  }
})

export const {
  answerQuestion,
  setContext,
  setRevision,
  resetBrief,
  setBriefState,
  setOriginal
} = briefSlice.actions
export default briefSlice.reducer

/** Shape used by selectors (a slice of the root state). */
export interface BriefSliceState {
  chat: BriefState
  questionnaires?: {
    data: Record<string, unknown> | null
  }
}

/**
 * The complete design-brief payload in the exact schema.md shape — all 8
 * questions always present (stored items + empty defaults for the rest).
 * Memoized so the same items/context yield a stable reference (avoids
 * needless re-renders of consumers like ChatWindow).
 */
export const selectBriefPayload = createSelector(
  [
    (state: BriefSliceState) => state.chat,
    (state: BriefSliceState) => state.questionnaires?.data ?? null,
  ],
  (brief, questionnaires): ApiBriefPayload => payloadFromState(brief, questionnaires)
)
