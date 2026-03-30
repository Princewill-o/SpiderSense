"""Calibration subsystem: establishes environment baseline."""
from __future__ import annotations

import time
from typing import Optional

import cv2
import numpy as np

from models import CalibrationBaseline, DetectedObject


class CalibrationManager:
    """Samples frames to compute environment baseline."""

    MIN_DURATION = 2.0   # seconds
    MAX_DURATION = 5.0   # seconds
    EXTENSION = 3.0      # seconds of extension if noisy
    NOISE_THRESHOLD = 0.15  # motion intensity above which we extend

    def __init__(self) -> None:
        self._frames: list[np.ndarray] = []
        self._motion_levels: list[float] = []
        self._start_time: Optional[float] = None
        self._extended = False
        self._complete = False
        self._baseline: Optional[CalibrationBaseline] = None

    def start(self) -> None:
        self._frames = []
        self._motion_levels = []
        self._start_time = time.time()
        self._extended = False
        self._complete = False
        self._baseline = None

    def add_frame(
        self,
        frame: np.ndarray,
        motion_intensity: float,
        detected_objects: Optional[list[DetectedObject]] = None,
    ) -> bool:
        """Add a frame to calibration. Returns True when calibration is complete."""
        if self._complete:
            return True
        if self._start_time is None:
            self.start()

        self._frames.append(frame.copy())
        self._motion_levels.append(motion_intensity)

        elapsed = time.time() - self._start_time
        max_dur = self.MAX_DURATION + (self.EXTENSION if self._extended else 0.0)

        if elapsed < self.MIN_DURATION:
            return False

        # Check if we need to extend
        if not self._extended and elapsed >= self.MIN_DURATION:
            avg_motion = float(np.mean(self._motion_levels)) if self._motion_levels else 0.0
            if avg_motion > self.NOISE_THRESHOLD and elapsed < self.MAX_DURATION:
                self._extended = True
                return False

        if elapsed >= max_dur or (elapsed >= self.MIN_DURATION and not self._extended):
            self._baseline = self._compute_baseline(detected_objects or [])
            self._complete = True
            return True

        return False

    def _compute_baseline(
        self, detected_objects: list[DetectedObject]
    ) -> CalibrationBaseline:
        if not self._frames:
            return CalibrationBaseline(
                avg_motion_level=0.0,
                avg_brightness=128.0,
                noise_floor=0.0,
                reference_objects=[],
                frame_count=0,
                stable=False,
            )

        avg_motion = float(np.mean(self._motion_levels)) if self._motion_levels else 0.0
        noise_floor = float(np.std(self._motion_levels)) if len(self._motion_levels) > 1 else 0.0

        # Compute average brightness from sampled frames
        brightness_values = []
        for f in self._frames:
            gray = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
            brightness_values.append(float(np.mean(gray)))
        avg_brightness = float(np.mean(brightness_values)) if brightness_values else 128.0

        stable = avg_motion <= self.NOISE_THRESHOLD

        return CalibrationBaseline(
            avg_motion_level=avg_motion,
            avg_brightness=avg_brightness,
            noise_floor=noise_floor,
            reference_objects=detected_objects,
            frame_count=len(self._frames),
            stable=stable,
        )

    @property
    def is_complete(self) -> bool:
        return self._complete

    @property
    def baseline(self) -> Optional[CalibrationBaseline]:
        return self._baseline

    @property
    def elapsed(self) -> float:
        if self._start_time is None:
            return 0.0
        return time.time() - self._start_time

    @property
    def progress(self) -> float:
        """Returns calibration progress [0.0, 1.0]."""
        if self._start_time is None:
            return 0.0
        max_dur = self.MAX_DURATION + (self.EXTENSION if self._extended else 0.0)
        return min(1.0, self.elapsed / max_dur)
