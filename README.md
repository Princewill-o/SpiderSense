# 🕷️ SpiderSense

> Real-time threat detection system with gesture-controlled Spider-Man gameplay

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-blue)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green)](https://fastapi.tiangolo.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)

SpiderSense uses computer vision to detect threats in real-time through your webcam, just like Spider-Man's spider-sense. Control a classic Spider-Man game using only hand gestures - no controllers needed.

## ✨ Features

### 🎯 Real-Time Threat Detection
- **Computer Vision Pipeline**: YOLOv8 object detection + custom tracking algorithm
- **Threat Scoring**: Weighted algorithm prioritizing fist detection, approach velocity, and center proximity
- **Smart Filtering**: Only reacts to threatening objects (hands, persons, unknown moving regions)
- **Visual Feedback**: Pulsing threat ring with intensity levels (stable → aware → elevated → triggered)

### 🎮 Gesture-Controlled Gameplay
- **Hand Gestures**: Control Spider-Man with natural hand movements
  - ✋ Left hand extended → Move Left
  - ✋ Right hand extended → Move Right
  - 🙌 Both hands up → Jump
  - ✊ Closed fist → Shoot Web
  - 🕸️ Web-swinging gestures for advanced movement
- **Boss Battles**: Fight iconic villains (Venom, Green Goblin, Doctor Octopus, Mysterio, Sandman)
- **Progressive Difficulty**: Levels scale with boss defeats
- **Smart Enemy AI**: Enemies chase and attack the player

### 🔒 Privacy-First
- All video processing happens locally
- No data leaves your device
- WebSocket streaming for real-time performance

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+
- **Webcam** (required for gesture controls and threat detection)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/Princewill-o/SpiderSense.git
cd SpiderSense
```

2. **Backend Setup**
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install fastapi uvicorn opencv-python numpy ultralytics websockets python-multipart

# Download YOLOv8 model (if not included)
# The yolov8n.pt file should be in the backend directory
```

3. **Frontend Setup**
```bash
cd ../frontend

# Install dependencies
npm install

# Install additional dependencies
npm install gsap @gsap/react lucide-react
```

### Running the Application

1. **Start the Backend** (Terminal 1)
```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
python main.py
```
Backend runs on `http://localhost:8000`

2. **Start the Frontend** (Terminal 2)
```bash
cd frontend
npm run dev
```
Frontend runs on `http://localhost:3000`

3. **Open your browser**
```
http://localhost:3000
```

## 🎮 How to Play

### Spider-Sense Mode
1. Click "Spider-Sense" from the main menu
2. Allow camera permissions
3. Try throwing a punch at the camera - watch the threat ring react!
4. The system detects approaching objects and displays threat levels

### Game Mode
1. Click "Game" from the main menu
2. Allow camera permissions when prompted
3. Use hand gestures to control Spider-Man:
   - **Move Left**: Extend left hand to the left side
   - **Move Right**: Extend right hand to the right side
   - **Jump**: Raise both hands up
   - **Shoot Web**: Close your hand into a fist
   - **Web Swing Left**: Right hand up + left hand extended
   - **Web Swing Right**: Left hand up + right hand extended
4. Keyboard controls also work: `A/D` = Move, `W` = Jump, `Space` = Shoot

### Game Tips
- Defeat 5 enemies to trigger a boss battle
- Bosses have scaled health and damage based on level
- Enemies will chase you - use tactical positioning
- You can move backward through levels
- Collect web ammo from defeated enemies

## 🏗️ Tech Stack

### Backend
- **FastAPI**: High-performance async web framework
- **OpenCV**: Computer vision and image processing
- **YOLOv8**: State-of-the-art object detection
- **WebSockets**: Real-time bidirectional communication
- **NumPy**: Numerical computing for tracking algorithms

### Frontend
- **Next.js 15**: React framework with App Router
- **TypeScript**: Type-safe development
- **MediaPipe Hands**: Hand landmark detection for gestures
- **GSAP**: High-performance animations
- **Zustand**: Lightweight state management
- **Tailwind CSS**: Utility-first styling

### Computer Vision Pipeline
```
Webcam → MediaPipe/YOLOv8 → Object Tracker → Threat Engine → WebSocket → Frontend
```

## 📁 Project Structure

```
SpiderSense/
├── backend/
│   ├── main.py                 # FastAPI entry point
│   ├── api.py                  # REST API endpoints
│   ├── websocket_handler.py    # WebSocket frame processing
│   ├── threat_engine.py        # Threat scoring algorithm
│   ├── object_detector.py      # YOLOv8 detection wrapper
│   ├── object_tracker.py       # Custom tracking algorithm
│   ├── motion_analyzer.py      # Motion signal extraction
│   ├── calibration.py          # Baseline calibration
│   ├── session_store.py        # Session management
│   ├── models.py               # Pydantic data models
│   └── yolov8n.pt             # YOLOv8 nano model
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx        # Main landing page
│   │   │   ├── game/
│   │   │   │   └── page.tsx    # Gesture-controlled game
│   │   │   └── layout.tsx      # Root layout
│   │   ├── components/
│   │   │   ├── ThreatRing.tsx  # Visual threat indicator
│   │   │   ├── HUDRoot.tsx     # Spider-Sense HUD
│   │   │   └── ui/             # Reusable UI components
│   │   ├── lib/
│   │   │   └── wsClient.ts     # WebSocket client
│   │   └── store/
│   │       └── useSpiderSenseStore.ts  # Global state
│   └── public/
│       └── game/               # Game assets (images, audio, CSS)
├── docker-compose.yml          # Docker orchestration
└── README.md
```

## 🧠 How It Works

### Threat Detection Algorithm

The threat engine uses a weighted scoring system:

```python
threat_score = (
    0.15 * motion_intensity +      # Overall motion in frame
    0.15 * motion_suddenness +     # Rapid changes
    0.25 * approach_velocity +     # Objects moving toward camera
    0.15 * center_proximity +      # Distance from center
    0.15 * bbox_growth +           # Object getting larger
    0.05 * new_entity +            # New objects appearing
    0.02 * multi_zone +            # Multiple motion zones
    0.08 * fist_threat             # Fist/hand detection
)
```

**Key Features:**
- Exponential smoothing for stable scores
- Hysteresis state machine prevents flickering
- Only reacts to threatening object classes
- Prioritizes fist detection and approach velocity

### Gesture Recognition

MediaPipe Hands provides 21 3D hand landmarks per hand. The system analyzes:
- **Hand position**: Left/right side of frame for movement
- **Hand height**: Both hands raised for jumping
- **Finger closure**: Fist detection for shooting
- **Combined gestures**: Web-swinging with specific hand combinations

## 🐳 Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up --build

# Access the application
# Frontend: http://localhost:3000
# Backend: http://localhost:8000
```

## 🎨 Customization

### Adjust Threat Sensitivity
Edit `backend/models.py`:
```python
class Settings:
    sensitivity: str = "medium"  # low, medium, high
    smoothing_alpha: float = 0.3  # 0.0-1.0 (higher = more responsive)
    hysteresis_frames: int = 3    # Frames before level change
```

### Modify Game Difficulty
Edit `frontend/public/game/spiderman-game.js`:
```javascript
// Boss health scaling
this.maxHealth = 20 + (this.level * 10);

// Enemy chase speed
var chaseSpeed = 1.5 * this.game.physicsCoefficient();

// Enemy shoot frequency
if (this.frame % 60 === 0) { this.shoot(); }
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Spider-Man game assets and concept
- YOLOv8 by Ultralytics
- MediaPipe by Google
- Next.js and React teams
- FastAPI framework

## 📧 Contact

Princewill Okube - [@Princewill-o](https://github.com/Princewill-o)

Project Link: [https://github.com/Princewill-o/SpiderSense](https://github.com/Princewill-o/SpiderSense)

---

⭐ Star this repo if you found it interesting!

🕷️ With great power comes great responsibility.
