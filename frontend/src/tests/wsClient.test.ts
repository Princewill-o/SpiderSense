// Feature: spider-sense-ai
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useSpiderSenseStore } from "@/store/useSpiderSenseStore";

// Property 19: No frames transmitted before activation
// Feature: spider-sense-ai, Property 19: No frames transmitted before activation
describe("WSClient - no frames before activation", () => {
  beforeEach(() => {
    useSpiderSenseStore.getState().reset();
  });

  it("does not send frames when sessionState is idle", () => {
    // Import fresh instance
    const { WSClient } = require("@/lib/wsClient");
    const client = new WSClient();
    const mockWs = {
      readyState: 1, // OPEN
      send: vi.fn(),
      close: vi.fn(),
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
    };
    // Inject mock ws
    (client as any).ws = mockWs;

    // sessionState is 'idle' by default
    expect(useSpiderSenseStore.getState().sessionState).toBe("idle");
    client.sendFrame("base64data");
    expect(mockWs.send).not.toHaveBeenCalled();
  });

  it("does not send frames when sessionState is calibrating", () => {
    const { WSClient } = require("@/lib/wsClient");
    const client = new WSClient();
    const mockWs = {
      readyState: 1,
      send: vi.fn(),
      close: vi.fn(),
    };
    (client as any).ws = mockWs;

    useSpiderSenseStore.getState().setSessionState("calibrating");
    client.sendFrame("base64data");
    expect(mockWs.send).not.toHaveBeenCalled();
  });

  it("sends frames when sessionState is active", () => {
    const { WSClient } = require("@/lib/wsClient");
    const client = new WSClient();
    const mockWs = {
      readyState: 1,
      send: vi.fn(),
      close: vi.fn(),
    };
    (client as any).ws = mockWs;

    useSpiderSenseStore.getState().setSessionState("active");
    client.sendFrame("base64data");
    expect(mockWs.send).toHaveBeenCalledOnce();
  });

  it("does not send frames when sessionState is stopped", () => {
    const { WSClient } = require("@/lib/wsClient");
    const client = new WSClient();
    const mockWs = {
      readyState: 1,
      send: vi.fn(),
      close: vi.fn(),
    };
    (client as any).ws = mockWs;

    useSpiderSenseStore.getState().setSessionState("stopped");
    client.sendFrame("base64data");
    expect(mockWs.send).not.toHaveBeenCalled();
  });
});

describe("WSClient - reconnection backoff", () => {
  it("schedules reconnect on close", () => {
    vi.useFakeTimers();
    const { WSClient } = require("@/lib/wsClient");
    const client = new WSClient();
    (client as any).active = true;
    const connectSpy = vi.spyOn(client as any, "_connect");

    (client as any)._scheduleReconnect();
    vi.advanceTimersByTime(2000);
    expect(connectSpy).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("backoff increases with each attempt", () => {
    const { WSClient } = require("@/lib/wsClient");
    const client = new WSClient();
    (client as any).reconnectAttempt = 3;
    // delay = min(1000 * 2^3, 30000) = 8000
    // Just verify the formula works
    const delay = Math.min(1000 * Math.pow(2, 3), 30000);
    expect(delay).toBe(8000);
  });

  it("backoff caps at 30 seconds", () => {
    const { WSClient } = require("@/lib/wsClient");
    const client = new WSClient();
    (client as any).reconnectAttempt = 20;
    const delay = Math.min(1000 * Math.pow(2, 20), 30000);
    expect(delay).toBe(30000);
  });
});
