import {
  combineReducers,
  configureStore,
  type Middleware,
} from "@reduxjs/toolkit";
import { isPersistenceConfigured } from "../lib/persistenceConfig";
import briefReducer, { resetBrief, payloadFromState } from "./briefSlice";
import enterpriseReducer, { resetEnterprise } from "./enterprise/enterpriseSlice";
import persistenceReducer from "./persistence/persistenceSlice";
import questionnaireReducer from "./questionnaires/questionnaireSlice";
import settingsReducer from "./settings/settingsSlice";
import vendorSubscriptionReducer from "./vendorSubscription/vendorSubscriptionSlice";
import {
  deleteProject,
  saveProject,
} from "./persistence/persistenceThunk";

export { payloadFromState };

const isBrowser = typeof window !== "undefined";

/**
 * Persistence middleware — mirrors the old localStorage middleware but writes
 * the current chat payload + design history to Supabase (`luna_my_design_projects`)
 * instead of localStorage. Writes are debounced so the frequent per-action
 * updates (answers, status polls) coalesce into a single row upsert.
 */
const PERSIST_DEBOUNCE_MS = 1000;

let persistTimer: ReturnType<typeof setTimeout> | null = null;

/** Dispatch/store shape the helpers need (see Middleware note below). */
interface PersistAPI {
  getState: () => RootState;
  dispatch: AppDispatch;
}

function projectIdOf(state: RootState): string | null {
  return state.chat.id != null ? String(state.chat.id) : null;
}

/** Queue an upsert of the current chat payload + design history. */
function schedulePersist(storeApi: PersistAPI): void {
  if (!isBrowser || !isPersistenceConfigured) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const state = storeApi.getState();
    const projectId = projectIdOf(state);
    if (!projectId) return;
    // void storeApi.dispatch(
    //   saveProject({
    //     projectId,
    //     chats: payloadFromState(state.chat),
    //     designData: state.enterprise.entries,
    //   })
    // );
  }, PERSIST_DEBOUNCE_MS);
}

/**
 * Delete the project row on reset (Start Over / fresh intake). Cancels any
 * queued save so it can't re-create the row right after deletion.
 */
function scheduleDelete(storeApi: PersistAPI): void {
  if (!isBrowser || !isPersistenceConfigured) return;
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  const projectId = projectIdOf(storeApi.getState());
  if (!projectId) return;
  void storeApi.dispatch(deleteProject({ projectId }));
}

const persistBriefMiddleware: Middleware = (storeApi) => (next) => (action) => {
  const result = next(action);
  if (!isBrowser) return result;

  const type = (action as { type?: string }).type;
  if (!type) return result;

  try {
    // Only chat actions touch the brief payload; enterprise actions touch the
    // design history. Resets delete the whole row instead of saving an empty one.
    if (type.startsWith("chat/")) {
      if (type === resetBrief.type) {
        scheduleDelete(storeApi as unknown as PersistAPI);
      } else {
        schedulePersist(storeApi as unknown as PersistAPI);
      }
    } else if (type.startsWith("enterprise/")) {
      if (type === resetEnterprise.type) {
        scheduleDelete(storeApi as unknown as PersistAPI);
      } else {
        schedulePersist(storeApi as unknown as PersistAPI);
      }
    }
  } catch {
    // Persistence failure is non-fatal for the chat.
  }
  return result;
};

const rootReducer = combineReducers({
  chat: briefReducer,
  enterprise: enterpriseReducer,
  persistence: persistenceReducer,
  questionnaires: questionnaireReducer,
  settings: settingsReducer,
  subscription: vendorSubscriptionReducer,
  vendorSubscription: vendorSubscriptionReducer,
});


export type RootState = ReturnType<typeof rootReducer>;

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(persistBriefMiddleware),
});

export type AppDispatch = typeof store.dispatch;
