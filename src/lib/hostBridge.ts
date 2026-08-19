

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
