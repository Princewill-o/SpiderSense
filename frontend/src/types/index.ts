export type ThreatLevel = "stable" | "aware" | "elevated" | "triggered";
export type ThreatDirection =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "center-left"
  | "center-right"
  | "center"
  | "multi-zone";

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TrackedObject {
  track_id: number;
  class_label: string;
  bbox: BoundingBox;
  bbox_growth_rate: number;
  approaching: boolean;
  velocity_hint: string;
  path: [number, number][];
}

export interface WebSocketMessage {
  timestamp: string;
  frame_id: number;
  threat_score: number;
  threat_level: ThreatLevel;
  direction: ThreatDirection;
  motion_intensity: number;
  motion_suddenness: number;
  approach_velocity: number;
  center_proximity: number;
  zones_active: string[];
  objects: TrackedObject[];
  event_reasons: string[];
  snapshot_saved: boolean;
  degraded: boolean;
}

export interface EventLogEntry {
  id: string;
  timestamp: string;
  threat_level: ThreatLevel;
  direction: ThreatDirection;
  event_reasons: string[];
}

export interface TimelinePoint {
  timestamp: number; // epoch ms
  threat_score: number;
  is_spike: boolean;
  snapshot_saved: boolean;
}

export interface SessionSummary {
  session_id: string;
  total_alerts: number;
  highest_threat_score: number;
  average_threat_score: number;
  top_direction: ThreatDirection;
  total_snapshots: number;
  dominant_event_reason: string;
}

export interface SessionEvent {
  event_id: string;
  session_id: string;
  timestamp: string;
  frame_id: number;
  threat_score: number;
  threat_level: ThreatLevel;
  direction: ThreatDirection;
  event_reasons: string[];
  snapshot_saved: boolean;
}

export type SessionState = "idle" | "calibrating" | "active" | "stopped";

export interface Settings {
  sensitivity: "low" | "medium" | "high";
  snapshot_threshold: number;
  fps_cap: number;
  smoothing_alpha: number;
  hysteresis_frames: number;
  confidence_threshold: number;
  approach_threshold: number;
  tracker_timeout_frames: number;
}
