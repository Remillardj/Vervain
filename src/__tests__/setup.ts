// Global test setup — mock Chrome APIs
const chromeStorageData: Record<string, unknown> = {};

globalThis.chrome = {
  storage: {
    local: {
      get: (keys: string[], cb: (result: Record<string, unknown>) => void) => {
        const result: Record<string, unknown> = {};
        for (const k of keys) {
          if (k in chromeStorageData) result[k] = chromeStorageData[k];
        }
        cb(result);
      },
      set: (data: Record<string, unknown>, cb?: () => void) => {
        Object.assign(chromeStorageData, data);
        cb?.();
      },
    },
    managed: {
      get: (_keys: string[], cb: (result: Record<string, unknown>) => void) => {
        cb({});
      },
    },
  },
  runtime: {
    id: 'test-extension-id',
    lastError: null,
    sendMessage: () => {},
    onMessage: { addListener: () => {} },
    openOptionsPage: () => {},
  },
  action: {
    setBadgeText: () => {},
    setBadgeBackgroundColor: () => {},
  },
} as unknown as typeof chrome;
