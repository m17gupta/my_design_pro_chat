import { describe, expect, it } from "vitest";
import enterpriseReducer, { applyWsTaskStatus, EnterpriseState, setEntries } from "./enterpriseSlice";
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
    projectId: "123",
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

  it("handles setIsSkipped and resetEnterprise correctly", () => {
    let state = enterpriseReducer(initialState, { type: "enterprise/setIsSkipped", payload: true });
    expect(state.isSkipped).toBe(true);
    expect(state.lifecycle).toBe("idle");

    state = enterpriseReducer(state, { type: "enterprise/resetEnterprise" });
    expect(state.isSkipped).toBe(false);
    expect(state.entries).toEqual([]);
  });

  it("restarts original generation from beginning when previous original entry failed", () => {
    const failedOriginalState: EnterpriseState = {
      entries: [
        {
          id: "failed-original-task",
          task_id: "failed-original-task",
          url: "",
          status: "failed",
          type: "original",
          questions: [],
        },
      ],
      lifecycle: "failed",
      error: "Edit failed at visual_review",
      editId: null,
    };

    // User clicks Proceed (generate without round specified)
    const pendingAction = generateEnterpriseDesign.pending("req-id-retry", { payload });
    const pendingState = enterpriseReducer(failedOriginalState, pendingAction);

    // It should NOT create a revision entry; it clears out failed entries to restart original
    expect(pendingState.lifecycle).toBe("loading");
    expect(pendingState.error).toBeNull();
    expect(pendingState.entries).toEqual([]);

    // When the new original task is returned from backend
    const fulfilledAction = generateEnterpriseDesign.fulfilled(
      {
        id: "new-original-task-id",
        task_id: "new-original-task-id",
        url: "",
        status: "processing",
        type: "original",
        questions: [],
      },
      "req-id-retry",
      { payload }
    );

    const finalState = enterpriseReducer(pendingState, fulfilledAction);
    expect(finalState.entries.length).toBe(1);
    expect(finalState.entries[0].id).toBe("new-original-task-id");
    expect(finalState.entries[0].type).toBe("original");
    expect(finalState.entries[0].status).toBe("processing");
    expect(finalState.lifecycle).toBe("pending");
  });

  it("updates entry and lifecycle when applyWsTaskStatus is dispatched", () => {
    const processingState: EnterpriseState = {
      entries: [
        {
          id: "task-ws-123",
          task_id: "task-ws-123",
          url: "",
          status: "processing",
          type: "original",
          questions: [],
        },
      ],
      lifecycle: "pending",
      error: null,
      editId: null,
    };

    const nextState = enterpriseReducer(
      processingState,
      applyWsTaskStatus({
        task_id: "task-ws-123",
        status: "completed",
        result: {
          task_id: "task-ws-123",
          generated_image_url: "https://img.example/done.png",
          work_type: "front_yard",
          reference_image_urls: [],
        },
        error: null,
      })
    );

    expect(nextState.lifecycle).toBe("succeeded");
    expect(nextState.entries[0].status).toBe("completed");
    expect(nextState.entries[0].url).toBe("https://img.example/done.png");
  });

  it("updates entry to text_answer and stores answer when applyWsTaskStatus receives text_answer", () => {
    const processingRevisionState: EnterpriseState = {
      entries: [
        {
          id: "9db27e3c-fb4a-4568-91dd-8e6ed088312f",
          task_id: "9db27e3c-fb4a-4568-91dd-8e6ed088312f",
          url: "",
          status: "processing",
          type: "revision",
          questions: [],
        },
      ],
      lifecycle: "pending",
      error: null,
      editId: null,
    };

    const nextState = enterpriseReducer(
      processingRevisionState,
      applyWsTaskStatus({
        task_id: "9db27e3c-fb4a-4568-91dd-8e6ed088312f",
        status: "completed",
        result: {
          task_id: "9db27e3c-fb4a-4568-91dd-8e6ed088312f",
          response_type: "text_answer",
          answer: "The house resembles a Craftsman style with timber beams.",
        },
        error: null,
      })
    );

    expect(nextState.lifecycle).toBe("succeeded");
    expect(nextState.entries[0].status).toBe("completed");
    expect(nextState.entries[0].type).toBe("text_answer");
    expect(nextState.entries[0].response_type).toBe("text_answer");
    expect(nextState.entries[0].answer).toBe(
      "The house resembles a Craftsman style with timber beams."
    );
  });
});


it("preserves an original failure reason when design history is restored", () => {
  const task = { id: "original-visual-review", type: "original" as const, url: "", status: "processing", questions: [] };
  const state = enterpriseReducer(undefined, setEntries([task]));
  const failed = enterpriseReducer(state, applyWsTaskStatus({
    task_id: task.id, status: "failed", result: null, error: "Edit failed at visual_review",
  }));
  const restored = enterpriseReducer(undefined, setEntries(JSON.parse(JSON.stringify(failed.entries))));
  expect(restored.entries[0]).toMatchObject({ type: "original", status: "failed", failure_reason: "Edit failed at visual_review" });
});
