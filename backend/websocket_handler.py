"""WebSocket endpoint and frame processing pipeline."""
from __future__ import annotations

import asyncio
import base64
import time
import uuid
from datetime import datetime
from typing import Optional

import cv2
import numpy as np
from fastapi import WebSocket, WebSocketDisconnect

from calibration import CalibrationManager
from models import (
    SessionEvent,
    Settings,
    SnapshotRecord,
    WebSocketMessage,
)
from motion_analyzer import MotionAnalyzer
from object_detector import ObjectDetector
from object_tracker import ObjectTracker
from session_store import SessionStore
from threat_engine import ThreatEngine


class FramePipeline:
    """Manages the full frame processing pipeline for a WebSocket session."""

    TARGET_INTERVAL = 1.0 / 15  # 15 FPS target

    def __init__(
        self,
        store: SessionStore,
        settings: Settings,
        data_dir: str = "./data",
    ) -> None:
        self._store = store
        self._settings = settings
        self._data_dir = data_dir
        self._motion_analyzer = MotionAnalyzer(smoothing_window=5)
        self._object_detector = ObjectDetector(
            confidence_threshold=settings.confidence_threshold
        )
        self._object_tracker = ObjectTracker(
            approach_threshold=settings.approach_threshold,
            timeout_frames=settings.tracker_timeout_frames,
        )
        self._threat_engine = ThreatEngine(settings=settings, data_dir=data_dir)
        self._calibration = CalibrationManager()
        self._processing = False
        self._last_message: Optional[WebSocketMessage] = None
        self._frame_id = 0
        self._demo_mode = False
        self._demo_task: Optional[asyncio.Task] = None

    def update_settings(self, settings: Settings) -> None:
        self._settings = settings
        self._threat_engine.update_settings(settings)
        self._object_detector.set_confidence_threshold(settings.confidence_threshold)
        self._object_tracker.set_approach_threshold(settings.approach_threshold)
        self._object_tracker.set_timeout_frames(settings.tracker_timeout_frames)

    def set_demo_mode(self, active: bool) -> None:
        self._demo_mode = active

    async def process_frame(
        self, frame_data: bytes, frame_id: int, websocket: WebSocket
    ) -> Optional[WebSocketMessage]:
        """Process a single frame through the pipeline."""
        if self._processing:
            return None  # Drop frame if pipeline is busy

        self._processing = True
        start_time = time.time()
        session = self._store.get_active()
        if session is None:
            self._processing = False
            return None

        try:
            # Decode frame
            nparr = np.frombuffer(frame_data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame is None:
                self._processing = False
                return None

            self._frame_id = frame_id

            # Calibration phase
            if session.state == "calibrating":
                motion = self._motion_analyzer.analyze(frame)
                detections = []
                try:
                    detections = self._object_detector.detect(frame)
                except Exception:
                    pass
                done = self._calibration.add_frame(
                    frame, motion.motion_intensity, detections
                )
                if done:
                    self._store.set_active()
                    session = self._store.get_active()
                    if session:
                        self._threat_engine.set_session(session.session_id)

                # During calibration: emit stable message
                msg = WebSocketMessage(
                    timestamp=datetime.utcnow().isoformat(),
                    frame_id=frame_id,
                    threat_score=0,
                    threat_level="stable",
                    direction="center",
                    motion_intensity=motion.motion_intensity,
                    motion_suddenness=motion.motion_suddenness,
                    approach_velocity=0.0,
                    center_proximity=0.0,
                    zones_active=motion.zones_active,
                    objects=[],
                    event_reasons=[],
                    snapshot_saved=False,
                    degraded=False,
                )
                self._last_message = msg
                self._processing = False
                return msg

            # Active phase
            baseline = self._calibration.baseline
            motion = self._motion_analyzer.analyze(frame, baseline=baseline)
            detections = []
            try:
                detections = self._object_detector.detect(frame)
            except Exception:
                pass
            tracked = self._object_tracker.update(detections)
            assessment = self._threat_engine.assess(
                motion, tracked, frame=frame, frame_id=frame_id
            )

            elapsed = time.time() - start_time
            degraded = elapsed > self.TARGET_INTERVAL * 2

            # Compute derived values for message
            approach_velocity = max(
                (o.bbox_growth_rate for o in tracked if o.approaching), default=0.0
            )
            center_proximity = max(
                (
                    max(0.0, 1.0 - ((o.bbox.x + o.bbox.w / 2 - 0.5) ** 2 + (o.bbox.y + o.bbox.h / 2 - 0.5) ** 2) ** 0.5 * 2)
                    for o in tracked
                ),
                default=0.0,
            )

            msg = WebSocketMessage(
                timestamp=datetime.utcnow().isoformat(),
                frame_id=frame_id,
                threat_score=assessment.threat_score,
                threat_level=assessment.threat_level,
                direction=assessment.direction,
                motion_intensity=motion.motion_intensity,
                motion_suddenness=motion.motion_suddenness,
                approach_velocity=float(approach_velocity),
                center_proximity=float(center_proximity),
                zones_active=motion.zones_active,
                objects=tracked,
                event_reasons=assessment.event_reasons,
                snapshot_saved=assessment.snapshot_saved,
                degraded=degraded or assessment.degraded,
            )

            # Record event if significant
            if assessment.event_reasons and session:
                event = SessionEvent(
                    event_id=str(uuid.uuid4()),
                    session_id=session.session_id,
                    timestamp=datetime.utcnow(),
                    frame_id=frame_id,
                    threat_score=assessment.threat_score,
                    threat_level=assessment.threat_level,
                    direction=assessment.direction,
                    event_reasons=assessment.event_reasons,
                    snapshot_saved=assessment.snapshot_saved,
                )
                self._store.add_event(event)

            self._last_message = msg
            return msg

        except Exception as e:
            print(f"[FramePipeline] Error processing frame: {e}")
            # Return degraded message with last known values
            if self._last_message:
                degraded_msg = self._last_message.model_copy(
                    update={"degraded": True, "frame_id": frame_id}
                )
                return degraded_msg
            return None
        finally:
            self._processing = False

    def inject_demo_event(self) -> Optional[WebSocketMessage]:
        """Generate a synthetic threat event for demo mode."""
        import random
        score = random.randint(60, 95)
        level = "elevated" if score < 75 else "triggered"
        directions = ["left", "right", "top", "bottom", "center"]
        direction = random.choice(directions)
        reasons = ["rapid motion spike", "approaching object", "new entity in scene"]
        selected_reasons = random.sample(reasons, k=random.randint(1, 3))

        msg = WebSocketMessage(
            timestamp=datetime.utcnow().isoformat(),
            frame_id=self._frame_id,
            threat_score=score,
            threat_level=level,
            direction=direction,
            motion_intensity=0.7,
            motion_suddenness=0.6,
            approach_velocity=0.5,
            center_proximity=0.8,
            zones_active=["mid-center", "top-center"],
            objects=[],
            event_reasons=selected_reasons,
            snapshot_saved=False,
            degraded=False,
        )
        self._last_message = msg
        return msg

    def reset(self) -> None:
        self._motion_analyzer.reset()
        self._object_tracker.reset()
        self._threat_engine.reset()
        self._calibration = CalibrationManager()
        self._processing = False
        self._last_message = None
        self._frame_id = 0


async def websocket_endpoint(
    websocket: WebSocket,
    pipeline: FramePipeline,
) -> None:
    """Handle a WebSocket connection."""
    await websocket.accept()
    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=30.0)
            except asyncio.TimeoutError:
                continue

            if pipeline._demo_mode:
                msg = pipeline.inject_demo_event()
                if msg:
                    await websocket.send_text(msg.model_dump_json())
                continue

            frame_b64 = data.get("frame", "")
            frame_id = data.get("frame_id", 0)

            if not frame_b64:
                continue

            try:
                frame_bytes = base64.b64decode(frame_b64)
            except Exception:
                continue

            msg = await pipeline.process_frame(frame_bytes, frame_id, websocket)
            if msg:
                await websocket.send_text(msg.model_dump_json())

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WebSocket] Connection error: {e}")
