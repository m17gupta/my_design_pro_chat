import { afterEach, describe, expect, it, vi } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import reducer, { setEntries } from "./enterpriseSlice";
import { fetchEnterpriseStatus, generateEnterpriseDesign } from "./enterpriseThunk";
import { isRevisionEntry, type EnterpriseEntry } from "./enterpriseType";

const original: EnterpriseEntry = { id: "original-task", type: "original", status: "completed", url: "https://example.com/original.jpg", questions: [] };
const payload = { projectId: "177", role: "enterprise", user_type: "landscape-design", work_type: "front_yard", watermark: "", value: "", image_url: original.url, original: {}, revision_comment: { files: [], notes: "A question" } };
const answer = "This question isn’t related to your property design project. Please ask a project-related question.";
afterEach(() => vi.unstubAllGlobals());
function setup(entries = [original]) {
  const store = configureStore({ reducer: { enterprise: reducer } });
  store.dispatch(setEntries(entries));
  return store;
}

describe("text-only revision results", () => {
  it.each(["enterprise", "enterprise-client"])("stores a completed text_answer entry for %s without requesting status", async (role) => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ task_id: null, response_type: "text_answer", answer }));
    vi.stubGlobal("fetch", fetchMock);
    const store = setup();
    const result = await store.dispatch(generateEnterpriseDesign({ payload: { ...payload, role }, round: 1 })).unwrap();
    expect(result).toMatchObject({ type: "text_answer", answer, url: "", status: "completed" });
    expect(result.id).toMatch(/^text-answer-/);
    expect(result.questions[0].answer.notes).toBe("A question");
    expect(store.getState().enterprise.entries).toEqual([original, result]);
    expect(store.getState().enterprise.lifecycle).toBe("succeeded");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/design-brief?mode=revision");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ ...payload, role });
  });
  it("keeps image generations and consecutive text results in separate rounds", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ task_id: null, response_type: "text_answer", answer }))
      .mockResolvedValueOnce(Response.json({ task_id: null, response_type: "text_answer", answer: "Please clarify your request." }))
      .mockResolvedValueOnce(Response.json({ task_id: "image-task", status: "queued" }));
    vi.stubGlobal("fetch", fetchMock);
    const store = setup();
    for (const round of [1, 2, 3]) await store.dispatch(generateEnterpriseDesign({ payload, round })).unwrap();
    const entries = store.getState().enterprise.entries;
    expect(entries.map((entry) => entry.type)).toEqual(["original", "text_answer", "text_answer", "revision"]);
    expect(entries.filter(isRevisionEntry)).toHaveLength(3);
    expect(entries[3]).toMatchObject({ id: "image-task", status: "queued", url: "" });
    const restored = setup(entries).getState().enterprise.entries;
    expect(restored[1].answer).toBe(answer);
    expect(restored[2].answer).toBe("Please clarify your request.");
  });
  it.each([{ task_id: null, response_type: "text_answer", answer: " " }, { task_id: null }])("rejects malformed success responses and removes pending placeholders", async (response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(response)));
    const store = setup();
    await expect(store.dispatch(generateEnterpriseDesign({ payload, round: 1 })).unwrap()).rejects.toBeTypeOf("string");
    expect(store.getState().enterprise.entries).toEqual([original]);
  });
  it("keeps original submissions on the existing API route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ task_id: "original-task", status: "queued" }));
    vi.stubGlobal("fetch", fetchMock);
    const store = setup([]);
    const result = await store.dispatch(generateEnterpriseDesign({ payload })).unwrap();
    expect(result.type).toBe("original");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/design-brief");
  });
  it("stores the new envelope schema response in entries with result data", async () => {
    const newSchemaResponse = {
      status: "completed",
      result: {
        task_id: "e8e025ca-2db5-4420-927d-f2e8e5c34440",
        original_image_url: "https://mydesigns.pro/tmp/WhatsApp-Image-2026_09_29-at-17.51.30_1790686108.jpeg",
        pipeline: null,
        model: null,
        work_type: null,
        reference_image_urls: [],
        vision_data: null,
        mask_stats: null,
        generated_image_url: null,
        watermark_status: "applied",
        response_type: "text_answer",
        answer: "You're welcome! Whenever you're ready, tell me what you'd like to change or ask about your design.",
      },
      error: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(Response.json(newSchemaResponse));
    vi.stubGlobal("fetch", fetchMock);
    const store = setup();
    const result = await store.dispatch(generateEnterpriseDesign({ payload: { ...payload, role: "enterprise" }, round: 1 })).unwrap();
    expect(result).toMatchObject({
      id: "e8e025ca-2db5-4420-927d-f2e8e5c34440",
      type: "text_answer",
      answer: "You're welcome! Whenever you're ready, tell me what you'd like to change or ask about your design.",
      status: "completed",
      original_image_url: "https://mydesigns.pro/tmp/WhatsApp-Image-2026_09_29-at-17.51.30_1790686108.jpeg",
      watermark_status: "applied",
    });
    expect(store.getState().enterprise.entries).toEqual([original, result]);
    expect(store.getState().enterprise.lifecycle).toBe("succeeded");
  });

  it("handles revision with 'processsing' status and polls until completed text_answer arrives", async () => {
    const processingResponse = {
      status: "processsing",
      result: {
        task_id: "7e1388b0-e4a5-429b-a086-ec308cfa0619",
        original_image_url:
          "https://dzinlyv2.s3.us-east-2.amazonaws.com/luna-ai/vendor_images/132/design_753f56c8-6537-4b77-bff3-4492827db62d.png",
        pipeline: null,
        model: null,
        work_type: null,
        reference_image_urls: [],
        vision_data: null,
        mask_stats: null,
        generated_image_url: null,
        watermark_status: "applied",
        response_type: "text_answer",
        answer: "You're welcome! I'm here if you'd like to explore another idea.",
        extra: {
          project_id: 132,
          project_view_id: 132,
          tmp_project_id: 132,
          user_id: 12365,
          type: "chat",
          question: {
            files: [],
            notes: "how are you",
          },
        },
      },
      error: null,
    };

    const completedStatusResponse = {
      status: "completed",
      result: {
        task_id: "7e1388b0-e4a5-429b-a086-ec308cfa0619",
        original_image_url:
          "https://dzinlyv2.s3.us-east-2.amazonaws.com/luna-ai/vendor_images/5/design_7a0f016b-a886-4c39-84f7-c9000a0fe60f.png",
        pipeline: null,
        model: null,
        work_type: null,
        reference_image_urls: [],
        vision_data: null,
        mask_stats: null,
        generated_image_url: null,
        watermark_status: "applied",
        response_type: "text_answer",
        answer:
          "The house in the image resembles a Craftsman style. This is evident from the use of timber beams, the gabled roof, and the combination of stone and siding materials.",
        extra: {
          project_id: 0,
          project_view_id: 0,
          tmp_project_id: 5,
          user_id: 7235,
          type: "chat",
          question: {
            files: [],
            notes: "What architectural style does this house resemble?",
          },
        },
      },
      error: null,
    };

    // 1. Initial hit to /api/design-brief?mode=revision
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(Response.json(processingResponse))
    );
    const store = setup();
    const initialEntry = await store
      .dispatch(generateEnterpriseDesign({ payload, round: 1 }))
      .unwrap();

    expect(initialEntry).toMatchObject({
      id: "7e1388b0-e4a5-429b-a086-ec308cfa0619",
      task_id: "7e1388b0-e4a5-429b-a086-ec308cfa0619",
      status: "processing", // normalized from "processsing"
      type: "text_answer",
      response_type: "text_answer",
      url: "",
    });
    expect(store.getState().enterprise.lifecycle).toBe("pending");

    // 2. Poll status endpoint: /api/design-status/{taskId}
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(Response.json(completedStatusResponse))
    );
    await store
      .dispatch(fetchEnterpriseStatus("7e1388b0-e4a5-429b-a086-ec308cfa0619"))
      .unwrap();

    const state = store.getState().enterprise;
    expect(state.lifecycle).toBe("succeeded");
    const updatedEntry = state.entries[1];
    expect(updatedEntry.status).toBe("completed");
    expect(updatedEntry.type).toBe("text_answer");
    expect(updatedEntry.answer).toBe(completedStatusResponse.result.answer);
  });
});


