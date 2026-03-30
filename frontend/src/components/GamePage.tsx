"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { MovieCountdown } from "./MovieCountdown";

interface Anchor { x: number; y: number; r: number; }
interface Obstacle { x: number; y: number; w: number; h: number; type: "spike" | "wall"; }
interface Coin { x: number; y: number; r: number; collected: boolean; }
interface Level {
  name: string; bg: string;
  anchors: Anchor[]; obstacles: Obstacle[]; coins: Coin[];
  finish: { x: number; y: number; r: number };
  startX: number; startY: number; width: number;
}

const GROUND_Y = 460;
const CEILING_Y = 20;
const GRAVITY = 0.5;

const BG: Record<string, string> = {
  manhattan: "/sprites/SNES - Spider-Man and Venom_ Maximum Carnage - Backgrounds - Manhattan Rooftop.gif",
  park: "/sprites/SNES - Spider-Man and Venom_ Maximum Carnage - Backgrounds - Central Park.gif",
  alley: "/sprites/SNES - Spider-Man and Venom_ Maximum Carnage - Backgrounds - Alleyway.gif",
  hall: "/sprites/SNES - Spider-Man and Venom_ Maximum Carnage - Backgrounds - The Hall.gif",
  lab: "/sprites/SNES - Spider-Man and Venom_ Maximum Carnage - Backgrounds - Fantastic 4 Lab.gif",
};

function makeLevel(name: string, bg: string, aCnt: number, oCnt: number, width: number, sy: number): Level {
  const anchors: Anchor[] = [];
  const obstacles: Obstacle[] = [];
  const coins: Coin[] = [];
  const as = width / (aCnt + 1);
  for (let i = 0; i < aCnt; i++) anchors.push({ x: as * (i + 1), y: 50 + Math.sin(i * 1.3) * 30, r: 14 });
  const os = width / (oCnt + 1);
  for (let i = 0; i < oCnt; i++) {
    const ox = os * (i + 1);
    if (i % 2 === 0) obstacles.push({ x: ox - 40, y: GROUND_Y - 30, w: 80, h: 30, type: "spike" });
    else obstacles.push({ x: ox - 10, y: GROUND_Y - 160, w: 20, h: 160, type: "wall" });
  }
  for (let i = 0; i < 8; i++) coins.push({ x: (width / 9) * (i + 1), y: 160 + Math.sin(i * 0.8) * 40, r: 10, collected: false });
  return { name, bg, anchors, obstacles, coins, finish: { x: width - 100, y: sy - 60, r: 35 }, startX: 80, startY: sy, width };
}

const LEVELS: Level[] = [
  makeLevel("NEW YORK — LEVEL 1", "manhattan", 13, 6, 3000, 400),
  makeLevel("CENTRAL PARK — LEVEL 2", "park", 17, 9, 3500, 380),
  makeLevel("ALLEYWAY — LEVEL 3", "alley", 21, 12, 4000, 360),
  makeLevel("THE HALL — LEVEL 4", "hall", 25, 15, 4500, 340),
  makeLevel("FANTASTIC 4 LAB — LEVEL 5", "lab", 30, 18, 5000, 320),
];

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const camCanvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const mountedRef = useRef(true);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRef = useRef<{ stop?: () => void } | null>(null);

  // Sprite rows
  const spRowRef = useRef<(HTMLImageElement | null)[]>(Array(8).fill(null));
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const bgLoadedRef = useRef(false);

  // Game state
  const posRef = useRef<V2>({ x: 80, y: 400 });
  const velRef = useRef<V2>({ x: 3, y: 0 });
  const anchorRef = useRef<V2 | null>(null);
  const ropeLenRef = useRef(0);
  const levelRef = useRef(0);
  const levelDataRef = useRef<Level>(LEVELS[0]);
  const scrollRef = useRef(0);
  const scoreRef = useRef(0);
  const coinsRef = useRef<Coin[]>([...LEVELS[0].coins.map(c => ({ ...c }))]);
  const deadRef = useRef(false);
  const deadTimerRef = useRef(0);
  const winRef = useRef(false);
  const winTimerRef = useRef(0);
  const frameRef = useRef(0);
  const spFrameRef = useRef(0);
  const spFtRef = useRef(0);

  // Hand gesture
  const gestureRef = useRef({ detected: false, isFist: false, isPointing: false, x: 0.5, y: 0.5 });

  const [uiScore, setUiScore] = useState(0);
  const [uiLevel, setUiLevel] = useState("NEW YORK — LEVEL 1");
  const [uiCoins, setUiCoins] = useState(0);
  const [handLabel, setHandLabel] = useState("NO HAND — MOUSE: HOLD=SWING");
  const [ready, setReady] = useState(false);
  const [lives, setLives] = useState(3);
  const livesRef = useRef(3);

  const resetLevel = useCallback((idx: number) => {
    const lv = LEVELS[idx % LEVELS.length];
    levelDataRef.current = lv;
    coinsRef.current = lv.coins.map(c => ({ ...c }));
    posRef.current = { x: lv.startX, y: lv.startY };
    velRef.current = { x: 3, y: 0 };
    anchorRef.current = null;
    scrollRef.current = 0;
    deadRef.current = false;
    deadTimerRef.current = 0;
    winRef.current = false;
    winTimerRef.current = 0;
    setUiLevel(lv.name);
    bgLoadedRef.current = false;
    const img = new window.Image();
    img.src = BG[lv.bg] || BG.manhattan;
    img.onload = () => { bgImgRef.current = img; bgLoadedRef.current = true; };
  }, []);

  // Find nearest anchor above player within reach
  const findAnchor = useCallback((W: number): V2 | null => {
    const pos = posRef.current;
    const sc = scrollRef.current;
    let best: V2 | null = null;
    let bestD = 320;
    for (const a of levelDataRef.current.anchors) {
      const ax = a.x - sc;
      if (ax < -20 || ax > W + 20) continue;
      if (a.y >= pos.y) continue; // must be above
      const d = Math.hypot(ax - pos.x, a.y - pos.y);
      if (d < bestD) { bestD = d; best = { x: a.x, y: a.y }; }
    }
    return best;
  }, []);

  const drawBg = useCallback((ctx: CanvasRenderingContext2D, W: number, H: number) => {
    if (bgImgRef.current && bgLoadedRef.current) {
      const bg = bgImgRef.current;
      const scale = H / bg.naturalHeight;
      const bw = bg.naturalWidth * scale;
      const ox = -(scrollRef.current * 0.12) % bw;
      ctx.drawImage(bg, ox, 0, bw, H);
      if (ox + bw < W) ctx.drawImage(bg, ox + bw, 0, bw, H);
      if (ox + bw * 2 < W) ctx.drawImage(bg, ox + bw * 2, 0, bw, H);
      ctx.fillStyle = "rgba(0,0,8,0.32)"; ctx.fillRect(0, 0, W, H);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#04041a"); g.addColorStop(1, "#0a0a2e");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const W = canvas.width; const H = canvas.height;
    const pos = posRef.current;
    const sc = scrollRef.current;
    const lv = levelDataRef.current;

    drawBg(ctx, W, H);

    // Ground
    ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.strokeStyle = "#e62429"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(W, GROUND_Y); ctx.stroke();

    // Ceiling
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(0, 0, W, CEILING_Y);
    ctx.strokeStyle = "#1a3a8f"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, CEILING_Y); ctx.lineTo(W, CEILING_Y); ctx.stroke();

    // Obstacles
    lv.obstacles.forEach(o => {
      const ox = o.x - sc;
      if (ox > W + 50 || ox + o.w < -50) return;
      if (o.type === "spike") {
        ctx.fillStyle = "#8b0000";
        const count = Math.floor(o.w / 15);
        for (let i = 0; i < count; i++) {
          ctx.beginPath();
          ctx.moveTo(ox + i * 15, o.y + o.h);
          ctx.lineTo(ox + i * 15 + 7.5, o.y);
          ctx.lineTo(ox + i * 15 + 15, o.y + o.h);
          ctx.fill();
        }
        ctx.strokeStyle = "#ff2222"; ctx.lineWidth = 1;
        ctx.strokeRect(ox, o.y, o.w, o.h);
      } else {
        ctx.fillStyle = "#1a1a3e"; ctx.fillRect(ox, o.y, o.w, o.h);
        ctx.strokeStyle = "#e62429"; ctx.lineWidth = 2; ctx.strokeRect(ox, o.y, o.w, o.h);
      }
    });

    // Coins
    coinsRef.current.forEach(c => {
      if (c.collected) return;
      const cx = c.x - sc;
      if (cx < -20 || cx > W + 20) return;
      ctx.fillStyle = "#ffd700";
      ctx.beginPath(); ctx.arc(cx, c.y, c.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#ffaa00"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = "bold 8px monospace"; ctx.textAlign = "center";
      ctx.fillText("W", cx, c.y + 3); ctx.textAlign = "left";
    });

    // Anchors
    lv.anchors.forEach(a => {
      const ax = a.x - sc;
      if (ax < -20 || ax > W + 20) return;
      const isActive = anchorRef.current && Math.abs(anchorRef.current.x - a.x) < 1;
      ctx.strokeStyle = isActive ? "#e62429" : "#4488ff";
      ctx.lineWidth = isActive ? 3 : 2;
      ctx.beginPath(); ctx.arc(ax, a.y, a.r, 0, Math.PI * 2); ctx.stroke();
      if (isActive) { ctx.fillStyle = "rgba(230,36,41,0.25)"; ctx.fill(); }
      ctx.fillStyle = isActive ? "#e62429" : "#88aaff";
      ctx.beginPath(); ctx.arc(ax, a.y, 5, 0, Math.PI * 2); ctx.fill();
      // Ceiling mount line
      ctx.strokeStyle = isActive ? "#e62429" : "#2244aa"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ax, CEILING_Y); ctx.lineTo(ax, a.y - a.r); ctx.stroke();
    });

    // Finish portal
    const fx = lv.finish.x - sc;
    if (fx > -50 && fx < W + 50) {
      const pulse = 0.8 + Math.sin(frameRef.current * 0.08) * 0.2;
      ctx.strokeStyle = "#e62429"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(fx, lv.finish.y, lv.finish.r * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(230,36,41,${0.15 * pulse})`;
      ctx.beginPath(); ctx.arc(fx, lv.finish.y, lv.finish.r * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#e62429"; ctx.font = "bold 10px monospace"; ctx.textAlign = "center";
      ctx.fillText("FINISH", fx, lv.finish.y + 4); ctx.textAlign = "left";
    }

    // Web rope
    const anch = anchorRef.current;
    if (anch) {
      const ax = anch.x - sc;
      // Web strand
      ctx.strokeStyle = "#c8a96e"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(pos.x, pos.y); ctx.lineTo(ax, anch.y); ctx.stroke();
      ctx.strokeStyle = "rgba(200,169,110,0.3)"; ctx.lineWidth = 1;
      for (let t = 0.25; t < 0.85; t += 0.25) {
        const wx = pos.x + (ax - pos.x) * t + Math.sin(t * Math.PI) * 4;
        const wy = pos.y + (anch.y - pos.y) * t;
        ctx.beginPath(); ctx.arc(wx, wy, 2, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // Spider-Man character
    const spRow = anch ? 2 : (Math.abs(velRef.current.x) > 2 ? 1 : 0);
    const spImg = spRowRef.current[spRow];
    const sf = spFrameRef.current;
    const flip = velRef.current.x < -0.5;
    if (spImg) {
      ctx.save();
      if (flip) { ctx.translate(pos.x + 28, 0); ctx.scale(-1, 1); ctx.drawImage(spImg, sf * 240, 0, 240, 248, -28, pos.y - 44, 56, 70); }
      else ctx.drawImage(spImg, sf * 240, 0, 240, 248, pos.x - 28, pos.y - 44, 56, 70);
      ctx.restore();
    } else {
      // Fallback stickman spider
      ctx.fillStyle = "#e62429"; ctx.beginPath(); ctx.arc(pos.x, pos.y - 20, 10, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#1a3a8f"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pos.x, pos.y - 10); ctx.lineTo(pos.x, pos.y + 15); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pos.x - 15, pos.y); ctx.lineTo(pos.x + 15, pos.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pos.x, pos.y + 15); ctx.lineTo(pos.x - 12, pos.y + 30); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pos.x, pos.y + 15); ctx.lineTo(pos.x + 12, pos.y + 30); ctx.stroke();
    }

    // Hand cursor
    const g = gestureRef.current;
    if (g.detected) {
      const hx = g.x * W; const hy = g.y * H;
      if (g.isPointing) {
        ctx.strokeStyle = "#ffff00"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(hx - 14, hy); ctx.lineTo(hx + 14, hy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(hx, hy - 14); ctx.lineTo(hx, hy + 14); ctx.stroke();
        ctx.fillStyle = "#ffff00"; ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2); ctx.fill();
      } else {
        const col = g.isFist ? "#e62429" : "#4488ff";
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(hx, hy, 26, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = col; ctx.font = "20px monospace";
        ctx.fillText(g.isFist ? "✊" : "✋", hx - 10, hy + 8);
        // Show nearest anchor hint when fist but not attached
        if (g.isFist && !anch) {
          const near = findAnchor(W);
          if (near) {
            ctx.strokeStyle = "rgba(230,36,41,0.35)"; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
            ctx.beginPath(); ctx.moveTo(pos.x, pos.y); ctx.lineTo(near.x - sc, near.y); ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }
    }

    // Death overlay
    if (deadRef.current) {
      ctx.fillStyle = "rgba(180,0,0,0.55)"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff"; ctx.font = "bold 32px 'Courier New'"; ctx.textAlign = "center";
      ctx.fillText("SPIDER-SENSE FAILED!", W / 2, H / 2 - 20);
      ctx.font = "16px 'Courier New'"; ctx.fillText("Restarting...", W / 2, H / 2 + 20);
      ctx.textAlign = "left";
    }

    // Win overlay
    if (winRef.current) {
      ctx.fillStyle = "rgba(0,0,0,0.65)"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#e62429"; ctx.font = "bold 36px 'Courier New'"; ctx.textAlign = "center";
      ctx.fillText("CITY CLEARED! ��", W / 2, H / 2 - 30);
      ctx.fillStyle = "#c8a96e"; ctx.font = "18px 'Courier New'";
      ctx.fillText(`SCORE: ${scoreRef.current}`, W / 2, H / 2 + 20);
      ctx.fillText("Next city loading...", W / 2, H / 2 + 50);
      ctx.textAlign = "left";
    }

    // HUD
    ctx.fillStyle = "rgba(4,4,20,0.9)"; ctx.fillRect(0, 0, W, 44);
    ctx.strokeStyle = "#e62429"; ctx.lineWidth = 1; ctx.strokeRect(0, 0, W, 44);
    ctx.fillStyle = "#e62429"; ctx.font = "bold 12px 'Courier New'";
    ctx.fillText("🕷 SPIDER-SENSE AI", 10, 15);
    ctx.fillStyle = "#c8a96e"; ctx.font = "10px 'Courier New'";
    ctx.fillText(`${lv.name}  ·  SCORE: ${scoreRef.current}  ·  ❤ ${livesRef.current}`, 10, 32);
    ctx.fillStyle = g.detected ? (g.isFist ? "#e62429" : g.isPointing ? "#ffff00" : "#4488ff") : "#555";
    ctx.fillText(g.detected ? (g.isFist ? "✊ SWINGING" : g.isPointing ? "☝ POINTER" : "✋ OPEN — FLYING") : "MOUSE: HOLD=SWING", W - 240, 15);
    ctx.fillStyle = "#1a3a8f"; ctx.font = "8px 'Courier New'";
    ctx.fillText("FIST/HOLD=ATTACH WEB & SWING  OPEN/RELEASE=FLY  ONE FINGER=POINTER", W / 2 - 220, H - 6);

    // Movie promo
    ctx.fillStyle = "rgba(230,36,41,0.88)"; ctx.fillRect(0, H - 24, W, 18);
    ctx.fillStyle = "white"; ctx.font = "bold 8px 'Courier New'"; ctx.textAlign = "center";
    ctx.fillText("🎬 SPIDER-MAN: BRAND NEW DAY — OFFICIAL PROMO — IN CINEMAS JULY 31 2026", W / 2, H - 10);
    ctx.textAlign = "left";
  }, [drawBg, findAnchor]);


  const update = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const W = canvas.width; const H = canvas.height;
    const pos = posRef.current; const vel = velRef.current;
    const g = gestureRef.current;
    const lv = levelDataRef.current;
    frameRef.current++;

    // Animate sprite
    spFtRef.current++;
    if (spFtRef.current >= 5) { spFtRef.current = 0; spFrameRef.current = (spFrameRef.current + 1) % 8; }

    if (deadRef.current) {
      deadTimerRef.current++;
      if (deadTimerRef.current > 90) {
        livesRef.current = Math.max(0, livesRef.current - 1);
        setLives(livesRef.current);
        if (livesRef.current <= 0) { livesRef.current = 3; setLives(3); scoreRef.current = 0; setUiScore(0); }
        resetLevel(levelRef.current);
      }
      return;
    }

    if (winRef.current) {
      winTimerRef.current++;
      if (winTimerRef.current > 120) {
        levelRef.current++;
        resetLevel(levelRef.current);
      }
      return;
    }

    // Swing control: fist or mouse hold
    const wantSwing = g.detected ? g.isFist : false;

    if (wantSwing && !anchorRef.current) {
      const near = findAnchor(W);
      if (near) {
        anchorRef.current = { x: near.x, y: near.y };
        ropeLenRef.current = Math.max(60, Math.hypot(pos.x - (near.x - scrollRef.current), pos.y - near.y));
      }
    } else if (!wantSwing && anchorRef.current) {
      anchorRef.current = null;
    }

    // Physics
    vel.y += GRAVITY;

    if (anchorRef.current) {
      const anch = anchorRef.current;
      const ax = anch.x - scrollRef.current;
      const dx = pos.x - ax; const dy = pos.y - anch.y;
      const dist = Math.hypot(dx, dy);
      if (dist > ropeLenRef.current && dist > 0) {
        // Constraint: project velocity onto tangent
        const nx = dx / dist; const ny = dy / dist;
        const vDotN = vel.x * nx + vel.y * ny;
        if (vDotN > 0) { vel.x -= vDotN * nx * 0.95; vel.y -= vDotN * ny * 0.95; }
        pos.x = ax + nx * ropeLenRef.current;
        pos.y = anch.y + ny * ropeLenRef.current;
      }
    }

    pos.x += vel.x; pos.y += vel.y;
    vel.x *= 0.998;

    // Boundaries
    if (pos.y >= GROUND_Y - 5) { pos.y = GROUND_Y - 5; vel.y *= -0.2; vel.x *= 0.85; anchorRef.current = null; }
    if (pos.y <= CEILING_Y + 5) { pos.y = CEILING_Y + 5; vel.y = Math.abs(vel.y) * 0.3; }
    if (pos.x < 20) { pos.x = 20; vel.x = Math.abs(vel.x) * 0.5; }

    // Scroll
    if (pos.x > W * 0.45) {
      const d = pos.x - W * 0.45;
      pos.x = W * 0.45; scrollRef.current += d;
      scoreRef.current += Math.floor(d * 0.08);
      setUiScore(scoreRef.current);
    }

    // Obstacle collision
    for (const o of lv.obstacles) {
      const ox = o.x - scrollRef.current;
      if (pos.x > ox - 12 && pos.x < ox + o.w + 12 && pos.y > o.y - 12 && pos.y < o.y + o.h + 12) {
        deadRef.current = true; deadTimerRef.current = 0; anchorRef.current = null; return;
      }
    }

    // Coin collection
    coinsRef.current.forEach(c => {
      if (c.collected) return;
      const cx = c.x - scrollRef.current;
      if (Math.hypot(cx - pos.x, c.y - pos.y) < c.r + 14) {
        c.collected = true; scoreRef.current += 50; setUiScore(scoreRef.current);
        setUiCoins(prev => prev + 1);
      }
    });

    // Finish check
    const fx = lv.finish.x - scrollRef.current;
    if (Math.hypot(fx - pos.x, lv.finish.y - pos.y) < lv.finish.r + 14) {
      winRef.current = true; winTimerRef.current = 0;
      scoreRef.current += 500; setUiScore(scoreRef.current);
    }
  }, [findAnchor, resetLevel]);

  const gameLoop = useCallback(() => {
    if (!mountedRef.current) return;
    update(); draw();
    animRef.current = requestAnimationFrame(gameLoop);
  }, [update, draw]);

  useEffect(() => {
    mountedRef.current = true;
    resetLevel(0);

    for (let i = 0; i < 8; i++) {
      const img = new window.Image();
      img.src = `/sprites/sp-row-${i}.png`;
      img.onload = () => { spRowRef.current[i] = img; };
    }

    const setupCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" } });
        if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }

        const mirrorLoop = () => {
          if (!mountedRef.current) return;
          const cc = camCanvasRef.current; const v = videoRef.current;
          if (cc && v && v.readyState >= 2) {
            const c2 = cc.getContext("2d");
            if (c2) { c2.save(); c2.scale(-1, 1); c2.drawImage(v, -cc.width, 0, cc.width, cc.height); c2.restore(); }
          }
          requestAnimationFrame(mirrorLoop);
        };
        mirrorLoop();

        const loadScript = (src: string): Promise<void> => new Promise((res, rej) => {
          if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
          const s = document.createElement("script"); s.src = src; s.crossOrigin = "anonymous";
          s.onload = () => res(); s.onerror = () => rej(); document.head.appendChild(s);
        });

        try {
          await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js");
          await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js");
          if (!mountedRef.current) return;
          const win = window as unknown as Record<string, unknown>;
          const HandsClass = win["Hands"] as new (o: unknown) => unknown;
          const CameraClass = win["Camera"] as new (v: HTMLVideoElement, o: unknown) => { start: () => void; stop: () => void };
          if (HandsClass && CameraClass && videoRef.current) {
            const hands = new HandsClass({ locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` }) as {
              setOptions: (o: unknown) => void; onResults: (cb: (r: unknown) => void) => void; send: (o: unknown) => Promise<void>;
            };
            hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.65, minTrackingConfidence: 0.5 });
            hands.onResults((results: unknown) => {
              if (!mountedRef.current) return;
              const r = results as { multiHandLandmarks?: Array<Array<{ x: number; y: number }>> };
              if (r.multiHandLandmarks && r.multiHandLandmarks.length > 0) {
                const lm = r.multiHandLandmarks[0];
                const wrist = lm[0]; const index = lm[8]; const middle = lm[12]; const ring = lm[16]; const pinky = lm[20];
                const iBase = lm[5]; const mBase = lm[9]; const rBase = lm[13]; const pBase = lm[17];
                const isFist = index.y > iBase.y + 0.03 && middle.y > mBase.y + 0.03 && ring.y > rBase.y + 0.03 && pinky.y > pBase.y + 0.03;
                const isPointing = !isFist && index.y < iBase.y - 0.08 && middle.y > mBase.y && ring.y > rBase.y && pinky.y > pBase.y;
                gestureRef.current = { detected: true, isFist, isPointing, x: 1 - wrist.x, y: Math.min(0.95, wrist.y) };
                setHandLabel(isFist ? "✊ FIST — SWINGING" : isPointing ? "☝ POINTING — CURSOR" : "✋ OPEN — FLYING");
              } else {
                gestureRef.current = { ...gestureRef.current, detected: false, isFist: false, isPointing: false };
                setHandLabel("NO HAND DETECTED");
              }
            });
            const cam = new CameraClass(videoRef.current, {
              onFrame: async () => { if (videoRef.current && mountedRef.current) await hands.send({ image: videoRef.current }); },
              width: 320, height: 240,
            });
            cam.start(); cameraRef.current = cam;
          }
        } catch { /* CDN unavailable */ }
      } catch { /* no camera */ }
      if (mountedRef.current) setReady(true);
    };

    setupCamera();
    animRef.current = requestAnimationFrame(gameLoop);
    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(animRef.current);
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
      if (cameraRef.current?.stop) { try { cameraRef.current.stop(); } catch { /* ignore */ } cameraRef.current = null; }
    };
  }, [gameLoop, resetLevel]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current?.getBoundingClientRect(); if (!r) return;
    gestureRef.current = { ...gestureRef.current, x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, detected: true };
  }, []);
  const onMouseDown = useCallback(() => { gestureRef.current = { ...gestureRef.current, isFist: true, isPointing: false, detected: true }; }, []);
  const onMouseUp = useCallback(() => { gestureRef.current = { ...gestureRef.current, isFist: false }; }, []);
  const onCtxMenu = useCallback((e: React.MouseEvent) => e.preventDefault(), []);

  return (
    <div className="flex flex-col" style={{ height: "100vh", background: "#050510", overflow: "hidden" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b-2 flex-shrink-0"
        style={{ borderColor: "#e62429", background: "#0a0a1a" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs hud-text border px-2 py-1 hover:bg-red-950 focus:outline-none focus:ring-2 focus:ring-red-500"
            style={{ borderColor: "#e62429", color: "#e62429" }}>← BACK</Link>
          <span className="hud-text font-bold text-sm" style={{ color: "#e62429" }}>🕸 SPIDER-SENSE AI — WEB SWING</span>
          <span className="text-xs hud-text px-2 py-0.5 border" style={{ borderColor: "#e62429", color: "#e62429" }}>BRAND NEW DAY PROMO</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs hud-text" style={{ color: "#ffd700" }}>🪙 {uiCoins}</span>
          <span className="text-xs hud-text" style={{ color: "#c8a96e" }}>SCORE: {uiScore}</span>
          <span className="text-xs hud-text" style={{ color: "#e62429" }}>❤ {lives}</span>
          <span className="text-xs hud-text" style={{ color: gestureRef.current.detected ? "#e62429" : "#555" }}>{handLabel}</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Game canvas */}
        <div className="flex-1 relative">
          <canvas ref={canvasRef} width={900} height={520} className="w-full h-full block cursor-crosshair"
            onMouseMove={onMouseMove} onMouseDown={onMouseDown} onMouseUp={onMouseUp} onContextMenu={onCtxMenu}
            aria-label="Spider-Man web swing game" />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(5,5,16,0.92)" }}>
              <div className="text-center">
                <div className="text-5xl mb-3 animate-spin">🕷️</div>
                <p className="hud-text text-sm" style={{ color: "#e62429" }}>LOADING SPIDER-SENSE...</p>
              </div>
            </div>
          )}
        </div>

        {/* Camera panel */}
        <div className="w-44 flex flex-col border-l flex-shrink-0" style={{ borderColor: "#1a3a8f", background: "#050510" }}>
          <div className="px-2 py-1 border-b text-xs hud-text" style={{ borderColor: "#1a3a8f", color: "#e62429" }}>📷 HAND CAM</div>
          <div className="flex-1 flex items-center justify-center" style={{ background: "#000" }}>
            <canvas ref={camCanvasRef} width={176} height={132} className="w-full" />
            <video ref={videoRef} className="hidden" playsInline muted aria-hidden="true" />
          </div>
          <div className="p-2 border-t text-xs hud-text space-y-1" style={{ borderColor: "#1a3a8f", color: "#c8a96e" }}>
            <p className="font-bold" style={{ color: "#e62429" }}>CONTROLS:</p>
            <p>✊ FIST = SWING</p>
            <p>✋ OPEN = FLY</p>
            <p>☝ POINT = CURSOR</p>
            <p className="mt-2" style={{ color: "#555" }}>MOUSE:</p>
            <p style={{ color: "#555" }}>HOLD = SWING</p>
            <p style={{ color: "#555" }}>RELEASE = FLY</p>
          </div>
        </div>
      </div>

      <div className="py-1 flex-shrink-0" style={{ background: "rgba(230,36,41,0.9)" }}>
        <MovieCountdown compact />
      </div>
    </div>
  );
}
