import { describe, expect, it } from "vitest";
import questionnaireReducer, {
  setQuestionnaires,
  resetQuestionnaires,
  selectQuestionnairesData,
  selectQuestionnairesState,
} from "./questionnaireSlice";
import { fetchQuestionnaires } from "./questionnaireThunk";

describe("questionnaireSlice", () => {
  const sampleData = {
    enterprise: {
      "color-material": {
        front_yard: {
          phase_1: {
            title: "Dynamic Phase 1",
            questions: [
              {
                id: "dyn_q1",
                name: "Dynamic Question 1",
                type: "radio",
                options: ["Opt A", "Opt B"],
              },
            ],
          },
        },
      },
    },
  };

  it("should return initial state", () => {
    const state = questionnaireReducer(undefined, { type: "UNKNOWN" });
    expect(state).toEqual({
      data: null,
      signature: null,
      questionnaireSequence: [],
      lifecycle: "idle",
      error: null,
      lastFetchedAt: null,
    });
  });

  it("should set questionnaires data on setQuestionnaires action", () => {
    const state = questionnaireReducer(undefined, setQuestionnaires(sampleData));
    expect(state.lifecycle).toBe("succeeded");
    expect(state.data).toEqual(sampleData);
    expect(state.signature).toBe(JSON.stringify(sampleData));
    expect(state.error).toBeNull();
    expect(state.lastFetchedAt).toBeTypeOf("number");
  });

  it("should reset state on resetQuestionnaires action", () => {
    const stateWithData = questionnaireReducer(undefined, setQuestionnaires(sampleData));
    const resetState = questionnaireReducer(stateWithData, resetQuestionnaires());
    expect(resetState).toEqual({
      data: null,
      signature: null,
      questionnaireSequence: [],
      lifecycle: "idle",
      error: null,
      lastFetchedAt: null,
    });
  });

  it("handles fetchQuestionnaires thunk lifecycle", () => {
    let state = questionnaireReducer(undefined, fetchQuestionnaires.pending("req1"));
    expect(state.lifecycle).toBe("loading");
    expect(state.error).toBeNull();

    state = questionnaireReducer(state, fetchQuestionnaires.fulfilled(sampleData, "req1"));
    expect(state.lifecycle).toBe("succeeded");
    expect(state.data).toEqual(sampleData);

    state = questionnaireReducer(
      state,
      fetchQuestionnaires.rejected(null, "req2", undefined, "Network Error")
    );
    expect(state.lifecycle).toBe("failed");
    expect(state.error).toBe("Network Error");
  });

  it("keeps the same data reference when a refetch is unchanged", () => {
    const first = questionnaireReducer(undefined, fetchQuestionnaires.fulfilled(sampleData, "req1"));
    const second = questionnaireReducer(first, fetchQuestionnaires.fulfilled(sampleData, "req2"));
    expect(second.data).toBe(first.data);
    expect(second.signature).toBe(first.signature);
  });

  it("swaps data when a refetch changes the questionnaire", () => {
    const first = questionnaireReducer(undefined, fetchQuestionnaires.fulfilled(sampleData, "req1"));
    const changed = {
      enterprise: {
        "color-material": {
          front_yard: {
            phase_1: {
              title: "Dynamic Phase 1",
              questions: [
                { id: "dyn_q1", name: "Dynamic Question 1", type: "radio", options: ["A"] },
                { id: "dyn_q2", name: "Dynamic Question 2", type: "radio", options: ["B"] },
              ],
            },
          },
        },
      },
    };
    const second = questionnaireReducer(first, fetchQuestionnaires.fulfilled(changed, "req2"));
    expect(second.data).toEqual(changed);
    expect(second.signature).toBe(JSON.stringify(changed));
  });

  it("selectors extract data correctly from state", () => {
    const rootState = {
      questionnaires: {
        data: sampleData,
        signature: JSON.stringify(sampleData),
        questionnaireSequence: [],
        lifecycle: "succeeded" as const,
        error: null,
        lastFetchedAt: 12345,
      },
    };
    expect(selectQuestionnairesData(rootState)).toEqual(sampleData);
    expect(selectQuestionnairesState(rootState)).toEqual(rootState.questionnaires);
  });

  it("skips execution when questionnaires are already present in Redux", async () => {
    const dispatch = () => {};
    const getState = () => ({
      questionnaires: {
        data: sampleData,
        signature: JSON.stringify(sampleData),
        questionnaireSequence: [],
        lifecycle: "succeeded" as const,
        error: null,
        lastFetchedAt: 12345,
      },
    });

    const thunk = fetchQuestionnaires();
    const result = await thunk(dispatch, getState, undefined);
    expect(result.meta.requestStatus).toBe("rejected");
    expect((result as { meta?: { condition?: boolean } }).meta?.condition).toBe(true);
  });

  it("skips execution when questionnaires are currently loading", async () => {
    const dispatch = () => {};
    const getState = () => ({
      questionnaires: {
        data: null,
        signature: null,
        questionnaireSequence: [],
        lifecycle: "loading" as const,
        error: null,
        lastFetchedAt: null,
      },
    });

    const thunk = fetchQuestionnaires();
    const result = await thunk(dispatch, getState, undefined);
    expect(result.meta.requestStatus).toBe("rejected");
    expect((result as { meta?: { condition?: boolean } }).meta?.condition).toBe(true);
  });
});
