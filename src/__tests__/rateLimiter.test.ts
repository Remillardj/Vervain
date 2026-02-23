import { describe, it, expect, vi } from 'vitest';
import { RateLimiter } from '@/background/rateLimiter';

describe('RateLimiter', () => {
  it('allows requests within rate limit', async () => {
    const limiter = new RateLimiter(4, 60000); // 4 per minute
    expect(limiter.canProceed()).toBe(true);
    limiter.record();
    expect(limiter.canProceed()).toBe(true);
  });

  it('blocks requests exceeding rate limit', () => {
    const limiter = new RateLimiter(2, 60000);
    limiter.record();
    limiter.record();
    expect(limiter.canProceed()).toBe(false);
  });

  it('allows requests after window expires', () => {
    const limiter = new RateLimiter(1, 100); // 1 per 100ms
    limiter.record();
    expect(limiter.canProceed()).toBe(false);
    // Fast-forward time
    vi.useFakeTimers();
    vi.advanceTimersByTime(150);
    expect(limiter.canProceed()).toBe(true);
    vi.useRealTimers();
  });
});
