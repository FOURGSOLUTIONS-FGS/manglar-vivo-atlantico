"use client";

import type { ReliabilityBreakdown } from "@/lib/reliability";

interface ReliabilityMeterProps {
  score: number;
  breakdown?: ReliabilityBreakdown | null;
  variant?: "light" | "dark";
  compact?: boolean;
}

const SEGMENTS = [
  { key: "foto", label: "Foto EXIF", max: 25 },
  { key: "gps", label: "GPS CRA", max: 25 },
  { key: "tiempo", label: "Tiempo", max: 15 },
  { key: "gt", label: "Ground-Truth", max: 15 },
  { key: "mentores", label: "Mentores", max: 20 },
];

export function ReliabilityMeter({
  score,
  breakdown,
  variant = "light",
  compact = false,
}: ReliabilityMeterProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const tierColor =
    clamped >= 75 ? "#16794A" : clamped >= 45 ? "#C98206" : "#C84023";
  const tierText =
    clamped >= 75 ? "Confiabilidad Alta" : clamped >= 45 ? "Confiabilidad Media" : "Confiabilidad Baja";

  const isDark = variant === "dark";
  const trackBg = isDark ? "bg-white/10" : "bg-[#041A29]/10";
  const titleColor = isDark ? "text-white" : "text-[#041A29]";
  const mutedColor = isDark ? "text-white/65" : "text-[#041A29]/60";

  // Si hay desglose exacto usamos cada factor; si no, llenamos proporcionalmente los 5 bloques
  let remaining = clamped;
  const filledSegments = SEGMENTS.map((seg, idx) => {
    const factor = breakdown?.factors?.[idx];
    if (factor) {
      return {
        ...seg,
        label: factor.label,
        points: factor.points,
        pct: Math.round((factor.points / factor.maxPoints) * 100),
        met: factor.met,
      };
    }
    const pts = Math.min(seg.max, remaining);
    remaining = Math.max(0, remaining - pts);
    return {
      ...seg,
      points: pts,
      pct: Math.round((pts / seg.max) * 100),
      met: pts >= seg.max * 0.6,
    };
  });

  if (compact) {
    return (
      <div className="min-w-[112px]">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className="font-mono text-sm font-bold tabular-nums"
            style={{ color: isDark && clamped >= 45 && clamped < 75 ? "#F8D86F" : tierColor }}
          >
            {clamped}/100
          </span>
          <span className={`text-[11px] font-bold ${mutedColor}`}>
            {clamped >= 75 ? "Alta" : clamped >= 45 ? "Media" : "Baja"}
          </span>
        </div>
        <div className="mt-1.5 grid grid-cols-5 gap-1" aria-label={`Confiabilidad ${clamped} de 100`}>
          {filledSegments.map((seg) => (
            <div key={seg.key} className={`h-1.5 overflow-hidden rounded-[2px] ${trackBg}`}>
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${seg.pct}%`,
                  backgroundColor: isDark && clamped >= 45 && clamped < 75 ? "#EDB512" : tierColor,
                }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2.5">
          <span
            className="font-display text-3xl font-black tracking-tight tabular-nums"
            style={{ color: isDark && clamped >= 45 && clamped < 75 ? "#F8D86F" : tierColor }}
          >
            {clamped}
            <span className={`text-base font-bold ${mutedColor}`}>/100</span>
          </span>
          <span className={`text-xs font-bold ${titleColor}`}>{tierText}</span>
        </div>
        {breakdown && (
          <span className={`text-xs ${mutedColor}`}>{breakdown.label}</span>
        )}
      </div>

      {/* Barra arquitectónica de 5 segmentos ponderados */}
      <div
        className="grid grid-cols-12 gap-1.5"
        role="meter"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Semáforo de confiabilidad: ${clamped} de 100 puntos`}
      >
        {filledSegments.map((seg, i) => {
          const span = i < 2 ? "col-span-3" : i === 4 ? "col-span-2" : "col-span-2";
          return (
            <div key={seg.key} className={span}>
              <div className={`h-2.5 overflow-hidden rounded-[2px] ${trackBg}`}>
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${seg.pct}%`,
                    backgroundColor:
                      isDark && clamped >= 45 && clamped < 75 ? "#EDB512" : tierColor,
                  }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px]">
                <span className={`truncate font-bold ${mutedColor}`}>
                  {SEGMENTS[i].label}
                </span>
                <span className={`font-mono font-bold tabular-nums ${titleColor}`}>
                  +{seg.points}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
