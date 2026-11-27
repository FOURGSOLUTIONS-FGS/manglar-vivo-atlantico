"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/lib/gsap";

export function SmoothScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
    const nav = navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
      deviceMemory?: number;
    };
    const isSlowNet =
      Boolean(nav.connection?.saveData) ||
      nav.connection?.effectiveType === "slow-2g" ||
      nav.connection?.effectiveType === "2g";
    const isLowPower =
      (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4) ||
      (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4);

    // En celulares táctiles o equipos lentos/ahorro de datos usamos scroll nativo (0% CPU extra)
    if (reduced || isTouchDevice || isSlowNet || isLowPower) return;

    const lenis = new Lenis({
      duration: 1.0,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    lenis.on("scroll", ScrollTrigger.update);

    const tick = (time: number) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  return null;
}
