export const runtime = "nodejs";

const QUESTIONNAIRES_URL = "https://mydesigns.pro/luna-ai/questionnaires";

export async function GET() {
  try {
    const res = await fetch(QUESTIONNAIRES_URL, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      cache: "no-store",
    });

    const body = await res.text();
    if (!res.ok) {
      return Response.json(
        { error: `Questionnaires API error (${res.status})` },
        { status: res.status }
      );
    }

    return new Response(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return Response.json(
      { error: "Network error — could not reach the questionnaires service" },
      { status: 502 }
    );
  }
}
