export {};

declare global {
  interface WxSystemInfo {
    windowWidth: number;
    windowHeight: number;
    pixelRatio?: number;
    safeArea?: {
      top: number;
      bottom: number;
      left: number;
      right: number;
      width: number;
      height: number;
    };
  }

  interface WxTouchPoint {
    clientX: number;
    clientY: number;
  }

  interface WxTouchEvent {
    touches?: WxTouchPoint[];
    changedTouches?: WxTouchPoint[];
  }

  interface WxMiniGameAPI {
    createCanvas(): HTMLCanvasElement;
    getSystemInfoSync(): WxSystemInfo;
    getStorageSync(key: string): unknown;
    setStorageSync(key: string, value: string): void;
    onTouchStart(callback: (event: WxTouchEvent) => void): void;
    onTouchMove(callback: (event: WxTouchEvent) => void): void;
    onTouchEnd(callback: (event: WxTouchEvent) => void): void;
    showShareMenu?(options?: { withShareTicket?: boolean }): void;
    onShareAppMessage?(callback: () => { title: string }): void;
    showToast?(options: { title: string; icon?: 'success' | 'error' | 'loading' | 'none'; duration?: number }): void;
  }

  // Provided by the WeChat Mini Game runtime.
  var wx: WxMiniGameAPI | undefined;
}
