"use client";

import type { AlertSoundProfile } from "@/core/alerts/types";

let sharedCtx: AudioContext | null = null;
let unlockBound = false;

export function ensureAlertAudioUnlocked() {
  if (typeof window === "undefined" || unlockBound) return;
  unlockBound = true;
  const unlock = () => {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    if (!sharedCtx) sharedCtx = new AudioCtx();
    if (sharedCtx.state === "suspended") {
      sharedCtx.resume().catch(() => {});
    }
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });
}

if (typeof window !== "undefined") {
  ensureAlertAudioUnlocked();
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  ensureAlertAudioUnlocked();
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedCtx) sharedCtx = new AudioCtx();
  return sharedCtx;
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startOffsetSec: number,
  durationSec: number,
  volume = 0.24,
  type: OscillatorType = "triangle"
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffsetSec);

  gain.gain.setValueAtTime(0.0001, ctx.currentTime + startOffsetSec);
  gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + startOffsetSec + 0.02);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    ctx.currentTime + startOffsetSec + durationSec
  );

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + startOffsetSec);
  osc.stop(ctx.currentTime + startOffsetSec + durationSec + 0.02);
}

function scheduleProfile(ctx: AudioContext, profile: AlertSoundProfile) {
  if (profile === "urgent") {
    // Señal de emergencia doble pulso nítida (Nivel 1 Urgente)
    playTone(ctx, 880, 0.0, 0.16, 0.28, "sawtooth");
    playTone(ctx, 660, 0.18, 0.16, 0.24, "triangle");
    playTone(ctx, 880, 0.38, 0.18, 0.28, "sawtooth");
    playTone(ctx, 1046.5, 0.58, 0.28, 0.26, "triangle");
    return;
  }

  if (profile === "priority") {
    // Aviso cálido de 2 tonos (Nivel 2 Alta / Nivel 3 Media)
    playTone(ctx, 587.33, 0.0, 0.18, 0.24, "sine");
    playTone(ctx, 783.99, 0.2, 0.25, 0.24, "sine");
    return;
  }

  // Confirmación positiva ascendente (Nivel 4 Verificación 828 ha)
  playTone(ctx, 523.25, 0.0, 0.12, 0.2, "sine");
  playTone(ctx, 659.25, 0.13, 0.12, 0.2, "sine");
  playTone(ctx, 783.99, 0.26, 0.24, 0.22, "sine");
}

/**
 * Reproduce señales acústicas diferenciadas por nivel de alerta (100% Web Audio API offline).
 */
export function playAlertSound(profile: AlertSoundProfile): boolean {
  if (profile === "none") return false;
  const ctx = getAudioContext();
  if (!ctx) return false;

  if (ctx.state === "suspended") {
    ctx
      .resume()
      .then(() => scheduleProfile(ctx, profile))
      .catch(() => {});
    return true;
  }

  scheduleProfile(ctx, profile);
  return true;
}

export async function requestBrowserNotificationPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "granted") return "granted";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function showBrowserAlertNotification(params: {
  title: string;
  body: string;
  tag?: string;
}): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;

  try {
    new Notification(params.title, {
      body: params.body,
      icon: "/images/pwa-icon-192.png",
      badge: "/images/pwa-icon-192.png",
      tag: params.tag || "manglar-vivo-alert",
    });
    return true;
  } catch {
    return false;
  }
}
