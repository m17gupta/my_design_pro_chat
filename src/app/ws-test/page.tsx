"use client";

import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

interface LogEntry {
  id: string;
  timestamp: string;
  type: "system" | "incoming" | "outgoing" | "error" | "success";
  event: string;
  data: any;
}

export default function WebSocketTestPage() {
  // Connection states
  const [url, setUrl] = useState("https://ws.dzinlynxt.com");
  const [token, setToken] = useState("");
  const [transport, setTransport] = useState<"websocket" | "polling,websocket">("websocket");
  const [showToken, setShowToken] = useState(false);
  
  const [connectionStatus, setConnectionStatus] = useState<
    "disconnected" | "connecting" | "connected" | "error"
  >("disconnected");
  const [socketId, setSocketId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [subscribedRooms, setSubscribedRooms] = useState<string[]>([]);

  // Task subscribe
  const [taskId, setTaskId] = useState("test-task-123");
  const [subscribing, setSubscribing] = useState(false);

  // Custom emit
  const [customEvent, setCustomEvent] = useState("task:subscribe");
  const [customPayload, setCustomPayload] = useState(JSON.stringify("test-task-123", null, 2));

  // Logs & Filters
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterEvent, setFilterEvent] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);

  const socketRef = useRef<Socket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Helper to append log
  const addLog = (type: LogEntry["type"], event: string, data: any) => {
    const newEntry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      type,
      event,
      data,
    };
    setLogs((prev) => [...prev, newEntry]);
  };

  // Auto scroll logs
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollTop = logsEndRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const handleConnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setConnectionStatus("connecting");
    setErrorMessage(null);
    addLog("system", "connection_attempt", {
      url,
      transport: transport.split(","),
      hasToken: Boolean(token.trim()),
    });

    try {
      const transportsArray = transport.split(",");
      const socket = io(url, {
        auth: token.trim() ? { token: token.trim() } : undefined,
        transports: transportsArray,
        reconnectionAttempts: 3,
        timeout: 10000,
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        setConnectionStatus("connected");
        setSocketId(socket.id || "unknown");
        setErrorMessage(null);
        addLog("success", "connect", {
          message: "🟢 Connected to WebSocket Server",
          socketId: socket.id,
          transport: socket.io.engine?.transport?.name,
        });
      });

      socket.on("disconnect", (reason) => {
        setConnectionStatus("disconnected");
        setSocketId(null);
        setSubscribedRooms([]);
        addLog("system", "disconnect", { reason });
      });

      socket.on("connect_error", (err: Error) => {
        setConnectionStatus("error");
        setErrorMessage(err.message);
        addLog("error", "connect_error", {
          message: err.message,
          error: err,
        });
      });

      // Wildcard / Any event listener
      socket.onAny((eventName: string, ...args: any[]) => {
        // We already handle specific UI notifications, but let's log everything
        if (eventName !== "connect" && eventName !== "disconnect" && eventName !== "connect_error") {
          addLog("incoming", eventName, args.length === 1 ? args[0] : args);
        }
      });

      // Specific known listener: status
      socket.on("status", (payload: any) => {
        console.log("%c🚀 RECEIVED LIVE STATUS EVENT:", "color: #3b82f6; font-weight: bold;", payload);
      });
    } catch (err: any) {
      setConnectionStatus("error");
      setErrorMessage(err?.message || "Failed to initialize socket");
      addLog("error", "init_exception", { error: err?.message || String(err) });
    }
  };

  const handleDisconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setConnectionStatus("disconnected");
    setSocketId(null);
    setSubscribedRooms([]);
    addLog("system", "manual_disconnect", { message: "User disconnected socket manually" });
  };

  const handleSubscribeTask = (targetTaskId?: string) => {
    const idToSub = targetTaskId || taskId;
    if (!socketRef.current || !socketRef.current.connected) {
      addLog("error", "subscribe_failed", { message: "Socket is not connected. Please connect first." });
      return;
    }

    if (!idToSub.trim()) {
      addLog("error", "subscribe_failed", { message: "Task ID cannot be empty." });
      return;
    }

    setSubscribing(true);
    addLog("outgoing", "task:subscribe", { taskId: idToSub.trim() });

    socketRef.current.emit("task:subscribe", idToSub.trim(), (response: any) => {
      setSubscribing(false);
      addLog("incoming", "task:subscribe [ACK]", response);
      if (!subscribedRooms.includes(idToSub.trim())) {
        setSubscribedRooms((prev) => [...prev, idToSub.trim()]);
      }
    });
  };

  const handleUnsubscribeTask = (idToUnsub: string) => {
    if (!socketRef.current || !socketRef.current.connected) return;

    addLog("outgoing", "task:unsubscribe", { taskId: idToUnsub });
    socketRef.current.emit("task:unsubscribe", idToUnsub, (response: any) => {
      addLog("incoming", "task:unsubscribe [ACK]", response);
      setSubscribedRooms((prev) => prev.filter((r) => r !== idToUnsub));
    });
  };

  const handleCustomEmit = () => {
    if (!socketRef.current || !socketRef.current.connected) {
      addLog("error", "emit_failed", { message: "Socket is not connected." });
      return;
    }

    let parsedPayload: any = customPayload;
    try {
      parsedPayload = JSON.parse(customPayload);
    } catch {
      // Send as string if not JSON
      parsedPayload = customPayload;
    }

    addLog("outgoing", customEvent, parsedPayload);

    socketRef.current.emit(customEvent, parsedPayload, (ack: any) => {
      addLog("incoming", `${customEvent} [ACK]`, ack);
    });
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(JSON.stringify(logs, null, 2));
    alert("Logs copied to clipboard as JSON!");
  };

  const filteredLogs = logs.filter((log) => {
    if (filterEvent !== "all" && log.event !== filterEvent && log.type !== filterEvent) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const content = JSON.stringify(log).toLowerCase();
      return content.includes(q);
    }
    return true;
  });

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case "connected":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            CONNECTED
          </span>
        );
      case "connecting":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/30 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            CONNECTING...
          </span>
        );
      case "error":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-600 border border-red-500/30">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            ERROR
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-500 border border-slate-500/30">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            DISCONNECTED
          </span>
        );
    }
  };

  const devScriptSnippet = `// Load Socket.IO client script in browser
const script = document.createElement('script');
script.src = 'https://cdn.socket.io/4.8.1/socket.io.min.js';
script.onload = () => {
  console.log('Socket.IO loaded, connecting to ${url}...');
  
  // Connect to live WSS
  const socket = io('${url}', {
    auth: { token: '${token || "your_valid_token_here"}' },
    transports: ${transport === "websocket" ? "['websocket']" : "['polling', 'websocket']"}
  });

  socket.on('connect', () => {
    console.log('%c🟢 Connected to WebSocket! Socket ID: ' + socket.id, 'color: green; font-size: 14px;');
    
    // Subscribe to a test task room
    socket.emit('task:subscribe', '${taskId || "test-task-123"}', (res) => {
      console.log('Subscribed response:', res);
    });
  });

  // Listen for live events
  socket.on('status', (payload) => {
    console.log('%c🚀 RECEIVED LIVE EVENT:', 'color: blue; font-weight: bold;', payload);
  });

  socket.on('connect_error', (err) => {
    console.error('❌ Connect error:', err.message);
  });
};
document.head.appendChild(script);`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600/20 border border-indigo-500/40 rounded-xl text-indigo-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
                  WebSocket Tester
                  {getStatusBadge()}
                </h1>
                <p className="text-xs text-slate-400">
                  Interactive real-time tester for <code className="text-indigo-300 font-mono">https://ws.dzinlynxt.com</code>
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/"
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg transition"
            >
              Back to App
            </a>
          </div>
        </header>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Column */}
          <div className="lg:col-span-5 space-y-6">
            {/* 1. Connection Config Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                Server Connection
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">WebSocket URL</label>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://ws.dzinlynxt.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-300">Auth Token / API Key</label>
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="text-[11px] text-indigo-400 hover:underline"
                    >
                      {showToken ? "Hide" : "Show"}
                    </button>
                  </div>
                  <input
                    type={showToken ? "text" : "password"}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Optional JWT or API Key"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Transport</label>
                    <select
                      value={transport}
                      onChange={(e) => setTransport(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="websocket">websocket only</option>
                      <option value="polling,websocket">polling + websocket</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Socket ID</label>
                    <div className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-400 font-mono truncate">
                      {socketId || "Not Connected"}
                    </div>
                  </div>
                </div>

                {errorMessage && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs space-y-1.5">
                    <div className="text-red-400 font-semibold flex items-center gap-1.5">
                      <span>❌ Error:</span>
                      <span>{errorMessage}</span>
                    </div>
                    {errorMessage.toLowerCase().includes("xhr poll") && (
                      <div className="text-[11px] text-amber-300/90 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                        💡 <strong>Fix:</strong> The server lacks CORS for HTTP polling. Please change <strong>Transport</strong> to <code>websocket only</code>.
                      </div>
                    )}
                    {errorMessage.toLowerCase().includes("unauthorized") && (
                      <div className="text-[11px] text-amber-300/90 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                        🔑 <strong>Fix:</strong> The server requires a valid token. Please paste a valid JWT / API key into the <strong>Auth Token</strong> input above.
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-2 flex gap-2">
                  {connectionStatus !== "connected" ? (
                    <button
                      onClick={handleConnect}
                      disabled={connectionStatus === "connecting"}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20"
                    >
                      {connectionStatus === "connecting" ? "Connecting..." : "Connect Socket"}
                    </button>
                  ) : (
                    <button
                      onClick={handleDisconnect}
                      className="flex-1 bg-rose-600/80 hover:bg-rose-600 text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Task Subscription Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Task Room Subscription (<code className="text-emerald-400">task:subscribe</code>)
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Task ID / Room Name</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={taskId}
                      onChange={(e) => setTaskId(e.target.value)}
                      placeholder="e.g. test-task-123 or task UUID"
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                    <button
                      onClick={() => handleSubscribeTask()}
                      disabled={connectionStatus !== "connected" || subscribing}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition cursor-pointer"
                    >
                      {subscribing ? "Subscribing..." : "Subscribe"}
                    </button>
                  </div>
                </div>

                {/* Subscribed Rooms Badges */}
                {subscribedRooms.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1.5">Active Subscriptions:</label>
                    <div className="flex flex-wrap gap-1.5">
                      {subscribedRooms.map((room) => (
                        <span
                          key={room}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/60 border border-emerald-700/50 rounded-lg text-xs font-mono text-emerald-300"
                        >
                          {room}
                          <button
                            onClick={() => handleUnsubscribeTask(room)}
                            className="hover:text-red-400 ml-1 text-slate-400 font-bold"
                            title="Unsubscribe"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Custom Event Emitter Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Emit Custom Event
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Event Name</label>
                  <input
                    type="text"
                    value={customEvent}
                    onChange={(e) => setCustomEvent(e.target.value)}
                    placeholder="e.g. ping, message, task:subscribe"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Payload (JSON or string)</label>
                  <textarea
                    value={customPayload}
                    onChange={(e) => setCustomPayload(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono resize-y"
                  />
                </div>

                <button
                  onClick={handleCustomEmit}
                  disabled={connectionStatus !== "connected"}
                  className="w-full bg-amber-600/80 hover:bg-amber-600 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold py-2.5 px-4 rounded-xl transition cursor-pointer"
                >
                  Emit Event
                </button>
              </div>
            </div>
          </div>

          {/* Logs & Inspector Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col h-[650px]">
              {/* Logs Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                    Live Event Feed
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-400">
                    {logs.length} events
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAutoScroll(!autoScroll)}
                    className={`text-[11px] px-2 py-1 rounded-lg border transition ${
                      autoScroll
                        ? "bg-indigo-600/20 border-indigo-500/40 text-indigo-300"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    Auto-scroll {autoScroll ? "ON" : "OFF"}
                  </button>
                  <button
                    onClick={handleCopyLogs}
                    className="text-[11px] px-2 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg transition"
                  >
                    Copy All
                  </button>
                  <button
                    onClick={handleClearLogs}
                    className="text-[11px] px-2 py-1 bg-slate-950 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-800 text-rose-400 rounded-lg transition"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Filters Bar */}
              <div className="flex items-center gap-2 pt-3 pb-2 text-xs">
                <input
                  type="text"
                  placeholder="Filter logs by keyword..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <select
                  value={filterEvent}
                  onChange={(e) => setFilterEvent(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Types</option>
                  <option value="incoming">Incoming</option>
                  <option value="outgoing">Outgoing</option>
                  <option value="error">Errors</option>
                  <option value="system">System</option>
                </select>
              </div>

              {/* Terminal Logs Area */}
              <div
                ref={logsEndRef}
                className="flex-1 overflow-y-auto bg-slate-950 border border-slate-800/80 rounded-xl p-4 font-mono text-xs space-y-3 mt-2"
              >
                {filteredLogs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 text-xs">
                    <p>No events recorded yet.</p>
                    <p className="text-[11px] mt-1 text-slate-700">Click &ldquo;Connect Socket&rdquo; to start streaming.</p>
                  </div>
                ) : (
                  filteredLogs.map((log) => {
                    let badgeColor = "bg-slate-800 text-slate-300 border-slate-700";
                    let prefix = "ℹ️";

                    if (log.type === "incoming") {
                      badgeColor = "bg-cyan-950/60 text-cyan-400 border-cyan-700/50";
                      prefix = "⬇ IN";
                    } else if (log.type === "outgoing") {
                      badgeColor = "bg-amber-950/60 text-amber-400 border-amber-700/50";
                      prefix = "⬆ OUT";
                    } else if (log.type === "error") {
                      badgeColor = "bg-red-950/60 text-red-400 border-red-700/50";
                      prefix = "✖ ERR";
                    } else if (log.type === "success") {
                      badgeColor = "bg-emerald-950/60 text-emerald-400 border-emerald-700/50";
                      prefix = "✔ OK";
                    }

                    return (
                      <div
                        key={log.id}
                        className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${badgeColor}`}
                            >
                              {prefix}
                            </span>
                            <span className="font-semibold text-slate-200">{log.event}</span>
                          </div>
                          <span className="text-slate-500 text-[10px]">{log.timestamp}</span>
                        </div>
                        {log.data !== undefined && (
                          <pre className="text-slate-300 bg-slate-950/80 p-2 rounded overflow-x-auto text-[11px] leading-relaxed border border-slate-900">
                            {typeof log.data === "object"
                              ? JSON.stringify(log.data, null, 2)
                              : String(log.data)}
                          </pre>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Dev Console Snippet Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Direct Browser Console Snippet
                </h3>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(devScriptSnippet);
                    alert("DevTools snippet copied to clipboard!");
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                >
                  Copy Snippet
                </button>
              </div>
              <pre className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-slate-400 overflow-x-auto">
                {devScriptSnippet}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
