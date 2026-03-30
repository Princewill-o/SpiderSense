"use client";

import { useEffect, useState } from "react";

const RELEASE_DATE = new Date("2026-07-31T00:00:00");

function getCountdown() {
  const diff = RELEASE_DATE.getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins: Math.floor((diff % 3600000) / 60000),
    secs: Math.floor((diff % 60000) / 1000),
  };
}

export function MovieCountdown({ compact = false }: { compact?: boolean }) {
  // Start null to avoid SSR/client mismatch — only set on client
  const [countdown, setCountdown] = useState<ReturnType<typeof getCountdown> | null>(null);

  useEffect(() => {
    setCountdown(getCountdown());
    const t = setInterval(() => setCountdown(getCountdown()), 1000);
    return () => clearInterval(t);
  }, []);

  // Render nothing on server / before hydration
  if (countdown === null) {
    return compact
      ? <span className="hud-text font-bold" style={{ color: "white" }}>🎬 SPIDER-MAN: BRAND NEW DAY — IN CINEMAS JUL 31 2026</span>
      : <div className="hud-text text-center text-xs" style={{ color: "#c8a96e" }}>🎬 SPIDER-MAN: BRAND NEW DAY — IN CINEMAS JUL 31 2026</div>;
  }

  if (!countdown) {
    return <div className="hud-text text-center font-bold" style={{ color: "#e62429" }}>🎬 SPIDER-MAN: BRAND NEW DAY — IN CINEMAS NOW!</div>;
  }

  const pad = (n: number) => String(n).padStart(2, "0");

  if (compact) {
    return (
      <span className="hud-text font-bold text-xs" style={{ color: "white" }}>
        🎬 SPIDER-MAN: BRAND NEW DAY — {countdown.days}d {pad(countdown.hours)}h {pad(countdown.mins)}m {pad(countdown.secs)}s — JUL 31 2026
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 py-2">
      <span className="hud-text text-xs font-bold" style={{ color: "#c8a96e" }}>🎬 SPIDER-MAN: BRAND NEW DAY</span>
      {(["DAYS", "HRS", "MIN", "SEC"] as const).map((label, i) => {
        const val = [countdown.days, countdown.hours, countdown.mins, countdown.secs][i];
        return (
          <div key={label} className="flex flex-col items-center">
            <span className="text-2xl font-bold hud-text tabular-nums" style={{ color: "#e62429", minWidth: "2.5ch", textAlign: "center" }}>
              {pad(val)}
            </span>
            <span className="text-xs hud-text" style={{ color: "#1a3a8f" }}>{label}</span>
          </div>
        );
      })}
      <span className="hud-text text-xs font-bold" style={{ color: "#c8a96e" }}>IN CINEMAS JUL 31 2026</span>
    </div>
  );
}
