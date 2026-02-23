// Content Script → Service Worker
export type CSMessage =
  | { type: 'PASSIVE_SCAN'; data: { sender: string; domain: string; contactName: string } }
  | { type: 'DEEP_SCAN'; data: { sender: string; domain: string; contactName: string; subject: string; body: string; links: string[] } }
  | { type: 'GET_SCAN_CONFIG' }
  | { type: 'PHISHING_DETECTED' }
  | { type: 'RESET_BADGE' }
  | { type: 'AI_ANALYZE'; data: { senderName: string; senderEmail: string; subject: string; body: string; urls: string[]; truncated: boolean; originalLength: number } }
  | { type: 'PING' };

// Service Worker → Content Script responses
export interface PassiveScanResponse {
  verdict: 'clean' | 'warning' | 'suspicious';
  rule: string;
  evidence: string;
}

export interface DeepScanResponse {
  domain: PassiveScanResponse;
  threatIntel: {
    bloomHit: boolean;
    feedMatches: Array<{ feedId: string; domain: string }>;
  } | null;
  ai: Record<string, unknown> | null;
  vt: {
    reputation: number;
    domainAge: string;
    detectionRatio: string;
  } | null;
  aggregate: {
    verdict: 'clean' | 'warning' | 'suspicious';
    confidence: number;
  };
}

export interface ScanConfigResponse {
  autoTI: boolean;
  autoAI: boolean;
  domainDetection: boolean;
  contactDetection: boolean;
}
