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
