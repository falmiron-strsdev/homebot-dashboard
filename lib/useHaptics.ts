"use client";

import { useCallback } from "react";

// Distinct vibration patterns (milliseconds)
const HAPTIC_PATTERNS = {
  send: [12],            // Short crisp tap – sent message
  firstToken: [8],       // Subtle pulse – first streaming token arrived
  reply: [10, 50, 10],   // Double pulse – assistant replied
  error: [30, 60, 30],   // Heavy triple – error occurred
} as const;

type HapticType = keyof typeof HAPTIC_PATTERNS;

/**
 * useHaptics – tactile feedback for compatible devices.
 *
 * Feature-detects `navigator.vibrate` and no-ops silently when:
 *  - the API is absent (most desktop browsers, iOS Safari)
 *  - the document is not currently visible (tab in background)
 *
 * Only call `fire()` for meaningful, user-driven interactions.
 * Import this hook inside Client Components only.
 */
export function useHaptics() {
  const fire = useCallback((type: HapticType) => {
    if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    try {
      navigator.vibrate(HAPTIC_PATTERNS[type]);
    } catch {
      // Silent failure — e.g. permission denied or API unavailable at runtime
    }
  }, []);

  return { fire };
}
