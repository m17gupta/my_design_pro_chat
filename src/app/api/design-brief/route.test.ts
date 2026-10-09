import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildEnterpriseClientPayload } from "../../../lib/enterpriseClientPayload";

const chats = {
  projectId: "cp-138963", role: "enterprise-client", user_type: "landscape-design",
  work_type: "front-yard", watermark: "https://example.com/logo.png",
  image_url: "https://example.com/projects/177/front/source.jpg",
  original: { design_style: { answer: "Mediterranean" } },
};
const wrapper = { project_id: "cp-138963", chats, design_data: [] };

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("DESIGN_API_URL", "https://design.example/");
  vi.stubEnv("DESIGN_API_KEY", "test-only");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

async function submit(body: unknown) {
  const { POST } = await import("./route");
  return POST(new Request("http://localhost/api/design-brief", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }));
}

describe("project ID forwarding", () => {
  it.each(["landscape-design", "color-material"])("preserves the wrapper ID for %s", async (user_type) => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ task_id: "task" }, { status: 201 }));
    vi.stubGlobal("fetch", fetch);
    const response = await submit({ ...wrapper, chats: { ...chats, user_type } });
    expect(response.status).toBe(201);
    expect(fetch.mock.calls[0][0]).toBe(`https://design.example/api/v1/luna/${user_type}`);
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.projectId).toBe("cp-138963");
    expect(body.image_url).toContain("/projects/177/");
    expect(body.original.design_style).toBe("Mediterranean");
    expect(body.work_type).toBe("front-yard");
    expect(body.chats).toBeUndefined();
  });
  it("preserves an already-flat brief", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ task_id: "task" }, { status: 201 }));
    vi.stubGlobal("fetch", fetch);
    expect((await submit(chats)).status).toBe(201);
    expect(JSON.parse(fetch.mock.calls[0][1].body).projectId).toBe("cp-138963");
  });
  it.each([undefined, null, "", " ", "../177"])("rejects invalid ID %s before forwarding", async (projectId) => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const response = await submit({ ...chats, projectId });
    expect(response.status).toBe(422);
    expect(fetch).not.toHaveBeenCalled();
    expect((await response.json()).error).toContain("projectId");
  });
  it("rejects conflicting wrapper IDs before forwarding", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const response = await submit({ ...wrapper, project_id: "177" });
    expect(response.status).toBe(422);
    expect((await response.json()).error).toContain("Conflicting project IDs");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects conflicting flat aliases", () => {
    expect(() => buildEnterpriseClientPayload({ ...chats, project_id: "177" })).toThrow("Conflicting project IDs");
  });
  it("converts an explicit numeric ID to a string", () => {
    expect(buildEnterpriseClientPayload({ ...chats, projectId: 177 }).projectId).toBe("177");
  });
});
