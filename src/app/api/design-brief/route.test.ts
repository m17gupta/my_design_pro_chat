import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const payload = {
  projectId: "cp-177", watermark: "https://example.com/logo.png",
  work_type: "color_material", image_url: "https://example.com/house.jpg",
  value: "", user_type: "color_material", dc_name: "", role: "enterprise-client",
  original: {
    supporting_files_upload: { name: "Files", question: "<p>Upload</p>", answer: [] },
    primary_material_preferences: {
      name: "Materials", question: "<p>Preferences</p>",
      answer: { files: [], notes: "Warm off-white" },
    },
  },
  revision_comment: { files: [], notes: "" }, status: null,
};

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("DESIGN_API_URL", "https://backend.example.com/");
  vi.stubEnv("DESIGN_API_KEY", "test-key");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function submit() {
  const { POST } = await import("./route");
  return POST(new Request("https://app.example.com/api/design-brief", {
    method: "POST", body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  }));
}

describe("color-material proxy", () => {
  it("forwards the nested contract unchanged and returns the task", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ task_id: "task-177" }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await submit();
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ task_id: "task-177" });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://backend.example.com/api/v1/luna/color-material");
    expect(JSON.parse(options.body)).toEqual(payload);
    expect(options.headers["X-API-Key"]).toBe("test-key");
  });

  it.each([
    { error: { type: "ValidationError", detail: [{ loc: ["body", "projectId"], msg: "Field required", input: "private" }] } },
    { detail: [{ loc: ["body", "projectId"], msg: "Field required" }] },
  ])("preserves validation field paths for either backend format", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body, { status: 422 })));
    const response = await submit();
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "body.projectId: Field required" });
  });

  it("preserves string errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ detail: "Conflicting query projectId" }, { status: 422 })));
    expect(await (await submit()).json()).toEqual({ error: "Conflicting query projectId" });
  });
});


describe("revision exterior proxy", () => {
  it.each(["enterprise", "enterprise-client"])("routes %s revisions to /luna/exterior and preserves the nested brief", async (role) => {
    const answer = { task_id: null, response_type: "text_answer", answer: "Please ask a project-related question." };
    const fetchMock = vi.fn().mockResolvedValue(Response.json(answer));
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("./route");
    const revision = { ...payload, role, user_type: "landscape-design", revision_comment: { files: [], notes: "A question" } };
    const response = await POST(new Request("https://app.example.com/api/design-brief?mode=revision", {
      method: "POST", body: JSON.stringify(revision), headers: { "Content-Type": "application/json" },
    }));
    expect(await response.json()).toEqual(answer);
    expect(fetchMock.mock.calls[0][0]).toBe("https://backend.example.com/api/v1/luna/exterior");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(revision);
    expect(fetchMock.mock.calls[0][1].headers["X-API-Key"]).toBe("test-key");
  });
});


describe("image response compatibility", () => {
  it.each(["enterprise", "enterprise-client"])("preserves queued image responses for %s revisions", async (role) => {
    const queued = { task_id: "image-task", status: "queued", message: "Generating" };
    const fetchMock = vi.fn().mockResolvedValue(Response.json(queued, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("./route");
    const response = await POST(new Request("https://app.example.com/api/design-brief?mode=revision", {
      method: "POST", body: JSON.stringify({ ...payload, role }), headers: { "Content-Type": "application/json" },
    }));
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual(queued);
    expect(fetchMock.mock.calls[0][0]).toBe("https://backend.example.com/api/v1/luna/exterior");
  });
  it("keeps enterprise original requests on enterprise-design", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ task_id: "original-task" }));
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("./route");
    await POST(new Request("https://app.example.com/api/design-brief", {
      method: "POST", body: JSON.stringify({ ...payload, role: "enterprise" }), headers: { "Content-Type": "application/json" },
    }));
    expect(fetchMock.mock.calls[0][0]).toBe("https://backend.example.com/api/v1/luna/enterprise-design");
  });
});
