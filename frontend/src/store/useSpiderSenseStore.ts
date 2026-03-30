import { create } from "zustand";
import {
  EventLogEntry,
  SessionState,
  SessionSummary,
  Settings,
  TimelinePoint,
  ThreatDirection,
  ThreatLevel,
  WebSocketMessage,
} from "@/types";

const MAX_EVENT_LOG = 50;
const TIMELINE_WINDOW_MS = 60_000; // 60 seconds
const PERF_WARNING_THRESHOLD = 5; // messages/sec

interface SpiderSenseStore {
  // Session
  sessionId: string | null;
  sessionState: SessionState;

  // Live threat data
  latestMessage: WebSocketMessage | null;
  threatScore: number;
  threatLevel: ThreatLevel;
  direction: ThreatDirection;
  eventReasons: string[];

  // Event log
  eventLog: EventLogEntry[];

  // Timeline
  timelineData: TimelinePoint[];

  // Settings
  sensitivity: "low" | "medium" | "high";
  audioEnabled: boolean;
  demoMode: boolean;
  exportMode: boolean;

  // Performance
  messageRate: number;
  performanceWarning: boolean;
  _messageTimestamps: number[];

  // Session summary
  sessionSummary: SessionSummary | null;

  // Actions
  appendEvent: (msg: WebSocketMessage) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  setSessionState: (state: SessionState) => void;
  setSessionId: (id: string | null) => void;
  setSessionSummary: (summary: SessionSummary | null) => void;
  setSensitivity: (s: "low" | "medium" | "high") => void;
  setAudioEnabled: (v: boolean) => void;
  setDemoMode: (v: boolean) => void;
  setExportMode: (v: boolean) => void;
  reset: () => void;
}

export const useSpiderSenseStore = create<SpiderSenseStore>((set, get) => ({
  sessionId: null,
  sessionState: "idle",
  latestMessage: null,
  threatScore: 0,
  threatLevel: "stable",
  direction: "center",
  eventReasons: [],
  eventLog: [],
  timelineData: [],
  sensitivity: "medium",
  audioEnabled: false,
  demoMode: false,
  exportMode: false,
  messageRate: 0,
  performanceWarning: false,
  _messageTimestamps: [],
  sessionSummary: null,

  appendEvent: (msg: WebSocketMessage) => {
    const now = Date.now();

    set((state) => {
      // Update message rate tracking
      const cutoff = now - 1000;
      const recentTimestamps = [...state._messageTimestamps.filter((t) => t > cutoff), now];
      const messageRate = recentTimestamps.length;
      const performanceWarning = messageRate < PERF_WARNING_THRESHOLD && state.sessionState === "active";

      // Update event log
      let newEventLog = state.eventLog;
      if (msg.event_reasons.length > 0) {
        const entry: EventLogEntry = {
          id: `${msg.frame_id}-${now}`,
          timestamp: msg.timestamp,
          threat_level: msg.threat_level,
          direction: msg.direction,
          event_reasons: msg.event_reasons,
        };
        newEventLog = [entry, ...state.eventLog];
        if (newEventLog.length > MAX_EVENT_LOG) {
          newEventLog = newEventLog.slice(0, MAX_EVENT_LOG);
        }
      }

      // Update timeline
      const isSpike = msg.threat_level === "elevated" || msg.threat_level === "triggered";
      const point: TimelinePoint = {
        timestamp: now,
        threat_score: msg.threat_score,
        is_spike: isSpike,
        snapshot_saved: msg.snapshot_saved,
      };
      const windowStart = now - TIMELINE_WINDOW_MS;
      const newTimeline = [...state.timelineData.filter((p) => p.timestamp > windowStart), point];

      return {
        latestMessage: msg,
        threatScore: msg.threat_score,
        threatLevel: msg.threat_level,
        direction: msg.direction,
        eventReasons: msg.event_reasons,
        eventLog: newEventLog,
        timelineData: newTimeline,
        messageRate,
        performanceWarning,
        _messageTimestamps: recentTimestamps,
      };
    });
  },

  updateSettings: (settings: Partial<Settings>) => {
    set((state) => ({
      sensitivity: settings.sensitivity ?? state.sensitivity,
    }));
  },

  setSessionState: (state: SessionState) => {
    set({ sessionState: state });
  },

  setSessionId: (id: string | null) => {
    set({ sessionId: id });
  },

  setSessionSummary: (summary: SessionSummary | null) => {
    set({ sessionSummary: summary });
  },

  setSensitivity: (s: "low" | "medium" | "high") => {
    set({ sensitivity: s });
  },

  setAudioEnabled: (v: boolean) => {
    set({ audioEnabled: v });
  },

  setDemoMode: (v: boolean) => {
    set({ demoMode: v });
  },

  setExportMode: (v: boolean) => {
    set({ exportMode: v });
  },

  reset: () => {
    set({
      sessionId: null,
      sessionState: "idle",
      latestMessage: null,
      threatScore: 0,
      threatLevel: "stable",
      direction: "center",
      eventReasons: [],
      eventLog: [],
      timelineData: [],
      messageRate: 0,
      performanceWarning: false,
      _messageTimestamps: [],
      sessionSummary: null,
    });
  },
}));
