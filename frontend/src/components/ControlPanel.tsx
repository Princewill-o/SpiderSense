"use client";

import { useSpiderSenseStore } from "@/store/useSpiderSenseStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function postSettings(sensitivity: string) {
  try {
    await fetch(`${API_URL}/settings`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sensitivity }),
    });
  } catch { /* backend may be offline */ }
}

export function ControlPanel() {
  const { sensitivity, audioEnabled, demoMode, exportMode,
    setSensitivity, setAudioEnabled, setDemoMode, setExportMode } = useSpiderSenseStore();

  const handleSensitivity = async (s: "low" | "medium" | "high") => {
    setSensitivity(s); await postSettings(s);
  };

  const Toggle = ({ id, checked, onChange, label }: { id: string; checked: boolean; onChange: () => void; label: string }) => (
    <div className="flex items-center justify-between">
      <label htmlFor={id} className="text-xs hud-text cursor-pointer" style={{ color: "#c8a96e" }}>{label}</label>
      <button id={id} role="switch" aria-checked={checked}
        aria-label={`${label} ${checked ? "enabled" : "disabled"}`}
        onClick={onChange}
        className="relative w-10 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
        style={{ background: checked ? "#e62429" : "#1a1a2e", border: "1px solid #1a3a8f" }}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <div className="p-3 space-y-4 border-2" style={{ background: "#0a0a1a", borderColor: "#1a3a8f" }}
      role="region" aria-label="Control panel">
      <h2 className="text-xs hud-text font-bold" style={{ color: "#e62429" }}>🕷 CONTROLS</h2>

      <fieldset>
        <legend className="text-xs hud-text mb-2" style={{ color: "#c8a96e" }}>SENSITIVITY</legend>
        <div className="flex gap-1" role="group" aria-label="Sensitivity level">
          {(["low", "medium", "high"] as const).map((level) => (
            <button key={level} onClick={() => handleSensitivity(level)}
              className="flex-1 py-1 text-xs hud-text border transition-all focus:outline-none focus:ring-2 focus:ring-red-500"
              style={{
                borderColor: sensitivity === level ? "#e62429" : "#1a3a8f",
                color: sensitivity === level ? "#e62429" : "#1a3a8f",
                background: sensitivity === level ? "rgba(230,36,41,0.15)" : "transparent",
              }}
              aria-pressed={sensitivity === level} aria-label={`Set sensitivity to ${level}`}>
              {level.toUpperCase()}
            </button>
          ))}
        </div>
      </fieldset>

      <Toggle id="audio-toggle" checked={audioEnabled} onChange={() => setAudioEnabled(!audioEnabled)} label="AUDIO ALERTS" />
      <Toggle id="demo-toggle" checked={demoMode} onChange={() => setDemoMode(!demoMode)} label="DEMO MODE" />
      <Toggle id="export-toggle" checked={exportMode} onChange={() => setExportMode(!exportMode)} label="EXPORT MODE" />
    </div>
  );
}
