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

  interface WxSharePayload {
    title: string;
    imageUrl?: string;
    query?: string;
  }

  interface WxShowOptions {
    scene?: number;
    query?: Record<string, string>;
    shareTicket?: string;
  }

  interface WxModalOptions {
    title?: string;
    content?: string;
    showCancel?: boolean;
    confirmText?: string;
    cancelText?: string;
    success?: (res: { confirm: boolean; cancel: boolean }) => void;
  }

  interface WxCanvasToTempOptions {
    canvas: HTMLCanvasElement;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    destWidth?: number;
    destHeight?: number;
    fileType?: 'jpg' | 'png';
    quality?: number;
    success?: (res: { tempFilePath: string }) => void;
    fail?: (err: unknown) => void;
  }

  interface WxMiniGameAPI {
    createCanvas(): HTMLCanvasElement;
    getSystemInfoSync(): WxSystemInfo;
    getStorageSync(key: string): unknown;
    setStorageSync(key: string, value: string): void;
    onTouchStart(callback: (event: WxTouchEvent) => void): void;
    onTouchMove(callback: (event: WxTouchEvent) => void): void;
    onTouchEnd(callback: (event: WxTouchEvent) => void): void;
    onShow?(callback: (options: WxShowOptions) => void): void;
    onHide?(callback: () => void): void;
    showShareMenu?(options?: { withShareTicket?: boolean }): void;
    onShareAppMessage?(callback: () => WxSharePayload): void;
    shareAppMessage?(options: WxSharePayload): void;
    showToast?(options: { title: string; icon?: 'success' | 'error' | 'loading' | 'none'; duration?: number }): void;
    showModal?(options: WxModalOptions): void;
    canvasToTempFilePath?(options: WxCanvasToTempOptions): void;
    onError?(callback: (error: { message?: string; stack?: string } | string) => void): void;
    onUnhandledRejection?(callback: (event: { reason?: unknown; promise?: unknown }) => void): void;
    onMemoryWarning?(callback: (event: { level: number }) => void): void;
    setKeepScreenOn?(options: { keepScreenOn: boolean }): void;
    vibrateShort?(options?: { type?: 'heavy' | 'medium' | 'light' }): void;
  }

  // Provided by the WeChat Mini Game runtime.
  var wx: WxMiniGameAPI | undefined;
}
