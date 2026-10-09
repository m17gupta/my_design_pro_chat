export const runtime = "nodejs";

import { buildEnterpriseClientPayload, DesignPayloadError, unwrapDesignBrief } from "../../../lib/enterpriseClientPayload";

const DESIGN_API_URL = process.env.DESIGN_API_URL ?? "";
const DESIGN_API_KEY = process.env.DESIGN_API_KEY ?? "";

export async function POST(request: Request) {
  if (!DESIGN_API_URL) {
    return Response.json({ error: "DESIGN_API_URL is not configured" }, { status: 500 });
  }
  if (!DESIGN_API_KEY) {
    return Response.json({ error: "DESIGN_API_KEY is not configured" }, { status: 500 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let res: Response;
  try {
    payload = unwrapDesignBrief(payload);
    // Normalize the base URL so a trailing slash never produces a double
    // slash (e.g. `https://api.dzinlynxt.com/` + `/api/v1/…` → 404).
    const base = DESIGN_API_URL.replace(/\/+$/, "");

    const rawRole = String(
      (payload && typeof payload === "object" && "role" in payload
        ? (payload as { role?: unknown }).role
        : "") ?? ""
    )
      .trim()
      .toLowerCase();

    const rawUserType = String(
      (payload && typeof payload === "object" && "user_type" in payload
        ? (payload as { user_type?: unknown }).user_type
        : "") ?? ""
    )
      .trim()
      .toLowerCase();

    let endpointPath = "/api/v1/luna/enterprise-design";
    let outgoingBody: unknown = payload;

    const incomingQuestionnaires =
      payload && typeof payload === "object" && "questionnaires" in payload
        ? ((payload as { questionnaires?: unknown }).questionnaires as Record<string, unknown> | null)
        : null;

    if (rawRole === "enterprise-client") {
      if (rawUserType === "landscape-design" || rawUserType === "landscape_design") {
        console.log("calling client landscape-design");
        endpointPath = "/api/v1/luna/landscape-design";
        outgoingBody = buildEnterpriseClientPayload(payload as Record<string, unknown>, incomingQuestionnaires);
      } else if (rawUserType === "color-material" || rawUserType === "color_material") {
        console.log("calling client color-material");
        endpointPath = "/api/v1/luna/color-material";
        outgoingBody = buildEnterpriseClientPayload(payload as Record<string, unknown>, incomingQuestionnaires);
      }
    }

    res = await fetch(`${base}${endpointPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": DESIGN_API_KEY,
      },
      body: JSON.stringify(outgoingBody),
    });
  } catch (error) {
    if (error instanceof DesignPayloadError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
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
