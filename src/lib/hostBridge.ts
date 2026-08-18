/**
 * Host bridge — the message protocol between this chat (embedded as an iframe)
 * and its embedding page (PHP).
 *
 *   chat → host  { action: "submitLunaProject", data }
 *     Posted when the user approves the project; the host page is expected to
 *     listen on its own `window` for this action, persist the design, and — when
 *     the user cancels — re-enable the chat by sending the reverse command:
 *
 *   host → chat  { action: "cancelAllNeed" }
 *     Sent by the host via `iframe.contentWindow.postMessage(...)` to undo a
 *     submission and unlock the result UI.
 *
 * Security model:
 *   - Incoming commands are only accepted when `event.source` is the window
 *     that directly embeds this chat (`window.parent`) — never an arbitrary
 *     frame that happens to be able to reach us.
 *   - The host's origin is learned from the first message it sends us, so
 *     outgoing posts stop using "*" as soon as the host has talked to us.
 *     Until then the origin is unknowable cross-origin, so "*" is the fallback.
 */

export const HOST_ACTION_SUBMIT_PROJECT = "submitLunaProject" as const;
export const HOST_ACTION_CANCEL_ALL_NEED = "cancelAllNeed" as const;
export const HOST_ACTION_CUSTOM_PROJECT = "custom" as const;

/** Payload of the chat → host submit message (schema-shaped brief + design history). */
export interface SubmitLunaProjectData {
  id: number | null;
  original: Record<string, unknown>;
  design: unknown[];
  rating: number;
  action: string;
}

export type HostMessage =
  | { action: typeof HOST_ACTION_SUBMIT_PROJECT; data: SubmitLunaProjectData }
  | { action: typeof HOST_ACTION_CANCEL_ALL_NEED }
  | { action: typeof HOST_ACTION_CUSTOM_PROJECT; data: SubmitLunaProjectData };

/** Origin of the embedding host once learned (null until the host talks to us). */
let hostOrigin: string | null = null;

/** Record the host's origin from an incoming parent message. */
export function noteHostOrigin(origin: string): void {
  hostOrigin = origin;
}

/** True when a message event was sent by the window directly embedding this chat. */
export function isFromParent(event: MessageEvent): boolean {
  return event.source === window.parent;
}

/**
 * Post a message to the embedding host. Targets the learned host origin when
 * available, otherwise "*".
 */
export function postToHost(message: HostMessage): void {
  window.parent.postMessage(message, hostOrigin ?? "*");
}
