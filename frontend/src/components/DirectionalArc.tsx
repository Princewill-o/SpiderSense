"use client";

import { useSpiderSenseStore } from "@/store/useSpiderSenseStore";
import { ThreatDirection } from "@/types";

const LEVEL_COLORS: Record<string, string> = {
  stable: "#1a3a8f",
  aware: "#eab308",
  elevated: "#f97316",
  triggered: "#e62429",
};

// Arc angles for each direction (start, end in degrees, 0=right, CCW)
const DIRECTION_ARCS: Record<ThreatDirection, [number, number]> = {
  right: [-45, 45],
  "center-right": [-30, 30],
  center: [-20, 20],
  "center-left": [150, 210],
  left: [135, 225],
  top: [225, 315],
  bottom: [45, 135],
  "multi-zone": [0, 360],
};

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  if (endDeg - startDeg >= 360) {
    return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy}`;
  }
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export function DirectionalArc() {
  const { direction, threatLevel, threatScore, sessionState } = useSpiderSenseStore();

  if (sessionState !== "active" || threatScore < 10) return null;

  const color = LEVEL_COLORS[threatLevel] || "#22c55e";
  const size = 200;
  const center = size / 2;
  const radius = 90;

  const arcAngles = DIRECTION_ARCS[direction as ThreatDirection] || DIRECTION_ARCS.center;
  const [startDeg, endDeg] = arcAngles;
  const path = arcPath(center, center, radius, startDeg, endDeg);
  const opacity = Math.min(1, threatScore / 50);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      aria-hidden="true"
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          opacity={opacity}
          style={{ transition: "opacity 0.15s ease, stroke 0.15s ease" }}
        />
        {/* Glow effect */}
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          opacity={opacity * 0.2}
        />
      </svg>
    </div>
  );
}
