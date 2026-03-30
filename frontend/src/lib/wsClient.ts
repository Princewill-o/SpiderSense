import { WebSocketMessage } from "@/types";
import { useSpiderSenseStore } from "@/store/useSpiderSenseStore";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws";
const MAX_BACKOFF_MS = 30_000;

export class WSClient {
  private ws: WebSocket | null = null;
  private frameId = 0;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private active = false;
  private videoElement: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private captureInterval: ReturnType<typeof setInterval> | null = null;
  private fpsCap = 15;

  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    this.active = true;
    this._connect();
  }

  private _connect(): void {
    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log("[WSClient] Connected");
        this.reconnectAttempt = 0;
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const msg: WebSocketMessage = JSON.parse(event.data);
          useSpiderSenseStore.getState().appendEvent(msg);
        } catch (e) {
          console.error("[WSClient] Failed to parse message", e);
        }
      };

      this.ws.onclose = () => {
        console.log("[WSClient] Disconnected");
        if (this.active) {
          this._scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.error("[WSClient] Error", err);
      };
    } catch (e) {
      console.error("[WSClient] Failed to create WebSocket", e);
      if (this.active) {
        this._scheduleReconnect();
      }
    }
  }

  private _scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempt),
      MAX_BACKOFF_MS
    );
    this.reconnectAttempt++;
    console.log(`[WSClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`);
    this.reconnectTimer = setTimeout(() => {
      if (this.active) this._connect();
    }, delay);
  }

  sendFrame(frameB64: string): void {
    const store = useSpiderSenseStore.getState();
    // Do not send frames before session is active
    if (store.sessionState !== "active") return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(
      JSON.stringify({
        frame: frameB64,
        frame_id: this.frameId++,
      })
    );
  }

  startCapture(video: HTMLVideoElement, fpsCap = 15): void {
    this.videoElement = video;
    this.fpsCap = fpsCap;
    if (!this.canvas) {
      this.canvas = document.createElement("canvas");
    }
    this.canvas.width = 320;
    this.canvas.height = 240;

    if (this.captureInterval) clearInterval(this.captureInterval);
    const interval = Math.floor(1000 / fpsCap);
    this.captureInterval = setInterval(() => {
      this._captureAndSend();
    }, interval);
  }

  private _captureAndSend(): void {
    const store = useSpiderSenseStore.getState();
    if (store.sessionState !== "active") return;
    if (!this.videoElement || !this.canvas) return;

    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);
    const dataUrl = this.canvas.toDataURL("image/jpeg", 0.7);
    const b64 = dataUrl.split(",")[1];
    if (b64) this.sendFrame(b64);
  }

  stopCapture(): void {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
  }

  disconnect(): void {
    this.active = false;
    this.stopCapture();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
export const wsClient = new WSClient();
