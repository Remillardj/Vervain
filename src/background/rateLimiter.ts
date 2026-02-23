export class RateLimiter {
  private timestamps: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  private prune(): void {
    const cutoff = Date.now() - this.windowMs;
    this.timestamps = this.timestamps.filter(t => t > cutoff);
  }

  canProceed(): boolean {
    this.prune();
    return this.timestamps.length < this.maxRequests;
  }

  record(): void {
    this.timestamps.push(Date.now());
  }

  msUntilAvailable(): number {
    this.prune();
    if (this.timestamps.length < this.maxRequests) return 0;
    return this.timestamps[0] + this.windowMs - Date.now();
  }
}
