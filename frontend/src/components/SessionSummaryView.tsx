"use client";

import { SessionSummary } from "@/types";

interface SessionSummaryViewProps {
  summary: SessionSummary;
  onReplay?: () => void;
  onClose: () => void;
}

export function SessionSummaryView({
  summary,
  onReplay,
  onClose,
}: SessionSummaryViewProps) {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-95 z-40 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Session summary"
    >
      <div className="border border-green-700 bg-black p-6 max-w-md w-full mx-4">
        <h2 className="text-lg hud-text text-green-400 mb-4 text-center">
          SESSION COMPLETE
        </h2>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="border border-green-900 p-3 text-center">
            <div className="text-xs text-green-600 hud-text">TOTAL ALERTS</div>
            <div className="text-2xl font-bold text-green-400 hud-text">
              {summary.total_alerts}
            </div>
          </div>
          <div className="border border-green-900 p-3 text-center">
            <div className="text-xs text-green-600 hud-text">PEAK SCORE</div>
            <div className="text-2xl font-bold text-red-400 hud-text">
              {summary.highest_threat_score}
            </div>
          </div>
          <div className="border border-green-900 p-3 text-center">
            <div className="text-xs text-green-600 hud-text">AVG SCORE</div>
            <div className="text-2xl font-bold text-yellow-400 hud-text">
              {summary.average_threat_score.toFixed(1)}
            </div>
          </div>
          <div className="border border-green-900 p-3 text-center">
            <div className="text-xs text-green-600 hud-text">SNAPSHOTS</div>
            <div className="text-2xl font-bold text-blue-400 hud-text">
              {summary.total_snapshots}
            </div>
          </div>
        </div>

        <div className="border border-green-900 p-3 mb-4">
          <div className="text-xs text-green-600 hud-text mb-1">TOP DIRECTION</div>
          <div className="text-sm text-green-400 hud-text">
            {summary.top_direction.toUpperCase()}
          </div>
        </div>

        {summary.dominant_event_reason && (
          <div className="border border-green-900 p-3 mb-4">
            <div className="text-xs text-green-600 hud-text mb-1">DOMINANT REASON</div>
            <div className="text-sm text-yellow-400 hud-text">
              {summary.dominant_event_reason}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          {onReplay && (
            <button
              onClick={onReplay}
              className="flex-1 py-2 text-xs hud-text border border-green-700 text-green-400 hover:bg-green-950 focus:outline-none focus:ring-2 focus:ring-green-400"
              aria-label="Replay session"
            >
              ⏮ REPLAY
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-2 text-xs hud-text border border-green-700 text-green-400 hover:bg-green-950 focus:outline-none focus:ring-2 focus:ring-green-400"
            aria-label="Close session summary"
          >
            ✕ CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
