import { NextRequest, NextResponse } from "next/server";
import { isSupabaseServerConfigured, supabaseAdmin } from "../../../../lib/supabaseAdmin";

const FASTAPI_URL = process.env.DESIGN_API_URL ?? "";
const FASTAPI_SECRET_KEY = process.env.token ?? "";

export async function GET(req: NextRequest) {
  // 1. Attempt fetching from FastAPI backend endpoint first
  try {
    const rawAuthHeader = req.headers.get("Authorization");
    const token = FASTAPI_SECRET_KEY || (rawAuthHeader ? rawAuthHeader.replace(/^Bearer\s+/i, "") : "");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
    }

    const base = FASTAPI_URL.replace(/\/+$/, "");

    const res = await fetch(
      `${base}/api/v1/admin/vendors`,
      {
        headers,
        cache: "no-store",
      }
    );
    console.log("Fast api response", res.status, res.statusText);

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch (error) {
    console.error("FastAPI fetch error:", error);
    // Backend API down — fallback to Supabase table query
  }

  // 3. Fallback response if no data exists in table or database unavailable
  return NextResponse.json({
    success: true,
    total: 0,
    active_count: 0,
    expiring_count: 0,
    expired_count: 0,
    subscriptions: [],
    data: [],
  });
}

