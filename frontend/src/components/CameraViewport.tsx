"use client";

import { useSpiderSenseStore } from "@/store/useSpiderSenseStore";
import { useEffect } from "react";

interface CameraViewportProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  children?: React.ReactNode;
}

export function CameraViewport({ videoRef, stream, children }: CameraViewportProps) {
  const { sessionState } = useSpiderSenseStore();
  const showCamera = sessionState === "calibrating" || sessionState === "active";

  // Re-attach stream whenever it changes — survives re-renders
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (stream) {
      video.srcObject = stream;
      video.play().catch(() => {/* autoplay policy — user gesture required */});
    } else {
      video.srcObject = null;
    }
  }, [stream, videoRef]);

  return (
    <div className="relative w-full h-full bg-black" aria-label="Camera viewport">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: showCamera ? 1 : 0 }}
        aria-label="Live camera feed"
      />

      {!showCamera && (
        <div className="absolute inset-0 flex items-center justify-center z-10"
          style={{ background: "#050510" }}>
          <div className="text-center">
            <div className="text-5xl mb-3 opacity-20" aria-hidden="true">📷</div>
            <p className="hud-text text-sm" style={{ color: "#333" }}>CAMERA OFFLINE</p>
          </div>
        </div>
      )}

      {sessionState === "calibrating" && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 hud-text text-xs px-4 py-1 animate-pulse"
          style={{ background: "rgba(230,36,41,0.85)", color: "white", border: "1px solid #e62429" }}>
          ◉ CALIBRATING SPIDER-SENSE...
        </div>
      )}

      <div className="absolute inset-0 pointer-events-none z-10">
        {children}
      </div>
    </div>
  );
}
