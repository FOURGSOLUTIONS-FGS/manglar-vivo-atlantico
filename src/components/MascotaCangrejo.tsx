"use client";

import { useEffect, useRef, useState } from "react";

interface MascotaCangrejoProps {
  message?: string;
  title?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function MascotaCangrejo({
  message,
  title = "Mangle · Tu guía en el manglar",
  size = "md",
  className = "",
}: MascotaCangrejoProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 });
  const [waving, setWaving] = useState(false);
  const [blinking, setBlinking] = useState(false);

  // Seguimiento suave de pupilas al cursor/toque
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let rafId = 0;
    const handleMove = (e: PointerEvent) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const el = wrapRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const maxMove = 3.2;
        setPupilOffset({
          x: (dx / dist) * Math.min(maxMove, dist / 28),
          y: (dy / dist) * Math.min(maxMove, dist / 28),
        });
      });
    };

    window.addEventListener("pointermove", handleMove, { passive: true });
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", handleMove);
    };
  }, []);

  // Parpadeo natural periódico
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setInterval(() => {
      setBlinking(true);
      setTimeout(() => setBlinking(false), 160);
    }, 4200);
    return () => clearInterval(timer);
  }, []);

  const dim =
    size === "sm"
      ? "h-16 w-16"
      : size === "lg"
      ? "h-28 w-28 sm:h-32 sm:w-32"
      : "h-20 w-20 sm:h-24 sm:w-24";

  return (
    <div
      ref={wrapRef}
      className={`flex items-center gap-3.5 sm:gap-4 ${className}`}
    >
      <button
        type="button"
        onClick={() => {
          setWaving(true);
          setTimeout(() => setWaving(false), 750);
        }}
        aria-label="Saludar a Mangle el Cangrejo Vigía"
        className={`relative shrink-0 cursor-pointer select-none rounded-3xl transition-transform duration-300 ease-coastal hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EDB512] ${dim}`}
      >
        <svg viewBox="0 0 320 320" className="h-full w-full drop-shadow-md">
          <defs>
            <linearGradient id="mcShell" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38A3DC" />
              <stop offset="55%" stopColor="#005F96" />
              <stop offset="100%" stopColor="#08334C" />
            </linearGradient>
            <linearGradient id="mcHat" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F8D86F" />
              <stop offset="100%" stopColor="#D89D09" />
            </linearGradient>
          </defs>
          <ellipse cx="160" cy="264" rx="88" ry="15" fill="#08334C" opacity="0.14" />
          <g stroke="#0A6EA8" strokeWidth="11" strokeLinecap="round" fill="none">
            <path d="M98 188 Q62 192 52 220" />
            <path d="M104 205 Q66 218 64 242" />
            <path d="M115 218 Q84 236 88 252" />
            <path d="M222 188 Q258 192 268 220" />
            <path d="M216 205 Q254 218 256 242" />
            <path d="M205 218 Q236 236 232 252" />
          </g>
          {/* Tenaza izquierda con lupa */}
          <g className="origin-[102px_162px] transition-transform duration-500">
            <path d="M102 162 Q68 134 62 104" stroke="#0A6EA8" strokeWidth="12" strokeLinecap="round" fill="none" />
            <path d="M44 92 C38 70 64 56 76 74 C66 80 68 92 78 96 C66 106 49 104 44 92 Z" fill="#38A3DC" />
            <g transform="translate(36, 46) rotate(-14)">
              <rect x="34" y="48" width="10" height="34" rx="5" fill="#7D4E24" />
              <circle cx="38" cy="30" r="24" fill="#DDF4FF" fillOpacity="0.62" stroke="#EDB512" strokeWidth="6" />
            </g>
          </g>
          {/* Tenaza derecha que saluda */}
          <g
            style={{
              transformOrigin: "218px 162px",
              transform: waving ? "rotate(18deg) translateY(-6px)" : "rotate(0deg)",
              transition: "transform 320ms cubic-bezier(0.32, 0.72, 0, 1)",
            }}
          >
            <path d="M218 162 Q252 134 256 102" stroke="#0A6EA8" strokeWidth="12" strokeLinecap="round" fill="none" />
            <path d="M276 92 C282 70 256 56 244 74 C254 80 252 92 242 96 C254 106 271 104 276 92 Z" fill="#38A3DC" />
          </g>
          {/* Cuerpo */}
          <ellipse cx="160" cy="186" rx="76" ry="56" fill="url(#mcShell)" />
          <ellipse cx="160" cy="204" rx="52" ry="26" fill="#E8F6FC" opacity="0.2" />
          {/* Ojos vivos */}
          <line x1="134" y1="142" x2="128" y2="118" stroke="#005F96" strokeWidth="9" strokeLinecap="round" />
          <line x1="186" y1="142" x2="192" y2="118" stroke="#005F96" strokeWidth="9" strokeLinecap="round" />
          <ellipse cx="127" cy="112" rx="14" ry={blinking ? 2.5 : 14} fill="#FFFFFF" />
          <ellipse cx="193" cy="112" rx="14" ry={blinking ? 2.5 : 14} fill="#FFFFFF" />
          {!blinking && (
            <>
              <circle cx={128 + pupilOffset.x} cy={112 + pupilOffset.y} r="6.8" fill="#08334C" />
              <circle cx={192 + pupilOffset.x} cy={112 + pupilOffset.y} r="6.8" fill="#08334C" />
              <circle cx={130.5 + pupilOffset.x} cy={109.5 + pupilOffset.y} r="2.2" fill="#FFFFFF" />
              <circle cx={194.5 + pupilOffset.x} cy={109.5 + pupilOffset.y} r="2.2" fill="#FFFFFF" />
            </>
          )}
          <path d="M138 184 Q160 202 182 184" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" fill="none" />
          <circle cx="126" cy="178" r="6" fill="#F8D86F" opacity="0.55" />
          <circle cx="194" cy="178" r="6" fill="#F8D86F" opacity="0.55" />
          {/* Sombrero vueltiao */}
          <g transform="translate(160, 126) rotate(-6)">
            <ellipse cx="0" cy="8" rx="54" ry="12" fill="url(#mcHat)" stroke="#08334C" strokeWidth="2.5" />
            <path d="M-28 6 Q-24 -22 0 -22 Q24 -22 28 6 Z" fill="url(#mcHat)" stroke="#08334C" strokeWidth="2.5" />
            <path d="M-24 -4 Q0 2 24 -4" stroke="#08334C" strokeWidth="4" fill="none" />
          </g>
        </svg>
      </button>

      {message && (
        <div className="relative flex-1 rounded-2xl border border-[#08334C]/12 bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#005F96]">
            {title}
          </p>
          <p className="mt-0.5 text-sm font-bold leading-snug text-[#08334C]">
            {message}
          </p>
        </div>
      )}
    </div>
  );
}
