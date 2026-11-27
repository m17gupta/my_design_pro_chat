export const runtime = "nodejs";

/**
 * Server-side proxy for POST /api/v1/luna/designer-generate.
 * Reads server-only `DESIGN_API_URL` (falls back to `http://localhost:8000`)
 * and forwards `X-API-Key` from `DESIGN_API_KEY` when configured, avoiding
 * browser CORS issues and keeping API keys off the client.
 */
export async function POST(request: Request) {
  const baseUrl = (
    process.env.DESIGN_API_URL || "http://localhost:8000"
  ).replace(/\/+$/, "");
  const apiKey = process.env.DESIGN_API_KEY || "";

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON request body" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const targetUrl = `${baseUrl}/api/v1/luna/designer-generate`;

  const headers: Record<string, string> = {
    accept: "*/*",
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
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
        error: `Could not reach designer-generate API at ${targetUrl}`,
        detail,
      },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
