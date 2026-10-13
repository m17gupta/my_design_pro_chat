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
 * Proxy for testing the isolated enterprise design backend endpoint.
 * Forwards POST /api/enterprise-design-test to:
 *   POST ${NEXUS_API_ORIGIN}/api/v1/luna/enterprise-design/test
 */
export async function POST(request: Request) {
  if (!NEXUS_VENDOR_API_KEY) {
    return Response.json(
      { error: "NEXUS_VENDOR_API_KEY or DESIGN_API_KEY is not configured" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON request body" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const targetUrl = `${NEXUS_API_ORIGIN}/api/v1/luna/enterprise-design/test`;

  try {
    const backendRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": NEXUS_VENDOR_API_KEY,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(100_000),
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
      { error: "Network error reaching backend test endpoint", detail: message },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
