"use client";

import { useSpiderSenseStore } from "@/store/useSpiderSenseStore";

interface StatusBarProps {
  calibrationProgress?: number;
}

export function StatusBar({ calibrationProgress = 0 }: StatusBarProps) {
  const { sessionState, performanceWarning, demoMode, exportMode } = useSpiderSenseStore();

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b hud-text text-xs"
      style={{ borderColor: "#1a3a8f", background: "#0a0a1a", color: "#e62429" }}>
      {/* Left: logo */}
      <div className="flex items-center gap-2">
        <span aria-hidden="true">🕷️</span>
        <span className="font-bold" style={{ color: "#e62429" }}>SPIDER-SENSE AI</span>
        {demoMode && (
          <span className="px-2 py-0.5 text-xs border animate-pulse"
            style={{ borderColor: "#f97316", color: "#f97316" }}>DEMO</span>
        )}
        {exportMode && (
          <span className="px-2 py-0.5 text-xs border animate-pulse"
            style={{ borderColor: "#e62429", color: "#e62429" }}>● REC</span>
        )}
      </div>

      {/* Center: calibration or status */}
      <div className="flex-1 mx-4">
        {sessionState === "calibrating" && (
          <div className="flex items-center gap-2">
            <span style={{ color: "#c8a96e" }}>CALIBRATING</span>
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "#1a1a2e" }}>
              <div className="h-full rounded-full transition-all duration-100"
                style={{ width: `${calibrationProgress * 100}%`, background: "#e62429" }} />
            </div>
            <span style={{ color: "#c8a96e" }}>{Math.round(calibrationProgress * 100)}%</span>
          </div>
        )}
        {sessionState === "active" && (
          <span style={{ color: "#1a3a8f" }}>● MONITORING ACTIVE</span>
        )}
        {sessionState === "idle" && (
          <span style={{ color: "#333" }}>SYSTEM OFFLINE</span>
        )}
      </div>

      {/* Right: warnings */}
      <div className="flex items-center gap-3">
        {performanceWarning && (
          <span className="animate-pulse" style={{ color: "#f97316" }}>
            ⚠ LOW FPS
          </span>
        )}
        <span style={{ color: "#333" }}>
          {new Date().toLocaleTimeString("en-US", { hour12: false })}
        </span>
      </div>
    </div>
  );
}
