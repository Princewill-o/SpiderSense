"use client";

import { useSpiderSenseStore } from "@/store/useSpiderSenseStore";

const LEVEL_COLORS: Record<string, string> = {
  stable: "#1a3a8f", aware: "#eab308", elevated: "#f97316", triggered: "#e62429",
};
const LEVEL_ICONS: Record<string, string> = {
  stable: "●", aware: "◆", elevated: "▲", triggered: "★",
};

export function ThreatScoreDisplay() {
  const { threatScore, threatLevel, direction, eventReasons } = useSpiderSenseStore();
  const color = LEVEL_COLORS[threatLevel] || "#1a3a8f";

  return (
    <div className="flex flex-col items-center gap-1 p-3 border-2"
      style={{ borderColor: color, background: "#0a0a1a", boxShadow: `0 0 8px ${color}40` }}
      role="status" aria-label={`Threat score: ${threatScore}, level: ${threatLevel}`} aria-live="polite">
      <div className="text-5xl font-bold hud-text" style={{ color }}>{threatScore}</div>
      <div className="flex items-center gap-2 hud-text text-sm" style={{ color }}>
        <span aria-hidden="true">{LEVEL_ICONS[threatLevel]}</span>
        <span>{threatLevel.toUpperCase()}</span>
      </div>
      <div className="text-xs hud-text" style={{ color: "#c8a96e" }}>
        DIR: {direction.toUpperCase()}
      </div>
      {eventReasons.length > 0 && (
        <div className="mt-1 text-xs hud-text max-w-[200px] text-center" style={{ color: "#e62429" }}>
          {eventReasons[0]}
        </div>
      )}
    </div>
  );
}
