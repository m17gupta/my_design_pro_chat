"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  senderId: string;
  message: string;
  timestamp: string;
}

interface UserState {
  name: string;
  token: string;
  color: string;
  avatarBg: string;
  emoji: string;
  socket: Socket | null;
  status: "disconnected" | "connecting" | "connected" | "error";
  socketId: string | null;
  errorMsg: string | null;
  messages: ChatMessage[];
  isTyping: boolean;      // Is the OTHER user typing (seen by this panel)
  inputValue: string;
}

const ROOM_ID = "alice-bob";
const DEFAULT_WS_URL = "https://ws.dzinlynxt.com";

const USERS_CONFIG = [
  {
    name: "Alice",
    token: "token-alice",
    color: "#6366f1",
    avatarBg: "bg-indigo-600",
    emoji: "👩‍💼",
  },
  {
    name: "Bob",
    token: "token-bob",
    color: "#10b981",
    avatarBg: "bg-emerald-600",
    emoji: "👨‍💻",
  },
];

// ─────────────────────────────────────────────────────────────
// Typing Indicator Dots Component
// ─────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-end gap-1 px-3 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-slate-400 typing-dot"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Individual Chat Panel
// ─────────────────────────────────────────────────────────────
interface ChatPanelProps {
  user: typeof USERS_CONFIG[0];
  otherUser: typeof USERS_CONFIG[0];
  wsUrl: string;
}

function ChatPanel({ user, otherUser, wsUrl }: ChatPanelProps) {
  const [status, setStatus] = useState<UserState["status"]>("disconnected");
  const [socketId, setSocketId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [otherTyping, setOtherTyping] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingSentRef = useRef(false);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, otherTyping]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setStatus("connecting");
    setErrorMsg(null);

    const socket = io(wsUrl, {
      auth: { token: user.token },
      transports: ["websocket"],
      reconnectionAttempts: 3,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus("connected");
      setSocketId(socket.id || null);

      // Join the shared chat room
      socket.emit("chat:join", { roomId: ROOM_ID }, (res: { ok: boolean; room?: string; error?: string }) => {
        if (res?.ok) {
          console.log(`[${user.name}] joined room:`, res.room);
        }
      });
    });

    socket.on("disconnect", (reason) => {
      setStatus("disconnected");
      setSocketId(null);
    });

    socket.on("connect_error", (err: Error) => {
      setStatus("error");
      setErrorMsg(err.message);
    });

    // Incoming message
    socket.on("chat:message", (payload: ChatMessage) => {
      setMessages((prev) => {
        // Deduplicate by id
        if (prev.some((m) => m.id === payload.id)) return prev;
        return [...prev, payload];
      });
    });

    // Typing indicator from the other user
    socket.on("chat:typing", ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
      if (userId !== user.name.toLowerCase()) {
        setOtherTyping(isTyping);
      }
    });
  }, [wsUrl, user]);

  const disconnect = () => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setStatus("disconnected");
    setSocketId(null);
    setOtherTyping(false);
  };

  // Send typing event
  const sendTyping = useCallback((typing: boolean) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit("chat:typing", {
      roomId: ROOM_ID,
      userId: user.name.toLowerCase(),
      isTyping: typing,
    });
  }, [user.name]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);

    if (!isTypingSentRef.current) {
      isTypingSentRef.current = true;
      sendTyping(true);
    }

    // Reset typing stop timer
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingSentRef.current = false;
      sendTyping(false);
    }, 1500);
  };

  const sendMessage = () => {
    if (!inputValue.trim() || !socketRef.current?.connected) return;

    // Stop typing indicator before sending
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    isTypingSentRef.current = false;
    sendTyping(false);

    socketRef.current.emit(
      "chat:message",
      {
        roomId: ROOM_ID,
        message: inputValue.trim(),
        senderId: user.name.toLowerCase(),
      },
      (ack: { ok: boolean; msgId?: string }) => {
        console.log(`[${user.name}] message ack:`, ack);
      }
    );

    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isMe = (senderId: string) =>
    senderId === user.name.toLowerCase();

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  // Status indicators
  const statusDot = {
    connected: "bg-emerald-400",
    connecting: "bg-amber-400 animate-pulse",
    error: "bg-red-500",
    disconnected: "bg-slate-600",
  }[status];

  const statusLabel = {
    connected: `online · ${otherUser.name} ${otherTyping ? "is typing…" : ""}`,
    connecting: "connecting…",
    error: `error: ${errorMsg || "unknown"}`,
    disconnected: "offline",
  }[status];

  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl" style={{ background: "#0f1117" }}>
      {/* Chat Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-slate-800"
        style={{ background: "#161b27" }}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${user.avatarBg} shadow-lg`}>
            {user.emoji}
          </div>
          <div>
            <p className="font-semibold text-white text-sm leading-tight">{user.name}</p>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
              <span className="text-[11px] text-slate-400 truncate max-w-[180px]">{statusLabel}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {socketId && (
            <span className="hidden sm:block text-[10px] font-mono text-slate-600 bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg truncate max-w-[100px]">
              {socketId.slice(0, 8)}…
            </span>
          )}
          {status === "disconnected" || status === "error" ? (
            <button
              onClick={connect}
              className="text-xs px-3 py-1.5 rounded-xl font-semibold text-white transition"
              style={{ background: user.color }}
            >
              Connect
            </button>
          ) : status === "connecting" ? (
            <button disabled className="text-xs px-3 py-1.5 rounded-xl font-semibold text-slate-500 bg-slate-800 cursor-wait">
              Connecting…
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="text-xs px-3 py-1.5 rounded-xl font-semibold text-rose-400 bg-rose-900/20 border border-rose-700/30 hover:bg-rose-900/40 transition"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2" style={{ background: "#0b0f1a" }}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-600 text-xs gap-2">
            <span className="text-4xl">💬</span>
            <span>No messages yet. Say something!</span>
          </div>
        )}

        {messages.map((msg) => {
          const mine = isMe(msg.senderId);
          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"} chat-msg-in`}
            >
              {/* Avatar (other side only) */}
              {!mine && (
                <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs ${otherUser.avatarBg}`}>
                  {otherUser.emoji}
                </div>
              )}

              <div className={`max-w-[72%] flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <div
                  className="px-3.5 py-2 rounded-2xl text-sm leading-relaxed shadow-md"
                  style={{
                    background: mine ? user.color : "#1e2433",
                    color: mine ? "#fff" : "#e2e8f0",
                    borderBottomRightRadius: mine ? "4px" : "16px",
                    borderBottomLeftRadius: mine ? "16px" : "4px",
                  }}
                >
                  {msg.message}
                </div>
                <span className="text-[10px] text-slate-600 mt-1 px-1">{formatTime(msg.timestamp)}</span>
              </div>

              {/* Avatar (my side) */}
              {mine && (
                <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs ${user.avatarBg}`}>
                  {user.emoji}
                </div>
              )}
            </div>
          );
        })}

        {/* Typing Indicator */}
        {otherTyping && (
          <div className="flex items-end gap-2 justify-start chat-msg-in">
            <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs ${otherUser.avatarBg}`}>
              {otherUser.emoji}
            </div>
            <div className="px-1 py-1.5 rounded-2xl rounded-bl bg-slate-800/80 border border-slate-700/50" style={{ borderBottomLeftRadius: "4px" }}>
              <TypingDots />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="px-4 py-3 border-t border-slate-800" style={{ background: "#161b27" }}>
        {status !== "connected" && (
          <div className="text-center text-xs text-slate-600 mb-2">
            {status === "connecting" ? "Establishing connection…" : "Connect to start chatting"}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={status !== "connected"}
            placeholder={status === "connected" ? `Message ${otherUser.name}…` : "Connect first…"}
            className="flex-1 bg-slate-900 border border-slate-800 focus:border-slate-600 rounded-2xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none disabled:opacity-40 transition"
          />
          <button
            onClick={sendMessage}
            disabled={status !== "connected" || !inputValue.trim()}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 shadow-lg"
            style={{ background: status === "connected" && inputValue.trim() ? user.color : "#374151" }}
            aria-label="Send"
          >
            <svg className="w-4 h-4 translate-x-px" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export default function WsChatPage() {
  const [wsUrl, setWsUrl] = useState(DEFAULT_WS_URL);
  const [editingUrl, setEditingUrl] = useState(false);
  const [draftUrl, setDraftUrl] = useState(DEFAULT_WS_URL);

  const applyUrl = () => {
    setWsUrl(draftUrl.trim());
    setEditingUrl(false);
  };

  return (
    <>
      {/* Inject typing animation styles */}
      <style>{`
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        .typing-dot {
          animation: typingBounce 1.2s infinite ease-in-out;
        }
        @keyframes msgSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .chat-msg-in {
          animation: msgSlideIn 0.18s ease-out both;
        }
      `}</style>

      <div className="min-h-screen flex flex-col" style={{ background: "#07090f" }}>
        {/* Top Bar */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800" style={{ background: "#0f1117" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-tight">WebSocket Chat Tester</h1>
              <p className="text-slate-500 text-[11px]">WhatsApp-style · Alice ↔ Bob · Socket.IO real-time</p>
            </div>
          </div>

          {/* URL Config */}
          <div className="flex items-center gap-2">
            {editingUrl ? (
              <>
                <input
                  autoFocus
                  type="text"
                  value={draftUrl}
                  onChange={(e) => setDraftUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyUrl()}
                  className="bg-slate-900 border border-indigo-500/50 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none w-60"
                />
                <button onClick={applyUrl} className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition">
                  Apply
                </button>
                <button onClick={() => setEditingUrl(false)} className="text-xs px-2 py-1.5 text-slate-400 hover:text-white transition">
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => { setDraftUrl(wsUrl); setEditingUrl(true); }}
                className="flex items-center gap-2 text-xs bg-slate-900 border border-slate-800 hover:border-slate-600 text-slate-400 hover:text-white px-3 py-1.5 rounded-xl transition font-mono"
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {wsUrl}
              </button>
            )}

            <a
              href="/ws-test"
              className="text-xs px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-xl transition"
            >
              WS Tester →
            </a>
          </div>
        </header>

        {/* Instruction Banner */}
        <div className="px-6 py-2.5 border-b border-slate-900 flex items-center gap-3 text-xs" style={{ background: "#0c0f1a" }}>
          <span className="text-slate-500">💡</span>
          <span className="text-slate-500">
            Click <strong className="text-slate-300">Connect</strong> on both panels → type in one → see the live typing indicator appear in the other.
            Connected to live WebSocket server: <code className="text-indigo-400 font-mono">https://ws.dzinlynxt.com</code>.
          </span>
        </div>

        {/* Dual Panel */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 sm:p-6">
          <ChatPanel
            key={`alice-${wsUrl}`}
            user={USERS_CONFIG[0]}
            otherUser={USERS_CONFIG[1]}
            wsUrl={wsUrl}
          />
          <ChatPanel
            key={`bob-${wsUrl}`}
            user={USERS_CONFIG[1]}
            otherUser={USERS_CONFIG[0]}
            wsUrl={wsUrl}
          />
        </div>

        {/* Legend Footer */}
        <footer className="px-6 py-3 border-t border-slate-900 flex flex-wrap items-center gap-6 text-[11px] text-slate-600" style={{ background: "#0f1117" }}>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
            <span>Alice — token: <code className="font-mono text-slate-500">token-alice</code></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Bob — token: <code className="font-mono text-slate-500">token-bob</code></span>
          </div>
          <div className="flex items-center gap-2">
            <span>🔗</span>
            <span>Room: <code className="font-mono text-slate-500">chat:{ROOM_ID}</code></span>
          </div>
          <div className="ml-auto">
            <a href="/" className="hover:text-slate-300 transition">← Back to App</a>
          </div>
        </footer>
      </div>
    </>
  );
}
