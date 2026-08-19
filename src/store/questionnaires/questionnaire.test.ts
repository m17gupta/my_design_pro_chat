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
      lifecycle: "idle",
      error: null,
      lastFetchedAt: null,
    });
  });

  it("should set questionnaires data on setQuestionnaires action", () => {
    const state = questionnaireReducer(undefined, setQuestionnaires(sampleData));
    expect(state.lifecycle).toBe("succeeded");
    expect(state.data).toEqual(sampleData);
    expect(state.error).toBeNull();
    expect(state.lastFetchedAt).toBeTypeOf("number");
  });

  it("should reset state on resetQuestionnaires action", () => {
    const stateWithData = questionnaireReducer(undefined, setQuestionnaires(sampleData));
    const resetState = questionnaireReducer(stateWithData, resetQuestionnaires());
    expect(resetState).toEqual({
      data: null,
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

  it("selectors extract data correctly from state", () => {
    const rootState = {
      questionnaires: {
        data: sampleData,
        lifecycle: "succeeded" as const,
        error: null,
        lastFetchedAt: 12345,
      },
    };
    expect(selectQuestionnairesData(rootState)).toEqual(sampleData);
    expect(selectQuestionnairesState(rootState)).toEqual(rootState.questionnaires);
  });
});
