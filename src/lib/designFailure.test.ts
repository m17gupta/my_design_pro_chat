import { describe, expect, it } from "vitest";
import { describeDesignFailure } from "./designFailure";

describe("design failure guidance", () => {
  it("asks the user to clarify the scope after a visual review rejection", () => {
    expect(describeDesignFailure("Edit failed at visual_review (ValueError). Generated edit did not pass scope and preservation verification"))
      .toContain("Clarify where the change should go and what should stay the same");
  });

  it("does not expose unrelated backend diagnostics in the chat", () => {
    expect(describeDesignFailure("worker unavailable: internal diagnostics"))
      .toBe("The design could not be generated. Please try again.");
  });
});
