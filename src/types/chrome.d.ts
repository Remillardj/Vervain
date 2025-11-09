
// Type definitions for Chrome extension API
interface Chrome {
  storage: {
    local: {
      get: (keys: string | string[] | object | null, callback: (items: object) => void) => void;
      set: (items: object, callback?: () => void) => void;
      remove: (keys: string | string[], callback?: () => void) => void;
      clear: (callback?: () => void) => void;
    };
    sync: {
      get: (keys: string | string[] | object | null, callback: (items: object) => void) => void;
      set: (items: object, callback?: () => void) => void;
      remove: (keys: string | string[], callback?: () => void) => void;
      clear: (callback?: () => void) => void;
    };
  };
  runtime: {
    lastError?: {
      message: string;
    };
    onMessage: {
      addListener: (callback: (message: any, sender: any, sendResponse: any) => void) => void;
    };
    sendMessage: (message: any, callback?: (response: any) => void) => void;
    openOptionsPage: () => void;
  };
  action: {
    setBadgeText: (details: { text: string }) => void;
    setBadgeBackgroundColor: (details: { color: string }) => void;
  };
}

declare const chrome: Chrome;
