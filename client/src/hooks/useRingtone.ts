/**
 * useRingtone — iOS-compatible ringtone hook for incoming calls
 *
 * iOS Safari has strict autoplay restrictions:
 * - Audio CANNOT be played programmatically without a prior user gesture
 * - AudioContext must be created/resumed inside a user interaction handler
 * - The restriction applies even if the device is not muted
 *
 * Strategy:
 * 1. On first user interaction (click/touch anywhere on the page), we create
 *    and immediately suspend an AudioContext — this "unlocks" audio for the session
 * 2. When an incoming call arrives, we resume the AudioContext and play a
 *    synthesized ringtone using the Web Audio API (no external file needed)
 * 3. The ringtone loops until the call is accepted, rejected, or cancelled
 *
 * This approach works on iOS Safari 14+, Chrome, Firefox, and Android.
 */
import { useRef, useEffect, useCallback } from "react";

// Detect iOS
const isIOS = () =>
  typeof navigator !== "undefined" &&
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !(window as any).MSStream;

export function useRingtone() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ringtoneIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isUnlockedRef = useRef(false);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);

  // Create and unlock AudioContext on first user gesture
  const unlockAudio = useCallback(() => {
    if (isUnlockedRef.current) return;
    try {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      // Play a silent buffer to unlock audio on iOS
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);

      // Suspend immediately after unlock
      ctx.suspend().catch(() => {});
      isUnlockedRef.current = true;
      console.log("[Ringtone] AudioContext unlocked for iOS");
    } catch (e) {
      console.warn("[Ringtone] Failed to unlock AudioContext:", e);
    }
  }, []);

  // Register unlock listener on mount
  useEffect(() => {
    const events = ["click", "touchstart", "touchend", "keydown"];
    const handler = () => {
      unlockAudio();
      // Remove listeners after first interaction
      events.forEach((e) => document.removeEventListener(e, handler));
    };
    events.forEach((e) => document.addEventListener(e, handler, { once: true, passive: true }));
    return () => {
      events.forEach((e) => document.removeEventListener(e, handler));
    };
  }, [unlockAudio]);

  // Play a single "ring" tone (two-tone pattern like a phone)
  const playRingTone = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    try {
      // Resume AudioContext (required after suspend)
      ctx.resume().then(() => {
        const now = ctx.currentTime;
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        gainNode.connect(ctx.destination);

        // Two oscillators for a richer ringtone sound
        const freqs = [880, 1100]; // A5 + C#6 — classic phone ring
        freqs.forEach((freq) => {
          const osc = ctx.createOscillator();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now);
          osc.connect(gainNode);
          osc.start(now);
          osc.stop(now + 0.4);
          oscillatorsRef.current.push(osc);
        });

        // Clean up finished oscillators
        setTimeout(() => {
          oscillatorsRef.current = oscillatorsRef.current.filter((o) => {
            try { o.disconnect(); } catch {}
            return false;
          });
        }, 500);
      }).catch((e) => {
        console.warn("[Ringtone] AudioContext resume failed:", e);
      });
    } catch (e) {
      console.warn("[Ringtone] Error playing ringtone:", e);
    }
  }, []);

  // Start ringing — plays every 1.5 seconds
  const startRinging = useCallback(() => {
    // Stop any existing ring
    stopRinging();

    // If AudioContext not unlocked (no user gesture yet), try to create one now
    // This will work on Android/Chrome; on iOS it requires prior gesture
    if (!audioCtxRef.current) {
      try {
        const AudioContextClass =
          window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioCtxRef.current = new AudioContextClass();
          isUnlockedRef.current = true;
        }
      } catch {}
    }

    // Play immediately, then every 1.5s
    playRingTone();
    ringtoneIntervalRef.current = setInterval(playRingTone, 1500);
    console.log("[Ringtone] Started ringing");
  }, [playRingTone]);

  // Stop ringing
  const stopRinging = useCallback(() => {
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
    // Stop all active oscillators
    oscillatorsRef.current.forEach((o) => {
      try { o.stop(); o.disconnect(); } catch {}
    });
    oscillatorsRef.current = [];

    // Suspend AudioContext to save battery
    if (audioCtxRef.current) {
      audioCtxRef.current.suspend().catch(() => {});
    }
    console.log("[Ringtone] Stopped ringing");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRinging();
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch {}
        audioCtxRef.current = null;
      }
    };
  }, [stopRinging]);

  return { startRinging, stopRinging, isUnlocked: isUnlockedRef };
}
