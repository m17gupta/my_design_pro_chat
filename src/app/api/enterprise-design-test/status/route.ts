export const runtime = "nodejs";

const NEXUS_API_ORIGIN = (
  process.env.NEXUS_API_ORIGIN ||
  process.env.DESIGN_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

const NEXUS_VENDOR_API_KEY =
  process.env.NEXUS_VENDOR_API_KEY ||
  process.env.DESIGN_API_KEY ||
  "";

/**
 * Proxy for polling task image status from backend.
 * Forwards GET /api/enterprise-design-test/status?task_id=... to:
 *   GET ${NEXUS_API_ORIGIN}/api/v1/luna/status/{task_id}
 */
export async function GET(request: Request) {
  if (!NEXUS_VENDOR_API_KEY) {
    return Response.json(
      { error: "NEXUS_VENDOR_API_KEY or DESIGN_API_KEY is not configured" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("task_id");

  if (!taskId) {
    return Response.json(
      { error: "Missing required query parameter: task_id" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const targetUrl = `${NEXUS_API_ORIGIN}/api/v1/luna/status/${encodeURIComponent(taskId)}`;

  try {
    const backendRes = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "X-API-Key": NEXUS_VENDOR_API_KEY,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    const responseText = await backendRes.text();
    let responseData: unknown;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { error: "Backend returned a non-JSON response", upstream_status: backendRes.status };
    }

    return Response.json(responseData, {
      status: typeof responseData === "object" && responseData !== null && "upstream_status" in responseData ? 502 : backendRes.status,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: "Network error reaching backend status endpoint", detail: message },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
