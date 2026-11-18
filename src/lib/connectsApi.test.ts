import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchUserConnectsBalance } from "./connectsApi";

describe("fetchUserConnectsBalance", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("fetches balance successfully with available_connects > 0", async () => {
    const mockResponse = {
      success: true,
      result: {
        total_connects: 225,
        used_cconnects: 112,
        available_connects: 113,
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as unknown as Response);

    const data = await fetchUserConnectsBalance(7500, "test-token-xyz");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.dzinly.com/api/v1/connects/7500/balance",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token-xyz",
        },
      }
    );

    expect(data.success).toBe(true);
    expect(data.result?.available_connects).toBe(113);
  });

  it("preserves Bearer prefix if token already includes it", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, result: { available_connects: 5 } }),
    } as unknown as Response);

    await fetchUserConnectsBalance("user-123", "Bearer already-bearer-token");

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/connects/user-123/balance"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer already-bearer-token",
        }),
      })
    );
  });

  it("throws error when API returns a non-200 error response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ success: false, error: "Authentication is required to continue" }),
    } as unknown as Response);

    await expect(fetchUserConnectsBalance(7500, "bad-token")).rejects.toThrow(
      "Authentication is required to continue"
    );
  });
});
