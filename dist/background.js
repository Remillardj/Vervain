// Background script for the Vervain extension

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Open options page on install
    chrome.runtime.openOptionsPage();
  }
});

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
      "trustedContacts"
    ], (settings) => {
      sendResponse(settings);
    });
    return true; // Required for async sendResponse
  } else if (message.type === "PING") {
    sendResponse({ success: true });
  }
  
  return true; // Keep the message channel open for async response
});
