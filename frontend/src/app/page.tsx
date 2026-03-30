"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSpiderSenseStore } from "@/store/useSpiderSenseStore";
import { HUDRoot } from "@/components/HUDRoot";
import { ReplayMode } from "@/components/ReplayMode";
import { SessionSummaryView } from "@/components/SessionSummaryView";
import { wsClient } from "@/lib/wsClient";
import Image from "next/image";
import { SessionSummary } from "@/types";
import { CircleMenu } from "@/components/ui/circle-menu";
import AnimatedNumberCountdown from "@/components/ui/countdown-number";
import ImageLoader from "@/components/ui/image-loading";
import CinematicHero from "@/components/ui/cinematic-landing-hero";
import { Gamepad2, Camera, Menu, X, Shield } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
type CameraError = "permission-denied" | "device-unavailable" | "unknown";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<CameraError | null>(null);
  const [privacyDismissed, setPrivacyDismissed] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [showReplay, setShowReplay] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [replaySessionId, setReplaySessionId] = useState<string | null>(null);
  const calibrationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { sessionState, sessionId, setSessionState, setSessionId, setSessionSummary: storeSetSummary, reset } = useSpiderSenseStore();

  const initializeSystem = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false });
      streamRef.current = stream;
      setStream(stream);
      // Don't set srcObject here — CameraViewport useEffect handles it
      try {
        const resp = await fetch(`${API_URL}/session/start`, { method: "POST" });
        if (resp.ok) { const data = await resp.json(); setSessionId(data.session_id); }
        else setSessionId("local-" + Date.now());
      } catch { setSessionId("local-" + Date.now()); }
      setSessionState("calibrating");
      wsClient.connect();
      let progress = 0;
      calibrationTimerRef.current = setInterval(() => {
        progress += 0.02;
        setCalibrationProgress(Math.min(1, progress));
        if (progress >= 1) {
          if (calibrationTimerRef.current) clearInterval(calibrationTimerRef.current);
          setSessionState("active");
          if (videoRef.current) wsClient.startCapture(videoRef.current, 15);
        }
      }, 100);
    } catch (err: unknown) {
      const e = err as { name?: string };
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") setCameraError("permission-denied");
      else if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") setCameraError("device-unavailable");
      else setCameraError("unknown");
    }
  }, [setSessionId, setSessionState]);

  const stopSystem = useCallback(async () => {
    wsClient.stopCapture(); wsClient.disconnect();
    if (calibrationTimerRef.current) clearInterval(calibrationTimerRef.current);
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; setStream(null); }
    try {
      const resp = await fetch(`${API_URL}/session/stop`, { method: "POST" });
      if (resp.ok) { const s: SessionSummary = await resp.json(); setSessionSummary(s); storeSetSummary(s); setShowSummary(true); }
    } catch { /* ignore */ }
    setSessionState("stopped");
  }, [setSessionState, storeSetSummary]);

  useEffect(() => {
    return () => {
      wsClient.disconnect();
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); setStream(null); }
      if (calibrationTimerRef.current) clearInterval(calibrationTimerRef.current);
    };
  }, []);

  // Privacy / splash
  if (!privacyDismissed) {
    return (
      <div className="min-h-screen relative overflow-y-auto">
        
        {/* Show loader for 5 seconds */}
        {showLoader && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
            <ImageLoader
              src="/sprites/Spiderman4.png"
              alt="Spider-Man: Brand New Day"
              width={700}
              height={393}
              gridSize={20}
              cellShape="circle"
              cellGap={2}
              cellColor="#c41e3a"
              blinkSpeed={1000}
              transitionDuration={800}
              fadeOutDuration={600}
              loadingDelay={5000}
              onLoad={() => {
                setTimeout(() => setShowLoader(false), 6000)
              }}
              className="max-w-2xl w-full"
            />
          </div>
        )}

        {/* Main content - shown after loader */}
        {!showLoader && (
          <>
            {/* Hero Section */}
            <div className="min-h-screen flex flex-col items-center justify-center relative">
              {/* Dark overlay for better readability */}
              <div className="absolute inset-0 bg-black/60" aria-hidden="true" />

              <div className="relative z-10 flex flex-col items-center gap-8 max-w-4xl w-full px-4">
                {/* Main logo */}
                <div className="relative">
                  <Image src="/sprites/Spiderman4.png" alt="Spider-Man: Brand New Day" width={700} height={393}
                    className="w-full max-w-2xl rounded-sm" 
                    style={{ filter: "drop-shadow(0 0 40px rgba(230,36,41,1))" }} 
                    priority />
                </div>

                {/* Large Countdown */}
                <div className="w-full flex flex-col items-center gap-4">
                  <Badge
                    variant="outline"
                    className="rounded-[14px] border-2 text-base px-4 py-2"
                    style={{
                      borderColor: "#c41e3a",
                      background: "rgba(196,30,58,0.1)",
                      color: "#c41e3a",
                      boxShadow: "0 0 20px rgba(196,30,58,0.3)"
                    }}
                  >
                    <Shield size={16} style={{ color: "#c41e3a" }} /> 
                    &nbsp;SPIDER-MAN: BRAND NEW DAY
                  </Badge>
                  
                  <AnimatedNumberCountdown
                    endDate={new Date("2026-07-31")}
                    className="scale-150 my-8"
                  />
                  
                  <p className="text-sm hud-text" style={{ color: "#c8a96e" }}>
                    IN CINEMAS JULY 31, 2026
                  </p>
                </div>

                {/* Circle Menu - Only 2 items */}
                <div className="my-8 p-8 rounded-full" style={{ background: 'rgba(0,0,0,0.9)', border: '2px solid #c41e3a', boxShadow: '0 0 40px rgba(196,30,58,0.4)' }}>
                  <CircleMenu
                    items={[
                      { 
                        label: 'Spider-Sense', 
                        icon: <Camera size={20} style={{ color: '#ffffff' }} />, 
                        href: '#',
                        onClick: () => setPrivacyDismissed(true)
                      },
                      { 
                        label: 'Game', 
                        icon: <Gamepad2 size={20} style={{ color: '#ffffff' }} />, 
                        href: '/game'
                      },
                    ]}
                    openIcon={<Menu size={20} style={{ color: 'white' }} />}
                    closeIcon={<X size={20} style={{ color: 'white' }} />}
                  />
                </div>

                <p className="text-xs hud-text text-center max-w-md" style={{ color: "#c8a96e" }}>
                  🔒 All video processed locally. No data leaves your device.
                </p>
              </div>
            </div>

            {/* Cinematic Hero Section */}
            <CinematicHero
              title="SPIDER-MAN: BRAND NEW DAY"
              subtitle="The Web-Slinger Returns"
              description="Peter Parker faces his greatest challenge yet as new threats emerge in New York City. With great power comes great responsibility, and this time, the stakes have never been higher."
              trailerUrl="https://www.youtube.com/watch?v=8TZMtslA3UY"
              releaseDate="JULY 31, 2026"
            />

            {/* Custom styles for Spider-Man theme */}
            <style jsx global>{`
              :root {
                --foreground: #000000;
                --background: #000000;
                --muted: #000000;
              }
              
              .bg-muted {
                background: #000000 !important; border: 2px solid #c41e3a;
                box-shadow: 0 0 20px rgba(196, 30, 58, 0.5);
              }
              
              .bg-muted:hover {
                background: #1a1a1a !important; border: 2px solid #0066cc;
                box-shadow: 0 0 30px rgba(0, 102, 204, 0.7);
              }
              
              .bg-foreground {
                background: #000000 !important; border: 2px solid #c41e3a;
                box-shadow: 0 0 30px rgba(196, 30, 58, 0.8);
              }
              
              .text-foreground {
                color: #ffffff !important;
                font-weight: bold;
                text-shadow: 0 0 10px rgba(196, 30, 58, 0.5);
              }

              /* Countdown styling - WHITE TEXT */
              .text-5xl {
                font-size: 4rem !important;
                color: #ffffff !important;
                text-shadow: 0 0 20px rgba(196, 30, 58, 0.8);
              }

              .text-gray-500 {
                color: #ffffff !important;
                font-weight: bold;
                text-transform: uppercase;
                letter-spacing: 0.1em;
              }

              .text-2xl {
                color: #ffffff !important;
              }
            `}</style>
          </>
        )}
      </div>
    );
  }

  if (cameraError) {
    return (
      <div className="min-h-screen spider-bg flex items-center justify-center p-4">
        <div className="border-2 p-8 max-w-md w-full" style={{ borderColor: "#e62429", background: "#0a0a1a" }} role="alert">
          <h1 className="text-lg hud-text font-bold mb-4 text-center" style={{ color: "#e62429" }}>⚠ SPIDER-SENSE DISRUPTED</h1>
          {cameraError === "permission-denied" && (
            <div className="text-sm space-y-2 mb-4" style={{ color: "#c8a96e" }}>
              <p className="font-bold" style={{ color: "#e62429" }}>Camera permission denied.</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Click the camera icon in your browser address bar</li>
                <li>Select "Allow" for camera access</li>
                <li>Refresh and try again</li>
              </ol>
            </div>
          )}
          {cameraError === "device-unavailable" && (
            <div className="text-sm space-y-2 mb-4" style={{ color: "#c8a96e" }}>
              <p className="font-bold" style={{ color: "#e62429" }}>No camera found.</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Ensure a webcam is connected</li>
                <li>Check no other app is using the camera</li>
                <li>Refresh the page</li>
              </ol>
            </div>
          )}
          {cameraError === "unknown" && <p className="text-sm mb-4" style={{ color: "#c8a96e" }}>Unexpected error. Please refresh.</p>}
          <button onClick={initializeSystem} className="w-full py-2 text-sm hud-text border-2 focus:outline-none focus:ring-2 focus:ring-red-500"
            style={{ borderColor: "#e62429", color: "#e62429" }} autoFocus>RETRY</button>
        </div>
      </div>
    );
  }

  if (sessionState === "idle") {
    return (
      <div className="min-h-screen relative overflow-y-auto">
        
        {/* Show loader for 5 seconds */}
        {showLoader && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
            <ImageLoader
              src="/sprites/Spiderman4.png"
              alt="Spider-Man: Brand New Day"
              width={700}
              height={393}
              gridSize={20}
              cellShape="circle"
              cellGap={2}
              cellColor="#c41e3a"
              blinkSpeed={1000}
              transitionDuration={800}
              fadeOutDuration={600}
              loadingDelay={5000}
              onLoad={() => {
                setTimeout(() => setShowLoader(false), 6000)
              }}
              className="max-w-2xl w-full"
            />
          </div>
        )}

        {/* Main content - shown after loader */}
        {!showLoader && (
          <>
            {/* Hero Section */}
            <div className="min-h-screen flex flex-col items-center justify-center relative">
              {/* Dark overlay for better readability */}
              <div className="absolute inset-0 bg-black/60" aria-hidden="true" />

              <div className="relative z-10 flex flex-col items-center gap-8 max-w-4xl w-full px-4">
                {/* Main logo */}
                <div className="relative">
                  <Image src="/sprites/Spiderman4.png" alt="Spider-Man: Brand New Day" width={700} height={393}
                    className="w-full max-w-2xl rounded-sm" 
                    style={{ filter: "drop-shadow(0 0 40px rgba(230,36,41,1))" }} />
                </div>

                {/* Large Countdown */}
                <div className="w-full flex flex-col items-center gap-4">
                  <Badge
                    variant="outline"
                    className="rounded-[14px] border-2 text-base px-4 py-2"
                    style={{
                      borderColor: "#c41e3a",
                      background: "rgba(196,30,58,0.1)",
                      color: "#c41e3a",
                      boxShadow: "0 0 20px rgba(196,30,58,0.3)"
                    }}
                  >
                    <Shield size={16} style={{ color: "#c41e3a" }} /> 
                    &nbsp;SPIDER-MAN: BRAND NEW DAY
                  </Badge>
                  
                  <AnimatedNumberCountdown
                    endDate={new Date("2026-07-31")}
                    className="scale-150 my-8"
                  />
                  
                  <p className="text-sm hud-text" style={{ color: "#c8a96e" }}>
                    IN CINEMAS JULY 31, 2026
                  </p>
                </div>

                {/* Circle Menu - Only 2 items */}
                <div className="my-8 p-8 rounded-full" style={{ background: 'rgba(0,0,0,0.9)', border: '2px solid #c41e3a', boxShadow: '0 0 40px rgba(196,30,58,0.4)' }}>
                  <CircleMenu
                    items={[
                      { 
                        label: 'Spider-Sense', 
                        icon: <Camera size={20} style={{ color: '#ffffff' }} />, 
                        href: '#',
                        onClick: () => initializeSystem()
                      },
                      { 
                        label: 'Game', 
                        icon: <Gamepad2 size={20} style={{ color: '#ffffff' }} />, 
                        href: '/game'
                      },
                    ]}
                    openIcon={<Menu size={20} style={{ color: 'white' }} />}
                    closeIcon={<X size={20} style={{ color: 'white' }} />}
                  />
                </div>

                <p className="text-xs hud-text text-center max-w-md" style={{ color: "#c8a96e" }}>
                  🔒 All video processed locally. No data leaves your device.
                </p>
              </div>
            </div>

            {/* Cinematic Hero Section */}
            <CinematicHero
              title="SPIDER-MAN: BRAND NEW DAY"
              subtitle="The Web-Slinger Returns"
              description="Peter Parker faces his greatest challenge yet as new threats emerge in New York City. With great power comes great responsibility, and this time, the stakes have never been higher."
              trailerUrl="https://www.youtube.com/watch?v=8TZMtslA3UY"
              releaseDate="JULY 31, 2026"
            />

            {/* Custom styles for Spider-Man theme */}
            <style jsx global>{`
              :root {
                --foreground: #000000;
                --background: #000000;
                --muted: #000000;
              }
              
              .bg-muted {
                background: #000000 !important; border: 2px solid #c41e3a;
                box-shadow: 0 0 20px rgba(196, 30, 58, 0.5);
              }
              
              .bg-muted:hover {
                background: #1a1a1a !important; border: 2px solid #0066cc;
                box-shadow: 0 0 30px rgba(0, 102, 204, 0.7);
              }
              
              .bg-foreground {
                background: #000000 !important; border: 2px solid #c41e3a;
                box-shadow: 0 0 30px rgba(196, 30, 58, 0.8);
              }
              
              .text-foreground {
                color: #ffffff !important;
                font-weight: bold;
                text-shadow: 0 0 10px rgba(196, 30, 58, 0.5);
              }

              /* Countdown styling - WHITE TEXT */
              .text-5xl {
                font-size: 4rem !important;
                color: #ffffff !important;
                text-shadow: 0 0 20px rgba(196, 30, 58, 0.8);
              }

              .text-gray-500 {
                color: #ffffff !important;
                font-weight: bold;
                text-transform: uppercase;
                letter-spacing: 0.1em;
              }

              .text-2xl {
                color: #ffffff !important;
              }
            `}</style>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <div style={{ height: "100vh", overflow: "hidden", position: "relative" }}>
        <HUDRoot videoRef={videoRef} stream={stream} calibrationProgress={calibrationProgress} />
        {(sessionState === "active" || sessionState === "calibrating") && (
          <div className="absolute top-12 right-4 z-10 flex gap-2">
            <a href="/game"
              className="px-3 py-1 text-xs hud-text border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-blue-900/20"
              style={{ borderColor: "#1a3a8f", color: "#1a3a8f" }}>🕷 GAME</a>
            <button onClick={stopSystem}
              className="px-3 py-1 text-xs hud-text border-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              style={{ borderColor: "#e62429", color: "#e62429" }}>■ STOP</button>
          </div>
        )}
      </div>
      {showSummary && sessionSummary && (
        <SessionSummaryView summary={sessionSummary}
          onReplay={() => { setShowSummary(false); if (sessionId) { setReplaySessionId(sessionId); setShowReplay(true); } }}
          onClose={() => { setShowSummary(false); reset(); }} />
      )}
      {showReplay && replaySessionId && (
        <ReplayMode sessionId={replaySessionId} onClose={() => { setShowReplay(false); reset(); }} />
      )}
    </>
  );
}
