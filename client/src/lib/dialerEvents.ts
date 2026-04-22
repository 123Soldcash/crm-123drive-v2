/**
 * Dialer Event System
 *
 * Allows any component to programmatically open the FloatingDialer
 * with a pre-filled phone number and caller ID, and optionally auto-start the call.
 *
 * Usage:
 *   import { openDialer } from "@/lib/dialerEvents";
 *   openDialer({ phone: "+15551234567", callerId: "+15559876543", autoCall: true });
 */

export type DialerOpenEvent = {
  phone: string;
  callerId?: string;
  autoCall?: boolean;
};

const DIALER_OPEN_EVENT = "dialer:open";

/**
 * Dispatch an event to open the FloatingDialer with the given parameters.
 */
export function openDialer(params: DialerOpenEvent) {
  window.dispatchEvent(
    new CustomEvent<DialerOpenEvent>(DIALER_OPEN_EVENT, { detail: params })
  );
}

/**
 * Subscribe to dialer open events. Returns an unsubscribe function.
 */
export function onDialerOpen(callback: (params: DialerOpenEvent) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<DialerOpenEvent>).detail;
    callback(detail);
  };
  window.addEventListener(DIALER_OPEN_EVENT, handler);
  return () => window.removeEventListener(DIALER_OPEN_EVENT, handler);
}
