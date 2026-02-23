import { describe, it, expect } from 'vitest';

describe('smoke test', () => {
  it('vitest runs', () => {
    expect(1 + 1).toBe(2);
  });

  it('chrome mock is available', () => {
    expect(chrome.runtime.id).toBe('test-extension-id');
  });
});
