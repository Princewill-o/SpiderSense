"""REST API endpoints for Spider-Sense AI."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException

from models import Session, SessionEvent, SessionSummary, Settings
from session_store import SessionStore

router = APIRouter()

# Shared state (injected by main.py)
_store: Optional[SessionStore] = None
_settings: Optional[Settings] = None
_demo_mode: bool = False


def init(store: SessionStore, settings: Settings) -> None:
    global _store, _settings
    _store = store
    _settings = settings


def set_demo_mode(active: bool) -> None:
    global _demo_mode
    _demo_mode = active


def get_demo_mode() -> bool:
    return _demo_mode


@router.get("/health")
async def health() -> dict:
    return {"status": "ok", "version": "0.1.0", "service": "spider-sense-ai"}


@router.post("/session/start")
async def session_start() -> dict:
    if _store is None:
        raise HTTPException(status_code=500, detail="Store not initialized")
    session_id = _store.start_session()
    return {"session_id": session_id, "state": "calibrating"}


@router.post("/session/stop")
async def session_stop() -> dict:
    if _store is None:
        raise HTTPException(status_code=500, detail="Store not initialized")
    summary = _store.stop_session()
    if summary is None:
        raise HTTPException(status_code=400, detail="No active session")
    return summary.model_dump()


@router.get("/session/latest")
async def session_latest() -> dict:
    if _store is None:
        raise HTTPException(status_code=500, detail="Store not initialized")
    summary = _store.get_latest_summary()
    if summary is None:
        raise HTTPException(status_code=404, detail="No completed sessions found")
    return summary.model_dump()


@router.get("/session/{session_id}/events")
async def session_events(session_id: str) -> list:
    if _store is None:
        raise HTTPException(status_code=500, detail="Store not initialized")
    session = _store.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    return [e.model_dump() for e in session.events]


@router.post("/demo/trigger")
async def demo_trigger() -> dict:
    if not _demo_mode:
        raise HTTPException(status_code=400, detail="Demo mode is not active")
    # Synthetic event injection is handled by the WebSocket handler
    return {"status": "triggered", "message": "Synthetic threat event injected"}


@router.post("/settings")
async def update_settings(new_settings: Settings) -> dict:
    global _settings
    _settings = new_settings
    # Notify threat engine via callback if registered
    if _settings_callback:
        _settings_callback(new_settings)
    return {"status": "ok", "settings": new_settings.model_dump()}


# Settings update callback
_settings_callback = None


def register_settings_callback(callback) -> None:
    global _settings_callback
    _settings_callback = callback


def get_current_settings() -> Settings:
    return _settings or Settings()
