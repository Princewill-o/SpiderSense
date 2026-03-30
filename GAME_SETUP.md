# Spider-Man Game Setup

## What Was Done

1. ✅ Removed the web-swinging game from `frontend/public/spiderman`
2. ✅ Updated the classic Spider-Man game with Spider-Man colors (red #c41e3a and blue #0066cc)
3. ✅ Copied the game to `frontend/public/game/`
4. ✅ Created a new `/game` route that loads the classic game
5. ✅ Updated all navigation links to point to the new game

## File Structure

```
frontend/
├── public/
│   └── game/
│       ├── index.html
│       ├── spiderman-game.js
│       ├── css/
│       ├── images/
│       ├── audio/
│       └── fonts/
├── src/
│   └── app/
│       └── game/
│           ├── page.tsx (Game component)
│           └── layout.tsx (Custom layout)
└── game/ (original source)
```

## How to Run

1. **Start the Next.js development server:**
   ```bash
   cd frontend
   npm run dev
   ```

2. **Open your browser:**
   - Main app: http://localhost:3000
   - Game directly: http://localhost:3000/game

3. **If you see a 404 error:**
   - Make sure the dev server is running
   - Try stopping and restarting: `Ctrl+C` then `npm run dev`
   - Clear browser cache and refresh

## Game Controls

- **Arrow Keys (←/→)**: Move left/right
- **Arrow Up (↑)**: Jump
- **Spacebar**: Shoot webs
- **Esc**: Pause game

## Features

- Classic side-scrolling platformer gameplay
- Spider-Man themed with red and blue colors
- Enemy battles and score tracking
- Multiple audio tracks
- Retro pixel art style

## Troubleshooting

If the game doesn't load:
1. Check browser console for errors (F12)
2. Verify files exist in `frontend/public/game/`
3. Ensure dev server is running on port 3000
4. Try accessing the game directly at `/game/index.html`
