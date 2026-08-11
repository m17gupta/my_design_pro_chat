import { combineReducers, configureStore, type Middleware } from "@reduxjs/toolkit";
import { API_QUESTIONS } from "../components/chat/flow";
import {
  buildApiPayload,
  type ApiBriefItem,
  type ApiBriefPayload,
} from "../lib/apiBrief";
import { isAnswerEmpty } from "../lib/briefDisplay";
import briefReducer, { resetBrief, type BriefState } from "./briefSlice";
import enterpriseReducer, { resetEnterprise, type EnterpriseState } from "./enterpriseSlice";

/** Versioned sessionStorage key — bump to invalidate old shapes. */
export const BRIEF_STORAGE_KEY = "luna-brief-v1";
export const ENTERPRISE_STORAGE_KEY = "luna-enterprise-v1";

const isBrowser = typeof window !== "undefined";

/**
 * Serialize the store state into the exact schema.md payload shape. This is
 * also the format written to sessionStorage, so the persisted blob is the API
 * payload itself (all 8 questions with name/question/answer, answered or empty).
 */
export function payloadFromState(state: BriefState): ApiBriefPayload {
  return buildApiPayload(API_QUESTIONS, state.original, {
    watermark: state.watermark,
    work_type: state.work_type,
    image_url: state.image_url,
  });
}

/**
 * Reverse of `payloadFromState`: reconstruct store state from a persisted
 * schema.md-shaped payload. Lossless round-trip — the same payload regenerates.
 * Items with empty (unanswered) answers are dropped so key presence = answered.
 */
export function stateFromPayload(payload: ApiBriefPayload): BriefState {
  const original: Record<string, ApiBriefItem> = {};
  API_QUESTIONS.forEach((q) => {
    const item = payload.original[q.apiKey];
    if (item && !isAnswerEmpty(item.answer)) {
      original[q.apiKey] = item;
    }
  });
  return {
    original,
    watermark: payload.watermark,
    work_type: payload.work_type,
    image_url: payload.image_url,
    revision_comment: {},
  };
}

/** Read + parse the persisted payload (returns undefined when absent/corrupt). */
export function loadPersistedState(): BriefState | undefined {
  if (!isBrowser) return undefined;
  try {
    const raw = window.sessionStorage.getItem(BRIEF_STORAGE_KEY);
    if (!raw) return undefined;
    const payload = JSON.parse(raw) as ApiBriefPayload;
    if (!payload || typeof payload !== "object" || !payload.original) {
      return undefined;
    }
    return stateFromPayload(payload);
  } catch {
    return undefined;
  }
}

export function loadPersistedEnterpriseState(): EnterpriseState | undefined {
  if (!isBrowser) return undefined;
  try {
    const raw = window.sessionStorage.getItem(ENTERPRISE_STORAGE_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as EnterpriseState;
  } catch {
    return undefined;
  }
}

/** Persist the current brief as a schema-shaped payload after every action. */
const persistBriefMiddleware: Middleware = (storeApi) => (next) => (action) => {
  const result = next(action);
  if (!isBrowser) return result;
  
  const type = (action as { type?: string }).type;
  if (!type) return result;

  try {
    // Only chat actions touch the brief payload
    if (type.startsWith("chat/")) {
      if (type === resetBrief.type) {
        window.sessionStorage.removeItem(BRIEF_STORAGE_KEY);
      } else {
        window.sessionStorage.setItem(
          BRIEF_STORAGE_KEY,
          JSON.stringify(payloadFromState(storeApi.getState().chat))
        );
      }
    }
    // Enterprise actions touch the enterprise payload
    else if (type.startsWith("enterprise/")) {
      if (type === resetEnterprise.type) {
        window.sessionStorage.removeItem(ENTERPRISE_STORAGE_KEY);
      } else {
        window.sessionStorage.setItem(
          ENTERPRISE_STORAGE_KEY,
          JSON.stringify(storeApi.getState().enterprise)
        );
      }
    }
  } catch {
    // Storage unavailable / quota exceeded — non-fatal for the chat.
  }
  return result;
};

const preloadedBrief = loadPersistedState();
const preloadedEnterprise = loadPersistedEnterpriseState();

const rootReducer = combineReducers({
  chat: briefReducer,
  enterprise: enterpriseReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

const preloadedState: Partial<RootState> = {};
if (preloadedBrief) preloadedState.chat = preloadedBrief;
if (preloadedEnterprise) preloadedState.enterprise = preloadedEnterprise;

export const store = configureStore({
  reducer: rootReducer,
  preloadedState,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(persistBriefMiddleware),
});

export type AppDispatch = typeof store.dispatch;
