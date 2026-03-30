import "@testing-library/jest-dom";

// Mock AudioContext
global.AudioContext = class MockAudioContext {
  createOscillator() {
    return {
      connect: () => {},
      frequency: { setValueAtTime: () => {} },
      start: () => {},
      stop: () => {},
    };
  }
  createGain() {
    return {
      connect: () => {},
      gain: {
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
      },
    };
  }
  get currentTime() { return 0; }
  get destination() { return {}; }
} as unknown as typeof AudioContext;

// Mock navigator.mediaDevices
Object.defineProperty(global.navigator, "mediaDevices", {
  value: {
    getUserMedia: vi.fn(),
  },
  writable: true,
});

// Mock WebSocket
global.WebSocket = class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  send = vi.fn();
  close = vi.fn();
  constructor(url: string) {}
} as unknown as typeof WebSocket;

// Mock canvas
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  drawImage: vi.fn(),
  toDataURL: vi.fn(() => "data:image/jpeg;base64,/9j/test"),
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/jpeg;base64,/9j/test");
