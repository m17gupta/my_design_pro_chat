import { NextResponse } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function GET() {
  try {
    const res = await fetch(`${FASTAPI_URL}/api/v1/subscriptions/my-status`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch {
    // If backend is not available, return 503 so client falls back to mock smoothly
  }

  return NextResponse.json(
    { error: "Backend API unavailable — using fallback data" },
    { status: 503 }
  );
}
