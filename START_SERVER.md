# 🚀 How to Start the Server

## The 404 error is because the Next.js dev server isn't running.

### To fix this:

1. **Open a terminal**

2. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Wait for the server to start** - You should see:
   ```
   ▲ Next.js 14.x.x
   - Local:        http://localhost:3000
   - Ready in X.Xs
   ```

5. **Open your browser and go to:**
   - Main app: http://localhost:3000
   - Game: http://localhost:3000/game

## If you see errors:

### "Cannot find module" or dependency errors:
```bash
npm install
npm run dev
```

### Port 3000 already in use:
```bash
# Kill the process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
npm run dev -- -p 3001
```

## ✅ Once the server is running:

- The game page will be available at `/game`
- Camera gesture controls will work
- The BG.png background will display on all pages
- First villain is removed so you can test controls

## 🎮 Game Controls:

### Keyboard (Test Mode):
- Arrow Left/Right: Move
- Arrow Up: Jump
- Spacebar: Shoot

### Gesture Controls:
- ✋ Left hand extended left: Move Left
- ✋ Right hand extended right: Move Right
- 🙌 Both hands raised up: Jump
- ✊ Closed fist: Shoot Web

## 🐛 Debug Info:

The game page shows:
- Camera status
- Current gesture detected
- Active keys being pressed

This helps you see if gestures are working!
