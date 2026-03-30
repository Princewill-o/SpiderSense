"""Motion_Analyzer: frame differencing-based motion analysis."""
from __future__ import annotations

import math
from collections import deque
from typing import Optional

import cv2
import numpy as np

from models import CalibrationBaseline, MotionSignals

VALID_DIRECTIONS = {
    "left", "right", "top", "bottom",
    "center-left", "center-right", "center", "multi-zone",
}

# 3x3 grid zone names
ZONE_NAMES = [
    "top-left", "top-center", "top-right",
    "mid-left", "mid-center", "mid-right",
    "bot-left", "bot-center", "bot-right",
]


class MotionAnalyzer:
    """Computes motion signals from consecutive video frames."""

    def __init__(self, smoothing_window: int = 5) -> None:
        self._prev_gray: Optional[np.ndarray] = None
        self._intensity_history: deque[float] = deque(maxlen=smoothing_window)
        self._smoothing_window = smoothing_window

    def analyze(
        self,
        frame: np.ndarray,
        baseline: Optional[CalibrationBaseline] = None,
    ) -> MotionSignals:
        """Analyze a BGR frame and return MotionSignals."""
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape

        if self._prev_gray is None or self._prev_gray.shape != gray.shape:
            self._prev_gray = gray.copy()
            return MotionSignals(
                motion_intensity=0.0,
                motion_suddenness=0.0,
                dominant_direction="center",
                zones_active=[],
                contour_area_fraction=0.0,
            )

        # Frame differencing
        diff = cv2.absdiff(gray, self._prev_gray)
        self._prev_gray = gray.copy()

        # Threshold to get motion mask
        _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)

        # Contour area fraction
        contour_pixels = float(np.count_nonzero(thresh))
        total_pixels = float(h * w)
        contour_area_fraction = min(1.0, contour_pixels / max(total_pixels, 1.0))

        # Raw motion intensity = mean of diff normalized
        raw_intensity = float(np.mean(diff)) / 255.0
        raw_intensity = min(1.0, max(0.0, raw_intensity))

        # Baseline subtraction
        baseline_level = 0.0
        if baseline is not None:
            baseline_level = baseline.avg_motion_level
        adjusted_intensity = max(0.0, raw_intensity - baseline_level)
        adjusted_intensity = min(1.0, adjusted_intensity)

        # Temporal smoothing
        self._intensity_history.append(adjusted_intensity)
        smoothed_intensity = float(np.mean(self._intensity_history))

        # Motion suddenness: rate of change
        if len(self._intensity_history) >= 2:
            history_list = list(self._intensity_history)
            suddenness = abs(history_list[-1] - history_list[-2])
        else:
            suddenness = 0.0
        suddenness = min(1.0, max(0.0, suddenness))

        # Zone analysis (3x3 grid)
        zone_h = h // 3
        zone_w = w // 3
        zone_magnitudes: list[float] = []
        for row in range(3):
            for col in range(3):
                y0 = row * zone_h
                y1 = (row + 1) * zone_h if row < 2 else h
                x0 = col * zone_w
                x1 = (col + 1) * zone_w if col < 2 else w
                zone_mask = thresh[y0:y1, x0:x1]
                zone_mag = float(np.count_nonzero(zone_mask)) / max(
                    float((y1 - y0) * (x1 - x0)), 1.0
                )
                zone_magnitudes.append(zone_mag)

        # Active zones (threshold > 5% motion)
        zone_threshold = 0.05
        zones_active = [
            ZONE_NAMES[i]
            for i, mag in enumerate(zone_magnitudes)
            if mag > zone_threshold
        ]

        # Dominant direction from zone activity
        dominant_direction = _compute_direction(zone_magnitudes)

        return MotionSignals(
            motion_intensity=smoothed_intensity,
            motion_suddenness=suddenness,
            dominant_direction=dominant_direction,
            zones_active=zones_active,
            contour_area_fraction=contour_area_fraction,
        )

    def reset(self) -> None:
        """Reset analyzer state (e.g., on new session)."""
        self._prev_gray = None
        self._intensity_history.clear()


def _compute_direction(zone_magnitudes: list[float]) -> str:
    """Compute dominant direction from 3x3 zone magnitudes."""
    # zone layout:
    # 0(TL) 1(TC) 2(TR)
    # 3(ML) 4(MC) 5(MR)
    # 6(BL) 7(BC) 8(BR)
    threshold = 0.05
    active = [i for i, m in enumerate(zone_magnitudes) if m > threshold]

    if not active:
        return "center"

    if len(active) >= 4:
        return "multi-zone"

    # Aggregate left/right/top/bottom weights
    left_weight = sum(zone_magnitudes[i] for i in [0, 3, 6])
    right_weight = sum(zone_magnitudes[i] for i in [2, 5, 8])
    top_weight = sum(zone_magnitudes[i] for i in [0, 1, 2])
    bottom_weight = sum(zone_magnitudes[i] for i in [6, 7, 8])
    center_weight = zone_magnitudes[4]

    total = left_weight + right_weight + top_weight + bottom_weight + center_weight
    if total < 1e-9:
        return "center"

    # Determine primary axis
    h_diff = right_weight - left_weight
    v_diff = bottom_weight - top_weight

    is_center_dominant = center_weight > 0.4 * total

    if is_center_dominant:
        if abs(h_diff) < 0.1 * total:
            return "center"
        return "center-right" if h_diff > 0 else "center-left"

    if abs(h_diff) > abs(v_diff):
        return "right" if h_diff > 0 else "left"
    else:
        return "bottom" if v_diff > 0 else "top"
