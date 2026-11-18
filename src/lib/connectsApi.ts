export interface ConnectsBalanceResult {
  total_connects?: number;
  used_cconnects?: number;
  available_connects?: number;
  [key: string]: unknown;
}

export interface ConnectsBalanceResponse {
  success: boolean;
  result?: ConnectsBalanceResult;
  message?: string;
  error?: string;
}

const CONNECTS_API_BASE =
  process.env.DESIGN_API_URL ?? "https://api.dzinly.com";

/**
 * Fetch the connects balance for a given user.
 * Endpoint: GET https://api.dzinly.com/api/v1/connects/{user_id}/balance
 */
export async function fetchUserConnectsBalance(
  userId: number | string,
  token: string
): Promise<ConnectsBalanceResponse> {
  const authToken = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  const base = CONNECTS_API_BASE.replace(/\/+$/, "");
  const res = await fetch(
    `${base}/api/v1/connects/${encodeURIComponent(userId)}/balance`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: authToken,
      },
    }
  );

  if (!res.ok) {
    let errorMsg = `Connects API error (${res.status})`;
    try {
      const errData = await res.json();
      if (errData?.error && typeof errData.error === "string") {
        errorMsg = errData.error;
      } else if (errData?.message && typeof errData.message === "string") {
        errorMsg = errData.message;
      }
    } catch {
      // Non-JSON response
    }
    throw new Error(errorMsg);
  }

  const data: ConnectsBalanceResponse = await res.json();
  return data;
}
