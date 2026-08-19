"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import LunaAvatar from "./LunaAvatar";
import MessageBubble from "./MessageBubble";
import ProgressChecklist from "./ProgressChecklist";
import type { CardResult } from "./QuestionCard";
import TypingIndicator from "./TypingIndicator";
import {
  buildEpisodesFromContext,
  buildMessage,
  buildRestoredTranscript,
  checklistFromFlowContext,
  countRevisionRounds,
  episodeById,
  episodeMessageId,
  getApiQuestions,
  nextEpisodeId,
  normalizeWorkType,
  revisionApiKey,
  revisionRoundFromMessage,
} from "./flow";
import {
  HOST_ACTION_CANCEL_ALL_NEED,
  HOST_ACTION_CUSTOM_PROJECT,
  HOST_ACTION_SUBMIT_PROJECT,
  isFromParent,
  noteHostOrigin,
  postToHost,
} from "../../lib/hostBridge";
import { deriveRevisionRound } from "../revisionDesign/RevisionDesign";
import type { SubmitAction } from "../revisionDesign/RevisionResultCard";
import { checklistForWorkType, type AnswerValue, type Message } from "./types";
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
  setEditId,
} from "../../store/enterprise/enterpriseSlice";
import {
  fetchEnterpriseStatus,
  generateEnterpriseDesign,
} from "../../store/enterprise/enterpriseThunk";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { buildApiPayload } from "@/lib/apiBrief";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { hydrateProject } from "../../store/persistence/persistenceThunk";
import { hydrationSkipped } from "../../store/persistence/persistenceSlice";

import GetAllProjectData from "./GetAllProjectData";

let idCounter = 0;
const nextId = () => `m-${Date.now()}-${idCounter++}`;

const TYPING_MS = 950;
/** Max revision loop rounds — beyond this, Regenerate is capped. */
const MAX_REVISION_ROUNDS = 4;

/** First status poll fires 3s after the task starts; every POLL_MS after that. */
const POLL_START_MS = 3000;
const POLL_MS = 3000;
/**
 * Fast-poll budget (~3 min) before falling back to a slow background poll.
 * Design generations can take minutes, so this is not a hard stop — see
 * SLOW_POLL_MS below.
 */
const MAX_POLLS = 60;
/** Slow background cadence used after the fast budget is exhausted. */
const SLOW_POLL_MS = 30000;

// Stable empty object so memoized bubbles without uploads don't re-render.
const EMPTY_FILES: Record<number, File[]> = {};

export default function ChatWindow() {
  
  const restoredItems = useAppSelector((s) => s.chat.original);
  const { entries } = useSelector((state: RootState) => state.enterprise);

  // Flow messages keep their `ep-<apiKey>` id (one appearance per episode)
  // so uploads and Handoff labels can be keyed by episode apiKey.
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentId, setCurrentId] = useState("overview");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  /** apiKey → (field index → files) */
  const [uploads, setUploads] = useState<Record<string, Record<number, File[]>>>({});
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [typing, setTyping] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const announcedIdRef = useRef<string | null>(null);


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
  const {watermark, image_url, work_type, projectId: id, original:chat_original, user_type, dc_name, role, custom_engage_designer, question_sets} = briefPayload;
  const busyRef = useRef(false);
  const [messageEpisodes, setMessageEpisodes] = useState<Record<string, string>>({});

  // Build the flow from the full brief context: enterprise / enterprise-client
  // roles resolve their phases from AllQuestion.json via question_sets;
  // everything else falls back to the legacy per-work-type flow.
  const flowContext = useMemo(
    () => ({
      work_type: work_type ?? undefined,
      user_type,
      role,
      question_sets,
      engageDesigner: custom_engage_designer,
      dcName: dc_name ?? undefined,
    }),
    [work_type, user_type, role, question_sets, custom_engage_designer, dc_name]
  );
  const episodes = useMemo(() => buildEpisodesFromContext(flowContext), [flowContext]);
  // The revision loop's card apiKey ("revision" for legacy / most flows).
  const revisionKey = useMemo(() => revisionApiKey(episodes), [episodes]);
  // Checklist labels follow the flow: phases for AllQuestion flows, the
  // work-type-specific static list for the legacy flows.
  const checklist = useMemo(
    () =>
      checklistFromFlowContext(flowContext) ??
      checklistForWorkType(work_type ?? undefined),
    [flowContext, work_type]
  );

  const briefPayloadRef = useRef(briefPayload);
  useEffect(() => {
    briefPayloadRef.current = briefPayload;
  }, [briefPayload]);

  const entriesRef = useRef(entries);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const restoredTranscript = useMemo(
    () =>
      buildRestoredTranscript(restoredItems, entries, episodes, revisionComment, {
        engageDesigner: Boolean(custom_engage_designer),
        work_type: work_type ?? undefined,
      }),
    [restoredItems, entries, episodes, revisionComment, custom_engage_designer, work_type]
  );
  
  // The project id is the single session identifier: the host sends a fresh id
  // for a brand-new project, while a refresh keeps the same id so the Supabase
  // row can be restored. Hydration is async (DB read), so restore is gated on
  // `persistence.hydrated` below — never before the row has been loaded.
  const hydrated = useAppSelector((s) => s.persistence.hydrated);
  const didInitializeRef = useRef(false);

  // Once hydration completes (row restored or confirmed absent), rebuild the
  // transcript or start fresh. Same restore logic as before, now DB-backed.
  useEffect(() => {
    if (didInitializeRef.current || !hydrated) return;
    didInitializeRef.current = true;

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
      // Fresh session — start at the flow's opening episode: the overview
      // screen for shared flows, or the first intake card for the
      // overview-less custom flow (which starts directly at its first question).
      const firstEp = episodes[0];
      setMessages([buildMessage(firstEp)]);
      setCurrentId(firstEp.apiKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

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
    if (editingId) {
      const scrollTarget = () => {
        const el = document.getElementById(`msg-${editingId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      };
      scrollTarget();
      const frameId = requestAnimationFrame(scrollTarget);
      return () => cancelAnimationFrame(frameId);
    }

    scrollToBottom();

    const chatPanel = document.getElementById("chat-panel");
    if (!chatPanel) return;

    let rAFId: number | null = null;
    const observer = new ResizeObserver(() => {
      if (rAFId) cancelAnimationFrame(rAFId);
      rAFId = requestAnimationFrame(() => {
        scrollToBottom();
      });
    });

    observer.observe(chatPanel);

    return () => {
      observer.disconnect();
      if (rAFId) cancelAnimationFrame(rAFId);
    };
  }, [messages, typing, editingId, scrollToBottom]);

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


    // calling  action custom 
  const submitCustomProject = useCallback(
    (action: SubmitAction, rating: number) => {
      const data = {
        id: briefPayloadRef.current.projectId,
        original: briefPayloadRef.current.original,
        design: entriesRef.current,
        rating,
        action,
      };
      console.log("hit action cutsom")
      postToHost({ action: HOST_ACTION_CUSTOM_PROJECT, data });
      setSubmittedAction(action);
    },
    []
  );

  const submitCustomProjectRef = useRef(submitCustomProject);
  useEffect(() => {
    submitCustomProjectRef.current = submitCustomProject;
  }, [submitCustomProject]);

  const commit = useCallback(
    (
      userText: string,
      filesByField?: Record<number, File[]>,
      urlsByField?: Record<number, Record<string, string>>,
      structuredAnswer?: AnswerValue
    ) => {
      if (typing || busyRef.current) return;
      busyRef.current = true;
      const ep = episodeById(currentId, episodes);

      if (currentId === "overview") {
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
      if (filesByField) {
        // Revision rounds are keyed by their round-specific message id so each
        // loop's uploaded files never leak into the next round's comments card.
        const key = ep.revisionStep
          ? episodeMessageId(revisionKey, countRevisionRounds(messages, revisionKey))
          : ep.apiKey;
        setUploads((prev) => ({ ...prev, [key]: filesByField }));
      }

      // Revision feedback stores `{ files: [uploaded URLs], notes: text }` in
      // the brief payload so the regeneration POST carries the changes.
      if (ep.revisionStep) {
        const urls = urlsByField
          ? Object.values(urlsByField).flatMap((byKey) => Object.values(byKey))
          : [];
        dispatch(setRevision({ files: urls, notes: userText }));
      }

      const nextEpisode = nextEpisodeId(ep.apiKey, userText, episodes);
      const isCustomEngage =
        Boolean(custom_engage_designer) &&
        normalizeWorkType(work_type ?? "") === "custom";

      setTyping(true);
      clearTypingTimeout();
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        busyRef.current = false;
        setTyping(false);
        if (isCustomEngage && ep.apiKey === "custom_engage_continue") {
          submitCustomProjectRef.current("engage_designer", 0);
        } else {
          setMessages((prev) => {
            const nextMsg = buildMessage(episodeById(nextEpisode, episodes));
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
        }
      }, TYPING_MS);
    },
    [
      typing,
      currentId,
      episodes,
      dispatch,
      messages,
      revisionKey,
      clearTypingTimeout,
      custom_engage_designer,
      work_type,
    ]
  );

  const advance = useCallback((rawAnswer: string) => commit(rawAnswer), [commit]);

  const handleCardSubmit = useCallback(
    (result: CardResult) =>
      commit(result.answerText, result.files, result.fileUrls, result.answer),
    [commit]
  );



  /** Apply an edited answer to the transcript, checklist summary, and API payload. */
  const handleEditSave = useCallback(
    (messageId: string, rawText: string) => {
      const text = rawText.trim();
      let nextCardToEdit: string | null = null;
      let insertedUserMsgId: string | null = null;
      let insertedEpId: string | null = null;

      const epId = messageEpisodes[messageId];
      if (epId) {
        const ep = episodeById(epId, episodes);
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

      // Build the next transcript and decide what enters edit mode BEFORE
      // touching state: the `editingId` target must be known synchronously so
      // a Yes→card edit re-opens the card instead of silently cancelling
      // (React runs state updaters lazily, so writing these inside the
      // setMessages updater and reading them after would see stale nulls).
      let newMessages = messages;
      if (text) {
        newMessages = messages.map((m) =>
          m.id === messageId ? { ...m, content: text } : m
        );
      }

      if (epId && (text.startsWith("Yes") || text.startsWith("No"))) {
        const nextEpId =
          epId === "photos"
            ? "additional_images_upload"
            : epId === "files"
            ? "supporting_files_upload"
            : null;

        if (nextEpId) {
          if (text.startsWith("Yes")) {
            const hasCard = newMessages.some((m) => m.id === `ep-${nextEpId}`);
            if (hasCard) {
              nextCardToEdit = `ep-${nextEpId}`;
              newMessages = newMessages.map((m) =>
                m.id === `ep-${nextEpId}` ? { ...m, isRestored: true } : m
              );
            } else {
              const msgIdx = newMessages.findIndex((m) => m.id === messageId);
              if (msgIdx >= 0) {
                const nextEp = episodeById(nextEpId, episodes);
                const cardMsg = buildMessage(nextEp);
                cardMsg.isRestored = true;
                const userMsgId = `m-inserted-${nextEpId}-${Date.now()}`;
                const userMsg: Message = { id: userMsgId, role: "user", content: "" };

                newMessages = [
                  ...newMessages.slice(0, msgIdx + 1),
                  cardMsg,
                  userMsg,
                  ...newMessages.slice(msgIdx + 1),
                ];

                nextCardToEdit = cardMsg.id;
                insertedUserMsgId = userMsgId;
                insertedEpId = nextEpId;
              }
            }
          } else if (text.startsWith("No")) {
            const cardIdx = newMessages.findIndex((m) => m.id === `ep-${nextEpId}`);
            if (cardIdx >= 0) {
              newMessages = newMessages.filter((m, i) => i !== cardIdx && i !== cardIdx + 1);
            }
          }
        }
      }

      setMessages(newMessages);

      if (insertedUserMsgId && insertedEpId) {
        setMessageEpisodes((prev) => ({ ...prev, [insertedUserMsgId as string]: insertedEpId as string }));
      }

      setEditingId(nextCardToEdit);
    },
    [messageEpisodes, briefPayload, dispatch, episodes, messages]
  );

  const handleCardEditSave = useCallback(
    (cardMessageId: string, result: CardResult) => {
      const text = result.answerText.trim();
      const rawEpId = cardMessageId.replace(/^ep-/, "");
      const baseEpId =
        rawEpId === revisionKey || rawEpId.startsWith(`${revisionKey}-`)
          ? revisionKey
          : rawEpId;

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
        const ep = episodeById(baseEpId, episodes);
        if (ep.checklistId) {
          setAnswers((prev) => ({ ...prev, [ep.checklistId as string]: text }));
          setCompleted((prev) => new Set(prev).add(ep.checklistId as string));
        }
        if (ep.api) {
          const apiKey = ep.apiKey;
          dispatch(answerQuestion({ apiKey, answer: result.answer }));
        }
        if (baseEpId === revisionKey) {
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
        const filesKey = cardMessageId.startsWith(`ep-${revisionKey}`)
          ? cardMessageId
          : ep.apiKey;
        setUploads((prev) => ({ ...prev, [filesKey]: result.files }));
      }

      setEditingId(null);
    },
    [dispatch, revisionKey]
  );

  const handleEditCancel = useCallback(() => setEditingId(null), []);

  /** POST the assembled brief payload to the FastAPI design backend. */
  const handleGenerate = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    try {
       const payload = buildApiPayload(getApiQuestions(episodes), chat_original, {
        projectId: id,
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
  }, [dispatch, generating, chat_original, watermark, image_url, work_type, revisionComment, user_type, dc_name, role, custom_engage_designer, question_sets]);

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
        setPendingRevisionGenerate(null);
        if (res.status === "completed") {
          toast.success("Your design is ready!");
        } else {
          toast.error(res.error ?? "Design generation failed. Please try again.");
        }
      }
    } catch (error) {
      // Transient failure (network blip / proxy 5xx). Never permanently
      // abandon the poll on a single error — the task may still complete and
      // Redux would then be stuck on a stale status forever. Keep polling at
      // the same cadence and surface the failure once.
      setPendingRevisionGenerate(null);
      toast.error(
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : "Failed to check design status"
      );
    }
  }, [taskId, dispatch]);

  // Kick off polling 3s after a task_id lands; clear on unmount / task change.
  // Fast-poll every 3s for MAX_POLLS, then fall back to a slow background poll
  // (SLOW_POLL_MS) so a long-running task still lands in Redux when it completes.
  useEffect(() => {
    if (!taskId) return;
    pollCountRef.current = 0;
    const startTimer = window.setTimeout(() => {
      const tick = async () => {
        pollCountRef.current += 1;
        if (pollCountRef.current > MAX_POLLS) {
          // Fast budget exhausted — the task may still be generating. Switch
          // to the slow cadence instead of giving up (giving up leaves Redux
          // stuck on a stale status while the API eventually completes).
          stopPolling();
          pollRef.current = window.setInterval(
            () => void getStatus(),
            SLOW_POLL_MS
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

  // When the user returns to the tab, immediately re-check the latest task so
  // a design that completed while the tab was backgrounded reaches Redux.
  useEffect(() => {
    if (!taskId) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void getStatus();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [taskId, getStatus]);

  // get status 

  /** "I'd Like To Make Changes" — restart the questions from the first card. */
  const goBackToQuestions = useCallback(() => {
    clearTypingTimeout();
    busyRef.current = false;
    setTyping(false);

    const firstEp = episodes[0];
    const firstEpId = firstEp.apiKey;
    const startIdx = messages.findIndex((m) => m.id === `ep-${firstEpId}`);
    // Shared flows keep their overview intro and restart from the first
    // question after it; the overview-less custom flow has nothing to keep, so
    // it truncates to the first card itself (or starts empty).
    setMessages(
      startIdx >= 0
        ? messages.slice(0, startIdx + 1)
        : firstEpId === "overview"
          ? [buildMessage(firstEp)]
          : []
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

    // The first question is the photos Yes/No step for shared flows; for the
    // custom flow the first episode IS the first question.
    const firstQuestion =
      firstEpId === "overview"
        ? episodes.find((e) => e.apiKey === "photos") ?? firstEp
        : firstEp;
    const needsAppend = firstEpId === "overview" || startIdx < 0;

    setTyping(true);
    clearTypingTimeout();
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      busyRef.current = false;
      setTyping(false);
      if (needsAppend) {
        setMessages((prev) => [...prev, buildMessage(firstQuestion)]);
      }
      setCurrentId(firstQuestion.apiKey);
    }, TYPING_MS);
  }, [messages, clearTypingTimeout, dispatch, episodes]);

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
      postToHost({ action: HOST_ACTION_SUBMIT_PROJECT, data });
      setSubmittedAction(action);
    },
    [id, chat_original, entries]
  );



  const handleCancelAllNeed = useCallback(() => {
    setSubmittedAction(null);
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only accept host commands from the embedding frame — never from an
      // arbitrary window that happens to be able to reach us.
      if (!isFromParent(event)) return;
      // Learn the host's origin from its first message so future posts to the
      // host can target it instead of "*".
      noteHostOrigin(event.origin);
      if (event.data?.action === HOST_ACTION_CANCEL_ALL_NEED) {
        handleCancelAllNeed();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleCancelAllNeed]);


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
    if (!episodes.some((e) => e.apiKey === revisionKey)) {
      toast("No revision questions are configured for this project.");
      return;
    }
    const round = countRevisionRounds(messages, revisionKey) + 1;
    if (round > MAX_REVISION_ROUNDS) {
      toast("More than 4 revisions — please engage your designer for further changes.");
      return;
    }
    // Clear previous round's comment so the new revision card starts empty
    dispatch(setRevision({ files: [], notes: "" }));
    const revisionMsg = buildMessage(episodeById(revisionKey, episodes));
    const id = episodeMessageId(revisionKey, round);
    setMessages((prev) => [...prev, { ...revisionMsg, id }]);
    setCurrentId(revisionKey);
  }, [clearTypingTimeout, messages, dispatch, episodes, revisionKey]);

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
      const hasActiveFallback = revisionComment.notes !== "" || (revisionComment.files && revisionComment.files.length > 0);
      const notes = hasActiveFallback ? revisionComment.notes : (entry?.questions[0]?.answer?.notes ?? revisionComment.notes);
      const files = hasActiveFallback ? (revisionComment.files ?? []) : (entry?.questions[0]?.answer?.files ?? revisionComment.files ?? []);
      const payload = buildApiPayload(getApiQuestions(episodes), chat_original, {
        projectId:id,
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
    [pendingRevisionGenerate, entries, revisionComment, chat_original, watermark, work_type, question_sets, dispatch]
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

      const commentId = episodeMessageId(revisionKey, round);
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
      setCurrentId(revisionKey);
      setPendingRevisionGenerate(null);
      // Scroll to the freshly-editable comments card.
      window.setTimeout(() => {
        document
          .getElementById(`msg-${commentId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 60);
    },
    [messages, entries, revisionComment, clearTypingTimeout, revisionKey]
  );

  /**
   * Toggle edit mode for a user message. Only one answer can be edited at a
   * time — clicking a second edit icon while another edit is open is blocked.
   */
  const handleEditStart = useCallback(
    (messageId: string) => {
      const epId = messageEpisodes[messageId];
      dispatch(setEditId(epId))
      if (epId && episodeById(epId, episodes).revisionStep) {
        const msgIdx = messages.findIndex((m) => m.id === messageId);
        if (msgIdx >= 0) {
          for (let i = msgIdx - 1; i >= 0; i--) {
            const isRevCard =
              messages[i].id === `ep-${revisionKey}` ||
              messages[i].id.startsWith(`ep-${revisionKey}-`);
            if (isRevCard) {
              const cardId = messages[i].id;
              const roundMatch = new RegExp(`^ep-${revisionKey}(?:-(\\d+))?$`).exec(cardId);
              if (roundMatch) {
                const round = roundMatch[1] ? parseInt(roundMatch[1], 10) : 1;
                handleMakeChanges(round);
                return;
              }
            }
          }
        }
      }

      let targetId = messageId;
      if (epId) {
        const ep = episodeById(epId, episodes);
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
    [editingId, messageEpisodes, messages, handleMakeChanges, episodes, revisionKey]
  );


  // The latest revision-summary message is the *current* round; earlier rounds
  // stay visible above as locked history.
  const revisionSummaries = messages.filter(
    (m) => revisionRoundFromMessage(m.id) > 0
  );
  const lastRevisionSummaryId =
    revisionSummaries[revisionSummaries.length - 1]?.id;

  return (
    <div>
      <GetAllProjectData />
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
              <ProgressChecklist
                completed={completed}
                currentId={currentId}
                episodes={episodes}
                checklist={checklist}
              />
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
                    m.id.startsWith(`ep-${revisionKey}`) && !isRevisionSummary
                      ? m.id
                      : episodeApiKey;
                  // Only editable episodes get an edit icon on their user answer
                  // (overview / photos are marked non-editable).
                  const msgEpId = messageEpisodes[m.id];
                  const msgEpisode = msgEpId ? episodeById(msgEpId, episodes) : undefined;
                  const hasCompletedEntry = entries.some(
                    (entry) => entry.status === "completed"
                  );
                  // Any episode in the current work type's flow is an intake
                  // message (edit-gated once a design entry exists) — derived
                  // so color-material's topic cards count too.
                  const isFlowChat = msgEpId
                    ? episodes.some((e) => e.apiKey === msgEpId)
                    : false;

                  const revisionEntries = entries.filter(
                    (entry) => entry.type === "revision"
                  );
                  const hideRevisionEdit =
                    msgEpId === revisionKey &&
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

                  // Hide revision question card once the user has submitted it
                  // (i.e. it is no longer the current active card).
                  const isRevisionQuestionCard =
                    m.id.startsWith(`ep-${revisionKey}`) && !isRevisionSummary;
                  if (isRevisionQuestionCard && !isCurrent) return null;

                  const isCardBeingEdited = msgEpId && editingId === `ep-${msgEpId}`;
                  if (isCardBeingEdited) return null;

                  // Extract already-uploaded image URLs from Redux so UserAnswerBubble
                  // can render thumbnails for the user's submitted answer.
                  // Covers: string[] (upload-only), { files, notes } (text+upload answers).
                  const answerImageUrls: string[] = (() => {
                    if (m.role !== 'user') return [];
                    const epKey = messageEpisodes[m.id];
                    if (!epKey) return [];
                    const item = briefPayload.original[epKey];
                    if (!item) return [];
                    const ans = item.answer;
                    if (Array.isArray(ans)) return ans as string[];
                    if (ans && typeof ans === 'object' && 'files' in ans && Array.isArray(ans.files))
                      return ans.files as string[];
                    return [];
                  })();

                  // Detect if this is an assistant option-message whose adjacent
                  // user answer is currently being edited — option buttons reappear.
                  const nextMsg = messages[i + 1];
                  const editingNextMessage = Boolean(
                    m.role === 'assistant' &&
                    m.options?.length &&
                    nextMsg?.role === 'user' &&
                    nextMsg.id === editingId
                  );

                   return (
                     <div
                       key={bubbleKey}
                       id={`msg-${m.id}`}
                       className="w-full scroll-mt-20"
                     >
                     <MessageBubble
                       message={m}
                       apiKey={msgEpId}
                       filesByField={uploads[filesKey] ?? EMPTY_FILES}
                       disabled={typing || (!isCurrent && editingId !== m.id && !editingNextMessage)}
                       selectedValue={messages[i + 1]?.role === "user" ? messages[i + 1].content : undefined}
                       onOption={isCurrent ? advance : undefined}
                       answerImageUrls={answerImageUrls}
                       editingNextMessage={editingNextMessage}
                       onOptionEditSave={
                         editingNextMessage && nextMsg
                           ? (text) => handleEditSave(nextMsg.id, text)
                           : undefined
                       }
                       onCardSubmit={
                         isCurrent
                           ? handleCardSubmit
                           : editingId === m.id
                           ? (result) => handleCardEditSave(m.id, result)
                           : undefined
                       }
                       onCardCancel={editingId === m.id ? handleEditCancel : undefined}
                       initialAnswer={
                          m.id.startsWith(`ep-${revisionKey}`) && !isRevisionSummary
                            ? (() => {
                                const round = m.id === `ep-${revisionKey}`
                                  ? 1
                                  : parseInt(m.id.replace(`ep-${revisionKey}-`, ""), 10) || 1;
                                const revEntry = entries.filter((e) => e.type === "revision")[round - 1];
                                const ans = revEntry?.questions?.[0]?.answer;
                                // If this round already has a saved entry answer, pre-fill it (edit/retry case).
                                // For a brand-new card (no entry yet and revisionComment was just cleared),
                                // return empty so the card starts blank.
                                if (ans) {
                                  return {
                                    files: ans.files ?? [],
                                    notes: ans.notes,
                                  };
                                }
                                // Only use revisionComment as fallback if it has actual data
                                // (avoids leaking previous round's stale comment into new card).
                                const hasComment =
                                  revisionComment.notes !== "" ||
                                  (revisionComment.files && revisionComment.files.length > 0);
                                return hasComment
                                  ? { files: revisionComment.files ?? [], notes: revisionComment.notes }
                                  : undefined;
                              })()
                            : briefPayload.original[episodeApiKey]?.answer
                        }
                      answers={answers}
                      checklist={checklist}
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
                       editOptions={msgEpisode?.options}
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

              <div ref={bottomRef} className="h-16 shrink-0" />
          </div>
        </main>
      </div>
    </div>
  );
}
