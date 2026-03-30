# ⚡ Quick Start Guide

Get SpiderSense running in 5 minutes!

## 🚀 Fastest Setup (Automated)

```bash
# Clone and setup
git clone https://github.com/Princewill-o/SpiderSense.git
cd SpiderSense
chmod +x setup.sh
./setup.sh
```

## 🎮 Run the App

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate
python main.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

**Open Browser:**
```
http://localhost:3000
```

## ✅ Verify It's Working

1. You should see the Spider-Man landing page
2. Click "Spider-Sense" → Allow camera access
3. Wave your hand → Should see hand detection
4. Throw a punch → Threat ring should pulse red

## 🎯 Quick Test

### Test Threat Detection
1. Click "Spider-Sense"
2. Move hand slowly toward camera
3. Watch threat score increase
4. Throw punch → "THREAT DETECTED" appears

### Test Game Controls
1. Click "Game"
2. Try each gesture:
   - ✋ Left hand left → Move left
   - ✋ Right hand right → Move right
   - 🙌 Both hands up → Jump
   - ✊ Close fist → Shoot web

## 🐛 Troubleshooting

### Camera Not Working
```bash
# Check camera permissions in browser settings
# Chrome: Settings → Privacy → Camera
# Safari: Preferences → Websites → Camera
```

### Backend Won't Start
```bash
# Install missing dependencies
cd backend
pip install fastapi uvicorn opencv-python numpy ultralytics websockets
```

### Frontend Won't Start
```bash
# Clear cache and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Port Already in Use
```bash
# Backend (8000)
lsof -ti:8000 | xargs kill -9

# Frontend (3000)
lsof -ti:3000 | xargs kill -9
```

## 📦 Dependencies

**Backend:**
- Python 3.11+
- FastAPI, OpenCV, YOLOv8

**Frontend:**
- Node.js 18+
- Next.js 15, MediaPipe

## 🎉 You're Ready!

Now you can:
- ✅ Detect threats with your webcam
- ✅ Play Spider-Man with hand gestures
- ✅ Customize the code
- ✅ Deploy to production

Need help? Open an issue on GitHub!
