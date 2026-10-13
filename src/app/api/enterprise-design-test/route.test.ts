import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXUS_API_ORIGIN", "http://127.0.0.1:8000");
  vi.stubEnv("NEXUS_VENDOR_API_KEY", "offline-test-key");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("enterprise revision test proxy", () => {
  it.each([200,202,422,503])("preserves backend HTTP %s and response JSON", async status => {
    const body = status === 200 ? {response_type:"text_answer", answer:"Roof advice"} : status === 202 ? {response_type:"image_generation",task_id:"task-1"} : {detail:"Backend error"};
    const mock = vi.fn().mockResolvedValue(Response.json(body,{status}));
    vi.stubGlobal("fetch",mock);
    const {POST} = await import("./route");
    const payload = {revision_comment:{notes:"Suggest roof colors",files:[]},user_type:"",role:null};
    const result = await POST(new Request("http://localhost:3000/api/enterprise-design-test",{method:"POST",body:JSON.stringify(payload)}));
    expect(result.status).toBe(status);
    expect(await result.json()).toEqual(body);
    expect(mock.mock.calls[0][0]).toBe("http://127.0.0.1:8000/api/v1/luna/enterprise-design/test");
    expect(JSON.parse(mock.mock.calls[0][1].body)).toEqual(payload);
    expect(mock.mock.calls[0][1].headers["X-API-Key"]).toBe("offline-test-key");
  });
  it("reports network failure without automatic submission retries",async()=>{
    const mock=vi.fn().mockRejectedValue(new Error("Offline")); vi.stubGlobal("fetch",mock);
    const {POST}=await import("./route");
    const result=await POST(new Request("http://localhost/api/enterprise-design-test",{method:"POST",body:"{}"}));
    expect(result.status).toBe(502); expect(mock).toHaveBeenCalledTimes(1);
  });
});
