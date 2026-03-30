"""Object_Tracker: IoU-based multi-object tracking."""
from __future__ import annotations

from collections import deque
from typing import Optional

from models import BoundingBox, DetectedObject, TrackedObject

IOU_THRESHOLD = 0.3
PATH_WINDOW = 20


class _Track:
    def __init__(self, track_id: int, det: DetectedObject) -> None:
        self.track_id = track_id
        self.class_label = det.class_label
        self.bbox = det.bbox
        self.missed_frames = 0
        self.path: deque[tuple[float, float]] = deque(maxlen=PATH_WINDOW)
        self.area_history: deque[float] = deque(maxlen=10)
        cx = det.bbox.x + det.bbox.w / 2
        cy = det.bbox.y + det.bbox.h / 2
        self.path.append((cx, cy))
        self.area_history.append(det.bbox.w * det.bbox.h)

    def update(self, det: DetectedObject) -> None:
        self.bbox = det.bbox
        self.missed_frames = 0
        cx = det.bbox.x + det.bbox.w / 2
        cy = det.bbox.y + det.bbox.h / 2
        self.path.append((cx, cy))
        self.area_history.append(det.bbox.w * det.bbox.h)

    @property
    def bbox_growth_rate(self) -> float:
        if len(self.area_history) < 2:
            return 0.0
        areas = list(self.area_history)
        return areas[-1] - areas[-2]

    @property
    def center(self) -> tuple[float, float]:
        return (self.bbox.x + self.bbox.w / 2, self.bbox.y + self.bbox.h / 2)


class ObjectTracker:
    """Tracks objects across frames using IoU matching."""

    def __init__(
        self,
        approach_threshold: float = 0.05,
        timeout_frames: int = 10,
    ) -> None:
        self._approach_threshold = approach_threshold
        self._timeout_frames = timeout_frames
        self._tracks: dict[int, _Track] = {}
        self._next_id = 1

    def update(self, detections: list[DetectedObject]) -> list[TrackedObject]:
        """Match detections to existing tracks; return TrackedObject list."""
        # Build cost matrix
        track_ids = list(self._tracks.keys())
        matched_track_ids: set[int] = set()
        matched_det_indices: set[int] = set()

        # Greedy IoU matching
        for det_idx, det in enumerate(detections):
            best_iou = IOU_THRESHOLD
            best_tid: Optional[int] = None
            for tid in track_ids:
                if tid in matched_track_ids:
                    continue
                track = self._tracks[tid]
                iou = _iou_bbox(track.bbox, det.bbox)
                if iou > best_iou:
                    best_iou = iou
                    best_tid = tid
            if best_tid is not None:
                self._tracks[best_tid].update(det)
                matched_track_ids.add(best_tid)
                matched_det_indices.add(det_idx)

        # Create new tracks for unmatched detections
        for det_idx, det in enumerate(detections):
            if det_idx not in matched_det_indices:
                new_track = _Track(self._next_id, det)
                self._tracks[self._next_id] = new_track
                self._next_id += 1

        # Increment missed frames for unmatched tracks
        for tid in track_ids:
            if tid not in matched_track_ids:
                self._tracks[tid].missed_frames += 1

        # Expire old tracks
        expired = [
            tid
            for tid, t in self._tracks.items()
            if t.missed_frames > self._timeout_frames
        ]
        for tid in expired:
            del self._tracks[tid]

        # Build output
        result: list[TrackedObject] = []
        for track in self._tracks.values():
            growth = track.bbox_growth_rate
            approaching = growth > self._approach_threshold
            velocity_hint = _compute_velocity_hint(track)
            result.append(
                TrackedObject(
                    track_id=track.track_id,
                    class_label=track.class_label,
                    bbox=track.bbox,
                    bbox_growth_rate=growth,
                    approaching=approaching,
                    velocity_hint=velocity_hint,
                    path=list(track.path),
                )
            )
        return result

    def reset(self) -> None:
        self._tracks.clear()
        self._next_id = 1

    def set_approach_threshold(self, threshold: float) -> None:
        self._approach_threshold = threshold

    def set_timeout_frames(self, frames: int) -> None:
        self._timeout_frames = frames


def _iou_bbox(a: BoundingBox, b: BoundingBox) -> float:
    ax2 = a.x + a.w
    ay2 = a.y + a.h
    bx2 = b.x + b.w
    by2 = b.y + b.h

    ix1 = max(a.x, b.x)
    iy1 = max(a.y, b.y)
    ix2 = min(ax2, bx2)
    iy2 = min(ay2, by2)

    if ix2 <= ix1 or iy2 <= iy1:
        return 0.0

    inter = (ix2 - ix1) * (iy2 - iy1)
    union = a.w * a.h + b.w * b.h - inter
    return inter / max(union, 1e-9)


def _compute_velocity_hint(track: _Track) -> str:
    """Generate human-readable velocity hint from track history."""
    if len(track.path) < 2:
        return "stationary"

    path = list(track.path)
    dx = path[-1][0] - path[-2][0]
    dy = path[-1][1] - path[-2][1]
    speed = (dx**2 + dy**2) ** 0.5

    growth = track.bbox_growth_rate

    if speed < 0.005 and abs(growth) < 0.001:
        return "stationary"

    if growth > 0.02:
        return "moving fast toward center"

    direction_parts = []
    if abs(dx) > 0.01:
        direction_parts.append("right" if dx > 0 else "left")
    if abs(dy) > 0.01:
        direction_parts.append("down" if dy > 0 else "up")

    if not direction_parts:
        return "slow movement"

    speed_label = "fast" if speed > 0.05 else "slow"
    return f"moving {speed_label} {'-'.join(direction_parts)}"
