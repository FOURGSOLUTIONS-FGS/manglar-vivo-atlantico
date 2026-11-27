"use client";

export function ReliabilityRing({
  score,
  size = 84,
}: {
  score: number;
  size?: number;
}) {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score));
  const offset = circ - (pct / 100) * circ;
  const color =
    pct >= 75 ? "#1F7A4C" : pct >= 45 ? "#EDB512" : "#D94E2A";

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(8,51,76,0.1)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-coastal"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="tabular-nums font-display text-xl font-black leading-none text-[#08334C]">
          {pct}
        </span>
        <span className="text-[9px] font-black uppercase tracking-wider text-[#08334C]/55">
          /100
        </span>
      </div>
    </div>
  );
}
