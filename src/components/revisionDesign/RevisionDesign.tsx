"use client";

import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import RevisionSummaryCard from "./RevisionSummaryCard";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { generateEnterpriseDesign } from "@/store/enterprise/enterpriseThunk";
import type { EnterpriseEntry } from "@/store/enterprise/enterpriseType";
import { buildApiPayload } from "@/lib/apiBrief";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { API_QUESTIONS } from "../chat/flow";

// interface RevisionDesignProps {
//   /** Optional override — called instead of the default generate dispatch. */
//   onGenerate?: (entry: EnterpriseEntry) => void;
//   /** Optional override — called when the user wants to edit the comments. */
//   onMakeChanges?: (entry: EnterpriseEntry) => void;
// }


const RevisionDesign = () => {
  const dispatch = useAppDispatch();
  const { entries } = useAppSelector((state) => state.enterprise);
  /** Id of the entry whose Generate action is currently in flight. */
  const [generatingId, setGeneratingId] = useState<string | null>(null);
 const { watermark, image_url, work_type, original: chat_original, revision_comment } = useSelector((state: RootState) => state.chat);

  // Only revision entries carry questions; the original is questions: [].
  const revisions = entries.filter((entry) => entry.type === "revision");

  const handleGenerate = useCallback(
    async (entry: EnterpriseEntry) => {
      // if (onGenerate) {
      //   onGenerate(entry);
      //   return;
      // }
      if (generatingId) return;
      setGeneratingId(entry.id);
      console.log("generate revision--", entry);
      const payload = buildApiPayload(API_QUESTIONS, chat_original, {
        // id: chat.id,
        watermark: watermark ?? "",
        work_type: work_type ?? "",
        image_url: entries[entries.length - 1]?.url ?? "",
        revision: revision_comment,
      });
      console.log("generate payload--", payload);
      try {
        await dispatch(generateEnterpriseDesign(payload)).unwrap();
        toast.success(
          "Your design brief has been sent to Brooke Edwards for review!"
        );
      } catch (error) {
        toast.error(
          typeof error === "string"
            ? error
            : error instanceof Error
              ? error.message
              : "Failed to submit the design brief"
        );
      } finally {
        setGeneratingId(null);
      }
    },
    [dispatch, generatingId, chat_original, watermark, image_url, work_type, revision_comment]
  );

  const handleMakeChanges = useCallback(() => {
    //   if (onMakeChanges) {
    //     onMakeChanges(entry);
    //     return;
    //   }
    toast("Open the chat to edit your revision comments.");
  }, []);

  if (revisions.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-4">
      {revisions.map((entry) => {
        // Combine the notes across the entry's questions (usually one).
        const notes = entry.questions
          .map((q) => q.answer.notes.trim())
          .filter(Boolean)
          .join("\n\n");
        // Total uploaded files across the entry's questions.
        const filesCount = entry.questions.reduce(
          (sum, q) => sum + (q.answer.files?.length ?? 0),
          0
        );
        // Keep the Generate action busy until the entry has a rendered image
        // (status polling fills `url` once the backend task completes). A
        // failed entry stays clickable so it can be retried.
        const hasImage = Boolean(entry.url);
        const stuckFailed = !hasImage && entry.status === "failed";
        const generating = generatingId === entry.id || (!hasImage && !stuckFailed);
        const disabled = generating;
        return (
          <RevisionSummaryCard
            key={entry.id}
            notes={notes}
            filesCount={filesCount}
            generating={generating}
            disabled={disabled}
            onGenerate={() => handleGenerate(entry)}
            onChanges={handleMakeChanges}
          />
        );
      })}
    </div>
  );
};

export default RevisionDesign;
