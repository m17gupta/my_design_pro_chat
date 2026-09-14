import { describe, expect, it } from "vitest";
import CompareImage from "./CompareImage";

describe("CompareImage Component", () => {
  it("exports CompareImage function component", () => {
    expect(CompareImage).toBeDefined();
    expect(typeof CompareImage).toBe("function");
  });
});
