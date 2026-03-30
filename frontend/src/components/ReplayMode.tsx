"use client";

import { useEffect, useState } from "react";
import { SessionEvent } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ReplayModeProps {
  sessionId: string;
  onClose: () => void;
}

export function ReplayMode({ sessionId, onClose }: ReplayModeProps) {
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const resp = await fetch(`${API_URL}/session/${sessionId}/events`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data: SessionEvent[] = await resp.json();
        setEvents(data);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [sessionId]);

  const currentEvent = events[currentIndex] || null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-95 z-50 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Replay mode - historical session data"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-green-900">
        <div className="flex items-center gap-3">
          <span className="text-yellow-400 hud-text text-sm font-bold border border-yellow-400 px-2 py-0.5">
            ⏮ HISTORICAL DATA
          </span>
          <span className="text-green-600 hud-text text-xs">
            SESSION: {sessionId.slice(0, 8)}...
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-green-400 hover:text-green-200 hud-text text-sm focus:outline-none focus:ring-2 focus:ring-green-400 px-2 py-1"
          aria-label="Close replay mode"
        >
          ✕ CLOSE
        </button>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center text-green-400 hud-text">
          LOADING SESSION DATA...
        </div>
      )}

      {error && (
        <div className="flex-1 flex items-center justify-center text-red-400 hud-text">
          ERROR: {error}
        </div>
      )}

      {!loading && !error && (
        <div className="flex-1 flex overflow-hidden">
          {/* Event list */}
          <div className="w-64 border-r border-green-900 overflow-y-auto">
            <div className="px-3 py-2 border-b border-green-900">
              <span className="text-xs hud-text text-green-500">
                EVENTS ({events.length})
              </span>
            </div>
            <ul>
              {events.map((event, idx) => (
                <li key={event.event_id}>
                  <button
                    onClick={() => setCurrentIndex(idx)}
                    className={`w-full text-left px-3 py-2 text-xs hud-text border-b border-green-950 focus:outline-none focus:ring-1 focus:ring-green-400 ${
                      idx === currentIndex
                        ? "bg-green-950 text-green-300"
                        : "text-green-700 hover:bg-green-950"
                    }`}
                    aria-label={`Event ${idx + 1}: ${event.threat_level} at frame ${event.frame_id}`}
                    aria-current={idx === currentIndex ? "true" : undefined}
                  >
                    <div className="flex justify-between">
                      <span>{event.threat_level.toUpperCase()}</span>
                      <span className="text-green-800">#{event.frame_id}</span>
                    </div>
                    <div className="text-green-800 mt-0.5">
                      {event.event_reasons[0] || "no reason"}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Event detail */}
          <div className="flex-1 p-4 overflow-y-auto">
            {currentEvent ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="border border-green-900 p-3">
                    <div className="text-xs text-green-600 hud-text mb-1">THREAT SCORE</div>
                    <div className="text-3xl font-bold text-green-400 hud-text">
                      {currentEvent.threat_score}
                    </div>
                  </div>
                  <div className="border border-green-900 p-3">
                    <div className="text-xs text-green-600 hud-text mb-1">LEVEL</div>
                    <div className="text-xl font-bold text-green-400 hud-text">
                      {currentEvent.threat_level.toUpperCase()}
                    </div>
                  </div>
                  <div className="border border-green-900 p-3">
                    <div className="text-xs text-green-600 hud-text mb-1">DIRECTION</div>
                    <div className="text-xl font-bold text-green-400 hud-text">
                      {currentEvent.direction.toUpperCase()}
                    </div>
                  </div>
                  <div className="border border-green-900 p-3">
                    <div className="text-xs text-green-600 hud-text mb-1">FRAME</div>
                    <div className="text-xl font-bold text-green-400 hud-text">
                      #{currentEvent.frame_id}
                    </div>
                  </div>
                </div>

                <div className="border border-green-900 p-3">
                  <div className="text-xs text-green-600 hud-text mb-2">EVENT REASONS</div>
                  {currentEvent.event_reasons.length === 0 ? (
                    <p className="text-xs text-green-800 hud-text">No reasons recorded</p>
                  ) : (
                    <ul className="space-y-1">
                      {currentEvent.event_reasons.map((r, i) => (
                        <li key={i} className="text-xs text-yellow-400 hud-text">
                          • {r}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-green-800 hud-text text-sm text-center mt-8">
                SELECT AN EVENT TO VIEW DETAILS
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scrub control */}
      {!loading && !error && events.length > 0 && (
        <div className="px-4 py-3 border-t border-green-900">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="text-green-400 hud-text text-xs px-2 py-1 border border-green-800 disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-green-400"
              aria-label="Previous event"
            >
              ◀ PREV
            </button>
            <input
              type="range"
              min={0}
              max={events.length - 1}
              value={currentIndex}
              onChange={(e) => setCurrentIndex(Number(e.target.value))}
              className="flex-1 accent-green-400"
              aria-label={`Timeline scrubber: event ${currentIndex + 1} of ${events.length}`}
            />
            <button
              onClick={() => setCurrentIndex(Math.min(events.length - 1, currentIndex + 1))}
              disabled={currentIndex === events.length - 1}
              className="text-green-400 hud-text text-xs px-2 py-1 border border-green-800 disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-green-400"
              aria-label="Next event"
            >
              NEXT ▶
            </button>
            <span className="text-xs text-green-600 hud-text">
              {currentIndex + 1} / {events.length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
