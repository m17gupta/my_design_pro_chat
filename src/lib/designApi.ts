import type { ApiBriefPayload } from "./apiBrief";

export interface SubmitBriefResult {
  ok: boolean;
  status: number;
  data: unknown;
}

/**
 * POST the assembled design brief (schema.md shape) to the local
 * `/api/design-brief` route, which proxies to the FastAPI backend
 * server-side. The API key never reaches the browser. Throws on network
 * failure or a non-2xx response (surfacing the backend's error message).
 */
export async function submitDesignBrief(
  payload: ApiBriefPayload
): Promise<SubmitBriefResult> {
  let res: Response;
  try {
    res = await fetch("/api/design-brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    console.log("get resposne enterprise", res);
  } catch {
    throw new Error("Network error — could not reach the design API");
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON body (e.g. HTML error page) — keep status-only failure.
  }

  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : `Design API error (${res.status})`;
    throw new Error(message);
  }

  return { ok: true, status: res.status, data };
}

/**
 * GET the status of a design generation task via the local
 * `/api/design-status/{taskId}` proxy (which forwards to the FastAPI backend
 * with the server-side API key). Returns the parsed JSON body or throws on
 * network failure / non-2xx response.
 */
export async function fetchDesignStatus(taskId: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`/api/design-status/${encodeURIComponent(taskId)}`);
  } catch {
    throw new Error("Network error — could not reach the design API");
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON body (e.g. HTML error page) — keep status-only failure.
  }

  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : `Design API error (${res.status})`;
    throw new Error(message);
  }

  return data;
}
