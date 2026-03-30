"""Object_Detector: YOLOv8n-based object detection."""
from __future__ import annotations

import uuid
from typing import Optional

import cv2
import numpy as np

from models import BoundingBox, DetectedObject

ALLOWED_CLASSES = {
    "person", "hand", "cell phone", "chair",
    "backpack", "bottle", "laptop", "unknown",
}

# YOLO class names that map to our allowed set
YOLO_CLASS_MAP = {
    "person": "person",
    "cell phone": "cell phone",
    "chair": "chair",
    "backpack": "backpack",
    "bottle": "bottle",
    "laptop": "laptop",
    # Note: YOLOv8n doesn't have a "hand" class by default,
    # but we'll detect hands as "unknown" moving regions
}


class ObjectDetector:
    """Runs YOLOv8n inference on frames."""

    def __init__(
        self,
        confidence_threshold: float = 0.4,
        input_resolution: int = 640,
    ) -> None:
        self._confidence_threshold = confidence_threshold
        self._input_resolution = input_resolution
        self._model = None
        self._load_model()

    def _load_model(self) -> None:
        try:
            from ultralytics import YOLO
            self._model = YOLO("yolov8n.pt")
        except Exception as e:
            print(f"[ObjectDetector] Failed to load YOLOv8n: {e}")
            self._model = None

    def detect(
        self,
        frame: np.ndarray,
        motion_contours: Optional[list[np.ndarray]] = None,
    ) -> list[DetectedObject]:
        """Run detection on a BGR frame. Returns list of DetectedObject."""
        h, w = frame.shape[:2]
        detections: list[DetectedObject] = []

        if self._model is not None:
            try:
                results = self._model(
                    frame,
                    imgsz=self._input_resolution,
                    conf=self._confidence_threshold,
                    verbose=False,
                )
                for result in results:
                    if result.boxes is None:
                        continue
                    for box in result.boxes:
                        cls_id = int(box.cls[0])
                        cls_name = result.names.get(cls_id, "unknown")
                        mapped = YOLO_CLASS_MAP.get(cls_name)
                        if mapped is None:
                            continue
                        conf = float(box.conf[0])
                        if conf < self._confidence_threshold:
                            continue
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        bbox = BoundingBox(
                            x=x1 / w,
                            y=y1 / h,
                            w=(x2 - x1) / w,
                            h=(y2 - y1) / h,
                        )
                        detections.append(
                            DetectedObject(
                                object_id=str(uuid.uuid4()),
                                class_label=mapped,
                                confidence=conf,
                                bbox=bbox,
                                is_unknown_moving_region=False,
                            )
                        )
            except Exception as e:
                print(f"[ObjectDetector] Inference error: {e}")

        # Emit unknown moving regions for motion contours not matched
        # These could be hands/fists approaching the camera
        if motion_contours:
            for contour in motion_contours:
                x, y, cw, ch = cv2.boundingRect(contour)
                # Check if this contour overlaps with any detection
                cx_norm = x / w
                cy_norm = y / h
                cw_norm = cw / w
                ch_norm = ch / h
                overlaps = any(
                    _iou(
                        (cx_norm, cy_norm, cw_norm, ch_norm),
                        (d.bbox.x, d.bbox.y, d.bbox.w, d.bbox.h),
                    ) > 0.3
                    for d in detections
                )
                # Lower threshold for hand-sized objects (potential fists/hands)
                min_area = 300  # Smaller threshold to catch hands
                if not overlaps and cw * ch > min_area:
                    # Classify as "hand" if it's hand-sized and in center region
                    cx_center = cx_norm + cw_norm / 2
                    cy_center = cy_norm + ch_norm / 2
                    is_center = 0.2 < cx_center < 0.8 and 0.2 < cy_center < 0.8
                    
                    # Hand-like aspect ratio (roughly square or slightly rectangular)
                    aspect_ratio = cw / max(ch, 1)
                    is_hand_shaped = 0.5 < aspect_ratio < 2.0
                    
                    class_label = "hand" if (is_center and is_hand_shaped) else "unknown"
                    
                    detections.append(
                        DetectedObject(
                            object_id=str(uuid.uuid4()),
                            class_label=class_label,
                            confidence=1.0,
                            bbox=BoundingBox(
                                x=cx_norm,
                                y=cy_norm,
                                w=cw_norm,
                                h=ch_norm,
                            ),
                            is_unknown_moving_region=True,
                        )
                    )

        return detections

    def set_confidence_threshold(self, threshold: float) -> None:
        self._confidence_threshold = threshold

    def set_resolution(self, resolution: int) -> None:
        self._input_resolution = resolution


def _iou(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> float:
    """Compute IoU between two (x, y, w, h) boxes."""
    ax1, ay1, aw, ah = a
    bx1, by1, bw, bh = b
    ax2, ay2 = ax1 + aw, ay1 + ah
    bx2, by2 = bx1 + bw, by1 + bh

    ix1 = max(ax1, bx1)
    iy1 = max(ay1, by1)
    ix2 = min(ax2, bx2)
    iy2 = min(ay2, by2)

    if ix2 <= ix1 or iy2 <= iy1:
        return 0.0

    inter = (ix2 - ix1) * (iy2 - iy1)
    union = aw * ah + bw * bh - inter
    return inter / max(union, 1e-9)
