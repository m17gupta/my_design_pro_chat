export const runtime = "nodejs";

/**
 * Server-side proxy for GET /api/v1/tasks/{taskId}.
 * Reads server-only `DESIGN_API_URL` (falls back to `http://localhost:8000`)
 * and forwards `X-API-Key` from `DESIGN_API_KEY` when configured.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/designer-generate/tasks/[taskId]">
) {
  const { taskId } = await ctx.params;

  if (!taskId || !taskId.trim()) {
    return Response.json(
      { error: "taskId is required" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const baseUrl = (
    process.env.DESIGN_API_URL || "http://localhost:8000"
  ).replace(/\/+$/, "");
  const apiKey = process.env.DESIGN_API_KEY || "";

  const targetUrl = `${baseUrl}/api/v1/tasks/${encodeURIComponent(taskId.trim())}`;

  const headers: Record<string, string> = {
    accept: "*/*",
  };
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown network error";
    return Response.json(
      {
        error: `Could not reach task status API at ${targetUrl}`,
        detail,
      },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
