export interface FeedEntry {
  domain: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface FeedSource {
  readonly id: string;
  readonly name: string;
  readonly refreshIntervalMs: number;
  fetch(): Promise<FeedEntry[]>;
}
