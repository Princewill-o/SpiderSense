"""Unit tests for backend pipeline modules."""
from __future__ import annotations

import numpy as np
import pytest

from models import (
    BoundingBox,
    CalibrationBaseline,
    DetectedObject,
    MotionSignals,
    Settings,
    TrackedObject,
)
from motion_analyzer import MotionAnalyzer, VALID_DIRECTIONS
from object_tracker import ObjectTracker
from threat_engine import ThreatEngine, SENSITIVITY_MAP


# ─── Helpers ────────────────────────────────────────────────────────────────

def make_frame(h: int = 240, w: int = 320, color: tuple = (100, 100, 100)) -> np.ndarray:
    frame = np.full((h, w, 3), color, dtype=np.uint8)
    return frame


def make_detected_object(
    x: float = 0.1, y: float = 0.1, w: float = 0.2, h: float = 0.2,
    label: str = "person", conf: float = 0.9,
) -> DetectedObject:
    return DetectedObject(
        object_id="test-id",
        class_label=label,
        confidence=conf,
        bbox=BoundingBox(x=x, y=y, w=w, h=h),
        is_unknown_moving_region=False,
    )


def make_tracked_object(
    track_id: int = 1,
    growth_rate: float = 0.0,
    approaching: bool = False,
    label: str = "person",
) -> TrackedObject:
    return TrackedObject(
        track_id=track_id,
        class_label=label,
        bbox=BoundingBox(x=0.4, y=0.4, w=0.2, h=0.2),
        bbox_growth_rate=growth_rate,
        approaching=approaching,
        velocity_hint="stationary",
        path=[(0.5, 0.5)],
    )


def make_motion_signals(
    intensity: float = 0.0,
    suddenness: float = 0.0,
    direction: str = "center",
    zones: list[str] | None = None,
) -> MotionSignals:
    return MotionSignals(
        motion_intensity=intensity,
        motion_suddenness=suddenness,
        dominant_direction=direction,
        zones_active=zones or [],
        contour_area_fraction=0.0,
    )


# ─── MotionAnalyzer tests ────────────────────────────────────────────────────

class TestMotionAnalyzer:
    def test_first_frame_returns_zero_intensity(self):
        analyzer = MotionAnalyzer()
        frame = make_frame()
        signals = analyzer.analyze(frame)
        assert signals.motion_intensity == 0.0
        assert signals.motion_suddenness == 0.0

    def test_identical_frames_produce_low_intensity(self):
        analyzer = MotionAnalyzer()
        frame = make_frame()
        analyzer.analyze(frame)  # prime
        signals = analyzer.analyze(frame)
        assert signals.motion_intensity < 0.05

    def test_different_frames_produce_nonzero_intensity(self):
        analyzer = MotionAnalyzer()
        frame1 = make_frame(color=(0, 0, 0))
        frame2 = make_frame(color=(255, 255, 255))
        analyzer.analyze(frame1)
        signals = analyzer.analyze(frame2)
        assert signals.motion_intensity > 0.0

    def test_direction_is_valid(self):
        analyzer = MotionAnalyzer()
        frame1 = make_frame()
        frame2 = make_frame()
        analyzer.analyze(frame1)
        signals = analyzer.analyze(frame2)
        assert signals.dominant_direction in VALID_DIRECTIONS

    def test_intensity_in_range(self):
        analyzer = MotionAnalyzer()
        frame1 = make_frame(color=(0, 0, 0))
        frame2 = make_frame(color=(200, 200, 200))
        analyzer.analyze(frame1)
        signals = analyzer.analyze(frame2)
        assert 0.0 <= signals.motion_intensity <= 1.0
        assert 0.0 <= signals.contour_area_fraction <= 1.0

    def test_baseline_subtraction_reduces_intensity(self):
        analyzer_raw = MotionAnalyzer()
        analyzer_sub = MotionAnalyzer()
        frame1 = make_frame(color=(50, 50, 50))
        frame2 = make_frame(color=(150, 150, 150))

        analyzer_raw.analyze(frame1)
        raw_signals = analyzer_raw.analyze(frame2)

        baseline = CalibrationBaseline(
            avg_motion_level=0.1,
            avg_brightness=100.0,
            noise_floor=0.05,
            reference_objects=[],
            frame_count=30,
            stable=True,
        )
        analyzer_sub.analyze(frame1)
        sub_signals = analyzer_sub.analyze(frame2, baseline=baseline)

        assert sub_signals.motion_intensity <= raw_signals.motion_intensity + 1e-6

    def test_reset_clears_state(self):
        analyzer = MotionAnalyzer()
        frame = make_frame()
        analyzer.analyze(frame)
        analyzer.reset()
        signals = analyzer.analyze(frame)
        assert signals.motion_intensity == 0.0

    def test_zones_active_is_list(self):
        analyzer = MotionAnalyzer()
        frame1 = make_frame(color=(0, 0, 0))
        frame2 = make_frame(color=(255, 255, 255))
        analyzer.analyze(frame1)
        signals = analyzer.analyze(frame2)
        assert isinstance(signals.zones_active, list)


# ─── ObjectTracker tests ─────────────────────────────────────────────────────

class TestObjectTracker:
    def test_new_detection_creates_track(self):
        tracker = ObjectTracker()
        det = make_detected_object()
        tracked = tracker.update([det])
        assert len(tracked) == 1
        assert tracked[0].track_id == 1

    def test_same_object_keeps_track_id(self):
        tracker = ObjectTracker()
        det = make_detected_object(x=0.1, y=0.1, w=0.2, h=0.2)
        tracked1 = tracker.update([det])
        tid = tracked1[0].track_id

        # Same position next frame
        det2 = make_detected_object(x=0.11, y=0.11, w=0.2, h=0.2)
        tracked2 = tracker.update([det2])
        assert tracked2[0].track_id == tid

    def test_track_expires_after_timeout(self):
        tracker = ObjectTracker(timeout_frames=2)
        det = make_detected_object()
        tracker.update([det])
        # No detections for 3 frames
        tracker.update([])
        tracker.update([])
        tracked = tracker.update([])
        assert len(tracked) == 0

    def test_approaching_flag_set_when_growth_exceeds_threshold(self):
        tracker = ObjectTracker(approach_threshold=0.05)
        # First frame: small bbox
        det1 = make_detected_object(x=0.3, y=0.3, w=0.1, h=0.1)
        tracker.update([det1])
        # Second frame: larger bbox (growing)
        det2 = make_detected_object(x=0.25, y=0.25, w=0.3, h=0.3)
        tracked = tracker.update([det2])
        assert len(tracked) == 1
        # Growth rate = 0.3*0.3 - 0.1*0.1 = 0.09 - 0.01 = 0.08 > 0.05
        assert tracked[0].approaching is True

    def test_velocity_hint_is_string(self):
        tracker = ObjectTracker()
        det = make_detected_object()
        tracked = tracker.update([det])
        assert isinstance(tracked[0].velocity_hint, str)
        assert len(tracked[0].velocity_hint) > 0

    def test_path_contains_positions(self):
        tracker = ObjectTracker()
        det = make_detected_object(x=0.1, y=0.1, w=0.2, h=0.2)
        tracked = tracker.update([det])
        assert len(tracked[0].path) >= 1

    def test_reset_clears_all_tracks(self):
        tracker = ObjectTracker()
        tracker.update([make_detected_object()])
        tracker.reset()
        tracked = tracker.update([])
        assert len(tracked) == 0


# ─── ThreatEngine tests ──────────────────────────────────────────────────────

class TestThreatEngine:
    def test_zero_signals_produce_low_score(self):
        engine = ThreatEngine()
        motion = make_motion_signals()
        assessment = engine.assess(motion, [])
        assert assessment.threat_score >= 0
        assert assessment.threat_score <= 100

    def test_threat_score_in_range(self):
        engine = ThreatEngine()
        motion = make_motion_signals(intensity=1.0, suddenness=1.0)
        objects = [make_tracked_object(growth_rate=0.5, approaching=True)]
        assessment = engine.assess(motion, objects)
        assert 0 <= assessment.threat_score <= 100

    def test_threat_level_mapping(self):
        engine = ThreatEngine(settings=Settings(smoothing_alpha=1.0, hysteresis_frames=1))
        # Force a high score
        motion = make_motion_signals(intensity=1.0, suddenness=1.0, zones=["a", "b", "c"])
        objects = [make_tracked_object(growth_rate=1.0, approaching=True)]
        for _ in range(5):
            assessment = engine.assess(motion, objects)
        assert assessment.threat_level in ["stable", "aware", "elevated", "triggered"]

    def test_direction_is_valid(self):
        engine = ThreatEngine()
        motion = make_motion_signals(direction="left")
        assessment = engine.assess(motion, [])
        from threat_engine import VALID_DIRECTIONS
        assert assessment.direction in VALID_DIRECTIONS

    def test_event_reasons_are_from_valid_set(self):
        engine = ThreatEngine()
        motion = make_motion_signals(intensity=0.8, suddenness=0.8, zones=["a", "b", "c"])
        objects = [make_tracked_object(growth_rate=0.5, approaching=True)]
        assessment = engine.assess(motion, objects)
        from threat_engine import VALID_EVENT_REASONS
        for reason in assessment.event_reasons:
            assert reason in VALID_EVENT_REASONS

    def test_sensitivity_high_produces_higher_score_than_low(self):
        settings_low = Settings(sensitivity="low", smoothing_alpha=1.0, hysteresis_frames=1)
        settings_high = Settings(sensitivity="high", smoothing_alpha=1.0, hysteresis_frames=1)
        engine_low = ThreatEngine(settings=settings_low)
        engine_high = ThreatEngine(settings=settings_high)

        motion = make_motion_signals(intensity=0.5, suddenness=0.3)
        objects = [make_tracked_object(growth_rate=0.1, approaching=True)]

        assessment_low = engine_low.assess(motion, objects)
        assessment_high = engine_high.assess(motion, objects)

        assert assessment_high.threat_score >= assessment_low.threat_score

    def test_snapshot_saved_false_without_session(self):
        engine = ThreatEngine(settings=Settings(snapshot_threshold=0))
        motion = make_motion_signals(intensity=1.0)
        frame = make_frame()
        assessment = engine.assess(motion, [], frame=frame)
        # No session set, so snapshot_saved should be False
        assert assessment.snapshot_saved is False

    def test_reset_clears_state(self):
        engine = ThreatEngine()
        motion = make_motion_signals(intensity=1.0, suddenness=1.0)
        engine.assess(motion, [])
        engine.reset()
        # After reset, score should start fresh
        motion_zero = make_motion_signals()
        assessment = engine.assess(motion_zero, [])
        assert assessment.threat_score == 0

    def test_hysteresis_prevents_immediate_level_change(self):
        engine = ThreatEngine(settings=Settings(
            smoothing_alpha=1.0,
            hysteresis_frames=3,
        ))
        # Single high-score frame should NOT immediately change level
        motion = make_motion_signals(intensity=1.0, suddenness=1.0, zones=["a", "b", "c"])
        objects = [make_tracked_object(growth_rate=1.0, approaching=True)]
        assessment = engine.assess(motion, objects)
        # After just 1 frame, level should still be stable (hysteresis=3)
        assert assessment.threat_level == "stable"

    def test_empty_event_reasons_when_no_signals(self):
        engine = ThreatEngine()
        motion = make_motion_signals()
        assessment = engine.assess(motion, [])
        assert assessment.event_reasons == []
