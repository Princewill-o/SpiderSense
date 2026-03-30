"""Threat_Engine: weighted threat scoring with hysteresis and smoothing - Enhanced for fist/hand detection."""
from __future__ import annotations

import os
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

from models import (
    CalibrationBaseline,
    MotionSignals,
    Settings,
    SnapshotRecord,
    ThreatAssessment,
    TrackedObject,
)

VALID_DIRECTIONS = {
    "left", "right", "top", "bottom",
    "center-left", "center-right", "center", "multi-zone",
}

VALID_EVENT_REASONS = {
    "rapid motion spike",
    "approaching object",
    "person entered frame unexpectedly",
    "fast centerline movement",
    "multiple motion zones active",
    "unknown moving region detected",
    "object size growth detected",
    "new entity in scene",
    "fist detected approaching",
    "hand moving toward camera",
    "threatening gesture detected",
}

THREAT_LEVELS = ["stable", "aware", "elevated", "triggered"]
LEVEL_UPPER = {"stable": 25, "aware": 50, "elevated": 75, "triggered": 101}
LEVEL_LOWER = {"stable": 0, "aware": 25, "elevated": 42, "triggered": 75}
SENSITIVITY_MAP = {"low": 0.6, "medium": 1.0, "high": 1.5}

# Threatening object classes that should trigger Spider-Sense
THREATENING_CLASSES = {"person", "hand", "unknown"}


class ThreatEngine:
    """Computes threat score, level, direction, and event reasons."""

    def __init__(
        self,
        settings: Optional[Settings] = None,
        data_dir: str = "./data",
    ) -> None:
        self._settings = settings or Settings()
        self._data_dir = data_dir
        self._smoothed_score: float = 0.0
        self._threat_level: str = "stable"
        self._level_up_counter: int = 0
        self._level_down_counter: int = 0
        self._last_snapshot_time: float = 0.0
        self._known_track_ids: set[int] = set()
        self._session_id: Optional[str] = None

    def set_session(self, session_id: str) -> None:
        self._session_id = session_id
        self._known_track_ids.clear()

    def update_settings(self, settings: Settings) -> None:
        self._settings = settings

    def assess(
        self,
        motion: MotionSignals,
        tracked_objects: list[TrackedObject],
        frame: Optional[np.ndarray] = None,
        frame_id: int = 0,
    ) -> ThreatAssessment:
        """Compute threat assessment from motion signals and tracked objects."""
        s = self._settings
        sensitivity_factor = SENSITIVITY_MAP.get(s.sensitivity, 1.0)

        # Filter for only threatening objects (hands, persons, unknown moving regions)
        threatening_objects = [
            obj for obj in tracked_objects 
            if obj.class_label in THREATENING_CLASSES
        ]

        # Compute derived signals - only from threatening objects
        approach_velocity = _compute_approach_velocity(threatening_objects)
        center_proximity = _compute_center_proximity(threatening_objects)
        bbox_growth = _compute_bbox_growth(threatening_objects)
        new_entity_bonus = _compute_new_entity_bonus(threatening_objects, self._known_track_ids)
        multi_zone_bonus = 1.0 if len(motion.zones_active) >= 3 else 0.0
        
        # Enhanced: Detect fist/hand approaching (high growth rate + center proximity)
        fist_threat = _detect_fist_threat(threatening_objects)

        # Update known track IDs
        for obj in tracked_objects:
            self._known_track_ids.add(obj.track_id)

        # If no threatening objects are approaching, reduce threat significantly
        if not threatening_objects or not any(obj.approaching for obj in threatening_objects):
            # Decay threat score faster when no threats present
            self._smoothed_score *= 0.7
            threat_score = int(round(min(100.0, max(0.0, self._smoothed_score))))
            threat_level = self._update_threat_level(threat_score)
            
            return ThreatAssessment(
                threat_score=threat_score,
                threat_level=threat_level,
                direction="center",
                event_reasons=[],
                snapshot_saved=False,
                degraded=False,
            )

        # Scale inputs by sensitivity
        mi = min(1.0, motion.motion_intensity * sensitivity_factor)
        ms = min(1.0, motion.motion_suddenness * sensitivity_factor)
        av = min(1.0, approach_velocity * sensitivity_factor)
        cp = min(1.0, center_proximity * sensitivity_factor)
        bg = min(1.0, bbox_growth * sensitivity_factor)
        ne = min(1.0, new_entity_bonus * sensitivity_factor)
        mz = min(1.0, multi_zone_bonus * sensitivity_factor)
        ft = min(1.0, fist_threat * sensitivity_factor)

        # Enhanced weighted formula - prioritize fist threat and approach velocity
        raw = (
            0.15 * mi      # Motion intensity (reduced)
            + 0.15 * ms    # Motion suddenness (reduced)
            + 0.25 * av    # Approach velocity (increased)
            + 0.15 * cp    # Center proximity (increased)
            + 0.15 * bg    # Bbox growth (increased)
            + 0.05 * ne    # New entity
            + 0.02 * mz    # Multi-zone
            + 0.08 * ft    # Fist threat (new)
        )

        # Normalize to [0, 100]
        raw_normalized = min(100.0, max(0.0, raw * 100.0))

        # Exponential smoothing
        alpha = s.smoothing_alpha
        self._smoothed_score = alpha * raw_normalized + (1.0 - alpha) * self._smoothed_score
        threat_score = int(round(min(100.0, max(0.0, self._smoothed_score))))

        # Hysteresis state machine
        threat_level = self._update_threat_level(threat_score)

        # Direction
        direction = _compute_direction(motion, threatening_objects)

        # Event reasons - enhanced for fist detection
        event_reasons = _compute_event_reasons(
            motion, threatening_objects, new_entity_bonus > 0, multi_zone_bonus > 0, fist_threat > 0.3
        )

        # Snapshot
        snapshot_saved = False
        snapshot_record: Optional[SnapshotRecord] = None
        if (
            threat_score >= s.snapshot_threshold
            and frame is not None
            and self._session_id is not None
        ):
            now = time.time()
            if now - self._last_snapshot_time >= 3.0:
                snapshot_record = self._save_snapshot(frame, threat_score, threat_level)
                if snapshot_record is not None:
                    snapshot_saved = True
                    self._last_snapshot_time = now

        return ThreatAssessment(
            threat_score=threat_score,
            threat_level=threat_level,
            direction=direction,
            event_reasons=event_reasons,
            snapshot_saved=snapshot_saved,
            degraded=False,
        )

    def _update_threat_level(self, score: int) -> str:
        current_idx = THREAT_LEVELS.index(self._threat_level)
        upper = LEVEL_UPPER[self._threat_level]
        lower = LEVEL_LOWER[self._threat_level]
        n = self._settings.hysteresis_frames

        if score >= upper and current_idx < len(THREAT_LEVELS) - 1:
            self._level_up_counter += 1
            self._level_down_counter = 0
            if self._level_up_counter >= n:
                self._threat_level = THREAT_LEVELS[current_idx + 1]
                self._level_up_counter = 0
        elif score < lower and current_idx > 0:
            self._level_down_counter += 1
            self._level_up_counter = 0
            if self._level_down_counter >= n:
                self._threat_level = THREAT_LEVELS[current_idx - 1]
                self._level_down_counter = 0
        else:
            self._level_up_counter = 0
            self._level_down_counter = 0

        return self._threat_level

    def _save_snapshot(
        self, frame: np.ndarray, threat_score: int, threat_level: str
    ) -> Optional[SnapshotRecord]:
        try:
            snap_dir = Path(self._data_dir) / "snapshots" / (self._session_id or "unknown")
            snap_dir.mkdir(parents=True, exist_ok=True)
            snapshot_id = str(uuid.uuid4())
            file_path = str(snap_dir / f"{snapshot_id}.jpg")
            cv2.imwrite(file_path, frame)
            return SnapshotRecord(
                snapshot_id=snapshot_id,
                session_id=self._session_id or "",
                timestamp=datetime.utcnow(),
                threat_score=threat_score,
                threat_level=threat_level,
                file_path=file_path,
            )
        except Exception as e:
            print(f"[ThreatEngine] Snapshot save failed: {e}")
            return None

    def reset(self) -> None:
        self._smoothed_score = 0.0
        self._threat_level = "stable"
        self._level_up_counter = 0
        self._level_down_counter = 0
        self._last_snapshot_time = 0.0
        self._known_track_ids.clear()


def _compute_approach_velocity(objects: list[TrackedObject]) -> float:
    if not objects:
        return 0.0
    approaching = [o for o in objects if o.approaching]
    if not approaching:
        return 0.0
    return min(1.0, max(o.bbox_growth_rate for o in approaching) * 10.0)


def _compute_center_proximity(objects: list[TrackedObject]) -> float:
    if not objects:
        return 0.0
    proximities = []
    for obj in objects:
        cx = obj.bbox.x + obj.bbox.w / 2
        cy = obj.bbox.y + obj.bbox.h / 2
        dist = ((cx - 0.5) ** 2 + (cy - 0.5) ** 2) ** 0.5
        proximity = max(0.0, 1.0 - dist * 2.0)
        proximities.append(proximity)
    return max(proximities)


def _compute_bbox_growth(objects: list[TrackedObject]) -> float:
    if not objects:
        return 0.0
    max_growth = max(o.bbox_growth_rate for o in objects)
    return min(1.0, max(0.0, max_growth * 10.0))


def _compute_new_entity_bonus(
    objects: list[TrackedObject], known_ids: set[int]
) -> float:
    new_count = sum(1 for o in objects if o.track_id not in known_ids)
    return min(1.0, new_count * 0.5)


def _detect_fist_threat(objects: list[TrackedObject]) -> float:
    """
    Detect if an object (hand/fist) is rapidly approaching the camera.
    Returns a threat score [0.0, 1.0] based on:
    - High bbox growth rate (object getting larger = approaching)
    - Center proximity (aimed at camera)
    - Fast velocity
    """
    if not objects:
        return 0.0
    
    max_threat = 0.0
    for obj in objects:
        # Only consider hands, persons, or unknown moving regions
        if obj.class_label not in THREATENING_CLASSES:
            continue
            
        # Check if approaching
        if not obj.approaching:
            continue
        
        # Calculate center position
        cx = obj.bbox.x + obj.bbox.w / 2
        cy = obj.bbox.y + obj.bbox.h / 2
        
        # Distance from center (0.5, 0.5)
        dist_from_center = ((cx - 0.5) ** 2 + (cy - 0.5) ** 2) ** 0.5
        center_score = max(0.0, 1.0 - dist_from_center * 1.5)  # Higher score when closer to center
        
        # Growth rate score (how fast it's getting bigger)
        growth_score = min(1.0, max(0.0, obj.bbox_growth_rate * 20.0))
        
        # Velocity score (from velocity hint)
        velocity_score = 0.0
        if "fast" in obj.velocity_hint.lower():
            velocity_score = 0.8
        elif "moving" in obj.velocity_hint.lower():
            velocity_score = 0.4
        
        # Combined threat score for this object
        threat = (
            0.4 * growth_score +      # Most important: is it getting bigger?
            0.35 * center_score +      # Is it aimed at the center?
            0.25 * velocity_score      # Is it moving fast?
        )
        
        max_threat = max(max_threat, threat)
    
    return max_threat


def _compute_direction(
    motion: MotionSignals, objects: list[TrackedObject]
) -> str:
    # Prefer direction from approaching objects
    approaching = [o for o in objects if o.approaching]
    if approaching:
        # Use the center of the most prominent approaching object
        obj = max(approaching, key=lambda o: o.bbox.w * o.bbox.h)
        cx = obj.bbox.x + obj.bbox.w / 2
        cy = obj.bbox.y + obj.bbox.h / 2
        return _position_to_direction(cx, cy)

    # Fall back to motion direction
    direction = motion.dominant_direction
    if direction in VALID_DIRECTIONS:
        return direction
    return "center"


def _position_to_direction(cx: float, cy: float) -> str:
    if cx < 0.33:
        return "left"
    elif cx > 0.67:
        return "right"
    elif cy < 0.33:
        return "top"
    elif cy > 0.67:
        return "bottom"
    else:
        return "center"


def _compute_event_reasons(
    motion: MotionSignals,
    objects: list[TrackedObject],
    has_new_entity: bool,
    multi_zone: bool,
    has_fist_threat: bool,
) -> list[str]:
    reasons: list[str] = []

    # Priority 1: Fist/hand threat
    if has_fist_threat:
        for obj in objects:
            if obj.class_label in THREATENING_CLASSES and obj.approaching:
                if obj.bbox_growth_rate > 0.03:
                    reasons.append("fist detected approaching")
                elif obj.class_label == "hand":
                    reasons.append("hand moving toward camera")
                else:
                    reasons.append("threatening gesture detected")
                break

    # Priority 2: Approaching objects
    for obj in objects:
        if obj.approaching and obj.class_label in THREATENING_CLASSES:
            reasons.append("approaching object")
            break

    # Priority 3: Rapid motion
    if motion.motion_suddenness > 0.4:
        reasons.append("rapid motion spike")

    # Priority 4: Person-specific threats
    for obj in objects:
        if obj.class_label == "person" and obj.approaching:
            if "fast" in obj.velocity_hint:
                reasons.append("person entered frame unexpectedly")
                break

    # Priority 5: Fast centerline movement
    for obj in objects:
        cx = obj.bbox.x + obj.bbox.w / 2
        if 0.3 < cx < 0.7 and "fast" in obj.velocity_hint and obj.class_label in THREATENING_CLASSES:
            reasons.append("fast centerline movement")
            break

    # Priority 6: Multi-zone activity
    if multi_zone:
        reasons.append("multiple motion zones active")

    # Priority 7: Unknown moving regions
    for obj in objects:
        if obj.class_label == "unknown" and getattr(obj, "is_unknown_moving_region", False):
            if obj.approaching:
                reasons.append("unknown moving region detected")
                break

    # Priority 8: Object size growth
    for obj in objects:
        if obj.bbox_growth_rate > 0.02 and obj.class_label in THREATENING_CLASSES:
            reasons.append("object size growth detected")
            break

    # Priority 9: New entity
    if has_new_entity:
        reasons.append("new entity in scene")

    # Deduplicate while preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for r in reasons:
        if r not in seen:
            seen.add(r)
            unique.append(r)

    return unique
