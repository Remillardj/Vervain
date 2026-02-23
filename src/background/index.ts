// Background script for the Vervain extension

import { AI_SYSTEM_PROMPT, buildUserMessage, EmailData, EnrichmentContext } from './aiPrompt';
import { VervainDB } from './db';
import { DetectionEngine } from './detection/engine';
import { ConfigManager, MergedConfig, ManagedStoragePolicy, LocalSettings } from './configManager';
import { FeedManager } from './feeds/feedManager';
import { VirusTotalClient } from './feeds/virustotal';
import { PhishTankFeed } from './feeds/phishtank';
import { URLhausFeed } from './feeds/urlhaus';
import { ThreatFoxFeed } from './feeds/threatfox';
import { OpenPhishFeed } from './feeds/openphish';
import type { PassiveScanResponse, DeepScanResponse, ScanConfigResponse } from './messages';
import { migrateToIndexedDB } from './migration';

// --- Module-level state ---

let db: VervainDB;
let engine: DetectionEngine;
let configManager: ConfigManager;
let feedManager: FeedManager;
let vtClient: VirusTotalClient | null = null;
let currentConfig: MergedConfig;

// --- Helpers to read Chrome storage as Promises ---

function getManagedStorage(): Promise<Partial<ManagedStoragePolicy>> {
  return new Promise((resolve) => {
    try {
      chrome.storage.managed.get(null, (result) => {
        if (chrome.runtime.lastError) {
          resolve({});
        } else {
          resolve(result as Partial<ManagedStoragePolicy>);
        }
      });
    } catch {
      resolve({});
    }
  });
}

function getLocalStorage(): Promise<Partial<LocalSettings>> {
  return new Promise((resolve) => {
    chrome.storage.local.get([
      'setupComplete', 'domainDetectionEnabled', 'contactDetectionEnabled',
      'autoTI', 'autoAI', 'aiProvider', 'aiApiKey', 'aiModel', 'aiEnabled',
      'virusTotalApiKey', 'enabledThreatFeeds', 'primaryDomain',
      'alertsCount', 'lastUpdated',
    ], (result) => {
      resolve(result as Partial<LocalSettings>);
    });
  });
}

// --- Initialization ---

async function initialize() {
  db = new VervainDB();
  await db.open();

  // Migrate existing chrome.storage.local data to IndexedDB (idempotent)
  await migrateToIndexedDB(db);

  engine = new DetectionEngine();
  configManager = new ConfigManager();
  feedManager = new FeedManager(db);

  // Register feed sources
  feedManager.registerSource(new PhishTankFeed());
  feedManager.registerSource(new URLhausFeed());
  feedManager.registerSource(new ThreatFoxFeed());
  feedManager.registerSource(new OpenPhishFeed());

  await rebuildFromDB();
}

async function rebuildFromDB() {
  // Load managed + local config
  const managed = await getManagedStorage();
  const local = await getLocalStorage();
  currentConfig = configManager.merge(managed, local);

  // Load domains + contacts from IndexedDB
  const domains = await db.getAllDomains();
  const contacts = await db.getAllContacts();

  // Rebuild bloom filter from feed cache
  await feedManager.rebuildBloomFilter();

  // Rebuild detection engine
  engine.rebuild({
    domains: domains.map(d => ({ domain: d.domain, baseName: d.baseName })),
    contacts: contacts.map(c => ({ name: c.name, email: c.email })),
    threatDomains: [], // Bloom filter handles this separately via feedManager
  });

  // Start feed refresh
  feedManager.startScheduledRefresh(currentConfig.enabledThreatFeeds);

  // VT client
  if (currentConfig.virusTotalApiKey) {
    vtClient = new VirusTotalClient(currentConfig.virusTotalApiKey, db);
  }
}

// Initialize on service worker start
initialize().catch(err => console.error('[Vervain] Initialization error:', err));

// Refresh config whenever chrome.storage.local changes (e.g. Pause toggle from popup)
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== 'local') return;

  const relevantKeys = [
    'domainDetectionEnabled', 'contactDetectionEnabled', 'detectionEnabled',
    'autoTI', 'autoAI', 'aiProvider', 'aiApiKey', 'aiModel', 'aiEnabled',
    'virusTotalApiKey', 'enabledThreatFeeds',
  ];
  const hasRelevant = Object.keys(changes).some(k => relevantKeys.includes(k));
  if (!hasRelevant) return;

  try {
    const managed = await getManagedStorage();
    const local = await getLocalStorage();
    currentConfig = configManager.merge(managed, local);
  } catch (err) {
    console.warn('[Vervain] Failed to refresh config on storage change:', err);
  }
});

// --- Deep scan handler ---

async function handleDeepScan(data: {
  sender: string; domain: string; contactName: string;
  subject: string; body: string; links: string[];
}): Promise<DeepScanResponse> {
  // 1. Passive domain scan
  const domainResult = engine.passiveScan({
    sender: data.sender,
    domain: data.domain,
    contactName: data.contactName,
  });

  // 2. Threat intel (bloom filter check + DB lookup)
  let threatIntel: DeepScanResponse['threatIntel'] = null;
  const bf = feedManager.getBloomFilter();
  const bloomHit = bf.has(data.domain.toLowerCase());
  if (bloomHit) {
    // Look up which feeds matched
    const feedMatches: Array<{ feedId: string; domain: string }> = [];
    for (const feedId of currentConfig.enabledThreatFeeds) {
      const entry = await db.getFeedDomain(feedId, data.domain.toLowerCase());
      if (entry) feedMatches.push({ feedId, domain: entry.domain });
    }
    threatIntel = { bloomHit, feedMatches };
  }

  // 3. VirusTotal lookup
  let vt: DeepScanResponse['vt'] = null;
  if (vtClient) {
    try {
      const vtReport = await vtClient.lookupDomain(data.domain);
      if (vtReport) {
        vt = {
          reputation: vtReport.reputation,
          domainAge: vtReport.domainAge,
          detectionRatio: vtReport.detectionRatio,
        };
      }
    } catch (err) {
      console.warn('[Vervain] VT lookup failed:', err);
    }
  }

  // 4. Build enrichment context from pre-screening results
  const enrichment: EnrichmentContext = {};
  if (domainResult.verdict !== 'clean') {
    enrichment.domainVerdict = { verdict: domainResult.verdict, rule: domainResult.rule, evidence: domainResult.evidence };
  }
  if (threatIntel) {
    enrichment.threatIntel = threatIntel;
  }
  if (vt) {
    enrichment.virusTotal = vt;
  }

  // 5. AI analysis (if enabled and has API key — autoAI controls whether
  //    content script triggers DEEP_SCAN, not whether AI runs within it)
  let ai: Record<string, unknown> | null = null;
  if (currentConfig.aiEnabled && currentConfig.aiApiKey) {
    try {
      ai = await handleAIAnalyze({
        senderName: data.contactName,
        senderEmail: data.sender,
        subject: data.subject,
        body: data.body,
        urls: data.links,
      }, enrichment);
    } catch (err) {
      console.warn('[Vervain] AI analysis failed:', err);
    }
  }

  // 6. Aggregate verdict (reduced weights to avoid double-counting since AI now sees enrichment)
  let aggregateVerdict: 'clean' | 'warning' | 'suspicious' = domainResult.verdict;
  let confidence = 0;

  if (domainResult.verdict === 'suspicious') confidence += 30;
  else if (domainResult.verdict === 'warning') confidence += 15;
  if (bloomHit) { confidence += 25; aggregateVerdict = 'suspicious'; }
  if (vt && vt.reputation < 0) { confidence += 15; aggregateVerdict = 'suspicious'; }
  if (ai && (ai as { confidence?: number }).confidence && (ai as { confidence?: number }).confidence! > 60) {
    confidence += 30;
    aggregateVerdict = 'suspicious';
  }

  confidence = Math.min(confidence, 100);

  return {
    domain: domainResult,
    threatIntel,
    ai,
    vt,
    aggregate: { verdict: aggregateVerdict, confidence },
  };
}

// --- AI Analysis API calls ---

async function callAnthropicAPI(apiKey: string, model: string, systemPrompt: string, userMessage: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 1024,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    if (response.status === 401) throw new Error('Invalid API key. Check your Anthropic API key in settings.');
    if (response.status === 429) throw new Error('Rate limited. Please wait a moment and try again.');
    throw new Error(`Anthropic API error (${response.status}): ${errorBody || response.statusText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function callOpenAIAPI(apiKey: string, model: string, systemPrompt: string, userMessage: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 1024,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    if (response.status === 401) throw new Error('Invalid API key. Check your OpenAI API key in settings.');
    if (response.status === 429) throw new Error('Rate limited. Please wait a moment and try again.');
    throw new Error(`OpenAI API error (${response.status}): ${errorBody || response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function parseAIResponse(responseText: string): Record<string, unknown> {
  // Strip markdown code fences if present
  let cleaned = responseText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return JSON.parse(cleaned);
}

async function handleAIAnalyze(emailData: EmailData, enrichment?: EnrichmentContext): Promise<Record<string, unknown>> {
  // Read AI settings from storage
  const settings = await chrome.storage.local.get(['aiEnabled', 'aiProvider', 'aiApiKey', 'aiModel']);

  if (!settings.aiEnabled) {
    throw new Error('AI analysis is not enabled. Enable it in extension settings.');
  }
  if (!settings.aiApiKey) {
    throw new Error('NO_API_KEY');
  }

  const userMessage = buildUserMessage(emailData, enrichment);
  const provider = settings.aiProvider || 'anthropic';
  const model = settings.aiModel || 'claude-sonnet-4-5-20250929';

  let responseText: string;
  if (provider === 'anthropic') {
    responseText = await callAnthropicAPI(settings.aiApiKey, model, AI_SYSTEM_PROMPT, userMessage);
  } else {
    responseText = await callOpenAIAPI(settings.aiApiKey, model, AI_SYSTEM_PROMPT, userMessage);
  }

  // Parse JSON response, retry once on failure
  try {
    return parseAIResponse(responseText);
  } catch (parseError) {
    console.warn('[Vervain] First JSON parse failed, retrying API call...');
    if (provider === 'anthropic') {
      responseText = await callAnthropicAPI(settings.aiApiKey, model, AI_SYSTEM_PROMPT, userMessage);
    } else {
      responseText = await callOpenAIAPI(settings.aiApiKey, model, AI_SYSTEM_PROMPT, userMessage);
    }
    return parseAIResponse(responseText);
  }
}

// --- Listen for installation ---

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.runtime.openOptionsPage();
  }
});

// --- Listen for messages from content script ---

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'PASSIVE_SCAN') {
    if (!currentConfig.domainDetectionEnabled && !currentConfig.contactDetectionEnabled) {
      sendResponse({ verdict: 'clean', rule: '', evidence: '' } as PassiveScanResponse);
    } else {
      const result = engine.passiveScan(message.data);
      // If only one layer is disabled, suppress its verdicts
      if (!currentConfig.domainDetectionEnabled && result.rule && !result.rule.includes('contact-spoof')) {
        sendResponse({ verdict: 'clean', rule: '', evidence: '' } as PassiveScanResponse);
      } else if (!currentConfig.contactDetectionEnabled && result.rule?.includes('contact-spoof')) {
        sendResponse({ verdict: 'clean', rule: '', evidence: '' } as PassiveScanResponse);
      } else {
        sendResponse(result as PassiveScanResponse);
      }
    }
  } else if (message.type === 'DEEP_SCAN') {
    if (!currentConfig.domainDetectionEnabled && !currentConfig.contactDetectionEnabled) {
      sendResponse({ domain: { verdict: 'clean', rule: '', evidence: '' }, threatIntel: null, ai: null, vt: null, aggregate: { verdict: 'clean', confidence: 0 } });
    } else {
      handleDeepScan(message.data)
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }));
      return true; // async
    }
  } else if (message.type === 'GET_SCAN_CONFIG') {
    sendResponse({
      autoTI: currentConfig.autoTI,
      autoAI: currentConfig.autoAI,
      domainDetection: currentConfig.domainDetectionEnabled,
      contactDetection: currentConfig.contactDetectionEnabled,
    } as ScanConfigResponse);
  } else if (message.type === "PHISHING_DETECTED") {
    chrome.action.setBadgeText({ text: "!" });
    chrome.action.setBadgeBackgroundColor({ color: "#DC2626" });

    chrome.storage.local.get(["alertsCount"], (result) => {
      const count = ((result.alertsCount as number) || 0) + 1;
      chrome.storage.local.set({ alertsCount: count });
    });

    sendResponse({ success: true });
  } else if (message.type === "RESET_BADGE") {
    chrome.action.setBadgeText({ text: "" });
    sendResponse({ success: true });
  } else if (message.type === "GET_SETTINGS") {
    chrome.storage.local.get([
      "setupComplete",
      "detectionEnabled",
      "domainDetectionEnabled",
      "contactDetectionEnabled",
      "primaryDomain",
      "variations",
      "whitelistedDomains",
      "blockedDomains",
      "additionalDomains",
      "trustedContacts",
      "aiEnabled"
    ], (settings) => {
      sendResponse(settings);
    });
    return true;
  } else if (message.type === "AI_ANALYZE") {
    handleAIAnalyze(message.data)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (message.type === "PING") {
    sendResponse({ success: true });
  }

  return true;
});
