# Requirements Document

## Introduction

Spider-Sense AI is a premium, real-time computer vision application that transforms a standard webcam into a cinematic threat-awareness interface. Inspired by the concept of Spider-Sense, the system continuously analyzes the camera feed for motion, scene changes, approaching objects, and human/object entry, then translates those detections into a futuristic HUD displaying a threat score, directionality, event reasoning, and session replay. The product is designed to be visually polished enough for viral social content and technically rigorous enough to impress AI/ML recruiters.

The system is composed of two primary components: a Next.js frontend that captures webcam frames and renders the cinematic HUD, and a FastAPI backend that performs motion analysis, object detection, object tracking, and threat score computation, communicating results to the frontend over WebSocket in real time.

---

## Glossary

- **System**: The Spider-Sense AI application as a whole (frontend + backend).
- **Frontend**: The Next.js 15+ / React 19+ web application responsible for camera capture, WebSocket communication, and HUD rendering.
- **Backend**: The FastAPI / Python 3.11+ service responsible for frame processing, motion analysis, object detection, tracking, and threat computation.
- **Threat_Engine**: The backend subsystem that computes the threat score, threat level, directionality, and event reasons from raw analysis signals.
- **Motion_Analyzer**: The backend subsystem that computes frame-to-frame motion intensity, suddenness, direction, and zone activity using OpenCV.
- **Object_Detector**: The backend subsystem that runs YOLOv8n inference to detect and classify objects in each frame.
- **Object_Tracker**: The backend subsystem that persists object identity across frames and infers approach velocity and bounding box growth.
- **HUD**: The Heads-Up Display rendered by the Frontend — the full cinematic overlay including threat rings, reticle, directional arcs, panels, and timeline.
- **Threat_Score**: A normalized 0–100 integer representing the current level of detected threat activity.
- **Threat_Level**: A categorical state derived from Threat_Score: stable (0–24), aware (25–49), elevated (50–74), triggered (75–100).
- **Calibration**: A 2–5 second initialization phase during which the Backend establishes a baseline of the environment's normal motion, brightness, and object layout.
- **Session**: A continuous period of active monitoring from system start to system stop, associated with a unique session ID.
- **Snapshot**: A JPEG frame image auto-captured by the Backend when the Threat_Score crosses a configured threshold.
- **Event_Log**: A rolling, time-ordered list of discrete threat events emitted during a Session.
- **Threat_Timeline**: A time-series chart of Threat_Score values covering the last 20–60 seconds of a Session.
- **Demo_Mode**: A synthetic event injection mode that simulates threat scenarios without requiring real camera input.
- **Export_Mode**: A vertical-friendly UI layout optimized for screen recording and social content creation.
- **WebSocket_Message**: The JSON payload emitted by the Backend to the Frontend after each processed frame.
- **Hysteresis**: A temporal filtering mechanism that requires a score to remain above or below a threshold for N consecutive frames before a Threat_Level transition is confirmed.
- **Frame_Rate**: The number of frames per second at which the Frontend captures and sends frames to the Backend.
- **Sensitivity**: A user-configurable parameter (low / medium / high or continuous 0–1 slider) that scales the Threat_Engine's detection thresholds.

---

## Requirements

### Requirement 1: Camera Initialization

**User Story:** As a user, I want to initialize my webcam with a single action, so that I can begin monitoring my environment immediately.

#### Acceptance Criteria

1. THE Frontend SHALL display an "Initialize System" control that is keyboard accessible and visible before any camera stream is active.
2. WHEN the user activates the "Initialize System" control, THE Frontend SHALL request webcam permission from the browser using the MediaDevices API.
3. WHEN webcam permission is granted, THE Frontend SHALL display a live camera preview within the HUD viewport.
4. IF webcam permission is denied or the camera device is unavailable, THEN THE Frontend SHALL display a permission troubleshooting UI that describes the specific failure reason and provides actionable remediation steps.
5. THE Frontend SHALL NOT transmit any video data to the Backend before the user activates the "Initialize System" control.

---

### Requirement 2: Calibration Mode

**User Story:** As a user, I want the system to calibrate itself to my environment before monitoring begins, so that normal background activity does not trigger false alerts.

#### Acceptance Criteria

1. WHEN the camera stream becomes active, THE System SHALL automatically enter Calibration state before transitioning to active monitoring.
2. WHILE in Calibration state, THE Backend SHALL sample a minimum of 2 seconds and a maximum of 5 seconds of frames to compute the environment baseline.
3. WHILE in Calibration state, THE Backend SHALL compute and store: average background motion level, average scene brightness, idle camera noise floor, and a reference layout of stationary objects.
4. WHILE in Calibration state, THE Frontend SHALL display a visible calibration progress indicator and prevent threat alerts from being emitted.
5. WHEN Calibration completes, THE System SHALL transition to active monitoring state and begin emitting WebSocket_Messages.
6. IF the calibration sample contains motion intensity above a configurable noise threshold, THEN THE Backend SHALL extend the calibration window by up to 3 additional seconds to obtain a stable baseline.

---

### Requirement 3: Motion Detection

**User Story:** As a user, I want the system to detect and characterize motion in the camera feed, so that meaningful movement is distinguished from background noise.

#### Acceptance Criteria

1. WHEN a frame is received by the Backend, THE Motion_Analyzer SHALL compute frame-to-frame optical flow or frame differencing to produce a motion intensity value in the range [0.0, 1.0].
2. WHEN a frame is received by the Backend, THE Motion_Analyzer SHALL compute motion suddenness as the rate of change of motion intensity between the current frame and the preceding N frames.
3. WHEN a frame is received by the Backend, THE Motion_Analyzer SHALL identify active motion zones by dividing the frame into a grid and computing per-zone motion magnitude.
4. WHEN a frame is received by the Backend, THE Motion_Analyzer SHALL compute the dominant motion direction as one of: left, right, top, bottom, center-left, center-right, center, multi-zone.
5. WHEN a frame is received by the Backend, THE Motion_Analyzer SHALL compute the total contour area of motion regions as a fraction of the total frame area.
6. WHILE the Backend is in active monitoring state, THE Motion_Analyzer SHALL subtract the calibration baseline from raw motion values before emitting signals to the Threat_Engine.
7. THE Motion_Analyzer SHALL apply temporal smoothing over a configurable rolling window to suppress single-frame noise spikes.

---

### Requirement 4: Object Detection

**User Story:** As a user, I want the system to identify specific objects in the camera feed, so that I receive contextually meaningful threat information.

#### Acceptance Criteria

1. WHEN a frame is received by the Backend, THE Object_Detector SHALL run YOLOv8n inference and return bounding boxes, class labels, and confidence scores for all detected objects.
2. THE Object_Detector SHALL recognize the following object classes: person, hand, cell phone, chair, backpack, bottle, laptop.
3. IF a motion region is detected by the Motion_Analyzer but no known object class is matched by the Object_Detector, THEN THE Object_Detector SHALL emit an "unknown moving region" detection with the motion contour bounding box.
4. THE Object_Detector SHALL filter detections below a configurable minimum confidence threshold before passing results to the Object_Tracker.
5. THE Object_Detector SHALL operate at a frame rate sufficient to maintain a perceived inference latency under 150 milliseconds on reference hardware.

---

### Requirement 5: Object Tracking

**User Story:** As a user, I want the system to track objects across frames, so that approach detection and trajectory analysis are possible.

#### Acceptance Criteria

1. WHEN an object is detected in consecutive frames, THE Object_Tracker SHALL assign and persist a stable object ID across those frames using bounding box overlap or a compatible tracking algorithm.
2. WHEN an object ID is active, THE Object_Tracker SHALL compute the bounding box growth rate (change in area per frame) as a proxy for approach velocity.
3. WHEN an object ID is active, THE Object_Tracker SHALL compute the movement path as the sequence of bounding box center positions over the tracking window.
4. WHEN the bounding box growth rate of a tracked object exceeds a configurable approach threshold, THE Object_Tracker SHALL set the approaching flag to true for that object.
5. IF a tracked object ID is not matched in a frame for longer than a configurable timeout window, THEN THE Object_Tracker SHALL expire that object ID.
6. THE Object_Tracker SHALL emit per-object velocity hints as human-readable strings (e.g., "moving fast toward center", "stationary", "moving left") for use in event reasoning.

---

### Requirement 6: Threat Score Computation

**User Story:** As a user, I want a single numeric threat score that summarizes all detected signals, so that I can understand the current risk level at a glance.

#### Acceptance Criteria

1. WHEN the Threat_Engine processes a frame, THE Threat_Engine SHALL compute the raw threat score using the following weighted formula:
   `threat_score_raw = 0.28 * motion_intensity + 0.20 * motion_suddenness + 0.18 * approach_velocity + 0.14 * center_proximity + 0.10 * bbox_growth + 0.06 * new_entity_bonus + 0.04 * multi_zone_bonus`
2. WHEN the raw score is computed, THE Threat_Engine SHALL normalize the result to the integer range [0, 100].
3. WHEN the normalized score is computed, THE Threat_Engine SHALL apply exponential smoothing with a configurable alpha parameter to produce the final smoothed Threat_Score.
4. THE Threat_Engine SHALL scale all input signals by the user-configured Sensitivity parameter before applying the weighted formula.
5. THE Threat_Engine SHALL emit the Threat_Score as part of every WebSocket_Message.

---

### Requirement 7: Threat Level State Machine

**User Story:** As a user, I want the system to categorize the threat score into named states, so that I can interpret severity without reading a number.

#### Acceptance Criteria

1. THE Threat_Engine SHALL map Threat_Score to Threat_Level according to: 0–24 = stable, 25–49 = aware, 50–74 = elevated, 75–100 = triggered.
2. WHEN the Threat_Score exceeds the upper threshold of the current Threat_Level for N consecutive frames, THE Threat_Engine SHALL transition to the next higher Threat_Level.
3. WHEN the Threat_Score falls below the lower hysteresis threshold of the current Threat_Level for N consecutive frames, THE Threat_Engine SHALL transition to the next lower Threat_Level.
4. THE Threat_Engine SHALL use a lower hysteresis threshold of 42 for the transition from elevated to aware (i.e., score must remain below 42 for N frames to drop from elevated).
5. THE Threat_Engine SHALL emit the current Threat_Level string in every WebSocket_Message.
6. THE Frontend SHALL update the HUD visual state to reflect the new Threat_Level within 150 milliseconds of receiving the WebSocket_Message.

---

### Requirement 8: Directionality

**User Story:** As a user, I want to know the direction from which a threat is approaching, so that I can respond appropriately.

#### Acceptance Criteria

1. WHEN the Threat_Engine processes a frame, THE Threat_Engine SHALL compute the dominant threat direction from the active motion zones and approaching object positions.
2. THE Threat_Engine SHALL classify threat direction as one of: left, right, top, bottom, center-left, center-right, center, multi-zone.
3. WHEN multiple zones are simultaneously active above the motion threshold, THE Threat_Engine SHALL emit "multi-zone" as the direction.
4. THE Threat_Engine SHALL emit the direction string in every WebSocket_Message.
5. THE Frontend SHALL render a directional threat indicator (arc, arrow, or ring segment) on the HUD that visually corresponds to the emitted direction.

---

### Requirement 9: Event Reasoning

**User Story:** As a user, I want human-readable explanations for why the threat score changed, so that I understand what the system detected.

#### Acceptance Criteria

1. WHEN the Threat_Engine processes a frame, THE Threat_Engine SHALL generate a list of zero or more event reason strings describing the dominant contributing signals.
2. THE Threat_Engine SHALL produce event reasons from the following set: "rapid motion spike", "approaching object", "person entered frame unexpectedly", "fast centerline movement", "multiple motion zones active", "unknown moving region detected", "object size growth detected", "new entity in scene".
3. WHEN no significant threat signal is present, THE Threat_Engine SHALL emit an empty event_reasons list.
4. THE Threat_Engine SHALL emit the event_reasons list in every WebSocket_Message.
5. THE Frontend SHALL display the most recent non-empty event_reasons in the Event_Log panel.

---

### Requirement 10: Event Log

**User Story:** As a user, I want a rolling log of recent system events, so that I can review what happened during a monitoring session.

#### Acceptance Criteria

1. THE Frontend SHALL maintain a rolling Event_Log of the most recent 50 events received from the Backend.
2. WHEN a WebSocket_Message contains a non-empty event_reasons list, THE Frontend SHALL append a new entry to the Event_Log containing the timestamp, Threat_Level, direction, and event reasons.
3. THE Frontend SHALL display the Event_Log in reverse-chronological order in the right panel.
4. WHEN the Event_Log exceeds 50 entries, THE Frontend SHALL discard the oldest entry.
5. THE Frontend SHALL render each Event_Log entry with a visual severity indicator that does not rely on color alone (e.g., icon + color).

---

### Requirement 11: Threat Timeline

**User Story:** As a user, I want to see a time-series chart of the threat score, so that I can identify patterns and spikes over time.

#### Acceptance Criteria

1. THE Frontend SHALL render a Threat_Timeline chart displaying Threat_Score values over the most recent configurable window of 20–60 seconds.
2. WHEN a new WebSocket_Message is received, THE Frontend SHALL append the Threat_Score and timestamp to the Threat_Timeline data series.
3. THE Frontend SHALL render spike markers on the Threat_Timeline at timestamps where the Threat_Level transitioned to elevated or triggered.
4. THE Frontend SHALL render snapshot capture markers on the Threat_Timeline at timestamps where a Snapshot was saved.
5. THE Frontend SHALL update the Threat_Timeline chart at a minimum of 10 frames per second to maintain visual continuity.

---

### Requirement 12: Snapshot Capture

**User Story:** As a user, I want the system to automatically capture frame snapshots when a threat is detected, so that I have a visual record of threat events.

#### Acceptance Criteria

1. WHEN the Threat_Score crosses a configurable snapshot threshold (default: 50), THE Backend SHALL capture and store a JPEG snapshot of the current frame.
2. THE Backend SHALL include a snapshot_saved boolean flag in the WebSocket_Message for the frame on which a snapshot was captured.
3. THE Backend SHALL associate each Snapshot with the current Session ID, a timestamp, the Threat_Score at capture time, and the Threat_Level at capture time.
4. THE Backend SHALL store Snapshots locally and make them accessible via the session events REST endpoint.
5. THE Frontend SHALL display Snapshot thumbnails in the right panel and as markers on the Threat_Timeline.
6. IF the Threat_Score remains above the snapshot threshold continuously, THEN THE Backend SHALL enforce a minimum interval of 3 seconds between consecutive Snapshots to prevent storage exhaustion.

---

### Requirement 13: Sensitivity Control

**User Story:** As a user, I want to adjust the system's detection sensitivity, so that I can tune it for my environment and use case.

#### Acceptance Criteria

1. THE Frontend SHALL provide a Sensitivity control with at minimum three discrete levels: low, medium, high.
2. WHEN the user changes the Sensitivity setting, THE Frontend SHALL transmit the new value to the Backend via the POST /settings endpoint.
3. WHEN the Backend receives a new Sensitivity value, THE Threat_Engine SHALL apply the updated scaling factor to all subsequent threat score computations without requiring a session restart.
4. THE Backend SHALL map sensitivity levels to scaling factors: low = 0.6, medium = 1.0, high = 1.5.
5. THE Frontend SHALL reflect the active Sensitivity level in the HUD control panel at all times.

---

### Requirement 14: Demo Mode

**User Story:** As a content creator, I want a demo mode that injects synthetic threat events, so that I can record compelling social content without needing real threats.

#### Acceptance Criteria

1. THE Frontend SHALL provide a Demo Mode toggle in the control panel.
2. WHEN Demo Mode is activated, THE Backend SHALL begin emitting synthetic WebSocket_Messages that simulate a scripted sequence of threat escalation and de-escalation events.
3. WHEN Demo Mode is active, THE Backend SHALL inject synthetic events via the POST /demo/trigger endpoint or an internal scheduler.
4. WHEN Demo Mode is active, THE Frontend SHALL display a visible "DEMO" indicator in the HUD so that recordings are clearly identifiable as demonstrations.
5. WHEN Demo Mode is deactivated, THE Backend SHALL resume processing live camera frames and cease synthetic event emission.

---

### Requirement 15: Session Summary

**User Story:** As a user, I want a summary of my monitoring session, so that I can review overall activity after stopping the system.

#### Acceptance Criteria

1. WHEN a Session is stopped, THE Backend SHALL compute and store a session summary containing: total alert count, highest Threat_Score recorded, average Threat_Score, top threat direction, total Snapshots captured, and dominant event reason.
2. WHEN a Session is stopped, THE Frontend SHALL display the session summary in a dedicated summary view.
3. THE Frontend SHALL make the session summary accessible via the GET /session/latest endpoint response.
4. THE Backend SHALL persist session summaries so that they remain accessible after the session ends.

---

### Requirement 16: Replay Mode

**User Story:** As a user, I want to replay past session events, so that I can review what the system detected after the fact.

#### Acceptance Criteria

1. THE Frontend SHALL provide a Replay Mode that allows the user to select a past Session and step through its recorded events.
2. WHEN Replay Mode is active for a Session, THE Frontend SHALL display Snapshot thumbnails, Threat_Score history on the Threat_Timeline, and Event_Log entries in chronological order.
3. WHEN Replay Mode is active, THE Frontend SHALL allow the user to scrub through the session timeline using a playback control.
4. THE Backend SHALL serve all events for a given Session via the GET /session/:id/events endpoint.
5. WHEN Replay Mode is active, THE Frontend SHALL clearly indicate that the displayed data is historical and not live.

---

### Requirement 17: Audio Alerts

**User Story:** As a user, I want optional audio warnings when threats are detected, so that I can be alerted without watching the screen.

#### Acceptance Criteria

1. THE Frontend SHALL provide an audio toggle control that enables or disables auditory alerts.
2. WHEN audio is enabled and the Threat_Level transitions to elevated, THE Frontend SHALL play a distinct auditory alert sound.
3. WHEN audio is enabled and the Threat_Level transitions to triggered, THE Frontend SHALL play a distinct, higher-urgency auditory alert sound that is perceptually different from the elevated alert.
4. WHEN audio is disabled, THE Frontend SHALL suppress all auditory alerts without affecting any other system behavior.
5. THE Frontend SHALL default to audio disabled on first load to respect user environment preferences.

---

### Requirement 18: Export / Social Mode

**User Story:** As a content creator, I want a vertical-friendly UI layout optimized for screen recording, so that I can produce polished social media content.

#### Acceptance Criteria

1. THE Frontend SHALL provide an Export Mode toggle that switches the layout to a vertical-friendly aspect ratio suitable for social content recording.
2. WHEN Export Mode is active, THE Frontend SHALL display the camera feed as a full-screen background with the threat score overlay at the top, the reticle centered, and a compact event feed at the bottom.
3. WHEN Export Mode is active, THE Frontend SHALL hide all developer-facing controls and diagnostic panels to maximize visual impact.
4. WHEN Export Mode is active, THE Frontend SHALL display a visible "REC" indicator to signal that the layout is optimized for recording.
5. THE Frontend SHALL maintain full threat detection and HUD animation functionality while Export Mode is active.

---

### Requirement 19: WebSocket Communication Protocol

**User Story:** As a developer, I want a well-defined WebSocket message contract between frontend and backend, so that both sides can be developed and tested independently.

#### Acceptance Criteria

1. THE Backend SHALL emit a WebSocket_Message after processing each frame containing all fields defined in the WebSocket message schema.
2. THE WebSocket_Message SHALL include: timestamp (ISO 8601 string), frame_id (integer), threat_score (integer 0–100), threat_level (string), direction (string), motion_intensity (float), motion_suddenness (float), approach_velocity (float), center_proximity (float), zones_active (string array), objects (array of object descriptors), event_reasons (string array), snapshot_saved (boolean).
3. WHEN the Backend cannot process a frame within the target latency window, THE Backend SHALL emit a WebSocket_Message with the most recent valid values and a degraded flag set to true.
4. THE Backend SHALL maintain a single WebSocket connection per active Session and close it cleanly when the Session ends.
5. THE Frontend SHALL reconnect automatically if the WebSocket connection is lost, with exponential backoff up to a maximum of 30 seconds between attempts.

---

### Requirement 20: REST API

**User Story:** As a developer, I want a set of REST endpoints for session lifecycle and configuration management, so that the frontend can control backend state reliably.

#### Acceptance Criteria

1. THE Backend SHALL expose a GET /health endpoint that returns HTTP 200 and a JSON body indicating service status and version.
2. THE Backend SHALL expose a POST /session/start endpoint that initializes a new Session, returns the session ID, and begins accepting frames.
3. THE Backend SHALL expose a POST /session/stop endpoint that finalizes the current Session, triggers summary computation, and closes the WebSocket connection.
4. THE Backend SHALL expose a GET /session/latest endpoint that returns the summary of the most recently completed Session.
5. THE Backend SHALL expose a GET /session/:id/events endpoint that returns the full ordered event list for the specified Session.
6. THE Backend SHALL expose a POST /demo/trigger endpoint that injects a synthetic threat event into the current session when Demo Mode is active.
7. THE Backend SHALL expose a POST /settings endpoint that accepts and applies updated Sensitivity and snapshot threshold values.
8. IF a REST endpoint receives a malformed or invalid request body, THEN THE Backend SHALL return HTTP 422 with a Pydantic validation error response.

---

### Requirement 21: Performance and Graceful Degradation

**User Story:** As a user, I want the system to remain responsive on lower-end hardware, so that the experience is usable across a range of devices.

#### Acceptance Criteria

1. THE Frontend SHALL render the HUD at a minimum of 24 frames per second under normal operating conditions.
2. THE Frontend SHALL reflect WebSocket_Message updates in the HUD within 150 milliseconds of message receipt.
3. WHEN the Backend detects that frame processing is taking longer than the target frame interval, THE Backend SHALL drop frames rather than queue them to prevent latency accumulation.
4. WHEN the Frontend detects that the WebSocket message rate has dropped below 5 messages per second, THE Frontend SHALL display a performance warning indicator in the HUD.
5. THE Backend SHALL expose a configurable frames-per-second cap for frame ingestion to allow users to reduce CPU load on low-end hardware.
6. THE System SHALL degrade inference quality (e.g., reduce YOLO input resolution) before dropping below the minimum HUD frame rate.

---

### Requirement 22: Privacy and Data Handling

**User Story:** As a user, I want my video data to remain local by default, so that I can use the system without privacy concerns.

#### Acceptance Criteria

1. THE System SHALL process all video frames locally and SHALL NOT transmit raw video frames to any external network endpoint by default.
2. THE Backend SHALL store Snapshots only on the local filesystem and SHALL NOT upload them to any remote service by default.
3. THE Frontend SHALL display a privacy notice on first load informing the user that all processing is local.
4. WHEN a Session ends, THE Backend SHALL provide the user with the option to delete all stored Snapshots and event data for that Session.

---

### Requirement 23: Accessibility

**User Story:** As a user with accessibility needs, I want the control panel to be fully keyboard accessible and not rely on color alone for information, so that I can use the system regardless of ability.

#### Acceptance Criteria

1. THE Frontend SHALL ensure all interactive controls in the HUD are reachable and operable via keyboard navigation.
2. THE Frontend SHALL render all threat state indicators using both color and a secondary visual cue (icon, label, or pattern) so that information is not conveyed by color alone.
3. THE Frontend SHALL provide visible focus indicators on all interactive elements.
4. THE Frontend SHALL use ARIA labels on all icon-only controls to provide screen reader context.

---

### Requirement 24: Modular Architecture and Typed Interfaces

**User Story:** As a developer, I want the system to use a modular architecture with typed interfaces, so that components can be developed, tested, and replaced independently.

#### Acceptance Criteria

1. THE Backend SHALL implement Motion_Analyzer, Object_Detector, Object_Tracker, and Threat_Engine as independent modules with defined input/output interfaces validated by Pydantic models.
2. THE Frontend SHALL define TypeScript interfaces for all WebSocket_Message fields and REST response shapes.
3. THE Backend SHALL validate all inter-module data using Pydantic v2 models.
4. THE Frontend SHALL manage global application state using Zustand stores with typed state slices.
5. THE System SHALL be deployable via Docker Compose with a single command for both frontend and backend services.
