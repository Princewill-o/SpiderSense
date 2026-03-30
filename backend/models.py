from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class BoundingBox(BaseModel):
    x: float
    y: float
    w: float
    h: float


class MotionSignals(BaseModel):
    motion_intensity: float
    motion_suddenness: float
    dominant_direction: str
    zones_active: list[str]
    contour_area_fraction: float


class DetectedObject(BaseModel):
    object_id: str
    class_label: str
    confidence: float
    bbox: BoundingBox
    is_unknown_moving_region: bool


class TrackedObject(BaseModel):
    track_id: int
    class_label: str
    bbox: BoundingBox
    bbox_growth_rate: float
    approaching: bool
    velocity_hint: str
    path: list[tuple[float, float]]


class ThreatAssessment(BaseModel):
    threat_score: int
    threat_level: str
    direction: str
    event_reasons: list[str]
    snapshot_saved: bool
    degraded: bool


class WebSocketMessage(BaseModel):
    timestamp: str
    frame_id: int
    threat_score: int
    threat_level: str
    direction: str
    motion_intensity: float
    motion_suddenness: float
    approach_velocity: float
    center_proximity: float
    zones_active: list[str]
    objects: list[TrackedObject]
    event_reasons: list[str]
    snapshot_saved: bool
    degraded: bool


class CalibrationBaseline(BaseModel):
    avg_motion_level: float
    avg_brightness: float
    noise_floor: float
    reference_objects: list[DetectedObject]
    frame_count: int
    stable: bool


class SessionEvent(BaseModel):
    event_id: str
    session_id: str
    timestamp: datetime
    frame_id: int
    threat_score: int
    threat_level: str
    direction: str
    event_reasons: list[str]
    snapshot_saved: bool


class SnapshotRecord(BaseModel):
    snapshot_id: str
    session_id: str
    timestamp: datetime
    threat_score: int
    threat_level: str
    file_path: str


class SessionSummary(BaseModel):
    session_id: str
    total_alerts: int
    highest_threat_score: int
    average_threat_score: float
    top_direction: str
    total_snapshots: int
    dominant_event_reason: str


class Session(BaseModel):
    session_id: str
    started_at: datetime
    ended_at: datetime | None = None
    state: Literal["calibrating", "active", "stopped"]
    events: list[SessionEvent] = []
    snapshots: list[SnapshotRecord] = []
    summary: SessionSummary | None = None


class Settings(BaseModel):
    sensitivity: Literal["low", "medium", "high"] = "low"  # default low to reduce false alerts
    snapshot_threshold: int = 65  # higher threshold = fewer snapshots
    fps_cap: int = 15
    smoothing_alpha: float = 0.15  # more smoothing = less jitter
    hysteresis_frames: int = 5    # more frames required before level change
    confidence_threshold: float = 0.5  # higher confidence = fewer detections
    approach_threshold: float = 0.08
    tracker_timeout_frames: int = 10
