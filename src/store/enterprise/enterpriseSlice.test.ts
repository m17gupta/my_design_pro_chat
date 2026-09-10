import { describe, expect, it } from "vitest";
import enterpriseReducer, { EnterpriseState } from "./enterpriseSlice";
import { generateEnterpriseDesign } from "./enterpriseThunk";

describe("enterpriseSlice extraReducers", () => {
  const initialState: EnterpriseState = {
    entries: [
      {
        id: "original-task-id",
        url: "https://example.com/original.jpg",
        status: "completed",
        type: "original",
        questions: [],
      },
    ],
    lifecycle: "idle",
    error: null,
    editId: null,
  };

  const payload = {
    projectId: 123,
    watermark: "",
    work_type: "front_yard",
    image_url: "https://example.com/original.jpg",
    value: "",
    original: {},
    revision_comment: {
      files: ["https://example.com/rev.jpg"],
      notes: "add sitting area",
    },
  };

  it("adds pending revision entry to entries on generateEnterpriseDesign.pending", () => {
    const action = generateEnterpriseDesign.pending("req-id-1", { payload, round: 1 });
    const state = enterpriseReducer(initialState, action);

    expect(state.lifecycle).toBe("loading");
    expect(state.entries.length).toBe(2);
    expect(state.entries[1]).toEqual({
      id: "pending-revision-1",
      url: "",
      status: "pending",
      type: "revision",
      questions: [
        {
          name: "Revision Comments",
          type: "files_with_description",
          details: "Please share your revision requests, I will incorporate them into the design.",
          answer: {
            files: ["https://example.com/rev.jpg"],
            notes: "add sitting area",
          },
        },
      ],
    });
  });

  it("updates pending entry with fulfilled response on generateEnterpriseDesign.fulfilled", () => {
    const pendingAction = generateEnterpriseDesign.pending("req-id-1", { payload, round: 1 });
    let state = enterpriseReducer(initialState, pendingAction);

    const fulfilledAction = generateEnterpriseDesign.fulfilled(
      {
        id: "task-id-123",
        url: "https://example.com/result.jpg",
        status: "pending",
        type: "revision",
        questions: [
          {
            name: "Revision Comments",
            type: "files_with_description",
            details: "Please share your revision requests, I will incorporate them into the design.",
            answer: {
              files: ["https://example.com/rev.jpg"],
              notes: "add sitting area",
            },
          },
        ],
      },
      "req-id-1",
      { payload, round: 1 }
    );

    state = enterpriseReducer(state, fulfilledAction);

    expect(state.lifecycle).toBe("pending");
    expect(state.entries.length).toBe(2);
    expect(state.entries[1].id).toBe("task-id-123");
    expect(state.entries[1].status).toBe("pending");
    expect(state.entries[1].questions[0].answer).toEqual({
      files: ["https://example.com/rev.jpg"],
      notes: "add sitting area",
    });
  });
});
