export const runtime = "nodejs";

const STATUS_API_URL = process.env.DESIGN_STATUS_API_URL ?? "";
const DESIGN_API_KEY = process.env.DESIGN_API_KEY ?? "";

/**
 * Server-side proxy for task status polling. GET /api/design-status/{taskId}
 * forwards to `DESIGN_STATUS_API_URL/{taskId}` (FastAPI) with the server-only
 * API key and passes the JSON response through untouched, e.g.:
 *
 *   { "status": "completed", "result": { "generated_image_url": "…", … }, "error": null }
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/design-status/[taskId]">
) {
  const { taskId } = await ctx.params;

  if (!STATUS_API_URL) {
    return Response.json({ error: "DESIGN_STATUS_API_URL is not configured" }, { status: 500 });
  }
  if (!DESIGN_API_KEY) {
    return Response.json({ error: "DESIGN_API_KEY is not configured" }, { status: 500 });
  }

  let res: Response;
  try {
    // Normalize the base URL so a trailing slash never produces a double
    // slash (e.g. `…/status/` + `/{taskId}` → 404).
    const base = STATUS_API_URL.replace(/\/+$/, "");
    res = await fetch(`${base}/${encodeURIComponent(taskId)}`, {
      method: "GET",
      headers: { "X-API-Key": DESIGN_API_KEY },
    });
  } catch {
    return Response.json(
      { error: "Network error — could not reach the design API" },
      { status: 502 }
    );
  }

  const body = await res.text();
  if (!res.ok) {
    let message = `Design API error (${res.status})`;
    try {
      const data = JSON.parse(body) as { detail?: unknown };
      if (typeof data.detail === "string") message = data.detail;
      else if (data.detail && typeof data.detail === "object") {
        message = JSON.stringify(data.detail);
      }
    } catch {
      // Non-JSON error body — keep the status-based message.
    }
    return Response.json({ error: message }, { status: res.status });
  }

  return new Response(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
