"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import HandoffPanel from "./HandoffPanel";
import LunaAvatar from "./LunaAvatar";
import MessageBubble from "./MessageBubble";
import ProgressChecklist from "./ProgressChecklist";
import type { CardResult } from "./QuestionCard";
import TypingIndicator from "./TypingIndicator";
import {
  buildMessage,
  buildRestoredTranscript,
  episodeById,
  nextEpisodeId,
} from "./flow";
import { CHECKLIST, type AnswerValue, type Message } from "./types";
import {
  answerQuestion,
  resetBrief,
  selectBriefPayload,
} from "../../store/briefSlice";
import { resetEnterprise } from "../../store/enterpriseSlice";
import { fetchEnterpriseStatus, generateEnterpriseDesign } from "../../store/enterpriseThunk";
import { useAppDispatch, useAppSelector } from "../../store/hooks";

type Tab = "chat" | "handoff";

let idCounter = 0;
const nextId = () => `m-${Date.now()}-${idCounter++}`;

const TYPING_MS = 950;

/** First status poll fires 3s after the task starts; every POLL_MS after that. */
const POLL_START_MS = 3000;
const POLL_MS = 3000;
/** Safety cap (~3 min) so the loader can never spin forever on a stuck task. */
const MAX_POLLS = 60;

// Stable empty object so memoized bubbles without uploads don't re-render.
const EMPTY_FILES: Record<number, File[]> = {};

export default function ChatWindow() {
  const [tab, setTab] = useState<Tab>("chat");
  // After a refresh the store rehydrates answered items from sessionStorage;
  // rebuild the whole transcript (assistant questions + user answers) so
  // Redux and the chat stay in sync — empty store keeps the welcome screen.
  const restoredItems = useAppSelector((s) => s.chat.original);
  const restoredTranscript = useMemo(
    () => buildRestoredTranscript(restoredItems),
    [restoredItems]
  );

  // Flow messages keep their `ep-<episodeId>` id (one appearance per episode)
  // so uploads and Handoff labels can be keyed by episode id.
  const [messages, setMessages] = useState<Message[]>(() => restoredTranscript.messages);
  const [currentId, setCurrentId] = useState(restoredTranscript.currentId);
  const [answers, setAnswers] = useState<Record<string, string>>(
    restoredTranscript.answers
  );
  /** episodeId → (field index → files) */
  const [uploads, setUploads] = useState<Record<string, Record<number, File[]>>>({});
  /** episodeId → (field index → fileKey → Cloudinary URL) */
  const [fileUrls, setFileUrls] = useState<
    Record<string, Record<number, Record<string, string>>>
  >({});
  const [completed, setCompleted] = useState<Set<string>>(
    () => restoredTranscript.completed
  );
  const [typing, setTyping] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  /** Id of the user message currently being edited — at most one at a time. */
  const [editingId, setEditingId] = useState<string | null>(null);
  /** messageId → episodeId, so an edited message can be mapped back to its question. */
  const [messageEpisodes, setMessageEpisodes] = useState<Record<string, string>>(
    restoredTranscript.messageEpisodes
  );
  const dispatch = useAppDispatch();
  const briefPayload = useAppSelector(selectBriefPayload);
  /** Generated design preview URL — populated once status polling completes. */
  const designImageUrl = useAppSelector((s) => s.enterprise.generatedImage) || undefined;

  const bottomRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);
  const announcedIdRef = useRef<string | null>(null);
  // Guard against double-firing before React re-renders (set in handlers only).
  const busyRef = useRef(false);

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
  }, [messages, typing, tab, designImageUrl, scrollToBottom]);

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
    setFileUrls({});
    setCompleted(new Set());
    setGenerated(false);
    setGenerating(false);
    setEditingId(null);
    setMessageEpisodes({});
    announcedIdRef.current = null;
    setTab("chat");
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
      // intake: wipe the Redux brief (and its sessionStorage copy) plus any
      // restored/display state before recording the first answer.
      if (currentId === "welcome") {
        dispatch(resetBrief());
        setAnswers({});
        setUploads({});
        setFileUrls({});
        setCompleted(new Set());
      }

      const userMessage: Message = { id: nextId(), role: "user", content: userText };
      setMessages((prev) => [...prev, userMessage]);
      setMessageEpisodes((prev) => ({ ...prev, [userMessage.id]: ep.id }));

      const checklistId = ep.checklistId;
      if (checklistId) {
        setAnswers((prev) => ({ ...prev, [checklistId]: userText }));
        setCompleted((prev) => new Set(prev).add(checklistId));
      }
      const apiKey = ep.api?.apiKey;
      if (apiKey && structuredAnswer !== undefined) {
        dispatch(answerQuestion({ apiKey, answer: structuredAnswer }));
      }
      if (filesByField && ep.id !== "welcome") {
        setUploads((prev) => ({ ...prev, [ep.id]: filesByField }));
        if (urlsByField) {
          setFileUrls((prev) => ({ ...prev, [ep.id]: urlsByField }));
        }
      }

      const nextEpisode = nextEpisodeId(ep.id, userText);
      setTyping(true);
      clearTypingTimeout();
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        busyRef.current = false;
        setTyping(false);
        setMessages((prev) => [...prev, buildMessage(episodeById(nextEpisode))]);
        setCurrentId(nextEpisode);
      }, TYPING_MS);
    },
    [typing, currentId, clearTypingTimeout, dispatch]
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
      if (editingId !== null && editingId !== messageId) {
        toast.error(
          "Only one answer can be edited at a time — save or cancel the current edit first."
        );
        return;
      }
      setEditingId(editingId === messageId ? null : messageId);
    },
    [editingId]
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
          const apiKey = ep.api.apiKey;
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

  const handleEditCancel = useCallback(() => setEditingId(null), []);

  /** POST the assembled brief payload to the FastAPI design backend. */
  const handleGenerate = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    try {
      await dispatch(generateEnterpriseDesign()).unwrap();
      setGenerated(true);
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
  }, [dispatch, generating]);

  /**
   * Status polling: once the POST lands a `task_id` in the store, wait 3s,
   * then poll the status endpoint every 3s until the task reaches a terminal
   * state (completed / failed). On any error we stop polling and surface a
   * toast instead of hammering the API.
   */
  const taskId = useAppSelector((s) => s.enterprise.task_id);
  /** Backend task lifecycle (queued | processing | completed | failed) — drives the loader text. */
  const taskStatus = useAppSelector((s) => s.enterprise.taskStatus);
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
          // Back to the summary card so the user can retry.
          setGenerated(false);
          toast.error(res.error ?? "Design generation failed. Please try again.");
        }
      }
    } catch (error) {
      stopPolling();
      // Back to the summary card so the user can retry.
      setGenerated(false);
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
          setGenerated(false);
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
    setFileUrls({});
    setCompleted(new Set());
    setGenerated(false);
    setGenerating(false);
    setEditingId(null);
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

  /** "This is All I Need" — the initial render is approved as-is. */
  const handleDesignAllINeed = useCallback(() => {
    setGenerated(true);
    toast.success("Great! Your design will be sent to Brooke Edwards for review.");
  }, []);

  /** "Regenerate With Comments" — restart intake so the user can tweak + resubmit. */
  const handleDesignRegenerate = useCallback(() => {
    goBackToQuestions();
  }, [goBackToQuestions]);

  /** "Engage Designer" — hand off to the human designer for review. */
  const handleDesignEngage = useCallback(() => {
    setGenerated(true);
    toast.success("Brooke Edwards has been engaged to review your design.");
  }, []);

  const doneCount = completed.size;

  return (
    <div className="flex h-dvh flex-col">
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
      <a
        href="#tab-panel"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-emerald-700 focus:shadow-lg dark:focus:bg-zinc-900"
      >
        Skip to chat
      </a>

      {/* Header */}
      <header className="z-20 flex items-center gap-3 border-b border-zinc-200/70 bg-white/70 px-4 py-3 backdrop-blur-md dark:border-zinc-800/70 dark:bg-zinc-950/70 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <LunaAvatar pulse={typing} />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight">Luna</h1>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={typing ? "busy" : "idle"}
                initial={{ opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -2 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-1.5 truncate text-xs text-zinc-500 dark:text-zinc-400"
              >
                {typing ? (
                  "Luna is typing…"
                ) : (
                  <>
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    <span className="truncate">Your virtual AI designer</span>
                  </>
                )}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="View"
          className="mx-auto flex shrink-0 items-center gap-1 rounded-full bg-zinc-100 p-1 dark:bg-zinc-800/70"
        >
          {(
            [
              { id: "chat", label: "Chat" },
              // { id: "handoff", label: "Handoff" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="tab-panel"
              onClick={() => setTab(t.id)}
              className={`relative rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-150 sm:px-4 ${
                tab === t.id
                  ? "text-emerald-800 dark:text-emerald-200"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {tab === t.id && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-full bg-white shadow-sm dark:bg-zinc-900"
                  transition={{ type: "spring", stiffness: 500, damping: 32 }}
                />
              )}
              <span className="relative flex items-center gap-1.5">
                {t.id === "chat" ? (
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                ) : (
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                )}
                {t.label}
              </span>
            </button>
          ))}
        </div>

        {/* Mobile progress chip */}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-haspopup="true"
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50 lg:hidden dark:border-emerald-500/30 dark:bg-zinc-900 dark:text-emerald-300"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <path d="M22 4L12 14.01l-3-3" />
          </svg>
          {doneCount}/{CHECKLIST.length}
        </button>

        {/* Reset */}
        <motion.button
          type="button"
          onClick={startOver}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.92 }}
          aria-label="Start over"
          title="Start over"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm transition-colors hover:border-emerald-300 hover:text-emerald-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-emerald-500/50 dark:hover:text-emerald-400"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </motion.button>
      </header>

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

      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar */}
        <aside
          aria-label="Intake progress"
          className="hidden w-72 shrink-0 overflow-y-auto border-r border-zinc-200/70 bg-white/40 p-5 lg:block dark:border-zinc-800/70 dark:bg-zinc-950/40"
        >
          <ProgressChecklist completed={completed} currentId={currentId} />
        </aside>

        {/* Chat / Handoff content */}
        <main
          id="tab-panel"
          role="tabpanel"
          tabIndex={-1}
          aria-label={tab === "chat" ? "Chat with Luna" : "Handoff brief"}
          className="min-w-0 flex-1 overflow-y-auto"
        >
          {tab === "chat" ? (
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
                  const episodeKey = m.id.replace(/^ep-/, "");
                  // Only editable episodes get an edit icon on their user answer
                  // (welcome / overview / photos are marked non-editable).
                  const msgEpId = messageEpisodes[m.id];
                  const msgEpisode = msgEpId ? episodeById(msgEpId) : undefined;
                  const canEdit =
                    m.role === "user" && (msgEpisode?.editable ?? true);
                  return (
                    <MessageBubble
                      key={m.id}
                      message={m}
                      filesByField={uploads[episodeKey] ?? EMPTY_FILES}
                      disabled={typing || !isCurrent}
                      onOption={isCurrent ? advance : undefined}
                      onCardSubmit={isCurrent ? handleCardSubmit : undefined}
                      answers={answers}
                      uploadTotal={uploadTotal}
                      generating={generating}
                      onSummaryGenerate={isCurrent ? handleGenerate : undefined}
                      onSummaryChanges={isCurrent ? goBackToQuestions : undefined}
                      designImageUrl={designImageUrl}
                      designPending={generated && !designImageUrl}
                      designStatus={taskStatus}
                      onDesignAllINeed={handleDesignAllINeed}
                      onDesignRegenerate={handleDesignRegenerate}
                      onDesignEngage={handleDesignEngage}
                      editing={canEdit && editingId === m.id}
                      onEditStart={
                        canEdit ? () => handleEditStart(m.id) : undefined
                      }
                      onEditSave={
                        canEdit ? (text) => handleEditSave(m.id, text) : undefined
                      }
                      onEditCancel={canEdit ? handleEditCancel : undefined}
                    />
                  );
                })}
              </AnimatePresence>

              <AnimatePresence>{typing && <TypingIndicator key="typing" />}</AnimatePresence>

              <div ref={bottomRef} className="h-1" />
            </div>
          ) : (
            <HandoffPanel
              answers={answers}
              uploads={uploads}
              fileUrls={fileUrls}
              payload={briefPayload}
              onBackToChat={() => setTab("chat")}
            />
          )}
        </main>
      </div>

      {/* Support / handoff footer */}
      {/* <footer className="z-10 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200/70 bg-white/70 px-4 py-2.5 text-xs text-zinc-500 backdrop-blur-md dark:border-zinc-800/70 dark:bg-zinc-950/70 dark:text-zinc-400 sm:px-6">
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          className="group flex items-center gap-1.5 transition-colors hover:text-emerald-600 dark:hover:text-emerald-400"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="transition-transform duration-150 group-hover:rotate-12"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <path d="M12 17h.01" />
          </svg>
          Having issues with Luna?
        </a>
        <button
          type="button"
          onClick={() => setTab("handoff")}
          className="group flex items-center gap-1.5 font-medium text-zinc-600 transition-colors hover:text-emerald-700 dark:text-zinc-300 dark:hover:text-emerald-400"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M16 3h5v5" />
            <path d="M8 21H3v-5" />
            <path d="M21 3l-7 7" />
            <path d="M3 21l7-7" />
          </svg>
          Message to Design Coordinator Brooke Edwards
        </button>
      </footer> */}
    </div>
  );
}
