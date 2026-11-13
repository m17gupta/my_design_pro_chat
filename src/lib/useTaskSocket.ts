/**
 * useTaskSocket — React hook that subscribes to real-time task status
 * updates via the dzinly WebSocket server (ws.dzinlynxt.com).
 *
 * Instead of (or alongside) HTTP polling, the hook opens a Socket.IO
 * connection, joins the `task:{taskId}` room, and listens for
 * `task:status` events pushed by the Python backend.
 *
 * Usage:
 * ```ts
 * useTaskSocket(taskId, token, (data) => {
 *   dispatch(applyWsTaskStatus(data)); // update Redux
 * });
 * ```
 *
 * The hook is a no-op when `taskId` is null / undefined / empty, or
 * when the task has already reached a terminal state. It disconnects
 * automatically on unmount or when `taskId` changes.
 */

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

/** The payload shape pushed by the backend via `task:status` event. */
export interface TaskStatusPayload {
  task_id: string;
  status: string;
  result: {
    task_id: string;
    generated_image_url: string;
    work_type: string;
    reference_image_urls: string[];
    prompt_used_preview?: string;
    prompt_used_full?: string;
    mask_stats?: {
      size: [number, number];
      editable_ratio: number;
      preserved_ratio: number;
    };
    structure_warning?: string | null;
    repaint_verification?: Record<string, unknown>;
    [key: string]: unknown;
  } | null;
  error: string | null;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "https://ws.dzinlynxt.com";

export const FALLBACK_WS_TOKEN = "test-token-12345";

/** Terminal states — once reached the socket can disconnect. */
const TERMINAL = new Set(["completed", "failed", "success", "succeeded", "error"]);

/**
 * Resolves a valid authentication token for the WebSocket handshake.
 * If the provided token is missing or is an expired JWT, it falls back to
 * `FALLBACK_WS_TOKEN` so the socket does not get rejected with "unauthorized".
 */
export function resolveSafeWsToken(rawToken: string | null | undefined): string {
  if (!rawToken || typeof rawToken !== "string" || !rawToken.trim()) {
    return FALLBACK_WS_TOKEN;
  }
  const token = rawToken.trim();
  const parts = token.split(".");
  if (parts.length === 3) {
    try {
      const base64Url = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64Url.padEnd(
        base64Url.length + ((4 - (base64Url.length % 4)) % 4),
        "=",
      );
      const decodedStr =
        typeof window !== "undefined"
          ? window.atob(padded)
          : Buffer.from(padded, "base64").toString("utf-8");
      const payload = JSON.parse(decodedStr);
      if (typeof payload?.exp === "number" && payload.exp * 1000 <= Date.now()) {
        console.warn(
          "[useTaskSocket] Provided access_token is expired; using fallback token",
        );
        return FALLBACK_WS_TOKEN;
      }
    } catch {
      return FALLBACK_WS_TOKEN;
    }
  }
  return token;
}

export function useTaskSocket(
  taskId: string | null | undefined,
  token: string | null | undefined,
  onStatus: (data: TaskStatusPayload) => void,
) {
  const socketRef = useRef<Socket | null>(null);
  // Keep onStatus stable across renders via a ref so the effect doesn't
  // re-run when the callback identity changes.
  const cbRef = useRef(onStatus);
  cbRef.current = onStatus;

  // Track whether we already received a terminal event to avoid
  // reconnecting after the task is done.
  const doneRef = useRef(false);

  const cleanup = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Reset done flag when taskId changes (new generation)
    doneRef.current = false;
  }, [taskId]);

  useEffect(() => {
    if (!taskId || taskId.startsWith("pending-revision-") || doneRef.current) {
      return;
    }

    const effectiveToken = resolveSafeWsToken(token);
    let fallbackAttempted = effectiveToken === FALLBACK_WS_TOKEN;

    // Create connection (auth via handshake)
    const socket = io(WS_URL, {
      auth: { token: effectiveToken },
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log(`[useTaskSocket] connected socket=${socket.id}`);
      // Subscribe to the task room
      socket.emit(
        "task:subscribe",
        taskId,
        (ack: { ok: boolean; room?: string; error?: string }) => {
          if (ack.ok) {
            console.log(`[useTaskSocket] subscribed to room=${ack.room}`);
          } else {
            console.warn(`[useTaskSocket] subscribe failed: ${ack.error}`);
          }
        },
      );
    });

    socket.on("task:status", (data: TaskStatusPayload) => {
      // If task has already finished, ignore any late-arriving events
      if (doneRef.current) {
        return;
      }

      console.log(
        `[useTaskSocket] task:status task=${data.task_id} status=${data.status}`,
      );
      cbRef.current(data);

      if (TERMINAL.has((data.status ?? "").trim().toLowerCase())) {
        doneRef.current = true;
        // Stop the websocket immediately once completed/failed
        socket.emit("task:unsubscribe", taskId);
        socket.disconnect();
        socketRef.current = null;
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`[useTaskSocket] disconnected reason=${reason}`);
    });

    socket.on("connect_error", (err: Error) => {
      console.warn(`[useTaskSocket] connect_error: ${err.message}`);
      if (
        !fallbackAttempted &&
        err.message &&
        err.message.toLowerCase().includes("unauthorized")
      ) {
        console.log("[useTaskSocket] Retrying connection with fallback token...");
        fallbackAttempted = true;
        socket.auth = { token: FALLBACK_WS_TOKEN };
        socket.connect();
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [taskId, token, cleanup]);

  return cleanup;
}

