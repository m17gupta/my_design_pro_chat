import { describe, expect, it } from "vitest";
import { resolveSafeWsToken, FALLBACK_WS_TOKEN } from "./useTaskSocket";

describe("resolveSafeWsToken", () => {
  it("returns fallback token when token is null, undefined, or empty", () => {
    expect(resolveSafeWsToken(null)).toBe(FALLBACK_WS_TOKEN);
    expect(resolveSafeWsToken(undefined)).toBe(FALLBACK_WS_TOKEN);
    expect(resolveSafeWsToken("")).toBe(FALLBACK_WS_TOKEN);
    expect(resolveSafeWsToken("   ")).toBe(FALLBACK_WS_TOKEN);
  });

  it("detects expired JWT and returns fallback token", () => {
    // Expired JWT with exp in the past
    const expiredJwt =
      "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxNTE2MjM5MDIyfQ.XbPfbIHMI6arZ3Y922BhjWgQzWXcXNrz0ogrVhgEd8U";
    expect(resolveSafeWsToken(expiredJwt)).toBe(FALLBACK_WS_TOKEN);
  });

  it("preserves valid JWT with exp in the future", () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: "user-1", exp: futureExp })).toString("base64url");
    const validJwt = `${header}.${payload}.signature`;
    expect(resolveSafeWsToken(validJwt)).toBe(validJwt);
  });

  it("returns the raw string if it is not a JWT", () => {
    expect(resolveSafeWsToken("custom-auth-key-123")).toBe("custom-auth-key-123");
  });
});

