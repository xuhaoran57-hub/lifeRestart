import type { SaveStorage } from '../engine/storage';

interface WxStorageApi {
  getStorageSync(key: string): unknown;
  setStorageSync(key: string, value: string): void;
}

export function createWxSaveStorage(wxApi: WxStorageApi | undefined): SaveStorage | undefined {
  if (!wxApi) return undefined;
  return {
    getItem(key) {
      const value = wxApi.getStorageSync(key);
      return typeof value === 'string' && value.length > 0 ? value : null;
    },
    setItem(key, value) {
      wxApi.setStorageSync(key, value);
    },
  };
}
