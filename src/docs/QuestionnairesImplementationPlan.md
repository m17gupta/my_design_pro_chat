# Plan: Dynamic Questionnaires from `https://mydesigns.pro/luna-ai/questionnaires`

## Context & Architecture Overview

- `AllQuestion.json` is currently a **static import** in `src/components/chat/flow.ts:14`, consumed by `resolveAllQuestionFlow` (flow.ts:808) to build chat episodes for `enterprise` / `enterprise-client` roles. It is a nested map: `role → user_type → (work_type →) phase → questions`.
- Redux store convention: `src/store/enterprise/` with `{slice, thunk, type}.ts` + wiring in `src/store/index.ts`.
- API convention: Next.js local proxy routes (`/api/design-brief`, `/api/projects`) forward requests to external services to avoid CORS restrictions in browsers.
- Question `type` variants in JSON: `radio`, `checkbox`, `display`, `textarea`, `file`, `files_with_description`, `checkbox_with_notes`, `multi_questions` (nested). `options` is `string[]` **or** `Record<string,string>`.

---

## Flaws Identified & Fixed in Plan

1. **CORS Headers Missing on Remote API:**
   - Testing `https://mydesigns.pro/luna-ai/questionnaires` confirmed that `Access-Control-Allow-Origin` headers are NOT returned.
   - Direct browser calls will fail due to CORS.
   - **Fix:** Added mandatory local API proxy `src/app/api/questionnaires/route.ts` that fetches server-side from `https://mydesigns.pro/luna-ai/questionnaires` and returns the JSON payload to client callers.

2. **Omission of `src/store/briefSlice.ts` Integration:**
   - The initial plan only updated `flow.ts` and `ChatWindow.tsx`, but `briefSlice.ts` calls `buildEpisodesFromContext` inside `selectBriefPayload`, `stateFromPayload`, `payloadFromState`, and `answerQuestion`.
   - If `briefSlice` does not pass the API questionnaire data, payload serialization and question metadata resolution fall back to static JSON.
   - **Fix:** Update `selectBriefPayload` to select both `state.chat` and `state.questionnaires.data`. Thread `questionnaires` parameter into `payloadFromState`, `stateFromPayload`, and `answerQuestion`.

3. **Omission of `persistenceThunk.ts` Restoration:**
   - `hydrateProject` calls `stateFromPayload` when restoring saved project data.
   - **Fix:** Update `hydrateProject` to pass `getState().questionnaires.data` into `stateFromPayload`.

4. **Clarified Thunk Extraction & Chat Initialization Flow:**
   - The initial plan was vague about when chat starts relative to fetching.
   - **Fix:** Dispatched `fetchQuestionnaires()` once at app startup (e.g. in `GetAllProjectData.tsx` or top-level component). As soon as the thunk fulfills and writes `data` to Redux `state.questionnaires.data`, `ChatWindow` re-evaluates `useMemo` for `buildEpisodesFromContext` and `checklistFromFlowContext`, dynamically starting/updating the chat with API data. Fallback to static `allQuestionsJson` guarantees instant render without crashing if fetch is pending or offline.

---

## Detailed Implementation Steps

### 1. Types — `src/store/questionnaires/questionnaireType.ts`
Define exact and tolerant types for questionnaires state and nested API response:
- `AllQQuestion`, `AllQPhase` (moving types from `flow.ts:742-763`, including recursive `multi_questions`).
- `QuestionnairesResponse` = recursive map typed down to `Record<string, AllQPhase>` at phase depth.
- `QuestionnairesState` shape:
  ```ts
  export interface QuestionnairesState {
    data: QuestionnairesResponse | null;
    lifecycle: "idle" | "loading" | "succeeded" | "failed";
    error: string | null;
    lastFetchedAt: number | null;
  }
  ```

### 2. Next.js API Proxy Route & API Helper
- **Proxy Route:** Create `src/app/api/questionnaires/route.ts`
  - `GET` handler fetching `https://mydesigns.pro/luna-ai/questionnaires` server-side (`cache: "no-store"` or revalidate interval).
  - Handles network/upstream errors gracefully with proper HTTP status codes.
- **Client Helper:** Create `src/lib/questionnairesApi.ts`
  - `fetchQuestionnairesApi()`: calls `/api/questionnaires`, parses JSON response, throws readable error if non-2xx.

### 3. Redux Thunk — `src/store/questionnaires/questionnaireThunk.ts`
- Create `fetchQuestionnaires = createAsyncThunk<QuestionnairesResponse, void, { rejectValue: string }>`:
  - Calls `fetchQuestionnairesApi()`.
  - Uses `rejectWithValue` on network/API failure.

### 4. Redux Slice — `src/store/questionnaires/questionnaireSlice.ts`
- Slice name: `questionnaires`.
- Initial state: `{ data: null, lifecycle: "idle", error: null, lastFetchedAt: null }`.
- Reducers: `setQuestionnaires`, `resetQuestionnaires`.
- `extraReducers`:
  - `pending`: lifecycle = `"loading"`, error = `null`.
  - `fulfilled`: lifecycle = `"succeeded"`, data = payload, lastFetchedAt = Date.now().
  - `rejected`: lifecycle = `"failed"`, error = action.payload.
- Export selectors: `selectQuestionnairesData`, `selectQuestionnairesState`.

### 5. Wire into Redux Store — `src/store/index.ts`
- Import `questionnaireReducer` and register under `questionnaires` key in `rootReducer`.

### 6. Make `flow.ts` Pure & Dynamic
- Update signature of `resolveAllQuestionFlow`:
  ```ts
  function resolveAllQuestionFlow(
    ctx: FlowContext,
    questionnaires?: QuestionnairesResponse | null
  ): ResolvedAllQuestionFlow | null
  ```
- Use `questionnaires` root if provided; fallback to module-level `allQuestionsRoot` (`allQuestionsJson`) when null/undefined.
- Thread `questionnaires` through `buildEpisodesFromContext(ctx, questionnaires)` and `checklistFromFlowContext(ctx, questionnaires)`.

### 7. Wire `briefSlice.ts` & `persistenceThunk.ts`
- Update `selectBriefPayload`:
  ```ts
  export const selectBriefPayload = createSelector(
    [
      (state: RootState) => state.chat,
      (state: RootState) => state.questionnaires?.data ?? null,
    ],
    (brief, questionnaires): ApiBriefPayload => payloadFromState(brief, questionnaires)
  );
  ```
- Update `payloadFromState(state, questionnaires)` and `stateFromPayload(payload, questionnaires)` to pass `questionnaires` to `buildEpisodesFromContext`.
- In `answerQuestion` reducer, pass action payload `questionnaires` or fallback gracefully.
- In `persistenceThunk.ts` (`hydrateProject`), get `getState().questionnaires.data` and pass to `stateFromPayload`.

### 8. App Startup, Data Extraction & Chat Start — `GetAllProjectData.tsx` & `ChatWindow.tsx`
- **Mount & Fetch:** In `GetAllProjectData.tsx` (or top-level chat container), dispatch `fetchQuestionnaires()` inside `useEffect`.
- **Data Extraction:** In `ChatWindow.tsx`:
  ```ts
  const questionnaires = useAppSelector(selectQuestionnairesData);
  const episodes = useMemo(
    () => buildEpisodesFromContext(flowContext, questionnaires),
    [flowContext, questionnaires]
  );
  const checklist = useMemo(
    () => checklistFromFlowContext(flowContext, questionnaires),
    [flowContext, questionnaires]
  );
  ```
- **Chat Start:** Chat components derive episodes directly from `episodes` memo. As soon as `fetchQuestionnaires` fulfills, `questionnaires` updates in Redux, memo recalculates with dynamic API questionnaires, and chat starts/updates seamlessly!

---

## Verification Plan

### Automated Tests
1. **Unit Tests for Flow Resolution (`src/components/chat/flow.test.ts`):**
   - Verify `buildEpisodesFromContext` with explicit synthetic `QuestionnairesResponse`.
   - Verify fallback to static `allQuestionsJson` when `questionnaires` is `null`/`undefined`.
2. **Unit Tests for Redux Slice & Thunk (`src/store/questionnaires/questionnaire.test.ts`):**
   - Test thunk pending, fulfilled, rejected states.
   - Test selector `selectQuestionnairesData`.
3. **Project Verification Commands:**
   - `npm run lint`
   - `npm test`
   - `npm run build`

### Manual Verification
1. Run local dev server (`npm run dev`).
2. Verify network tab hits `/api/questionnaires` and receives questionnaire payload.
3. Open Enterprise chat flow, verify questions match the response from `https://mydesigns.pro/luna-ai/questionnaires`.
