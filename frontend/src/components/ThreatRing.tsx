"use client";

import { useSpiderSenseStore } from "@/store/useSpiderSenseStore";
import { useEffect, useState } from "react";

const LEVEL_COLORS: Record<string, string> = {
  stable: "#1a3a8f",
  aware: "#eab308",
  elevated: "#f97316",
  triggered: "#e62429",
};

const LEVEL_ICONS: Record<string, string> = {
  stable: "●", aware: "◆", elevated: "▲", triggered: "★",
};

export function ThreatRing() {
  const { threatScore, threatLevel, eventReasons } = useSpiderSenseStore();
  const [pulseIntensity, setPulseIntensity] = useState(0);
  const [mounted, setMounted] = useState(false);
  
  // Ensure component only renders after mounting to prevent hydration errors
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Check for fist/hand threats
  const hasFistThreat = mounted && eventReasons.some(reason => 
    reason.includes("fist") || 
    reason.includes("hand") || 
    reason.includes("threatening gesture")
  );
  
  const hasApproachingThreat = mounted && eventReasons.some(reason =>
    reason.includes("approaching")
  );

  useEffect(() => {
    if (!mounted) return;
    
    // Pulse effect when threats are detected
    if (hasFistThreat || (hasApproachingThreat && threatScore > 50)) {
      setPulseIntensity(1);
      const timer = setTimeout(() => setPulseIntensity(0), 500);
      return () => clearTimeout(timer);
    }
  }, [mounted, hasFistThreat, hasApproachingThreat, threatScore]);

  const radius = 80;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - threatScore / 100);
  const color = LEVEL_COLORS[threatLevel] || "#1a3a8f";
  const size = 200;
  const center = size / 2;

  // Render placeholder during SSR
  if (!mounted) {
    return (
      <div className="relative flex items-center justify-center"
        role="img" aria-label="Threat ring loading">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle cx={center} cy={center} r={radius} fill="none" stroke="#1a1a2e" strokeWidth={strokeWidth} />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-3xl font-bold hud-text" style={{ color: "#1a3a8f" }}>0</span>
          <span className="text-xs hud-text flex items-center gap-1" style={{ color: "#1a3a8f" }}>
            <span aria-hidden="true">●</span>
            STABLE
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center"
      role="img" aria-label={`Threat ring: ${threatScore}% — ${threatLevel}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {/* Background circle */}
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#1a1a2e" strokeWidth={strokeWidth} />
        
        {/* Main threat ring */}
        <circle cx={center} cy={center} r={radius} fill="none" stroke={color}
          strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={dashOffset}
          strokeLinecap="round" transform={`rotate(-90 ${center} ${center})`}
          style={{ 
            transition: "stroke-dashoffset 0.15s ease, stroke 0.15s ease",
            filter: pulseIntensity > 0 ? `drop-shadow(0 0 ${10 * pulseIntensity}px ${color})` : 'none'
          }} />
        
        {/* Triggered state: multiple pulsing rings */}
        {threatLevel === "triggered" && (
          <>
            <circle cx={center} cy={center} r={radius + 6} fill="none" stroke={color}
              strokeWidth={2} opacity={0.4} className="animate-ping" />
            <circle cx={center} cy={center} r={radius + 12} fill="none" stroke={color}
              strokeWidth={1} opacity={0.2} className="animate-ping" style={{ animationDelay: '0.2s' }} />
          </>
        )}
        
        {/* Fist threat: intense warning effect */}
        {hasFistThreat && (
          <>
            <circle cx={center} cy={center} r={radius + 15} fill="none" stroke="#e62429"
              strokeWidth={3} opacity={0.6} className="animate-ping" />
            <circle cx={center} cy={center} r={radius + 25} fill="none" stroke="#e62429"
              strokeWidth={2} opacity={0.3} className="animate-ping" style={{ animationDelay: '0.15s' }} />
          </>
        )}
        
        {/* Spider web lines - more visible when threat is high */}
        {[0, 45, 90, 135].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          const webOpacity = threatScore > 50 ? 0.4 : 0.2;
          return (
            <line key={angle}
              x1={center - Math.cos(rad) * (radius - 10)} y1={center - Math.sin(rad) * (radius - 10)}
              x2={center + Math.cos(rad) * (radius - 10)} y2={center + Math.sin(rad) * (radius - 10)}
              stroke={color} strokeWidth={0.5} opacity={webOpacity} />
          );
        })}
        
        {/* Radial warning lines for high threats */}
        {threatScore > 70 && [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          const innerRadius = radius - 15;
          const outerRadius = radius + 5;
          return (
            <line key={`radial-${angle}`}
              x1={center + Math.cos(rad) * innerRadius} 
              y1={center + Math.sin(rad) * innerRadius}
              x2={center + Math.cos(rad) * outerRadius} 
              y2={center + Math.sin(rad) * outerRadius}
              stroke={color} strokeWidth={1} opacity={0.3} />
          );
        })}
      </svg>
      
      <div className="absolute flex flex-col items-center">
        <span 
          className="text-3xl font-bold hud-text" 
          style={{ 
            color,
            textShadow: pulseIntensity > 0 ? `0 0 ${20 * pulseIntensity}px ${color}` : 'none',
            transform: pulseIntensity > 0 ? `scale(${1 + 0.2 * pulseIntensity})` : 'scale(1)',
            transition: 'transform 0.2s ease'
          }}
        >
          {threatScore}
        </span>
        <span className="text-xs hud-text flex items-center gap-1" style={{ color }}>
          <span aria-hidden="true">{LEVEL_ICONS[threatLevel]}</span>
          {threatLevel.toUpperCase()}
        </span>
        {hasFistThreat && (
          <span className="text-xs font-bold mt-1 animate-pulse" style={{ color: "#e62429" }}>
            ⚠ THREAT DETECTED
          </span>
        )}
      </div>
    </div>
  );
}

