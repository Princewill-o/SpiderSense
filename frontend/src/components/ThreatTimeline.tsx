"use client";

import { useEffect, useRef } from "react";
import { useSpiderSenseStore } from "@/store/useSpiderSenseStore";
import { TimelinePoint } from "@/types";

const LEVEL_COLORS: Record<string, string> = {
  stable: "#1a3a8f",
  aware: "#eab308",
  elevated: "#f97316",
  triggered: "#e62429",
};

function scoreToColor(score: number): string {
  if (score >= 75) return LEVEL_COLORS.triggered;
  if (score >= 50) return LEVEL_COLORS.elevated;
  if (score >= 25) return LEVEL_COLORS.aware;
  return LEVEL_COLORS.stable;
}

export function ThreatTimeline() {
  const { timelineData } = useSpiderSenseStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = "#0a0a1a";
      ctx.fillRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = "#1a1a3e";
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = (h * i) / 4;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Score labels
      ctx.fillStyle = "#1a3a8f";
      ctx.font = "9px monospace";
      ctx.fillText("100", 2, 10);
      ctx.fillText("75", 2, h * 0.25 + 4);
      ctx.fillText("50", 2, h * 0.5 + 4);
      ctx.fillText("25", 2, h * 0.75 + 4);
      ctx.fillText("0", 2, h - 2);

      if (timelineData.length < 2) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      const now = Date.now();
      const windowMs = 60_000;
      const windowStart = now - windowMs;
      const points = timelineData.filter((p) => p.timestamp >= windowStart);

      if (points.length < 2) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      // Draw line
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";

      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const x1 = ((prev.timestamp - windowStart) / windowMs) * w;
        const y1 = h - (prev.threat_score / 100) * h;
        const x2 = ((curr.timestamp - windowStart) / windowMs) * w;
        const y2 = h - (curr.threat_score / 100) * h;

        ctx.strokeStyle = scoreToColor(curr.threat_score);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Draw spike markers
      for (const point of points) {
        if (point.is_spike) {
          const x = ((point.timestamp - windowStart) / windowMs) * w;
          const y = h - (point.threat_score / 100) * h;
          ctx.fillStyle = "#f97316";
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw snapshot markers
      for (const point of points) {
        if (point.snapshot_saved) {
          const x = ((point.timestamp - windowStart) / windowMs) * w;
          ctx.strokeStyle = "#60a5fa";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [timelineData]);

  return (
    <div className="border p-2" style={{ background: "#0a0a1a", borderColor: "#1a3a8f" }}
      role="img" aria-label="Threat score timeline chart">
      <div className="text-xs hud-text mb-1" style={{ color: "#e62429" }}>
        🕷 THREAT TIMELINE (60s)
      </div>
      <canvas
        ref={canvasRef}
        width={400}
        height={80}
        className="w-full"
        aria-hidden="true"
      />
      <div className="flex justify-between text-xs hud-text mt-1" style={{ color: "#1a3a8f" }}>
        <span>-60s</span>
        <span>NOW</span>
      </div>
    </div>
  );
}
