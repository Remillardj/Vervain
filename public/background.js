// Background script for the Vervain extension

import { AI_SYSTEM_PROMPT, buildUserMessage } from './aiPrompt.js';

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Open options page on install
    chrome.runtime.openOptionsPage();
  }
});

// --- AI Analysis API calls ---

async function callAnthropicAPI(apiKey, model, systemPrompt, userMessage) {
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

async function callOpenAIAPI(apiKey, model, systemPrompt, userMessage) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 1024,
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

function parseAIResponse(responseText) {
  // Strip markdown code fences if present
  let cleaned = responseText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return JSON.parse(cleaned);
}

async function handleAIAnalyze(emailData) {
  // Read AI settings from storage
  const settings = await chrome.storage.local.get(['aiEnabled', 'aiProvider', 'aiApiKey', 'aiModel']);

  if (!settings.aiEnabled) {
    throw new Error('AI analysis is not enabled. Enable it in extension settings.');
  }
  if (!settings.aiApiKey) {
    throw new Error('NO_API_KEY');
  }

  const userMessage = buildUserMessage(emailData);
  const provider = settings.aiProvider || 'anthropic';
  const model = settings.aiModel || 'claude-sonnet-4-5-20250929';

  let responseText;
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
    // Retry once
    if (provider === 'anthropic') {
      responseText = await callAnthropicAPI(settings.aiApiKey, model, AI_SYSTEM_PROMPT, userMessage);
    } else {
      responseText = await callOpenAIAPI(settings.aiApiKey, model, AI_SYSTEM_PROMPT, userMessage);
    }
    return parseAIResponse(responseText);
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PHISHING_DETECTED") {
    // Update badge to show there's a phishing attempt
    chrome.action.setBadgeText({ text: "!" });
    chrome.action.setBadgeBackgroundColor({ color: "#DC2626" });

    // Increment the alerts count
    chrome.storage.local.get(["alertsCount"], (result) => {
      const count = (result.alertsCount || 0) + 1;
      chrome.storage.local.set({ alertsCount: count });
    });

    sendResponse({ success: true });
  } else if (message.type === "RESET_BADGE") {
    // Clear the badge
    chrome.action.setBadgeText({ text: "" });
    sendResponse({ success: true });
  } else if (message.type === "GET_SETTINGS") {
    chrome.storage.local.get([
      "setupComplete",
      "detectionEnabled", // Legacy
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
    return true; // Required for async sendResponse
  } else if (message.type === "AI_ANALYZE") {
    handleAIAnalyze(message.data)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Required for async sendResponse
  } else if (message.type === "PING") {
    sendResponse({ success: true });
  }

  return true; // Keep the message channel open for async response
});
