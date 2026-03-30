"use client";

import { useSpiderSenseStore } from "@/store/useSpiderSenseStore";
import { ThreatLevel } from "@/types";

const LEVEL_COLORS: Record<ThreatLevel, string> = {
  stable: "#1a3a8f", aware: "#eab308", elevated: "#f97316", triggered: "#e62429",
};
const LEVEL_ICONS: Record<ThreatLevel, string> = {
  stable: "●", aware: "◆", elevated: "▲", triggered: "★",
};

function formatTime(isoString: string): string {
  try { return new Date(isoString).toLocaleTimeString("en-US", { hour12: false }); }
  catch { return isoString; }
}

export function EventLogPanel() {
  const { eventLog } = useSpiderSenseStore();

  return (
    <div className="flex flex-col h-full" style={{ background: "#0a0a1a" }}
      role="log" aria-label="Event log" aria-live="polite">
      <div className="px-3 py-2 border-b" style={{ borderColor: "#1a3a8f" }}>
        <h2 className="text-xs hud-text" style={{ color: "#e62429" }}>
          🕷 EVENT LOG ({eventLog.length}/50)
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {eventLog.length === 0 ? (
          <div className="p-3 text-xs hud-text text-center mt-4" style={{ color: "#333" }}>
            NO THREATS DETECTED
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "#0f0f1f" }}>
            {eventLog.map((entry) => {
              const color = LEVEL_COLORS[entry.threat_level] || "#1a3a8f";
              const icon = LEVEL_ICONS[entry.threat_level] || "●";
              return (
                <li key={entry.id} className="px-3 py-2 border-l-2"
                  style={{ borderLeftColor: color }}
                  aria-label={`${entry.threat_level} at ${formatTime(entry.timestamp)}: ${entry.event_reasons.join(", ")}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1 text-xs hud-text" style={{ color }}>
                      <span aria-hidden="true">{icon}</span>
                      {entry.threat_level.toUpperCase()}
                    </span>
                    <span className="text-xs hud-text" style={{ color: "#333" }}>
                      {formatTime(entry.timestamp)}
                    </span>
                  </div>
                  <div className="text-xs hud-text" style={{ color: "#c8a96e" }}>
                    DIR: {entry.direction.toUpperCase()}
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {entry.event_reasons.map((reason, i) => (
                      <li key={i} className="text-xs hud-text" style={{ color: "#e62429" }}>
                        • {reason}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
