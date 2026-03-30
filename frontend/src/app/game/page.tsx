"use client";

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import { RippleButton } from '@/components/ui/multi-type-ripple-buttons';

export default function GamePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [gesture, setGesture] = useState<string>("Waiting for hands...");
  const [showInstructions, setShowInstructions] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const activeKeysRef = useRef<Set<string>>(new Set());
  const handsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Override body styles for full-screen game
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.background = '#000000 url(/game/BG.png) center/cover no-repeat fixed';
    document.body.className = '';

    return () => {
      // Cleanup
      document.body.style.background = '';
      document.body.style.overflow = '';
      document.body.className = 'min-h-screen';
      
      // Release all keys
      activeKeysRef.current.forEach(key => releaseKey(key));
      activeKeysRef.current.clear();
      
      // Stop camera
      if (cameraRef.current?.stop) {
        try { cameraRef.current.stop(); } catch (e) { console.error(e); }
      }
      
      // Stop video stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const pressKey = (key: string) => {
    if (!activeKeysRef.current.has(key)) {
      activeKeysRef.current.add(key);
      
      // Get keyCode for the key - now using WASD
      const keyCode = key === "a" || key === "A" ? 65 :
                      key === "d" || key === "D" ? 68 :
                      key === "w" || key === "W" ? 87 :
                      key === " " ? 32 : 0;
      
      // Create keyboard event with proper properties
      const eventInit: any = {
        key: key,
        code: key === "a" || key === "A" ? "KeyA" : 
              key === "d" || key === "D" ? "KeyD" :
              key === "w" || key === "W" ? "KeyW" :
              key === " " ? "Space" : key,
        keyCode: keyCode,
        which: keyCode,
        bubbles: true,
        cancelable: true,
        view: window
      };
      
      const event = new KeyboardEvent("keydown", eventInit);
      
      // Dispatch to multiple targets to ensure game receives it
      document.dispatchEvent(event);
      window.dispatchEvent(event);
      
      // Also dispatch to canvas if it exists
      const canvas = document.getElementById("game-canvas");
      if (canvas) {
        canvas.dispatchEvent(event);
      }
    }
  };

  const releaseKey = (key: string) => {
    if (activeKeysRef.current.has(key)) {
      activeKeysRef.current.delete(key);
      
      // Get keyCode for the key - now using WASD
      const keyCode = key === "a" || key === "A" ? 65 :
                      key === "d" || key === "D" ? 68 :
                      key === "w" || key === "W" ? 87 :
                      key === " " ? 32 : 0;
      
      // Create keyboard event with proper properties
      const eventInit: any = {
        key: key,
        code: key === "a" || key === "A" ? "KeyA" : 
              key === "d" || key === "D" ? "KeyD" :
              key === "w" || key === "W" ? "KeyW" :
              key === " " ? "Space" : key,
        keyCode: keyCode,
        which: keyCode,
        bubbles: true,
        cancelable: true,
        view: window
      };
      
      const event = new KeyboardEvent("keyup", eventInit);
      
      // Dispatch to multiple targets to ensure game receives it
      document.dispatchEvent(event);
      window.dispatchEvent(event);
      
      // Also dispatch to canvas if it exists
      const canvas = document.getElementById("game-canvas");
      if (canvas) {
        canvas.dispatchEvent(event);
      }
    }
  };

  const initializeCamera = async () => {
    try {
      setCameraError(null);
      
      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user" 
        } 
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Load MediaPipe Hands
      const loadScript = (src: string): Promise<void> => 
        new Promise((resolve, reject) => {
          if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
          }
          const script = document.createElement("script");
          script.src = src;
          script.crossOrigin = "anonymous";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error(`Failed to load ${src}`));
          document.head.appendChild(script);
        });

      await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js");
      await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js");

      const win = window as any;
      const HandsClass = win.Hands;
      const CameraClass = win.Camera;

      if (HandsClass && CameraClass && videoRef.current) {
        const hands = new HandsClass({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.5
        });

        hands.onResults((results: any) => {
          processGestures(results);
          drawHands(results);
        });

        const camera = new CameraClass(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current) {
              await hands.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480
        });

        camera.start();
        handsRef.current = hands;
        cameraRef.current = camera;
        setCameraReady(true);
        setGesture("Camera ready! Show your hands");
      }
    } catch (error: any) {
      console.error("Camera initialization failed:", error);
      setCameraError(error.message || "Failed to access camera");
      setGesture("Camera error - check permissions");
    }
  };

  const processGestures = (results: any) => {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      // No hands detected - release all keys (now using WASD)
      releaseKey("a");
      releaseKey("d");
      releaseKey("w");
      releaseKey(" ");
      setGesture("No hands detected - show your hands!");
      return;
    }

    const hands = results.multiHandLandmarks;
    const handedness = results.multiHandedness;

    let leftHand = null;
    let rightHand = null;

    // Identify left and right hands (camera is mirrored)
    for (let i = 0; i < hands.length; i++) {
      const label = handedness[i].label;
      if (label === "Right") leftHand = hands[i]; // Mirrored
      if (label === "Left") rightHand = hands[i]; // Mirrored
    }

    let detectedGesture = "";
    let moveLeft = false;
    let moveRight = false;
    let jump = false;
    let shoot = false;
    let webSwing = false;

    // Check for web-swinging gesture: One hand up high, other hand extended
    if (leftHand && rightHand) {
      const leftWrist = leftHand[0];
      const rightWrist = rightHand[0];
      const leftMiddle = leftHand[12];
      const rightMiddle = rightHand[12];
      
      // Web swing left: Right hand up, left hand extended left
      if (rightWrist.y < 0.3 && leftWrist.x < 0.4 && leftMiddle.y > leftWrist.y) {
        webSwing = true;
        moveLeft = true;
        jump = true;
        detectedGesture = "🕸️ WEB SWING LEFT!";
      }
      // Web swing right: Left hand up, right hand extended right
      else if (leftWrist.y < 0.3 && rightWrist.x > 0.6 && rightMiddle.y > rightWrist.y) {
        webSwing = true;
        moveRight = true;
        jump = true;
        detectedGesture = "🕸️ WEB SWING RIGHT!";
      }
      // Both hands raised (Jump) - only if not web swinging
      else if (leftWrist.y < 0.4 && rightWrist.y < 0.4) {
        jump = true;
        detectedGesture = "🙌 JUMP!";
      }
    }

    // Check for fist (Shoot) - second priority
    if (!jump && !webSwing) {
      if (leftHand && isHandClosed(leftHand)) {
        shoot = true;
        detectedGesture = "✊ SHOOT WEB (Left)";
      } else if (rightHand && isHandClosed(rightHand)) {
        shoot = true;
        detectedGesture = "✊ SHOOT WEB (Right)";
      }
    }

    // Check for movement (lowest priority, only if not jumping, shooting, or web swinging)
    if (!jump && !shoot && !webSwing) {
      const centerThreshold = 0.5;
      const movementThreshold = 0.2;

      if (leftHand) {
        const wrist = leftHand[0];
        // Left hand on left side of screen
        if (wrist.x < centerThreshold - movementThreshold) {
          moveLeft = true;
          detectedGesture = "✋ MOVE LEFT";
        }
      }

      if (rightHand) {
        const wrist = rightHand[0];
        // Right hand on right side of screen
        if (wrist.x > centerThreshold + movementThreshold) {
          moveRight = true;
          detectedGesture = "✋ MOVE RIGHT";
        }
      }

      // If both hands detected but no specific gesture
      if (!moveLeft && !moveRight && leftHand && rightHand) {
        detectedGesture = "✋ Hands detected - extend left/right to move";
      }
    }

    // Apply key presses/releases with logging - now using WASD
    if (moveLeft) {
      console.log("Pressing A (Move Left)");
      pressKey("a");
    } else {
      releaseKey("a");
    }

    if (moveRight) {
      console.log("Pressing D (Move Right)");
      pressKey("d");
    } else {
      releaseKey("d");
    }

    if (jump) {
      console.log("Pressing W (Jump)");
      pressKey("w");
    } else {
      releaseKey("w");
    }

    if (shoot) {
      console.log("Pressing Space (Shoot)");
      pressKey(" ");
    } else {
      releaseKey(" ");
    }

    setGesture(detectedGesture || "Hands detected");
  };

  const isHandClosed = (hand: any): boolean => {
    // Check if hand is in a fist by comparing finger tips to their bases
    const indexTip = hand[8];
    const middleTip = hand[12];
    const ringTip = hand[16];
    const pinkyTip = hand[20];
    
    const indexBase = hand[5];
    const middleBase = hand[9];
    const ringBase = hand[13];
    const pinkyBase = hand[17];

    // Fingers are closed if tips are close to or below their bases
    const indexClosed = indexTip.y >= indexBase.y - 0.02;
    const middleClosed = middleTip.y >= middleBase.y - 0.02;
    const ringClosed = ringTip.y >= ringBase.y - 0.02;
    const pinkyClosed = pinkyTip.y >= pinkyBase.y - 0.02;

    // At least 3 fingers must be closed for a fist
    const closedCount = [indexClosed, middleClosed, ringClosed, pinkyClosed].filter(Boolean).length;
    return closedCount >= 3;
  };

  const drawHands = (results: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks) {
      for (const landmarks of results.multiHandLandmarks) {
        // Draw connections
        ctx.strokeStyle = "#00ff00";
        ctx.lineWidth = 3;

        const connections = [
          [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
          [0, 5], [5, 6], [6, 7], [7, 8], // Index
          [0, 9], [9, 10], [10, 11], [11, 12], // Middle
          [0, 13], [13, 14], [14, 15], [15, 16], // Ring
          [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
          [5, 9], [9, 13], [13, 17] // Palm
        ];

        for (const [start, end] of connections) {
          const startPoint = landmarks[start];
          const endPoint = landmarks[end];
          
          ctx.beginPath();
          ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height);
          ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height);
          ctx.stroke();
        }

        // Draw landmarks
        ctx.fillStyle = "#ff0000";
        for (const landmark of landmarks) {
          ctx.beginPath();
          ctx.arc(
            landmark.x * canvas.width,
            landmark.y * canvas.height,
            6,
            0,
            2 * Math.PI
          );
          ctx.fill();
        }
      }
    }
  };

  const startGame = () => {
    const startButton = document.getElementById("start-button");
    if (startButton && (window as any).SpidermanGame) {
      const game = new (window as any).SpidermanGame({
        canvas: "#game-canvas"
      });
      
      game.load().then(() => {
        console.log("Game loaded successfully!");
      });
      const wrapper = startButton.parentElement;
      if (wrapper) wrapper.style.display = "none";
    }
  };

  return (
    <>
      <Script 
        src="/game/spiderman-game.js" 
        strategy="afterInteractive"
        onLoad={() => {
          setTimeout(startGame, 500);
        }}
      />
      <link rel="stylesheet" href="/game/css/spiderman-game.css" />
      
      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        #game-canvas {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) scale(1.5);
          z-index: 1;
          box-shadow: 0 0 60px rgba(230, 36, 41, 0.5);
        }

        .camera-overlay {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 100;
          border: 3px solid #c41e3a;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 0 30px rgba(196, 30, 58, 0.8);
          background: rgba(0, 0, 0, 0.9);
        }

        .camera-overlay video {
          display: block;
          transform: scaleX(-1);
        }

        .camera-overlay canvas {
          position: absolute;
          top: 0;
          left: 0;
          transform: scaleX(-1);
        }

        .gesture-display {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 100;
          background: rgba(0, 0, 0, 0.95);
          color: white;
          padding: 15px 20px;
          border-radius: 10px;
          border: 2px solid #c41e3a;
          font-family: 'Courier New', monospace;
          font-size: 14px;
          min-width: 300px;
          box-shadow: 0 0 30px rgba(196, 30, 58, 0.6);
        }

        .gesture-display h3 {
          color: #c41e3a;
          margin-bottom: 10px;
          font-size: 16px;
          text-shadow: 0 0 10px rgba(196, 30, 41, 0.8);
        }

        .gesture-status {
          color: #00ff00;
          font-weight: bold;
          margin-top: 8px;
          font-size: 16px;
          text-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
        }

        .camera-status {
          font-size: 12px;
          color: #888;
          margin-top: 5px;
        }

        .back-button {
          position: fixed;
          top: 20px;
          left: 20px;
          z-index: 100;
          padding: 12px 24px;
          background: rgba(196, 30, 58, 0.95);
          color: white;
          border: 2px solid #c41e3a;
          border-radius: 8px;
          font-family: 'Courier New', monospace;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
          transition: all 0.3s;
          box-shadow: 0 0 20px rgba(196, 30, 58, 0.6);
        }

        .back-button:hover {
          background: rgba(0, 102, 204, 0.95);
          border-color: #0066cc;
          transform: scale(1.05);
          box-shadow: 0 0 30px rgba(0, 102, 204, 0.8);
        }

        .instructions-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.98);
          z-index: 200;
          display: flex;
          align-items: center;
          justify-center;
          color: white;
          font-family: 'Courier New', monospace;
        }

        .instructions-content {
          max-width: 700px;
          padding: 50px;
          background: rgba(10, 10, 26, 0.98);
          border: 3px solid #c41e3a;
          border-radius: 20px;
          box-shadow: 0 0 60px rgba(196, 30, 58, 0.8);
        }

        .instructions-content h2 {
          color: #c41e3a;
          font-size: 32px;
          margin-bottom: 30px;
          text-align: center;
          text-shadow: 0 0 20px rgba(196, 30, 41, 1);
        }

        .gesture-list {
          margin: 30px 0;
          line-height: 2;
        }

        .gesture-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px;
          background: rgba(196, 30, 58, 0.15);
          margin: 8px 0;
          border-radius: 8px;
          border: 1px solid rgba(196, 30, 58, 0.3);
          transition: all 0.3s;
        }

        .gesture-item:hover {
          background: rgba(196, 30, 58, 0.25);
          transform: translateX(5px);
        }

        .gesture-item .gesture {
          color: #00ff00;
          font-weight: bold;
          font-size: 16px;
        }

        .gesture-item .action {
          color: #0066cc;
          font-weight: bold;
          font-size: 16px;
        }

        .start-btn {
          width: 100%;
          padding: 18px;
          margin-top: 30px;
          background: linear-gradient(90deg, #c41e3a 0%, #0066cc 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 20px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 0 30px rgba(196, 30, 58, 0.6);
        }

        .start-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 0 40px rgba(196, 30, 58, 1);
        }

        .start-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        #start-wrapper {
          display: none;
        }

        .error-message {
          color: #ff4444;
          margin-top: 10px;
          font-size: 14px;
        }
      `}</style>

      <Link href="/" className="back-button">
        ← BACK
      </Link>

      {showInstructions && (
        <div className="instructions-overlay">
          <div className="instructions-content">
            <h2>🕷️ SPIDER-MAN GESTURE CONTROLS</h2>
            
            <div className="gesture-list">
              <div className="gesture-item">
                <span className="gesture">✋ Left hand extended left</span>
                <span className="action">Move Left (A)</span>
              </div>
              <div className="gesture-item">
                <span className="gesture">✋ Right hand extended right</span>
                <span className="action">Move Right (D)</span>
              </div>
              <div className="gesture-item">
                <span className="gesture">🙌 Both hands raised up</span>
                <span className="action">Jump (W)</span>
              </div>
              <div className="gesture-item">
                <span className="gesture">🕸️ Right hand up + Left extended</span>
                <span className="action">Web Swing Left</span>
              </div>
              <div className="gesture-item">
                <span className="gesture">🕸️ Left hand up + Right extended</span>
                <span className="action">Web Swing Right</span>
              </div>
              <div className="gesture-item">
                <span className="gesture">✊ Closed fist (either hand)</span>
                <span className="action">Shoot Web (Space)</span>
              </div>
              <div className="gesture-item">
                <span className="gesture">⌨️ Keyboard Controls</span>
                <span className="action">A/D = Move, W = Jump, Space = Shoot</span>
              </div>
            </div>

            <RippleButton 
              variant="hoverborder"
              hoverBorderEffectColor="#c41e3a"
              hoverBorderEffectThickness="3px"
              className="w-full"
              onClick={() => {
                initializeCamera();
                setShowInstructions(false);
              }}
            >
              <span style={{ 
                padding: '18px',
                marginTop: '30px',
                background: 'linear-gradient(90deg, #c41e3a 0%, #0066cc 100%)',
                color: 'white',
                fontSize: '20px',
                fontWeight: 'bold',
                display: 'block'
              }}>
                🎮 START GAME WITH CAMERA
              </span>
            </RippleButton>

            <RippleButton 
              variant="hover"
              hoverBaseColor="#0066cc"
              className="w-full"
              onClick={() => {
                setShowInstructions(false);
              }}
            >
              <span style={{ 
                padding: '18px',
                marginTop: '10px',
                background: 'linear-gradient(90deg, #0066cc 0%, #c41e3a 100%)',
                color: 'white',
                fontSize: '20px',
                fontWeight: 'bold',
                display: 'block'
              }}>
                ⌨️ START WITH KEYBOARD (TEST MODE)
              </span>
            </RippleButton>

            {cameraError && (
              <p className="error-message">
                ⚠️ {cameraError}
              </p>
            )}

            <p style={{ textAlign: 'center', marginTop: '15px', fontSize: '12px', color: '#888' }}>
              Camera permission required. All processing is local.
            </p>
          </div>
        </div>
      )}

      <div className="gesture-display">
        <h3>🎮 GESTURE CONTROL</h3>
        <div className="camera-status">
          Camera: {cameraReady ? "✅ Active" : "⏳ Initializing..."}
        </div>
        <div className="gesture-status">
          {gesture}
        </div>
        <div style={{ marginTop: '10px', fontSize: '12px', color: '#888' }}>
          Active Keys: {Array.from(activeKeysRef.current).join(', ') || 'None'}
        </div>
        {!cameraReady && (
          <button 
            onClick={initializeCamera}
            style={{
              marginTop: '10px',
              padding: '8px 16px',
              background: '#c41e3a',
              border: 'none',
              borderRadius: '5px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Start Camera
          </button>
        )}
      </div>

      <div className="camera-overlay">
        <video 
          ref={videoRef}
          width="320" 
          height="240"
          style={{ display: 'block' }}
          playsInline
          muted
        />
        <canvas 
          ref={canvasRef}
          width="320"
          height="240"
        />
      </div>

      <div id="start-wrapper">
        <button id="start-button">
          <span>Start</span>
        </button>
      </div>

      <canvas id="game-canvas" height="400" width="711"></canvas>
    </>
  );
}
