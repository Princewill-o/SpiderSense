// Feature: spider-sense-ai
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useSpiderSenseStore } from "@/store/useSpiderSenseStore";
import { ThreatScoreDisplay } from "@/components/ThreatScoreDisplay";
import { EventLogPanel } from "@/components/EventLogPanel";
import { StatusBar } from "@/components/StatusBar";
import { ControlPanel } from "@/components/ControlPanel";
import { ThreatRing } from "@/components/ThreatRing";
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
    zones_active: [],
    objects: [],
    event_reasons: [],
    snapshot_saved: false,
    degraded: false,
    ...overrides,
  };
}

describe("ThreatScoreDisplay", () => {
  beforeEach(() => {
    useSpiderSenseStore.getState().reset();
  });

  it("renders threat score", () => {
    useSpiderSenseStore.getState().appendEvent(makeMessage({ threat_score: 75 }));
    render(<ThreatScoreDisplay />);
    expect(screen.getByText("75")).toBeTruthy();
  });

  it("renders threat level label", () => {
    useSpiderSenseStore.getState().appendEvent(
      makeMessage({ threat_level: "triggered", threat_score: 80 })
    );
    render(<ThreatScoreDisplay />);
    expect(screen.getByText("TRIGGERED")).toBeTruthy();
  });

  it("renders icon alongside level (not color alone)", () => {
    useSpiderSenseStore.getState().appendEvent(
      makeMessage({ threat_level: "elevated", threat_score: 60 })
    );
    render(<ThreatScoreDisplay />);
    // Icon ▲ should be present for elevated
    expect(screen.getByText("▲")).toBeTruthy();
  });

  it("has aria-label for accessibility", () => {
    render(<ThreatScoreDisplay />);
    const el = screen.getByRole("status");
    expect(el.getAttribute("aria-label")).toBeTruthy();
  });
});

describe("EventLogPanel", () => {
  beforeEach(() => {
    useSpiderSenseStore.getState().reset();
  });

  it("shows no events message when empty", () => {
    render(<EventLogPanel />);
    expect(screen.getByText(/NO EVENTS RECORDED/i)).toBeTruthy();
  });

  it("renders event entries", () => {
    useSpiderSenseStore.getState().appendEvent(
      makeMessage({ event_reasons: ["approaching object"], threat_level: "elevated" })
    );
    render(<EventLogPanel />);
    expect(screen.getByText(/approaching object/i)).toBeTruthy();
  });

  it("has role=log for accessibility", () => {
    render(<EventLogPanel />);
    expect(screen.getByRole("log")).toBeTruthy();
  });

  it("shows event count", () => {
    render(<EventLogPanel />);
    expect(screen.getByText(/EVENT LOG/i)).toBeTruthy();
  });
});

describe("StatusBar", () => {
  beforeEach(() => {
    useSpiderSenseStore.getState().reset();
  });

  it("renders system name", () => {
    render(<StatusBar />);
    expect(screen.getByText(/SPIDER-SENSE AI/i)).toBeTruthy();
  });

  it("shows DEMO indicator when demo mode active", () => {
    useSpiderSenseStore.getState().setDemoMode(true);
    render(<StatusBar />);
    expect(screen.getByText(/DEMO/i)).toBeTruthy();
  });

  it("shows REC indicator when export mode active", () => {
    useSpiderSenseStore.getState().setExportMode(true);
    render(<StatusBar />);
    expect(screen.getByText(/REC/i)).toBeTruthy();
  });

  it("shows calibration progress during calibrating state", () => {
    useSpiderSenseStore.getState().setSessionState("calibrating");
    render(<StatusBar calibrationProgress={0.5} />);
    expect(screen.getByText(/CALIBRATING/i)).toBeTruthy();
  });

  it("has role=status for accessibility", () => {
    render(<StatusBar />);
    expect(screen.getByRole("status")).toBeTruthy();
  });
});

describe("ControlPanel", () => {
  beforeEach(() => {
    useSpiderSenseStore.getState().reset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
  });

  it("renders sensitivity controls", () => {
    render(<ControlPanel />);
    expect(screen.getByText("LOW")).toBeTruthy();
    expect(screen.getByText("MEDIUM")).toBeTruthy();
    expect(screen.getByText("HIGH")).toBeTruthy();
  });

  it("sensitivity buttons have aria-pressed", () => {
    render(<ControlPanel />);
    const mediumBtn = screen.getByRole("button", { name: /Set sensitivity to medium/i });
    expect(mediumBtn.getAttribute("aria-pressed")).toBe("true");
  });

  it("audio toggle has role=switch", () => {
    render(<ControlPanel />);
    const toggle = screen.getByRole("switch", { name: /Audio alerts/i });
    expect(toggle).toBeTruthy();
  });

  it("demo mode toggle has role=switch", () => {
    render(<ControlPanel />);
    const toggle = screen.getByRole("switch", { name: /Demo mode/i });
    expect(toggle).toBeTruthy();
  });

  it("export mode toggle has role=switch", () => {
    render(<ControlPanel />);
    const toggle = screen.getByRole("switch", { name: /Export mode/i });
    expect(toggle).toBeTruthy();
  });

  it("all controls have aria-labels", () => {
    render(<ControlPanel />);
    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => {
      expect(btn.getAttribute("aria-label") || btn.textContent).toBeTruthy();
    });
  });
});

describe("ThreatRing", () => {
  beforeEach(() => {
    useSpiderSenseStore.getState().reset();
  });

  it("renders with score 0 initially", () => {
    render(<ThreatRing />);
    expect(screen.getByText("0")).toBeTruthy();
  });

  it("renders updated score", () => {
    useSpiderSenseStore.getState().appendEvent(makeMessage({ threat_score: 85 }));
    render(<ThreatRing />);
    expect(screen.getByText("85")).toBeTruthy();
  });

  it("has aria-label", () => {
    render(<ThreatRing />);
    const el = screen.getByRole("img");
    expect(el.getAttribute("aria-label")).toBeTruthy();
  });
});
