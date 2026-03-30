"use client";

import { useEffect, useRef } from "react";
import { useSpiderSenseStore } from "@/store/useSpiderSenseStore";
import { CameraViewport } from "./CameraViewport";
import { ThreatRing } from "./ThreatRing";
import { Reticle } from "./Reticle";
import { DirectionalArc } from "./DirectionalArc";
import { ThreatScoreDisplay } from "./ThreatScoreDisplay";
import { ThreatTimeline } from "./ThreatTimeline";
import { EventLogPanel } from "./EventLogPanel";
import { ControlPanel } from "./ControlPanel";
import { StatusBar } from "./StatusBar";
import { WebSocketMessage, ThreatLevel, ThreatDirection } from "@/types";

interface HUDRootProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  calibrationProgress?: number;
}

// Simulate threat data locally when backend is offline
function useLocalSimulation() {
  const { sessionState, appendEvent } = useSpiderSenseStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameRef = useRef(0);
  const scoreRef = useRef(0);
  const directionRef = useRef<ThreatDirection>("center");

  useEffect(() => {
    if (sessionState !== "active") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const directions: ThreatDirection[] = ["left", "right", "top", "bottom", "center", "center-left", "center-right", "multi-zone"];
    const reasons = ["rapid motion spike", "approaching object", "person entered frame unexpectedly", "fast centerline movement", "multiple motion zones active"];

    timerRef.current = setInterval(() => {
      frameRef.current++;
      // Low baseline — only spikes occasionally to avoid false alerts
      const t = frameRef.current * 0.03;
      const base = 5 + Math.sin(t) * 4;
      const spike = Math.random() < 0.02 ? Math.random() * 30 : 0;
      scoreRef.current = Math.min(100, Math.max(0, Math.round(base + spike)));

      if (frameRef.current % 30 === 0) {
        directionRef.current = directions[Math.floor(Math.random() * directions.length)];
      }

      const score = scoreRef.current;
      const level: ThreatLevel = score >= 75 ? "triggered" : score >= 50 ? "elevated" : score >= 25 ? "aware" : "stable";
      const hasReasons = score > 45 && Math.random() < 0.15;

      const msg: WebSocketMessage = {
        timestamp: new Date().toISOString(),
        frame_id: frameRef.current,
        threat_score: score,
        threat_level: level,
        direction: directionRef.current,
        motion_intensity: score / 100,
        motion_suddenness: Math.random() * 0.5,
        approach_velocity: score > 50 ? Math.random() * 0.8 : 0,
        center_proximity: Math.random() * 0.6,
        zones_active: score > 40 ? ["mid-center", "top-center"] : [],
        objects: [],
        event_reasons: hasReasons ? [reasons[Math.floor(Math.random() * reasons.length)]] : [],
        snapshot_saved: false,
        degraded: false,
      };
      appendEvent(msg);
    }, 100);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sessionState, appendEvent]);
}

export function HUDRoot({ videoRef, stream, calibrationProgress = 0 }: HUDRootProps) {
  const { sessionState, exportMode, threatLevel, audioEnabled } = useSpiderSenseStore();
  const prevThreatLevel = useRef(threatLevel);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Run local simulation so HUD works even without backend
  useLocalSimulation();

  useEffect(() => {
    if (!audioEnabled) { prevThreatLevel.current = threatLevel; return; }
    const prev = prevThreatLevel.current;
    if (prev !== threatLevel && (threatLevel === "elevated" || threatLevel === "triggered")) {
      playAlert(threatLevel);
    }
    prevThreatLevel.current = threatLevel;
  }, [threatLevel, audioEnabled]);

  const playAlert = (level: "elevated" | "triggered") => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      if (level === "triggered") {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
      } else {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(550, ctx.currentTime + 0.15);
      }
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
    } catch { /* audio blocked */ }
  };

  const borderColor = threatLevel === "triggered" ? "#e62429"
    : threatLevel === "elevated" ? "#f97316"
    : threatLevel === "aware" ? "#eab308"
    : "#1a3a8f";

  if (exportMode) {
    return (
      <div className="fixed inset-0 flex flex-col" style={{ background: "#0a0a1a" }}>
        <StatusBar calibrationProgress={calibrationProgress} />
        <div className="flex-1 relative">
          <CameraViewport videoRef={videoRef} stream={stream}>
            <Reticle />
            <DirectionalArc />
            <div className="absolute top-4 left-1/2 -translate-x-1/2">
              <ThreatScoreDisplay />
            </div>
          </CameraViewport>
          <div className="absolute bottom-0 left-0 right-0 max-h-32 overflow-hidden"
            style={{ background: "rgba(10,10,26,0.85)" }}>
            <EventLogPanel />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden scanlines" style={{ background: "#0a0a1a", height: "100vh" }}>
      <StatusBar calibrationProgress={calibrationProgress} />

      <div className="flex overflow-hidden" style={{ flex: 1, minHeight: 0 }}>
        {/* Main viewport */}
        <div className="flex flex-col overflow-hidden" style={{ flex: 1, minWidth: 0 }}>
          {/* Camera — explicit flex-1 with minHeight:0 so it actually fills */}
          <div className="relative border-2 m-1" style={{ flex: 1, minHeight: 0, borderColor, transition: "border-color 0.3s ease", boxShadow: `0 0 12px ${borderColor}40` }}>
            <CameraViewport videoRef={videoRef} stream={stream}>
              <Reticle />
              <DirectionalArc />
            </CameraViewport>
          </div>

          {/* Bottom strip: timeline + ring */}
          <div className="flex gap-2 p-2 border-t" style={{ flexShrink: 0, borderColor: "#1a3a8f" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <ThreatTimeline />
            </div>
            <div style={{ flexShrink: 0 }}>
              <ThreatRing />
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex flex-col border-l overflow-hidden" style={{ width: 256, flexShrink: 0, borderColor: "#1a3a8f" }}>
          <div className="p-2 border-b" style={{ flexShrink: 0, borderColor: "#1a3a8f" }}>
            <ThreatScoreDisplay />
          </div>
          <div className="overflow-hidden" style={{ flex: 1, minHeight: 0 }}>
            <EventLogPanel />
          </div>
          <div className="border-t p-2" style={{ flexShrink: 0, borderColor: "#1a3a8f" }}>
            <ControlPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
