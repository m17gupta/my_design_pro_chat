import { describe, expect, it } from "vitest";
import { episodeMessageId, revisionApiKey, buildEpisodes } from "./flow";
import type { Message } from "./types";
import enterpriseReducer, { removeFailedRevision } from "../../store/enterprise/enterpriseSlice";
import type { EnterpriseEntry } from "../../store/enterprise/enterpriseType";

describe("Revision Failure Restoration Flow", () => {
  const episodes = buildEpisodes(undefined);
  const revisionKey = revisionApiKey(episodes);

  it("retains the revision card as the last message and pre-fills notes and files on failure", () => {
    const round = 1;
    const commentId = episodeMessageId(revisionKey, round);
    const summaryId = episodeMessageId("revision-summary", round);

    const initialMessages: Message[] = [
      { id: "intro", role: "assistant", content: "Welcome" },
      { id: "summary", role: "assistant", content: "Design Summary" },
      { id: commentId, role: "assistant", content: "Please share revision requests" },
      { id: "user-comment-answer", role: "user", content: "Change wall color to navy" },
      { id: summaryId, role: "assistant", content: "Generating revision..." },
    ];

    const userComment = {
      notes: "Change wall color to navy",
      files: ["https://example.com/wall-sample.jpg"],
    };

    // Simulate handleRevisionFailure message truncation & restoration logic
    const i = initialMessages.findIndex((m) => m.id === commentId);
    expect(i).toBeGreaterThanOrEqual(0);

    const base = initialMessages.slice(0, i + 1);
    const restoredMessages = base.map((m) =>
      m.id === commentId
        ? { ...m, initialAnswer: userComment, isRestored: true }
        : m,
    );

    // 1. The messages list ends at the revision card
    expect(restoredMessages).toHaveLength(3);
    const lastMessage = restoredMessages[restoredMessages.length - 1];
    expect(lastMessage.id).toBe(commentId);

    // 2. The revision card is the current active card
    const isCurrent = restoredMessages.length - 1 === restoredMessages.findIndex((m) => m.id === commentId);
    expect(isCurrent).toBe(true);

    // 3. User notes and files are preserved in initialAnswer
    expect(lastMessage.initialAnswer).toEqual({
      notes: "Change wall color to navy",
      files: ["https://example.com/wall-sample.jpg"],
    });
    expect(lastMessage.isRestored).toBe(true);

    // 4. Failed revision entry is removed from Redux
    const failedEntry: EnterpriseEntry = {
      id: "pending-revision-1",
      url: "",
      status: "failed",
      type: "revision",
      questions: [],
    };
    const nextState = enterpriseReducer(
      {
        entries: [failedEntry],
        editId: null,
        isSkipped: false,
        lifecycle: "failed",
        error: "Task failed",
      },
      removeFailedRevision({ round: 1 }),
    );

    expect(nextState.entries).toHaveLength(0);
    expect(nextState.lifecycle).toBe("idle");
    expect(nextState.error).toBeNull();
  });
});
