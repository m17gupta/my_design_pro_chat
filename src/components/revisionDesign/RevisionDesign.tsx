"use client";

import type { EnterpriseEntry } from "@/store/enterprise/enterpriseType";
import { revisionRoundFromMessage } from "../chat/flow";
import RevisionResultCard, {
  type SubmitAction,
} from "./RevisionResultCard";
import RevisionSummaryCard from "./RevisionSummaryCard";

export interface DerivedRevisionRound {
  /** 1-based loop round. */
  round: number;
  /** This round's revision entry — undefined until its Generate is submitted. */
  entry?: EnterpriseEntry;
}

/**
 * Selector/deriver: given a revision-summary message id + the Redux entries,
 * return the round and the entry bound to it. Rounds always map by index into
 * the `type: "revision"` entries, so a round never borrows another round's
 * data (each `RevisionResultCard` binds to its own entry by id).
 */
export function deriveRevisionRound(
  messageId: string,
  entries: EnterpriseEntry[]
): DerivedRevisionRound | null {
  const round = revisionRoundFromMessage(messageId);
  if (!round) return null;
  const revisions = entries.filter((entry) => entry.type === "revision");
  return { round, entry: revisions[round - 1] };
}

interface RevisionDesignProps {
  /** The `ep-revision-summary[-N]` message this round is rendered for. */
  messageId: string;
  /** Redux `enterprise.entries` — the single source of truth for rounds. */
  entries: EnterpriseEntry[];
  /** Fallback comments (notes + files) until this round's entry exists. */
  fallbackNotes: string;
  fallbackFiles: string[];
  /** Whether this message is the latest revision-summary (the current round). */
  isCurrent: boolean;
  /** Satisfaction rating for this round's entry (0 = unrated). */
  rating: number;
  onRate: (value: number) => void;
  /** Set once a terminal action was submitted — locks every result card. */
  submittedAction: SubmitAction | null;
  /** True while this round's generate POST is in flight (entry not appended yet). */
  pendingGenerate: boolean;
  /** True when the round cap is reached — disables Regenerate on the result card. */
  regenerateDisabled: boolean;
  onGenerate: () => void;
  onMakeChanges: () => void;
  onAllINeed: (rating: number) => void;
  onRegenerate: () => void;
  onEngageDesigner: (rating: number) => void;
}

/**
 * Per-round orchestrator: renders the Revision Summary card ("what you asked
 * for") + Revision Result card ("what you got") for exactly one loop round.
 * Pure — reads nothing from Redux, every value arrives via props.
 */
export default function RevisionDesign({
  messageId,
  entries,
  fallbackNotes,
  fallbackFiles,
  isCurrent,
  rating,
  onRate,
  submittedAction,
  pendingGenerate,
  regenerateDisabled,
  onGenerate,
  onMakeChanges,
  onAllINeed,
  onRegenerate,
  onEngageDesigner,
}: RevisionDesignProps) {
  const derived = deriveRevisionRound(messageId, entries);
  if (!derived) return null;
  const { round, entry } = derived;

  // The round's comments come from its own entry once it exists.
  // HOWEVER, if this is the current round and the user has actively provided
  // feedback in `revision_comment` (fallbackNotes), that takes precedence
  // over any stale `entry` data (e.g. if they edited a failed round).
  const hasActiveFallback = isCurrent && (fallbackNotes !== "" || fallbackFiles.length > 0);
  const notes = hasActiveFallback ? fallbackNotes : (entry?.questions[0]?.answer.notes ?? fallbackNotes);
  const files = hasActiveFallback ? fallbackFiles : (entry?.questions[0]?.answer.files ?? fallbackFiles);

  const status = entry?.status;
  const hasImage = Boolean(entry?.url);
  // Spinner while the task is in flight: an entry without an image that hasn't
  // reached a terminal status (matches the result card's own loading state).
  const inFlight =
    Boolean(entry) &&
    !hasImage &&
    status !== "failed" &&
    status !== "completed";
  const completed = entry?.status === "completed";
  const inProgress =
    status === "pending" || status === "queued" || status === "processing";

  const generating = pendingGenerate || inFlight || inProgress;
  const pending = status === "pending";

  // History rounds (and completed current rounds) keep the summary read-only;
  // a failed entry stays clickable so the same round can be retried.
  const disabled = generating || completed || pending || !isCurrent;
  const showActions = isCurrent && !completed;

  return (
    <div className="flex w-full flex-col gap-4">
      <RevisionSummaryCard
        round={round}
        notes={notes}
        filesCount={files.length}
        files={files}
        generating={generating}
        disabled={disabled}
        showActions={showActions}
        onGenerate={onGenerate}
        onChanges={onMakeChanges}
      />
      {entry && (
        <RevisionResultCard
          entry={entry}
          round={round}
          rating={rating}
          onRate={onRate}
          locked={!isCurrent || Boolean(submittedAction) || generating}
          regenerateDisabled={regenerateDisabled}
          submittedAction={submittedAction}
          onAllINeed={onAllINeed}
          onRegenerate={onRegenerate}
          onEngageDesigner={onEngageDesigner}
        />
      )}
    </div>
  );
}
