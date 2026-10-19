import { afterEach, describe, expect, it, vi } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import reducer, { setEntries } from "./enterpriseSlice";
import { generateEnterpriseDesign } from "./enterpriseThunk";
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
});
