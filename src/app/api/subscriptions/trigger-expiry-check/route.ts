import { NextResponse } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function POST() {
  try {
    const res = await fetch(`${FASTAPI_URL}/api/v1/subscriptions/trigger-expiry-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch {
    // Return 503 so client falls back to mock
  }

  return NextResponse.json(
    { error: "Backend API unavailable — using fallback trigger response" },
    { status: 503 }
  );
}
