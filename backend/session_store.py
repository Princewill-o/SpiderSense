"""Session store: in-process session management with disk persistence."""
from __future__ import annotations

import json
import uuid
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Optional

from models import (
    Session,
    SessionEvent,
    SessionSummary,
    SnapshotRecord,
)


class SessionStore:
    """Manages the active session and persists completed sessions to disk."""

    def __init__(self, data_dir: str = "./data") -> None:
        self._data_dir = Path(data_dir)
        self._sessions: dict[str, Session] = {}
        self._active_session_id: Optional[str] = None
        self._data_dir.mkdir(parents=True, exist_ok=True)
        (self._data_dir / "sessions").mkdir(exist_ok=True)
        (self._data_dir / "snapshots").mkdir(exist_ok=True)

    def start_session(self) -> str:
        session_id = str(uuid.uuid4())
        session = Session(
            session_id=session_id,
            started_at=datetime.utcnow(),
            state="calibrating",
        )
        self._sessions[session_id] = session
        self._active_session_id = session_id
        return session_id

    def set_active(self) -> None:
        """Transition active session from calibrating to active."""
        session = self.get_active()
        if session:
            session.state = "active"

    def stop_session(self) -> Optional[SessionSummary]:
        session = self.get_active()
        if session is None:
            return None
        session.ended_at = datetime.utcnow()
        session.state = "stopped"
        summary = self._compute_summary(session)
        session.summary = summary
        self._persist_session(session)
        self._active_session_id = None
        return summary

    def add_event(self, event: SessionEvent) -> None:
        session = self.get_active()
        if session:
            session.events.append(event)

    def add_snapshot(self, snapshot: SnapshotRecord) -> None:
        session = self.get_active()
        if session:
            session.snapshots.append(snapshot)

    def get_active(self) -> Optional[Session]:
        if self._active_session_id is None:
            return None
        return self._sessions.get(self._active_session_id)

    def get_session(self, session_id: str) -> Optional[Session]:
        if session_id in self._sessions:
            return self._sessions[session_id]
        # Try loading from disk
        path = self._data_dir / "sessions" / f"{session_id}.json"
        if path.exists():
            try:
                data = json.loads(path.read_text())
                session = Session.model_validate(data)
                self._sessions[session_id] = session
                return session
            except Exception:
                return None
        return None

    def get_latest_summary(self) -> Optional[SessionSummary]:
        # Find most recently stopped session
        stopped = [
            s for s in self._sessions.values() if s.state == "stopped" and s.summary
        ]
        if not stopped:
            # Try loading from disk
            sessions_dir = self._data_dir / "sessions"
            files = sorted(sessions_dir.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
            for f in files:
                try:
                    data = json.loads(f.read_text())
                    session = Session.model_validate(data)
                    if session.summary:
                        return session.summary
                except Exception:
                    continue
            return None
        latest = max(stopped, key=lambda s: s.ended_at or datetime.min)
        return latest.summary

    def _compute_summary(self, session: Session) -> SessionSummary:
        events = session.events
        if not events:
            return SessionSummary(
                session_id=session.session_id,
                total_alerts=0,
                highest_threat_score=0,
                average_threat_score=0.0,
                top_direction="center",
                total_snapshots=len(session.snapshots),
                dominant_event_reason="",
            )

        alert_events = [e for e in events if e.threat_level in ("elevated", "triggered")]
        scores = [e.threat_score for e in events]
        directions = [e.direction for e in events]
        all_reasons = [r for e in events for r in e.event_reasons]

        top_direction = Counter(directions).most_common(1)[0][0] if directions else "center"
        dominant_reason = Counter(all_reasons).most_common(1)[0][0] if all_reasons else ""

        return SessionSummary(
            session_id=session.session_id,
            total_alerts=len(alert_events),
            highest_threat_score=max(scores) if scores else 0,
            average_threat_score=sum(scores) / len(scores) if scores else 0.0,
            top_direction=top_direction,
            total_snapshots=len(session.snapshots),
            dominant_event_reason=dominant_reason,
        )

    def _persist_session(self, session: Session) -> None:
        try:
            path = self._data_dir / "sessions" / f"{session.session_id}.json"
            path.write_text(session.model_dump_json(indent=2))
        except Exception as e:
            print(f"[SessionStore] Failed to persist session: {e}")
