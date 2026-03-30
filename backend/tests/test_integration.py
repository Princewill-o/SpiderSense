"""Backend integration tests."""
from __future__ import annotations

import asyncio
import base64
import json
import os
import tempfile
import time
from pathlib import Path

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient

# Set data dir to temp before importing main
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))


def make_jpeg_frame(color=(100, 100, 100)) -> bytes:
    frame = np.full((240, 320, 3), color, dtype=np.uint8)
    _, buf = cv2.imencode(".jpg", frame)
    return buf.tobytes()


def make_b64_frame(color=(100, 100, 100)) -> str:
    return base64.b64encode(make_jpeg_frame(color)).decode()


@pytest.fixture
def temp_data_dir(tmp_path):
    return str(tmp_path)


@pytest.fixture
def app_client(temp_data_dir):
    os.environ["DATA_DIR"] = temp_data_dir
    # Re-import to get fresh state
    import importlib
    import main as main_module
    importlib.reload(main_module)
    client = TestClient(main_module.app)
    yield client, main_module


class TestHealthEndpoint:
    def test_health_returns_200(self, app_client):
        client, _ = app_client
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "version" in data


class TestSessionLifecycle:
    def test_start_session(self, app_client):
        client, _ = app_client
        resp = client.post("/session/start")
        assert resp.status_code == 200
        data = resp.json()
        assert "session_id" in data
        assert data["state"] == "calibrating"

    def test_stop_session(self, app_client):
        client, _ = app_client
        client.post("/session/start")
        resp = client.post("/session/stop")
        assert resp.status_code == 200
        data = resp.json()
        assert "session_id" in data

    def test_stop_without_start_returns_400(self, app_client):
        client, _ = app_client
        resp = client.post("/session/stop")
        assert resp.status_code == 400

    def test_latest_session_after_stop(self, app_client):
        client, _ = app_client
        client.post("/session/start")
        client.post("/session/stop")
        resp = client.get("/session/latest")
        assert resp.status_code == 200

    def test_session_events_404_for_unknown(self, app_client):
        client, _ = app_client
        resp = client.get("/session/nonexistent-id/events")
        assert resp.status_code == 404


class TestSettingsEndpoint:
    def test_update_settings(self, app_client):
        client, _ = app_client
        payload = {
            "sensitivity": "high",
            "snapshot_threshold": 60,
            "fps_cap": 10,
            "smoothing_alpha": 0.4,
            "hysteresis_frames": 5,
            "confidence_threshold": 0.5,
            "approach_threshold": 0.1,
            "tracker_timeout_frames": 15,
        }
        resp = client.post("/settings", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["settings"]["sensitivity"] == "high"

    def test_invalid_settings_returns_422(self, app_client):
        client, _ = app_client
        resp = client.post("/settings", json={"sensitivity": "ultra"})
        assert resp.status_code == 422


class TestDemoMode:
    def test_demo_trigger_without_demo_mode_returns_400(self, app_client):
        client, _ = app_client
        resp = client.post("/demo/trigger")
        assert resp.status_code == 400


class TestSessionEvents:
    def test_session_events_returns_list(self, app_client):
        client, _ = app_client
        start_resp = client.post("/session/start")
        session_id = start_resp.json()["session_id"]
        client.post("/session/stop")
        resp = client.get(f"/session/{session_id}/events")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestPydanticValidation:
    def test_invalid_body_returns_422(self, app_client):
        client, _ = app_client
        # Send completely wrong type
        resp = client.post("/settings", content="not json", headers={"Content-Type": "application/json"})
        assert resp.status_code == 422

    def test_missing_required_field_returns_422(self, app_client):
        client, _ = app_client
        # Settings has defaults so this should pass, but wrong type should fail
        resp = client.post("/settings", json={"sensitivity": 123})
        assert resp.status_code == 422
