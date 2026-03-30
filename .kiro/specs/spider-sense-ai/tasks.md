# Implementation Plan: Spider-Sense AI

## Overview

Implement the Spider-Sense AI system incrementally: backend pipeline first (Motion_Analyzer → Object_Detector → Object_Tracker → Threat_Engine), then REST/WebSocket layer, then frontend HUD components, then session features, and finally integration wiring. Each task builds on the previous and ends with all components connected.

## Tasks

- [ ] 1. Project scaffolding and typed interfaces
  - Create `backend/` directory with `pyproject.toml` (FastAPI, uvicorn, ultralytics, opencv-python, pydantic, hypothesis)
  - Create `frontend/` directory with `package.json` (Next.js 15, React 19, Zustand, fast-check, vitest)
  - Define all Pydantic v2 models in `backend/models.py`: `MotionSignals`, `DetectedObject`, `BoundingBox`, `TrackedObject`, `ThreatAssessment`, `WebSocketMessage`, `CalibrationBaseline`, `Session`, `SessionEvent`, `SnapshotRecord`, `SessionSummary`, `Settings`
  - Define all TypeScript interfaces in `frontend/src/types/index.ts`: `WebSocketMessage`, `ThreatLevel`, `ThreatDirection`, `TrackedObject`, `BoundingBox`, `EventLogEntry`, `TimelinePoint`, `SessionSummary`
  - Create `docker-compose.yml` wiring backend (port 8000) and frontend (port 3000) services
  - _Requirements: 19.2, 24.1, 24.2, 24.3, 24.5_

  - [ ]* 1.1 Write property test for Pydantic model validation at module boundaries (P25)
    - **Property 25: Pydantic validation enforced at module boundaries**
    - **Validates: Requirements 24.3**

- [ ] 2. Motion_Analyzer implementation
  - Implement `backend/motion_analyzer.py` with `MotionAnalyzer` class
  - Use OpenCV frame differencing to compute `motion_intensity` in [0.0, 1.0]
  - Compute `motion_suddenness` as rate of change over a configurable rolling window
  - Divide frame into a 3×3 grid and compute per-zone motion magnitude for `zones_active`
  - Compute `dominant_direction` from weighted zone activity (8 defined values)
  - Compute `contour_area_fraction` as motion contour area / total frame area
  - Subtract `CalibrationBaseline.avg_motion_level` from raw intensity before emitting
  - Apply temporal smoothing (configurable rolling window) to suppress noise spikes
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 2.1 Write property test for MotionSignals completeness and range (P1)
    - **Property 1: MotionSignals completeness and range**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

  - [ ]* 2.2 Write property test for baseline subtraction (P2)
    - **Property 2: Baseline subtraction reduces apparent motion**
    - **Validates: Requirements 3.6**

  - [ ]* 2.3 Write property test for temporal smoothing variance (P3)
    - **Property 3: Temporal smoothing reduces variance**
    - **Validates: Requirements 3.7**

- [ ] 3. Object_Detector implementation
  - Implement `backend/object_detector.py` with `ObjectDetector` class
  - Load YOLOv8n via `ultralytics` on init; support configurable input resolution for degradation
  - Run inference and return `list[DetectedObject]` with normalized bbox, class_label, confidence
  - Filter detections below `Settings.confidence_threshold`
  - Emit `is_unknown_moving_region=True` entries for motion contours with no matched YOLO class
  - Restrict class labels to: person, hand, cell phone, chair, backpack, bottle, laptop, unknown
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 3.1 Write property test for DetectedObject completeness and class domain (P4)
    - **Property 4: DetectedObject completeness and class domain**
    - **Validates: Requirements 4.1, 4.2, 4.4**

- [ ] 4. Object_Tracker implementation
  - Implement `backend/object_tracker.py` with `ObjectTracker` class
  - Assign stable `track_id` across frames using IoU-based bounding box overlap
  - Compute `bbox_growth_rate` (change in bbox area per frame) for each tracked object
  - Compute `path` as list of bbox center positions over the tracking window
  - Set `approaching=True` when `bbox_growth_rate` exceeds `Settings.approach_threshold`
  - Generate human-readable `velocity_hint` strings from movement direction and speed
  - Expire track IDs not matched for `Settings.tracker_timeout_frames` consecutive frames
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 4.1 Write property test for TrackedObject completeness and ID stability (P5)
    - **Property 5: TrackedObject completeness and ID stability**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.6**

  - [ ]* 4.2 Write property test for approach flag invariant (P6)
    - **Property 6: Approach flag invariant**
    - **Validates: Requirements 5.4**

- [ ] 5. Threat_Engine implementation
  - Implement `backend/threat_engine.py` with `ThreatEngine` class
  - Apply weighted formula: `0.28*motion_intensity + 0.20*motion_suddenness + 0.18*approach_velocity + 0.14*center_proximity + 0.10*bbox_growth + 0.06*new_entity_bonus + 0.04*multi_zone_bonus`
  - Scale all inputs by sensitivity factor (low=0.6, medium=1.0, high=1.5) before formula
  - Normalize raw score to integer [0, 100]
  - Apply exponential smoothing: `s_new = alpha * s_raw + (1 - alpha) * s_prev`
  - Implement hysteresis state machine: transition up after N frames above upper threshold, down after N frames below lower threshold (42 for elevated→aware)
  - Compute `direction` from active zones and approaching object positions
  - Generate `event_reasons` list from defined 8-string set based on dominant signals
  - Trigger snapshot capture when score crosses `Settings.snapshot_threshold`; enforce 3s minimum interval
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 9.4, 12.1, 12.6_

  - [ ]* 5.1 Write property test for threat score formula correctness (P7)
    - **Property 7: Threat score formula correctness**
    - **Validates: Requirements 6.1, 6.4**

  - [ ]* 5.2 Write property test for threat score range invariant (P8)
    - **Property 8: Threat score range invariant**
    - **Validates: Requirements 6.2, 6.5**

  - [ ]* 5.3 Write property test for exponential smoothing bounds (P9)
    - **Property 9: Exponential smoothing bounds**
    - **Validates: Requirements 6.3**

  - [ ]* 5.4 Write property test for sensitivity scaling monotonicity (P10)
    - **Property 10: Sensitivity scaling is monotone**
    - **Validates: Requirements 6.4, 13.3, 13.4**

  - [ ]* 5.5 Write property test for threat level mapping invariant (P11)
    - **Property 11: Threat level mapping invariant**
    - **Validates: Requirements 7.1, 7.5**

  - [ ]* 5.6 Write property test for hysteresis state machine correctness (P12)
    - **Property 12: Hysteresis state machine correctness**
    - **Validates: Requirements 7.2, 7.3, 7.4**

  - [ ]* 5.7 Write property test for direction domain invariant (P13)
    - **Property 13: Direction domain invariant**
    - **Validates: Requirements 8.1, 8.2, 8.4**

  - [ ]* 5.8 Write property test for event reasons domain constraint (P14)
    - **Property 14: Event reasons domain constraint**
    - **Validates: Requirements 9.1, 9.2, 9.3**

  - [ ]* 5.9 Write property test for snapshot trigger and rate limiting (P18)
    - **Property 18: Snapshot trigger and rate limiting**
    - **Validates: Requirements 12.1, 12.2, 12.6**

- [ ] 6. Checkpoint — backend pipeline unit tests
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Calibration subsystem
  - Implement `backend/calibration.py` with `CalibrationManager` class
  - Sample frames for 2–5 seconds; compute `avg_motion_level`, `avg_brightness`, `noise_floor`, `reference_objects`
  - Extend calibration window by up to 3 additional seconds if motion intensity exceeds noise threshold
  - Emit `CalibrationBaseline` with `stable=True` when complete; use best available baseline if still noisy after extension
  - _Requirements: 2.1, 2.2, 2.3, 2.6_

  - [ ]* 7.1 Write property test for calibration baseline completeness (P21)
    - **Property 21: Calibration baseline completeness**
    - **Validates: Requirements 2.3**

  - [ ]* 7.2 Write property test for calibration duration bounds (P22)
    - **Property 22: Calibration duration bounds**
    - **Validates: Requirements 2.2, 2.6**

- [ ] 8. Session store and snapshot persistence
  - Implement `backend/session_store.py` with in-process dict store for active session
  - Serialize `Session` (events + summary) to `./data/sessions/{session_id}.json` on stop
  - Save JPEG snapshots to `./data/snapshots/{session_id}/{snapshot_id}.jpg`
  - Compute `SessionSummary` on session stop: total_alerts, highest/average threat_score, top_direction, total_snapshots, dominant_event_reason
  - _Requirements: 12.3, 12.4, 15.1, 15.4, 22.2_

- [ ] 9. REST API endpoints
  - Implement `backend/api.py` with FastAPI router
  - `GET /health` → service status and version JSON
  - `POST /session/start` → initialize session, return `session_id`
  - `POST /session/stop` → finalize session, trigger summary computation
  - `GET /session/latest` → most recent `SessionSummary`
  - `GET /session/:id/events` → ordered `list[SessionEvent]` (404 if not found)
  - `POST /demo/trigger` → inject synthetic event (400 if not in demo mode)
  - `POST /settings` → update `Settings`; apply immediately to Threat_Engine
  - All bodies validated by Pydantic v2; invalid bodies return HTTP 422
  - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8_

  - [ ]* 9.1 Write property test for REST API 422 on invalid input (P24)
    - **Property 24: REST API rejects invalid input**
    - **Validates: Requirements 20.8**

- [ ] 10. WebSocket endpoint and frame pipeline
  - Implement `backend/websocket.py` WebSocket endpoint at `/ws`
  - Accept base64-encoded JPEG frames from frontend; decode and pass to pipeline
  - Run pipeline: CalibrationManager → Motion_Analyzer → Object_Detector → Object_Tracker → Threat_Engine
  - Drop incoming frames when pipeline is busy (do not queue)
  - Emit `WebSocketMessage` JSON after each processed frame
  - Emit `degraded=True` when frame processing exceeds target interval; use previous valid values
  - Suppress `event_reasons` and force `threat_level=stable` during calibration state
  - Maintain single WebSocket connection per session; close cleanly on session stop
  - _Requirements: 2.4, 2.5, 19.1, 19.2, 19.3, 19.4, 21.3, 21.5, 21.6_

  - [ ]* 10.1 Write property test for WebSocket message schema completeness (P23)
    - **Property 23: WebSocket message schema completeness**
    - **Validates: Requirements 19.1, 19.2**

  - [ ]* 10.2 Write property test for no threat alerts during calibration (P20)
    - **Property 20: No threat alerts during calibration**
    - **Validates: Requirements 2.4**

- [ ] 11. Checkpoint — backend integration tests
  - Write integration tests: full pipeline frame-in → WebSocket_Message-out
  - Write integration test: session start → calibration → active → stop → summary
  - Write integration test: snapshot capture — score crosses threshold → file exists on disk
  - Write integration test: POST /settings → next frame uses new sensitivity
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Zustand store and TypeScript types
  - Implement `frontend/src/store/useSpiderSenseStore.ts` with full `SpiderSenseStore` interface
  - Implement `appendEvent` action: append `EventLogEntry` when `event_reasons` non-empty; cap at 50 entries (discard oldest)
  - Implement timeline append: add `TimelinePoint` on every message; trim to configured window (20–60s)
  - Implement `updateSettings` and `setSessionState` actions
  - Track `messageRate` (messages/sec) and set `performanceWarning` when rate drops below 5/sec
  - _Requirements: 10.1, 10.2, 10.4, 11.2, 21.4, 24.4_

  - [ ]* 12.1 Write property test for event log bounded size (P15)
    - **Property 15: Event log bounded size**
    - **Validates: Requirements 10.1, 10.4**

  - [ ]* 12.2 Write property test for event log append round-trip (P16)
    - **Property 16: Event log append round-trip**
    - **Validates: Requirements 10.2**

  - [ ]* 12.3 Write property test for timeline append round-trip (P17)
    - **Property 17: Timeline append round-trip**
    - **Validates: Requirements 11.2**

- [ ] 13. WebSocket client
  - Implement `frontend/src/lib/wsClient.ts` WebSocket client class
  - Connect on session start; send JPEG frames as base64-encoded JSON at configured FPS
  - Parse incoming JSON as `WebSocketMessage`; dispatch to Zustand store via `appendEvent`
  - Implement exponential backoff reconnection (max 30s interval)
  - Do not send any frame data before `sessionState === 'active'`
  - _Requirements: 1.5, 19.5_

  - [ ]* 13.1 Write property test for no frames transmitted before activation (P19)
    - **Property 19: No frames transmitted before activation**
    - **Validates: Requirements 1.5**

- [ ] 14. Camera initialization and calibration UI
  - Implement `frontend/src/components/StatusBar.tsx` with calibration progress indicator
  - Implement camera init flow in `frontend/src/app/page.tsx`: render "Initialize System" button (keyboard accessible), call `getUserMedia`, display live preview in `<CameraViewport>`
  - Display permission troubleshooting UI with specific error reason when `getUserMedia` fails
  - Display privacy notice on first load
  - Show calibration progress bar during `sessionState === 'calibrating'`; suppress threat alerts in UI during calibration
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.4, 22.3_

- [ ] 15. Core HUD components
  - Implement `frontend/src/components/CameraViewport.tsx`: video element + canvas overlay
  - Implement `frontend/src/components/ThreatRing.tsx`: animated SVG ring scaled to `threat_score`; update visual state within 150ms of message receipt
  - Implement `frontend/src/components/Reticle.tsx`: center crosshair with pulse animation
  - Implement `frontend/src/components/DirectionalArc.tsx`: SVG arc segment for each of 8 directions
  - Implement `frontend/src/components/ThreatScoreDisplay.tsx`: numeric score + `threat_level` label with icon+color indicator (not color alone)
  - All components read from Zustand store; all interactive elements have ARIA labels and visible focus indicators
  - _Requirements: 7.6, 8.5, 21.2, 23.1, 23.2, 23.3, 23.4_

- [ ] 16. Event log and threat timeline components
  - Implement `frontend/src/components/EventLogPanel.tsx`: render `eventLog` in reverse-chronological order; each entry shows timestamp, threat_level, direction, event_reasons with icon+color severity indicator
  - Implement `frontend/src/components/ThreatTimeline.tsx`: time-series chart of `timelineData`; render spike markers at elevated/triggered transitions; render snapshot markers; update at ≥10 FPS
  - _Requirements: 10.3, 10.5, 11.1, 11.3, 11.4, 11.5_

- [ ] 17. Control panel and settings
  - Implement `frontend/src/components/ControlPanel.tsx` with:
    - Sensitivity control (low/medium/high); POST /settings on change; reflect active level in HUD
    - Audio toggle (default disabled); play distinct sounds on elevated/triggered transitions; suppress when disabled
    - Demo Mode toggle; show "DEMO" indicator when active; POST /demo/trigger or activate backend scheduler
    - Export Mode toggle; switch to vertical layout, full-screen camera background, hide dev controls, show "REC" indicator
  - All controls keyboard accessible with ARIA labels and visible focus indicators
  - _Requirements: 13.1, 13.2, 13.5, 14.1, 14.4, 14.5, 17.1, 17.2, 17.3, 17.4, 17.5, 18.1, 18.2, 18.3, 18.4, 18.5, 23.1, 23.3, 23.4_

- [ ] 18. Session summary and replay mode
  - Implement session summary view: display on session stop, fetch from `GET /session/latest`
  - Implement `frontend/src/components/ReplayMode.tsx`: fetch events from `GET /session/:id/events`; display snapshots, timeline, event log in chronological order; scrub control; show "HISTORICAL DATA" indicator
  - Display snapshot thumbnails in right panel and as markers on timeline
  - _Requirements: 11.4, 12.5, 15.2, 15.3, 16.1, 16.2, 16.3, 16.4, 16.5_

- [ ] 19. HUDRoot wiring and performance warning
  - Implement `frontend/src/components/HUDRoot.tsx` composing all HUD sub-components
  - Wire `performanceWarning` from store to `StatusBar` performance indicator
  - Implement FPS cap: send frames at `Settings.fps_cap` rate; allow user to reduce via settings
  - _Requirements: 21.1, 21.4, 21.5_

  - [ ]* 19.1 Write property test for no alerts during calibration in frontend (P20)
    - **Property 20: No threat alerts during calibration (frontend)**
    - **Validates: Requirements 2.4**

- [ ] 20. Checkpoint — frontend unit tests
  - Write unit tests: camera init flow (mock getUserMedia), permission denied UI, WebSocket reconnection backoff
  - Write unit tests: HUD rendering for each ThreatLevel, DirectionalArc for each direction
  - Write unit tests: audio alert on elevated/triggered, suppressed when disabled
  - Write unit tests: export mode hides dev controls, demo mode shows DEMO indicator
  - Write unit tests: sensitivity control POSTs correct value, accessibility (ARIA labels, focus indicators, icon+color indicators)
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 21. Docker Compose and final integration wiring
  - Finalize `docker-compose.yml`: backend service (Python, port 8000, mounts `./data`), frontend service (Node, port 3000)
  - Ensure `docker compose up` starts both services with a single command
  - Verify end-to-end: frame capture → WebSocket → pipeline → HUD update within 150ms
  - _Requirements: 24.5_

- [ ] 22. Final checkpoint — all tests pass
  - Ensure all backend and frontend tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `hypothesis` (backend) and `fast-check` (frontend), minimum 100 iterations each
- Property test tag format — backend: `# Feature: spider-sense-ai, Property {N}: {text}` / frontend: `// Feature: spider-sense-ai, Property {N}: {text}`
- Run backend tests with: `pytest --tb=short`
- Run frontend tests with: `vitest --run`
