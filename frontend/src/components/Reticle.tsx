"use client";

import { useSpiderSenseStore } from "@/store/useSpiderSenseStore";

export function Reticle() {
  const { threatLevel, threatScore, sessionState } = useSpiderSenseStore();
  if (sessionState !== "active" && sessionState !== "calibrating") return null;

  const color = threatLevel === "triggered" ? "#e62429"
    : threatLevel === "elevated" ? "#f97316"
    : threatLevel === "aware" ? "#eab308"
    : "#1a3a8f";

  const size = 80;
  const c = size / 2;
  const gap = 12;
  const len = 16;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Corner brackets */}
        {[
          [c - gap, c - gap, -len, 0, 0, -len],
          [c + gap, c - gap, len, 0, 0, -len],
          [c - gap, c + gap, -len, 0, 0, len],
          [c + gap, c + gap, len, 0, 0, len],
        ].map(([x, y, dx1, dy1, dx2, dy2], i) => (
          <g key={i}>
            <line x1={x} y1={y} x2={x + dx1} y2={y + dy1} stroke={color} strokeWidth={2} />
            <line x1={x} y1={y} x2={x + dx2} y2={y + dy2} stroke={color} strokeWidth={2} />
          </g>
        ))}
        {/* Center dot */}
        <circle cx={c} cy={c} r={2} fill={color} />
        {/* Pulse ring when elevated/triggered */}
        {(threatLevel === "elevated" || threatLevel === "triggered") && (
          <circle cx={c} cy={c} r={threatScore / 10} fill="none" stroke={color}
            strokeWidth={1} opacity={0.4} className="animate-ping" />
        )}
      </svg>
    </div>
  );
}
