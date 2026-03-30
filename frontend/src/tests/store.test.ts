// Feature: spider-sense-ai
import { describe, it, expect, beforeEach } from "vitest";
import { useSpiderSenseStore } from "@/store/useSpiderSenseStore";
import { WebSocketMessage } from "@/types";

function makeMessage(overrides: Partial<WebSocketMessage> = {}): WebSocketMessage {
  return {
    timestamp: new Date().toISOString(),
    frame_id: 1,
    threat_score: 30,
    threat_level: "aware",
    direction: "left",
    motion_intensity: 0.3,
    motion_suddenness: 0.2,
    approach_velocity: 0.1,
    center_proximity: 0.4,
    zones_active: ["mid-center"],
    objects: [],
    event_reasons: ["rapid motion spike"],
    snapshot_saved: false,
    degraded: false,
    ...overrides,
  };
}

describe("useSpiderSenseStore", () => {
  beforeEach(() => {
    useSpiderSenseStore.getState().reset();
  });

  it("starts with idle session state", () => {
    expect(useSpiderSenseStore.getState().sessionState).toBe("idle");
  });

  it("appendEvent updates threat score and level", () => {
    const msg = makeMessage({ threat_score: 60, threat_level: "elevated" });
    useSpiderSenseStore.getState().appendEvent(msg);
    const state = useSpiderSenseStore.getState();
    expect(state.threatScore).toBe(60);
    expect(state.threatLevel).toBe("elevated");
  });

  it("appendEvent adds to event log when event_reasons non-empty", () => {
    const msg = makeMessage({ event_reasons: ["approaching object"] });
    useSpiderSenseStore.getState().appendEvent(msg);
    expect(useSpiderSenseStore.getState().eventLog.length).toBe(1);
  });

  it("appendEvent does NOT add to event log when event_reasons empty", () => {
    const msg = makeMessage({ event_reasons: [] });
    useSpiderSenseStore.getState().appendEvent(msg);
    expect(useSpiderSenseStore.getState().eventLog.length).toBe(0);
  });

  it("event log never exceeds 50 entries", () => {
    for (let i = 0; i < 60; i++) {
      useSpiderSenseStore.getState().appendEvent(
        makeMessage({ frame_id: i, event_reasons: ["rapid motion spike"] })
      );
    }
    expect(useSpiderSenseStore.getState().eventLog.length).toBeLessThanOrEqual(50);
  });

  it("event log discards oldest when over 50", () => {
    for (let i = 0; i < 55; i++) {
      useSpiderSenseStore.getState().appendEvent(
        makeMessage({ frame_id: i, event_reasons: ["rapid motion spike"] })
      );
    }
    const log = useSpiderSenseStore.getState().eventLog;
    expect(log.length).toBe(50);
  });

  it("appendEvent adds to timeline data", () => {
    const msg = makeMessage({ threat_score: 45 });
    useSpiderSenseStore.getState().appendEvent(msg);
    const timeline = useSpiderSenseStore.getState().timelineData;
    expect(timeline.length).toBe(1);
    expect(timeline[0].threat_score).toBe(45);
  });

  it("timeline point has correct is_spike for elevated", () => {
    const msg = makeMessage({ threat_score: 60, threat_level: "elevated" });
    useSpiderSenseStore.getState().appendEvent(msg);
    expect(useSpiderSenseStore.getState().timelineData[0].is_spike).toBe(true);
  });

  it("timeline point has is_spike false for stable", () => {
    const msg = makeMessage({ threat_score: 10, threat_level: "stable" });
    useSpiderSenseStore.getState().appendEvent(msg);
    expect(useSpiderSenseStore.getState().timelineData[0].is_spike).toBe(false);
  });

  it("setSessionState updates session state", () => {
    useSpiderSenseStore.getState().setSessionState("active");
    expect(useSpiderSenseStore.getState().sessionState).toBe("active");
  });

  it("setSensitivity updates sensitivity", () => {
    useSpiderSenseStore.getState().setSensitivity("high");
    expect(useSpiderSenseStore.getState().sensitivity).toBe("high");
  });

  it("setAudioEnabled updates audio flag", () => {
    useSpiderSenseStore.getState().setAudioEnabled(true);
    expect(useSpiderSenseStore.getState().audioEnabled).toBe(true);
  });

  it("setDemoMode updates demo mode", () => {
    useSpiderSenseStore.getState().setDemoMode(true);
    expect(useSpiderSenseStore.getState().demoMode).toBe(true);
  });

  it("setExportMode updates export mode", () => {
    useSpiderSenseStore.getState().setExportMode(true);
    expect(useSpiderSenseStore.getState().exportMode).toBe(true);
  });

  it("reset clears all state", () => {
    useSpiderSenseStore.getState().appendEvent(makeMessage({ event_reasons: ["test"] }));
    useSpiderSenseStore.getState().setSessionState("active");
    useSpiderSenseStore.getState().reset();
    const state = useSpiderSenseStore.getState();
    expect(state.sessionState).toBe("idle");
    expect(state.eventLog.length).toBe(0);
    expect(state.timelineData.length).toBe(0);
    expect(state.threatScore).toBe(0);
  });

  it("event log entry contains correct fields", () => {
    const msg = makeMessage({
      timestamp: "2024-01-01T00:00:00Z",
      threat_level: "elevated",
      direction: "right",
      event_reasons: ["approaching object"],
    });
    useSpiderSenseStore.getState().appendEvent(msg);
    const entry = useSpiderSenseStore.getState().eventLog[0];
    expect(entry.timestamp).toBe("2024-01-01T00:00:00Z");
    expect(entry.threat_level).toBe("elevated");
    expect(entry.direction).toBe("right");
    expect(entry.event_reasons).toContain("approaching object");
  });

  it("snapshot_saved is reflected in timeline point", () => {
    const msg = makeMessage({ snapshot_saved: true });
    useSpiderSenseStore.getState().appendEvent(msg);
    expect(useSpiderSenseStore.getState().timelineData[0].snapshot_saved).toBe(true);
  });
});
