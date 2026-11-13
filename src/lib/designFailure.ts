export function describeDesignFailure(reason?: string | null): string {
  if (reason && /visual[_ -]review|scope and preservation/i.test(reason)) {
    return "The generated design did not pass the visual review. Clarify where the change should go and what should stay the same, then try again.";
  }
  return "The design could not be generated. Please try again.";
}
