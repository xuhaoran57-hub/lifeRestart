export function getWxApi(): WxMiniGameAPI | undefined {
  return typeof wx === 'undefined' ? undefined : wx;
}

export function createRuntimeCanvas(wxApi: WxMiniGameAPI | undefined): HTMLCanvasElement {
  if (wxApi) return wxApi.createCanvas();
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    document.body.style.margin = '0';
    document.body.append(canvas);
    return canvas;
  }
  throw new Error('No canvas runtime is available');
}

export function createOffscreenCanvas(wxApi: WxMiniGameAPI | undefined, width: number, height: number): HTMLCanvasElement | null {
  try {
    if (wxApi) {
      const canvas = wxApi.createCanvas();
      canvas.width = width;
      canvas.height = height;
      return canvas;
    }
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    }
  } catch {
    return null;
  }
  return null;
}

export function requestNextFrame(callback: FrameRequestCallback): number {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    return globalThis.requestAnimationFrame(callback);
  }
  return Number(setTimeout(() => callback(Date.now()), 16));
}

export function cancelNextFrame(handle: number): void {
  if (typeof globalThis.cancelAnimationFrame === 'function') {
    globalThis.cancelAnimationFrame(handle);
    return;
  }
  clearTimeout(handle);
}
