# Dead / Unused Code Report

Audit performed against `main` (2026-08-18). Findings are grouped by category. All
unused-import warnings below are confirmed by `eslint` (`@typescript-eslint/no-unused-vars`).

---

## 1. Unused imports

| File | Line | Symbol | Notes |
| --- | --- | --- | --- |
| `src/components/chat/ChatWindow.tsx` | 6 | `LunaAvatar` | Component is used elsewhere (MessageBubble, TypingIndicator); this import is dead. |
| `src/components/chat/ChatWindow.tsx` | 38 | `setContext` | Context is dispatched by `GetAllProjectData`, not here. |
| `src/components/chat/ChatWindow.tsx` | 54 | `hydrateProject` | Hydration is dispatched by `GetAllProjectData`, not here. |
| `src/components/chat/ChatWindow.tsx` | 55 | `hydrationSkipped` | Same as above. |
| `src/components/chat/GetAllProjectData.tsx` | 5 | `useMemo` | Not used in the component. |
| `src/components/chat/MainDesign/DesignSummaryCard.tsx` | 8 | `answerToText` | Not used. |
| `src/components/chat/UserAnswerBubble.tsx` | 2 | `React` | JSX transform does not require the import. |
| `src/store/index.ts` | 12 | `saveProject` | Only referenced inside a commented-out block (the middleware save was disabled). |
| `src/store/persistence/persistenceSlice.ts` | 1 | `PayloadAction` | Not used. |

## 2. Unused declarations (assigned but never read)

| File | Line | Symbol | Notes |
| --- | --- | --- | --- |
| `src/components/chat/ChatWindow.tsx` | 96 | `setMenuOpen` | Never called → the mobile checklist dropdown (`{menuOpen && …}`) is unreachable dead UI. |
| `src/components/chat/MainDesign/DesignSummaryCard.tsx` | 33 | `answers` | Summary checklist grid is commented out. |
| `src/components/chat/MainDesign/DesignSummaryCard.tsx` | 38 | `checklist` | Same as above. |
| `src/components/chat/MainDesign/DesignSummaryCard.tsx` | 42 | `onChanges` | "I'd Like To Make Changes" button is commented out. |
| `src/components/chat/MainDesign/DesignGeneratingCard.tsx` | 30 | `RATING_EMOJIS` | Constant never used. |
| `src/components/chat/MainDesign/DesignGeneratingCard.tsx` | 31 | `RATING_LABELS` | Constant never used. |
| `src/components/revisionDesign/RevisionResultCard.tsx` | 51 | `onRate` | Prop is destructured but never invoked inside the component. |
| `src/components/revisionDesign/RevisionSummaryCard.tsx` | 58 | `action` | Function parameter never used. |

## 3. Unused exports (production code)

| Export | File | Notes |
| --- | --- | --- |
| `buildColorMaterialEpisodes` | `src/components/chat/flow.ts` | Only imported by `flow.test.ts`. |
| `payloadFromState` | `src/store/index.ts` | Only referenced in the commented-out middleware block and in tests. |

## 4. Unused data files

| File | Notes |
| --- | --- |
| `src/docs/Question2.json` | Not imported anywhere — reference data only. (Other JSON files under `src/docs/` are imported: `Questions.json`, `CustomQuestions.json`, `AllQuestion.json`.) |

## 5. Debug leftovers

| File | Line | Notes |
| --- | --- | --- |
| `src/components/chat/GetAllProjectData.tsx` | 48 | `console.log("params", params)` — remove before shipping. |

## 6. Intentional / NOT dead (do not remove)

These look unused at a glance but are still reachable and must be kept:

- `WORK_TYPE_API_KEYS`, `EPISODES`, `buildEpisodes`, `CATALOG`, `Questions.json`, `CustomQuestions.json` —
  the legacy flow is the runtime fallback for roles with no `AllQuestion.json` path
  (`homeowner`, `realtor`, `builder`, `trade`, or a missing role).
- `summaryCopyForWorkType`, `SUMMARY_COPY`, `checklistForWorkType`, `CHECKLIST` — still used by
  `DesignSummaryCard` / `ChatWindow` as fallbacks for legacy flows.
- `saveProject` thunk — dispatched by `UpdateProjectData.tsx`; only the middleware's own
  dispatch in `store/index.ts` is disabled (commented out).
- `deleteProject`, `hydrateProject` — used by the persistence middleware / thunk.

## 7. Pre-existing lint error (not introduced by recent changes)

| File | Line | Rule |
| --- | --- | --- |
| `src/components/chat/ChatWindow.tsx` | 170 | `react-hooks/set-state-in-effect` — `setMessages(...)` called synchronously in the hydration effect. |
