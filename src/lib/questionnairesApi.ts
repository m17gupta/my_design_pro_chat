import type { QuestionnairesResponse } from "../store/questionnaires/questionnaireType";

/**
 * GET the questionnaires JSON payload from the local `/api/questionnaires` proxy route.
 * Throws an Error with a descriptive message on network failure or non-2xx status code.
 */
export async function fetchQuestionnairesApi(): Promise<QuestionnairesResponse> {
  let res: Response;
  try {
    res = await fetch("/api/questionnaires", {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    throw new Error("Network error — could not fetch questionnaires");
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON response body
  }

  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : `Questionnaires API error (${res.status})`;
    throw new Error(message);
  }

  if (!data || typeof data !== "object") {
    throw new Error("Invalid response payload from questionnaires API");
  }

  return data as QuestionnairesResponse;
}
