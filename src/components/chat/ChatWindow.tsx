"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import LunaAvatar from "./LunaAvatar";
import MessageBubble from "./MessageBubble";
import ProgressChecklist from "./ProgressChecklist";
import type { CardResult } from "./QuestionCard";
import TypingIndicator from "./TypingIndicator";
import {
  API_QUESTIONS,
  buildMessage,
  buildRestoredTranscript,
  countRevisionRounds,
  episodeById,
  episodeMessageId,
  nextEpisodeId,
  revisionRoundFromMessage,
} from "./flow";
import { deriveRevisionRound } from "../revisionDesign/RevisionDesign";
import type { SubmitAction } from "../revisionDesign/RevisionResultCard";
import { CHECKLIST, type AnswerValue, type Message } from "./types";
import {
  answerQuestion,
  resetBrief,
  selectBriefPayload,
  setContext,
  setRevision,
} from "../../store/briefSlice";
import {
  resetEnterprise,
  selectLatestEnterpriseEntry,
} from "../../store/enterprise/enterpriseSlice";
import {
  fetchEnterpriseStatus,
  generateEnterpriseDesign,
} from "../../store/enterprise/enterpriseThunk";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { buildApiPayload } from "@/lib/apiBrief";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

/** Decoded shape of the base64 `?params` query string sent from the site. */
interface ClientParams {
  id?: number;
  work_type?: string;
  image_url?: string;
  watermark?: string;
  value?: string;
}

/** URL-safe base64 → JSON object; returns undefined when absent/malformed. */
function decodeClientParams(raw: string | null): ClientParams | undefined {
  if (!raw) return undefined;
  try {
    const standard = raw.replace(/-/g, "+").replace(/_/g, "/");
    const padded = standard.padEnd(standard.length + ((4 - (standard.length % 4)) % 4), "=");
    return JSON.parse(atob(padded)) as ClientParams;
  } catch {
    return undefined;
  }
}

let idCounter = 0;
const nextId = () => `m-${Date.now()}-${idCounter++}`;

const TYPING_MS = 950;
/** Max revision loop rounds — beyond this, Regenerate is capped. */
const MAX_REVISION_ROUNDS = 3;

/** First status poll fires 3s after the task starts; every POLL_MS after that. */
const POLL_START_MS = 3000;
const POLL_MS = 3000;
/** Safety cap (~3 min) so the loader can never spin forever on a stuck task. */
const MAX_POLLS = 60;

// Stable empty object so memoized bubbles without uploads don't re-render.
const EMPTY_FILES: Record<number, File[]> = {};

export default function ChatWindow() {
  
  const restoredItems = useAppSelector((s) => s.chat.original);
  const { entries } = useSelector((state: RootState) => state.enterprise);
  const restoredTranscript = useMemo(
    () => buildRestoredTranscript(restoredItems, entries),
    [restoredItems, entries]
  );

  // Flow messages keep their `ep-<apiKey>` id (one appearance per episode)
  // so uploads and Handoff labels can be keyed by episode apiKey.
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentId, setCurrentId] = useState("welcome");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  /** apiKey → (field index → files) */
  const [uploads, setUploads] = useState<Record<string, Record<number, File[]>>>({});
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [typing, setTyping] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const announcedIdRef = useRef<string | null>(null);

  // Enterprise status poll
  const [pollCount, setPollCount] = useState(0);
  const [submittedAction, setSubmittedAction] = useState<SubmitAction | null>(null);
  const [pendingRevisionGenerate, setPendingRevisionGenerate] = useState<number | null>(
    null
  );
  const [ratings, setRatings] = useState<Record<string, number>>({});

  const dispatch = useAppDispatch();
  const briefPayload = useAppSelector(selectBriefPayload);
  const revisionComment = useAppSelector((s) => s.chat.revision_comment);
  const latestEnterpriseEntry = useAppSelector((s) =>
    selectLatestEnterpriseEntry(s.enterprise)
  );

  const [generating, setGenerating] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);
  const {watermark, image_url, work_type, id,original:chat_original} = briefPayload;
  const busyRef = useRef(false);
  const [messageEpisodes, setMessageEpisodes] = useState<Record<string, string>>({});
  
  const searchParams = useSearchParams();

  // Initialize or restore messages and context on client mount after hydration completes.
  // Wipes the Redux store and localStorage if the project id has changed.
  const didInitializeRef = useRef(false);
  useEffect(() => {
    if (didInitializeRef.current) return;
    didInitializeRef.current = true;

    const params = decodeClientParams(searchParams.get("params"));

    let isNewSession = false;
    let incomingProjectId = "";

    if (params) {
      // The project id is the single session identifier: a fresh, unique id
      // from the host means a brand-new project, while a refresh keeps the
      // same id so the persisted transcript can be restored.
      incomingProjectId = params.id ? String(params.id) : "";

      const lastProjectId = window.localStorage.getItem("luna-project-id-v1");

      if (lastProjectId && lastProjectId !== incomingProjectId) {
        isNewSession = true;
      }

      // Persist the current value for future mismatch comparison on refresh.
      if (incomingProjectId) {
        window.localStorage.setItem("luna-project-id-v1", incomingProjectId);
      }
    }

    if (isNewSession) {
      // Clear persistence and memory stores
      window.localStorage.removeItem("luna-brief-v1");
      window.localStorage.removeItem("luna-enterprise-v2");
      dispatch(resetBrief());
      dispatch(resetEnterprise());

      // Start fresh welcome message
      setMessages([buildMessage(episodeById("welcome"))]);
      setCurrentId("welcome");
      setAnswers({});
      setCompleted(new Set());
      setMessageEpisodes({});
    } else {
      // Restore from persisted state
      const anyAnswered = Object.values(restoredItems).some(
        (item) => item !== undefined
      );
      if (anyAnswered) {
        setMessages(restoredTranscript.messages);
        setCurrentId(restoredTranscript.currentId);
        setAnswers(restoredTranscript.answers);
        setCompleted(restoredTranscript.completed);
        setMessageEpisodes(restoredTranscript.messageEpisodes);
      } else {
        setMessages([buildMessage(episodeById("welcome"))]);
      }
    }

    if (params) {
      dispatch(
        setContext({
          id: params.id,
          work_type: params.work_type,
          image_url: params.image_url,
          watermark: params.watermark,
          value: params.value,
        })
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearTypingTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, typing, scrollToBottom]);

  useEffect(() => clearTypingTimeout, [clearTypingTimeout]);

  // Announce completed assistant turns to screen readers.
  useEffect(() => {
    if (typing) return;
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (lastAssistant && lastAssistant.id !== announcedIdRef.current) {
      announcedIdRef.current = lastAssistant.id;
      setAnnouncement(`Luna says: ${lastAssistant.content.replace(/\*\*/g, "")}`);
    }
  }, [messages, typing]);

  const uploadTotal = useMemo(
    () =>
      Object.values(uploads).reduce(
        (sum, fields) =>
          sum + Object.values(fields).reduce((s, arr) => s + arr.length, 0),
        0
      ),
    [uploads]
  );

  const startOver = useCallback(() => {
    clearTypingTimeout();
    busyRef.current = false;
    setTyping(false);
    setMessages([buildMessage(episodeById("welcome"))]);
    setCurrentId("welcome");
    setAnswers({});
    dispatch(resetBrief());
    dispatch(resetEnterprise());
    setUploads({});
    setCompleted(new Set());
    setGenerating(false);
    setEditingId(null);
    setMessageEpisodes({});
    setRatings({});
    setSubmittedAction(null);
    setPendingRevisionGenerate(null);
    announcedIdRef.current = null;
    setMenuOpen(false);
  }, [clearTypingTimeout, dispatch]);

  /**
   * Record an answer for the current episode, then (after Luna "types") push
   * the next episode's message.
   */
  const commit = useCallback(
    (
      userText: string,
      filesByField?: Record<number, File[]>,
      urlsByField?: Record<number, Record<string, string>>,
      structuredAnswer?: AnswerValue
    ) => {
      if (typing || busyRef.current) return;
      busyRef.current = true;
      const ep = episodeById(currentId);

      // Clicking "I am ready to proceed →" on the welcome screen starts a fresh
      // intake: wipe the Redux brief (and its localStorage copy), the design
      // history (enterprise entries), plus any restored/display state before
      // recording the first answer.
      if (currentId === "welcome") {
        dispatch(resetBrief());
        dispatch(resetEnterprise());
        setAnswers({});
        setUploads({});
        setCompleted(new Set());
        setRatings({});
        setSubmittedAction(null);
      }

      const userMessage: Message = { id: nextId(), role: "user", content: userText };
      setMessages((prev) => [...prev, userMessage]);
      setMessageEpisodes((prev) => ({ ...prev, [userMessage.id]: ep.apiKey }));

      const checklistId = ep.checklistId;
      if (checklistId) {
        setAnswers((prev) => ({ ...prev, [checklistId]: userText }));
        setCompleted((prev) => new Set(prev).add(checklistId));
      }
      if (ep.api && structuredAnswer !== undefined) {
        dispatch(answerQuestion({ apiKey: ep.apiKey, answer: structuredAnswer }));
      }
      if (filesByField && ep.apiKey !== "welcome") {
        // Revision rounds are keyed by their round-specific message id so each
        // loop's uploaded files never leak into the next round's comments card.
        const key =
          ep.apiKey === "revision"
            ? episodeMessageId("revision", countRevisionRounds(messages))
            : ep.apiKey;
        setUploads((prev) => ({ ...prev, [key]: filesByField }));
      }

      // Revision feedback stores `{ files: [uploaded URLs], notes: text }` in
      // the brief payload so the regeneration POST carries the changes.
      if (ep.apiKey === "revision") {
        const urls = urlsByField
          ? Object.values(urlsByField).flatMap((byKey) => Object.values(byKey))
          : [];
        dispatch(setRevision({ files: urls, notes: userText }));
      }

      const nextEpisode = nextEpisodeId(ep.apiKey, userText);
      setTyping(true);
      clearTypingTimeout();
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        busyRef.current = false;
        setTyping(false);
        setMessages((prev) => {
          const nextMsg = buildMessage(episodeById(nextEpisode));
          // One summary per revision round — suffix by the round's comment-card
          // count so round N always lands on `ep-revision-summary[-N]`.
          const id =
            nextEpisode === "revision-summary"
              ? episodeMessageId("revision-summary", countRevisionRounds(prev))
              : (() => {
                  const count = prev.filter(
                    (m) => m.id === nextMsg.id || m.id.startsWith(`${nextMsg.id}-`)
                  ).length;
                  return count === 0 ? nextMsg.id : `${nextMsg.id}-${count + 1}`;
                })();
          return [...prev, { ...nextMsg, id }];
        });
        setCurrentId(nextEpisode);
      }, TYPING_MS);
    },
    [typing, currentId, messages, clearTypingTimeout, dispatch]
  );

  const advance = useCallback((rawAnswer: string) => commit(rawAnswer), [commit]);

  const handleCardSubmit = useCallback(
    (result: CardResult) =>
      commit(result.answerText, result.files, result.fileUrls, result.answer),
    [commit]
  );

  /**
   * Toggle edit mode for a user message. Only one answer can be edited at a
   * time — clicking a second edit icon while another edit is open is blocked.
   */
  const handleEditStart = useCallback(
    (messageId: string) => {
      const epId = messageEpisodes[messageId];
      let targetId = messageId;
      if (epId) {
        const ep = episodeById(epId);
        if (ep.kind === "card") {
          targetId = `ep-${epId}`;
        }
      }

      if (editingId !== null && editingId !== targetId) {
        toast.error(
          "Only one answer can be edited at a time — save or cancel the current edit first."
        );
        return;
      }
      setEditingId(editingId === targetId ? null : targetId);
    },
    [editingId, messageEpisodes]
  );

  /** Apply an edited answer to the transcript, checklist summary, and API payload. */
  const handleEditSave = useCallback(
    (messageId: string, rawText: string) => {
      const text = rawText.trim();
      if (text) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, content: text } : m))
        );
      }

      const epId = messageEpisodes[messageId];
      if (epId) {
        const ep = episodeById(epId);
        if (ep.checklistId && text) {
          setAnswers((prev) => ({ ...prev, [ep.checklistId as string]: text }));
          setCompleted((prev) => new Set(prev).add(ep.checklistId as string));
        }
        if (ep.api && text) {
          const apiKey = ep.apiKey;
          const prevItem = briefPayload.original[apiKey];
          const prevAnswer =
            prevItem && typeof prevItem.answer === "object" ? prevItem.answer : undefined;
          let answer: AnswerValue | undefined;
          if (ep.api.answerShape === "text") {
            answer = text;
          } else if (ep.api.answerShape === "files-notes") {
            answer = {
              files: prevAnswer && "files" in prevAnswer ? prevAnswer.files : [],
              notes: text,
            };
          } else if (ep.api.answerShape === "value-notes") {
            answer = {
              value: prevAnswer && "value" in prevAnswer ? prevAnswer.value : [],
              notes: text,
            };
          } else {
            // "urls" — files can't be edited from plain text; keep as-is.
            answer = prevItem?.answer;
          }
          if (answer !== undefined) {
            dispatch(answerQuestion({ apiKey, answer }));
          }
        }
      }

      setEditingId(null);
    },
    [messageEpisodes, briefPayload, dispatch]
  );

  const handleCardEditSave = useCallback(
    (cardMessageId: string, result: CardResult) => {
      const text = result.answerText.trim();
      const epId = cardMessageId.replace(/^ep-/, "");
      const baseEpId = epId.startsWith("revision") ? "revision" : epId;

      setMessages((prev) => {
        const cardIndex = prev.findIndex((m) => m.id === cardMessageId);
        if (cardIndex < 0) return prev;
        
        let userMsgIndex = -1;
        for (let i = cardIndex + 1; i < prev.length; i++) {
          if (prev[i].role === "user") {
            userMsgIndex = i;
            break;
          }
        }
        if (userMsgIndex >= 0) {
          return prev.map((m, idx) => idx === userMsgIndex ? { ...m, content: text } : m);
        }
        return prev;
      });

      if (baseEpId) {
        const ep = episodeById(baseEpId);
        if (ep.checklistId) {
          setAnswers((prev) => ({ ...prev, [ep.checklistId as string]: text }));
          setCompleted((prev) => new Set(prev).add(ep.checklistId as string));
        }
        if (ep.api) {
          const apiKey = ep.apiKey;
          dispatch(answerQuestion({ apiKey, answer: result.answer }));
        }
        if (baseEpId === "revision") {
          const ans = result.answer;
          if (ans && typeof ans === "object" && "notes" in ans) {
            dispatch(
              setRevision({
                files: "files" in ans && ans.files ? ans.files : [],
                notes: ans.notes,
              })
            );
          }
        }
        const filesKey = cardMessageId.startsWith("ep-revision") ? cardMessageId : ep.apiKey;
        setUploads((prev) => ({ ...prev, [filesKey]: result.files }));
      }

      setEditingId(null);
    },
    [dispatch]
  );

  const handleEditCancel = useCallback(() => setEditingId(null), []);

  /** POST the assembled brief payload to the FastAPI design backend. */
  const handleGenerate = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    try {
       const payload = buildApiPayload(API_QUESTIONS, chat_original, {
          // id: chat.id,
          watermark: watermark,
          work_type: work_type,
          image_url: image_url,
          revision: revisionComment,
        });
      await dispatch(generateEnterpriseDesign({ payload })).unwrap();
      toast.success("Your design brief has been sent to Brooke Edwards for review!");
    } catch (error) {
      toast.error(
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : "Failed to submit the design brief"
      );
    } finally {
      setGenerating(false);
    }
  }, [dispatch, generating, chat_original, watermark, image_url, work_type, revisionComment]);

  /**
   * Status polling: once the POST lands a `task_id` in the store, wait 3s,
   * then poll the status endpoint every 3s until the task reaches a terminal
   * state (completed / failed). On any error we stop polling and surface a
   * toast instead of hammering the API.
   */
  const taskId = latestEnterpriseEntry?.id;
  /** Backend task lifecycle (queued | processing | completed | failed) — drives the loader text. */
  const taskStatus = latestEnterpriseEntry?.status;
  const pollRef = useRef<number | null>(null);
  const pollCountRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const getStatus = useCallback(async () => {
    if (!taskId) return;
    try {
      const res = await dispatch(fetchEnterpriseStatus(taskId)).unwrap();
      // Terminal state — stop polling and tell the user.
      if (res.status === "completed" || res.status === "failed") {
        stopPolling();
        if (res.status === "completed") {
          toast.success("Your design is ready!");
        } else {
          toast.error(res.error ?? "Design generation failed. Please try again.");
        }
      }
    } catch (error) {
      stopPolling();
      toast.error(
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : "Failed to check design status"
      );
    }
  }, [taskId, dispatch, stopPolling]);

  // Kick off polling 3s after a task_id lands; clear on unmount / task change.
  // Caps at MAX_POLLS so the loader can never hang forever on a stuck task.
  useEffect(() => {
    if (!taskId) return;
    pollCountRef.current = 0;
    const startTimer = window.setTimeout(() => {
      const tick = async () => {
        pollCountRef.current += 1;
        if (pollCountRef.current > MAX_POLLS) {
          stopPolling();
          toast.error(
            "Design generation is taking longer than expected. Please try again."
          );
          return;
        }
        await getStatus();
      };
      void tick();
      pollRef.current = window.setInterval(() => void tick(), POLL_MS);
    }, POLL_START_MS);
    return () => {
      window.clearTimeout(startTimer);
      stopPolling();
    };
  }, [taskId, getStatus, stopPolling]);

  // get status 

  /** "I'd Like To Make Changes" — restart the questions from the first card. */
  const goBackToQuestions = useCallback(() => {
    clearTypingTimeout();
    busyRef.current = false;
    setTyping(false);

    const overviewIdx = messages.findIndex((m) => m.id === "ep-overview");
    setMessages(
      overviewIdx >= 0
        ? messages.slice(0, overviewIdx + 1)
        : [buildMessage(episodeById("welcome")), buildMessage(episodeById("overview"))]
    );
    setAnswers({});
    dispatch(resetBrief());
    dispatch(resetEnterprise());
    setUploads({});
    setCompleted(new Set());
    setGenerating(false);
    setEditingId(null);
    setRatings({});
    setSubmittedAction(null);
    setPendingRevisionGenerate(null);
    announcedIdRef.current = null;

    setTyping(true);
    clearTypingTimeout();
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      busyRef.current = false;
      setTyping(false);
      setMessages((prev) => [...prev, buildMessage(episodeById("photos"))]);
      setCurrentId("photos");
    }, TYPING_MS);
  }, [messages, clearTypingTimeout, dispatch]);

  /**
   * Terminal submit — posts the project back to the host with the full design
   * history and this round's rating, then locks the whole result UI.
   */
  const submitLunaProject = useCallback(
    (action: SubmitAction, rating: number) => {
      const data = {
        id,
        original: chat_original,
        design: entries,
        rating,
        action,
      };
      console.log(`[Luna] submitLunaProject (${action})`, { data });
      window.parent.postMessage({ action: "submitLunaProject", data }, "*");
      setSubmittedAction(action);
    },
    [id, chat_original, entries]
  );

  /** "This is All I Need" — the initial render is approved as-is. */
  const handleDesignAllINeed = useCallback(() => {
    const originalEntry = entries.find((entry) => entry.type === "original");
    submitLunaProject("this_is_all_i_need", ratings[originalEntry?.id ?? ""] ?? 0);
  }, [submitLunaProject, entries, ratings]);

  /** "Engage Designer" — hand off to the human designer for review. */
  const handleDesignEngage = useCallback(() => {
    const originalEntry = entries.find((entry) => entry.type === "original");
    submitLunaProject("engage_designer", ratings[originalEntry?.id ?? ""] ?? 0);
  }, [submitLunaProject, entries, ratings]);

  const handleRevisionAllINeed = useCallback(
    (rating: number) => submitLunaProject("this_is_all_i_need", rating),
    [submitLunaProject]
  );

  const handleRevisionEngage = useCallback(
    (rating: number) => submitLunaProject("engage_designer", rating),
    [submitLunaProject]
  );

  /** Record the satisfaction rating for one revision entry (keyed by entry.id). */
  const handleRate = useCallback((entryId: string, value: number) => {
    setRatings((prev) => ({ ...prev, [entryId]: value }));
  }, []);

  /**
   * "Regenerate With Comments" — start the next revision loop round by pushing
   * a fresh `ep-revision[-N]` comments card (capped at MAX_REVISION_ROUNDS).
   */
  const handleDesignRegenerate = useCallback(() => {
    clearTypingTimeout();
    busyRef.current = false;
    setTyping(false);
    setEditingId(null);
    announcedIdRef.current = null;

    const round = countRevisionRounds(messages) + 1;
    if (round > MAX_REVISION_ROUNDS) {
      toast("More than 3 revisions — please engage your designer for further changes.");
      return;
    }
    const revisionMsg = buildMessage(episodeById("revision"));
    const id = episodeMessageId("revision", round);
    setMessages((prev) => [...prev, { ...revisionMsg, id }]);
    setCurrentId("revision");
  }, [clearTypingTimeout, messages]);

  /**
   * Generate a revision round (round N) — same single generate + polling path
   * as the original, driven from the round's own comments (or its entry's
   * questions on retry).
   */
  const handleRevisionGenerate = useCallback(
    async (round: number) => {
      if (pendingRevisionGenerate !== null) return;
      setPendingRevisionGenerate(round);
      const revisions = entries.filter((entry) => entry.type === "revision");
      const entry = revisions[round - 1];
      const notes = entry?.questions[0]?.answer.notes ?? revisionComment.notes;
      const files = entry?.questions[0]?.answer.files ?? revisionComment.files;
      const payload = buildApiPayload(API_QUESTIONS, chat_original, {
        watermark: watermark ?? "",
        work_type: work_type ?? "",
        image_url: entries[entries.length - 1]?.url ?? "",
        revision: { files, notes },
      });
      try {
        await dispatch(generateEnterpriseDesign({ payload, round })).unwrap();
        toast.success("Your design brief has been sent to Brooke Edwards for review!");
      } catch (error) {
        setPendingRevisionGenerate(null);
        toast.error(
          typeof error === "string"
            ? error
            : error instanceof Error
              ? error.message
              : "Failed to submit the design brief"
        );
      }
    },
    [pendingRevisionGenerate, entries, revisionComment, chat_original, watermark, work_type, dispatch]
  );

  /**
   * "I'd Like To Make Changes" — jump back to this round's comments card,
   * pre-filled with the round's own notes/files, so edits can be re-submitted.
   */
  const handleMakeChanges = useCallback(
    (round: number) => {
      clearTypingTimeout();
      busyRef.current = false;
      setTyping(false);
      setEditingId(null);
      announcedIdRef.current = null;

      const commentId = episodeMessageId("revision", round);
      const revisions = entries.filter((entry) => entry.type === "revision");
      const entry = revisions[round - 1];
      const notes = entry?.questions[0]?.answer.notes ?? revisionComment.notes;
      const files = entry?.questions[0]?.answer.files ?? revisionComment.files;

      // Truncate back to (and including) this round's comments card — dropping
      // the round's summary and any later rounds — so re-submitting edits
      // re-creates the summary without duplicating messages. The card is
      // re-hydrated with the round's notes/files via initialAnswer.
      const idx = messages.findIndex((m) => m.id === commentId);
      if (idx < 0) return;
      setMessages((prev) => {
        const i = prev.findIndex((m) => m.id === commentId);
        const base = i >= 0 ? prev.slice(0, i + 1) : prev;
        return base.map((m) =>
          m.id === commentId
            ? { ...m, initialAnswer: { files, notes } }
            : m
        );
      });
      setCurrentId("revision");
      setPendingRevisionGenerate(null);
      // Scroll to the freshly-editable comments card.
      window.setTimeout(() => {
        document
          .getElementById(`msg-${commentId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 60);
    },
    [messages, entries, revisionComment, clearTypingTimeout]
  );

  const doneCount = completed.size;

  // The latest revision-summary message is the *current* round; earlier rounds
  // stay visible above as locked history.
  const revisionSummaries = messages.filter(
    (m) => revisionRoundFromMessage(m.id) > 0
  );
  const lastRevisionSummaryId =
    revisionSummaries[revisionSummaries.length - 1]?.id;

  return (
    <div>
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
      <a
        href="#chat-panel"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-emerald-700 focus:shadow-lg dark:focus:bg-zinc-900"
      >
        Skip to chat
      </a>



      {/* Mobile checklist dropdown */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="z-10 overflow-hidden border-b border-zinc-200/70 bg-white/95 backdrop-blur-md lg:hidden dark:border-zinc-800/70 dark:bg-zinc-950/95"
          >
            <div className="px-5 py-4">
              <ProgressChecklist completed={completed} currentId={currentId} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        {/* Chat content */}
        <main id="chat-panel">
          <div
            role="log"
            aria-label="Chat with Luna"
            className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6"
          >
              <AnimatePresence initial={false}>
                {messages.map((m, i) => {
                  // Only the most recent message can be answered; historical
                  // attachments render disabled so they can't advance the flow.
                  const isCurrent = i === messages.length - 1;
                  const episodeApiKey = m.id.replace(/^ep-/, "");
                  // The intake design result card stays pinned to the original
                  // summary message (above the revision steps).
                  const showsResultCard = m.id === "ep-summary";
                  // Revision-summary messages render this round's dedicated
                  // Revision Summary + Revision Result card pair.
                  const revisionRound = revisionRoundFromMessage(m.id);
                  const isRevisionSummary = revisionRound > 0;
                  const isCurrentRevision =
                    isRevisionSummary && m.id === lastRevisionSummaryId;
                  const revisionDerived = isRevisionSummary
                    ? deriveRevisionRound(m.id, entries)
                    : null;
                  const revisionEntry = revisionDerived?.entry;
                  // Revision comment cards are keyed by their round message id
                  // so each round's uploaded files stay with their own round.
                  const filesKey =
                    m.id.startsWith("ep-revision") && !isRevisionSummary
                      ? m.id
                      : episodeApiKey;
                  // Only editable episodes get an edit icon on their user answer
                  // (welcome / overview / photos are marked non-editable).
                  const msgEpId = messageEpisodes[m.id];
                  const msgEpisode = msgEpId ? episodeById(msgEpId) : undefined;
                  const hasCompletedEntry = entries.some(
                    (entry) => entry.status === "completed"
                  );
                  const isFlowChat = msgEpId && [
                    "welcome",
                    "overview",
                    "photos",
                    "additional_images_upload",
                    "files",
                    "supporting_files_upload",
                    "project_goals_or_brief_description",
                    "landscape_design_style_preference",
                    "hardscape_material_preferences",
                    "softscape_planting_preferences",
                    "budget",
                    "important_proprty_information",
                  ].includes(msgEpId);

                  const revisionEntries = entries.filter(
                    (entry) => entry.type === "revision"
                  );
                  const hideRevisionEdit =
                    msgEpId === "revision" &&
                    revisionEntries.length === 1 &&
                    revisionEntries[0].status === "completed";

                  const canEdit =
                    m.role === "user" &&
                    (msgEpisode?.editable ?? true) &&
                    !(isFlowChat && hasCompletedEntry) &&
                    !hideRevisionEdit;
                  // Key by initialAnswer too, so "I'd Like To Make Changes"
                  // re-mounts the comments card with its pre-filled fields.
                  const bubbleKey = m.initialAnswer
                    ? `${m.id}-prefilled`
                    : m.id;
                   const isCardBeingEdited = msgEpId && editingId === `ep-${msgEpId}`;
                   if (isCardBeingEdited) return null;

                   return (
                     <div
                       key={bubbleKey}
                       id={`msg-${m.id}`}
                       className="w-full scroll-mt-20"
                     >
                     <MessageBubble
                       message={m}
                       filesByField={uploads[filesKey] ?? EMPTY_FILES}
                       disabled={typing || (!isCurrent && editingId !== m.id)}
                       onOption={isCurrent ? advance : undefined}
                       onCardSubmit={
                         isCurrent
                           ? handleCardSubmit
                           : editingId === m.id
                           ? (result) => handleCardEditSave(m.id, result)
                           : undefined
                       }
                       onCardCancel={editingId === m.id ? handleEditCancel : undefined}
                       initialAnswer={
                          m.id.startsWith("ep-revision") && !isRevisionSummary
                            ? (() => {
                                const round = m.id === "ep-revision"
                                  ? 1
                                  : parseInt(m.id.replace("ep-revision-", ""), 10) || 1;
                                const revEntry = entries.filter((e) => e.type === "revision")[round - 1];
                                const ans = revEntry?.questions?.[0]?.answer;
                                if (ans) {
                                  return {
                                    files: ans.files ?? [],
                                    notes: ans.notes,
                                  };
                                }
                                return {
                                  files: revisionComment.files ?? [],
                                  notes: revisionComment.notes,
                                };
                              })()
                            : briefPayload.original[episodeApiKey]?.answer
                        }
                      answers={answers}
                      uploadTotal={uploadTotal}
                      generating={generating}
                      onSummaryGenerate={isCurrent ? handleGenerate : undefined}
                      onSummaryChanges={isCurrent ? goBackToQuestions : undefined}
                      isRevisionSummary={isRevisionSummary}
                      isCurrentRevision={isCurrentRevision}
                      revisionNotes={revisionComment.notes}
                      revisionFiles={revisionComment.files}
                      revisionRating={
                        revisionEntry ? ratings[revisionEntry.id] ?? 0 : 0
                      }
                      onRevisionRate={
                        isCurrentRevision && revisionEntry
                          ? (value) => handleRate(revisionEntry.id, value)
                          : undefined
                      }
                      submittedAction={submittedAction}
                      revisionPendingGenerate={
                        isRevisionSummary &&
                        pendingRevisionGenerate === revisionRound
                      }
                      revisionRegenerateDisabled={
                        countRevisionRounds(messages) >= MAX_REVISION_ROUNDS
                      }
                      onRevisionGenerate={
                        isCurrentRevision
                          ? () => handleRevisionGenerate(revisionRound)
                          : undefined
                      }
                      onRevisionMakeChanges={
                        isCurrentRevision
                          ? () => handleMakeChanges(revisionRound)
                          : undefined
                      }
                      onRevisionAllINeed={
                        isCurrentRevision && revisionEntry
                          ? handleRevisionAllINeed
                          : undefined
                      }
                      onRevisionRegenerate={
                        isCurrentRevision && revisionEntry
                          ? handleDesignRegenerate
                          : undefined
                      }
                      onRevisionEngage={
                        isCurrentRevision && revisionEntry
                          ? handleRevisionEngage
                          : undefined
                      }
                      designStatus={taskStatus}
                      onDesignAllINeed={
                        showsResultCard ? handleDesignAllINeed : undefined
                      }
                      onDesignRegenerate={
                        showsResultCard ? handleDesignRegenerate : undefined
                      }
                      onDesignEngage={
                        showsResultCard ? handleDesignEngage : undefined
                      }
                      editing={canEdit && editingId === m.id}
                      onEditStart={
                        canEdit ? () => handleEditStart(m.id) : undefined
                      }
                      onEditSave={
                        canEdit ? (text) => handleEditSave(m.id, text) : undefined
                      }
                      onEditCancel={canEdit ? handleEditCancel : undefined}
                    />
                    </div>
                  );
                })}
              </AnimatePresence>

              <AnimatePresence>{typing && <TypingIndicator key="typing" />}</AnimatePresence>

              <div ref={bottomRef} className="h-1" />
          </div>
        </main>
      </div>
    </div>
  );
}
