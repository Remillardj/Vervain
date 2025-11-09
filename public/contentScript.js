// Content script for Vervain - runs on Gmail

// Global flag to prevent recursive scanning
let isCurrentlyScanning = false;
let isModifyingDOM = false;

// Helper: Extract domain from email address
function extractDomain(email) {
  const match = email.match(/@([^@]+)$/);
  return match ? match[1] : '';
}

// Check if domain is in the list of variations
function isDomainSuspicious(domain, userDomain, variations) {
  if (!domain || !userDomain) return false;
  
  // If it's the exact domain, it's not suspicious
  if (domain.toLowerCase() === userDomain.toLowerCase()) return false;
  
  // Check if the domain is in our list of variations
  return variations.some(variation => variation.domain.toLowerCase() === domain.toLowerCase());
}

// Check if domain is similar to any of the additional domains
function isSimilarToAdditionalDomain(senderDomain, additionalDomains) {
  if (!senderDomain || !additionalDomains || additionalDomains.length === 0) return false;

  for (const monitoredDomain of additionalDomains) {
    // Skip empty domains
    if (!monitoredDomain) continue;

    // Exact match (shouldn't flag but checking anyway)
    if (senderDomain.toLowerCase() === monitoredDomain.toLowerCase()) {
      return false;
    }

    // NEW: Check if sender domain contains the monitored domain
    // This catches cases where the protected domain is embedded within another domain
    if (senderDomain.toLowerCase().includes(monitoredDomain.toLowerCase())) {
      console.log('[Vervain] Monitored domain embedded in sender domain:', 
                  monitoredDomain, 'found in', senderDomain);
      return { suspicious: true, legitimateDomain: monitoredDomain };
    }
    
    // NEW: Check for homograph attacks with number substitutions
    const numberSubstitutions = {
      '0': 'o', 'o': '0',
      '1': 'l', 'l': '1', 'i': '1', '1': 'i',
      '3': 'e', 'e': '3',
      '4': 'a', 'a': '4',
      '5': 's', 's': '5',
      '7': 't', 't': '7'
    };
    
    // Normalize domains by replacing common substitutions
    let normalizedSenderDomain = senderDomain.toLowerCase();
    let normalizedMonitoredDomain = monitoredDomain.toLowerCase();
    
    for (const [char, replacement] of Object.entries(numberSubstitutions)) {
      normalizedSenderDomain = normalizedSenderDomain.replace(new RegExp(char, 'g'), replacement);
      normalizedMonitoredDomain = normalizedMonitoredDomain.replace(new RegExp(char, 'g'), replacement);
    }
    
    // Check if normalized domains match or are embedded
    if (normalizedSenderDomain.includes(normalizedMonitoredDomain)) {
              console.log('[Vervain] Homograph attack detected after normalization:', 
                  senderDomain, '→', normalizedSenderDomain, 'contains', 
                  monitoredDomain, '→', normalizedMonitoredDomain);
      return { suspicious: true, legitimateDomain: monitoredDomain };
    }
    
    // Simple string similarity check - if domain contains most of the monitored domain
    const maxLength = Math.max(senderDomain.length, monitoredDomain.length);
    const minLength = Math.min(senderDomain.length, monitoredDomain.length);
    
    // If the length difference is small and one domain contains most of the other
    if (maxLength - minLength <= 3) {
      // Check if domains are similar enough
      if (senderDomain.includes(monitoredDomain.substring(0, monitoredDomain.length - 2)) ||
          monitoredDomain.includes(senderDomain.substring(0, senderDomain.length - 2))) {
        return { suspicious: true, legitimateDomain: monitoredDomain };
      }
    }
  }
  
  return false;
}

// Check if domain is whitelisted
function isDomainWhitelisted(domain, whitelistedDomains) {
  return whitelistedDomains.some(d => d.toLowerCase() === domain.toLowerCase());
}

// Check if domain is blocked
function isDomainBlocked(domain, blockedDomains) {
  return blockedDomains.some(d => d.toLowerCase() === domain.toLowerCase());
}

// Add visual indicator for contact impersonation above the email
function addContactImpersonationIndicator(element, senderName, senderEmail, trustedEmail) {
  try {
    // Set flag to prevent mutation observer from triggering
    isModifyingDOM = true;
    
    console.log('[Vervain] Adding contact impersonation indicator for:', senderEmail);
    console.log('[Vervain] Element:', element);
    
    // Find the email container that contains this sender element
    let emailContainer = element;
    let searchDepth = 0;
    const maxSearchDepth = 10;
    
    while (emailContainer && !emailContainer.classList.contains('zA') && !emailContainer.classList.contains('zF') && searchDepth < maxSearchDepth) {
      emailContainer = emailContainer.parentElement;
      searchDepth++;
      console.log('[Vervain] Searching for email container, depth:', searchDepth, 'classes:', emailContainer?.classList?.toString());
    }
    
    if (!emailContainer) {
      console.log('[Vervain] Could not find email container for contact impersonation indicator');
      return;
    }
    
          console.log('[Vervain] Found email container:', emailContainer);
          console.log('[Vervain] Container classes:', emailContainer.classList.toString());
    
    // Check if this contact indicator has been dismissed
    if (window.phishguardDismissedContactIndicators && window.phishguardDismissedContactIndicators.has(senderEmail.toLowerCase())) {
      console.log('[Vervain] Contact impersonation indicator already dismissed for:', senderEmail);
      return;
    }
    
    // Create a unique identifier for this specific warning
    const warningId = `contact-${senderEmail}-${Date.now()}`;
    
    // Check if indicator already exists for THIS specific email
    const existingIndicator = emailContainer.querySelector(`[data-phishguard-id="${warningId}"]`);
    if (existingIndicator) {
      console.log('[Vervain] Contact impersonation indicator already exists for this specific warning');
      return;
    }
    
    // Also check for any existing indicators in this container
    const anyExistingIndicator = emailContainer.querySelector('.phishguard-contact-indicator');
    if (anyExistingIndicator) {
              console.log('[Vervain] Found existing indicator, removing old one before adding new');
      anyExistingIndicator.remove();
    }
    
    // Create the warning banner
    const indicator = document.createElement('div');
    indicator.className = 'phishguard-contact-indicator';
    indicator.setAttribute('data-phishguard-id', warningId);
    indicator.style.cssText = `
      background: #ffffff;
      color: #334155;
      padding: 16px;
      margin: 8px 0;
      border: 2px solid #DC2626;
      border-radius: 8px;
      font-family: 'Google Sans', Roboto, Arial, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      position: relative;
      z-index: 1000;
    `;
    
    // Create the warning content
    indicator.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink: 0;">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <div>
            <div style="font-weight: 600; margin-bottom: 4px;">
              ⚠️ Potential Contact Impersonation Detected
            </div>
            <div style="font-size: 13px; opacity: 0.9; line-height: 1.4;">
              This email appears to be from <strong>${senderName}</strong> (${senderEmail}) 
              but may be impersonating your trusted contact (${trustedEmail}).
            </div>
          </div>
        </div>

      </div>
    `;
    
          console.log('[Vervain] Created indicator element:', indicator);
    
    // Insert the indicator at the top of the email container
    if (emailContainer.firstChild) {
      emailContainer.insertBefore(indicator, emailContainer.firstChild);
              console.log('[Vervain] Inserted indicator before first child');
    } else {
      emailContainer.appendChild(indicator);
              console.log('[Vervain] Appended indicator to container');
    }
    

    
          console.log('[Vervain] Successfully added contact impersonation indicator for:', senderEmail);
    
  } catch (error) {
          console.error('[Vervain] Error adding contact impersonation indicator:', error);
  } finally {
    // Reset flag after DOM modification
    isModifyingDOM = false;
  }
}

// Insert warning popup for suspicious domains
function insertWarning(senderEmail, suspiciousDomain, userDomain) {
  // Skip if this specific warning has been dismissed since last scan
  const warningId = `domain-${suspiciousDomain.toLowerCase()}`;
  
  if (window.phishguardDismissedWarnings && window.phishguardDismissedWarnings.has(warningId)) {
    console.log('[Vervain] Warning already dismissed since last scan:', warningId);
    return;
  }
  
  // Don't show multiple warnings at once
  if (document.querySelector('.phishguard-warning')) {
    return;
  }
  
  // Set flag to prevent mutation observer from triggering
  isModifyingDOM = true;
  
  try {
    console.log('[Vervain] Inserting warning for:', senderEmail, suspiciousDomain, userDomain);
  
  // FIXED: Make sure we have the suspicious domain and legitimate domain in correct order
  // The sender's domain is the suspicious one, and the user's domain is the legitimate one
  let displaySuspiciousDomain = suspiciousDomain;
  let displayLegitDomain = userDomain;
  
  // Check if we accidentally reversed the domains (sometimes happens with homograph detection)
  if (suspiciousDomain === 'gmail.com' || suspiciousDomain === 'outlook.com' || 
      suspiciousDomain === 'yahoo.com' || suspiciousDomain === 'hotmail.com') {
    // These are likely legitimate domains, so swap the display
            console.log('[Vervain] Common email domain detected as suspicious - correcting display');
    displaySuspiciousDomain = userDomain;
    displayLegitDomain = suspiciousDomain;
  }
  
  // Create warning element
  const warningDiv = document.createElement('div');
  warningDiv.className = 'phishguard-warning';
  warningDiv.style.position = 'fixed';
  warningDiv.style.top = '20px';
  warningDiv.style.right = '20px';
  warningDiv.style.zIndex = '9999';
  warningDiv.style.backgroundColor = '#ffffff';
  warningDiv.style.border = '2px solid #DC2626';
  warningDiv.style.borderRadius = '8px';
  warningDiv.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  warningDiv.style.padding = '16px';
  warningDiv.style.width = '350px';
  warningDiv.style.animation = 'fadeIn 0.3s';
  
  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .phishguard-button {
      padding: 8px 12px;
      border-radius: 4px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      outline: none;
    }
    .phishguard-primary {
      background-color: #DC2626;
      color: white;
    }
    .phishguard-secondary {
      background-color: #f1f5f9;
      color: #334155;
    }
  `;
  document.head.appendChild(style);
  
  // Add warning content - with correct domain display
  warningDiv.innerHTML = `
    <div style="display: flex; align-items: center; margin-bottom: 12px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
        <path d="M12 9v4"></path>
        <path d="M12 17h.01"></path>
      </svg>
      <div style="font-weight: bold; font-size: 16px; margin-left: 8px; color: #DC2626;">⚠️ SUSPICIOUS EMAIL DOMAIN ⚠️</div>
      <div style="margin-left: auto; cursor: pointer;" id="phishguard-close">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6 6 18"></path>
          <path d="m6 6 12 12"></path>
        </svg>
      </div>
    </div>
    <div style="margin-bottom: 12px; font-size: 14px; color: #334155;">
      <strong>CAUTION:</strong> The sender is using a domain that appears to be impersonating your domain:
    </div>
    <div style="background-color: #FEF2F2; padding: 12px; border-radius: 4px; margin-bottom: 12px;">
      <div style="font-size: 14px; margin-bottom: 4px;"><strong>From:</strong> ${senderEmail}</div>
      <div style="font-size: 14px; margin-bottom: 4px;"><strong>Suspicious Domain:</strong> <span style="color: #DC2626;">${displaySuspiciousDomain}</span></div>
      <div style="font-size: 14px;"><strong>Your Domain:</strong> <span style="color: #047857;">${displayLegitDomain}</span></div>
    </div>
    <div style="display: flex; gap-2; justify-content: center; margin-top: 16px;">
      <button id="phishguard-dismiss" class="phishguard-button phishguard-secondary">Dismiss</button>
      <button id="phishguard-whitelist" class="phishguard-button phishguard-primary">Mark as Safe</button>
    </div>
  `;
  
  document.body.appendChild(warningDiv);
  
  // Handle close button (X) - same as dismiss
  document.getElementById('phishguard-close').addEventListener('click', () => {
          console.log('[Vervain] Warning closed by user');
    warningDiv.remove();
    chrome.runtime.sendMessage({ type: "RESET_BADGE" });
  });
  
  // Handle dismiss button - temporarily hide until next scan
  document.getElementById('phishguard-dismiss').addEventListener('click', () => {
          console.log('[Vervain] Warning dismissed by user (temporary until next scan)');
    
    // Store this dismissal in memory (clears on next scan)
    if (!window.phishguardDismissedWarnings) {
      window.phishguardDismissedWarnings = new Set();
    }
    window.phishguardDismissedWarnings.add(warningId);
    
    warningDiv.remove();
    chrome.runtime.sendMessage({ type: "RESET_BADGE" });
  });
  
  // Handle whitelist button - permanently mark as safe
  document.getElementById('phishguard-whitelist').addEventListener('click', () => {
          console.log('[Vervain] Domain marked as safe by user');
    
    chrome.storage.local.get(["whitelistedDomains"], (result) => {
      const whitelistedDomains = result.whitelistedDomains || [];
      if (!whitelistedDomains.includes(suspiciousDomain)) {
        whitelistedDomains.push(suspiciousDomain);
        chrome.storage.local.set({ whitelistedDomains });
        console.log('[Vervain] Added to whitelist:', suspiciousDomain);
      }
      warningDiv.remove();
      chrome.runtime.sendMessage({ type: "RESET_BADGE" });
    });
  });
  
  // Notify background script
  chrome.runtime.sendMessage({ type: "PHISHING_DETECTED" });
  
  } catch (error) {
    console.error('[Vervain] Error inserting warning:', error);
  } finally {
    // Reset flag after DOM modification
    isModifyingDOM = false;
  }
}

// Check link against protected domains - with fix for multiple warning icons and correct domain identification
function checkLinkAgainstDomains(link, url, urlDomain, domainsToProtect) {
  // Skip if this link already has a warning icon
  if (link.hasAttribute('data-phishguard-warned')) {
    return false;
  }
  
  for (const protectedDomain of domainsToProtect) {
    if (!protectedDomain) continue;
    
    // Skip if it's an exact match to the protected domain (legitimate link)
    if (urlDomain.toLowerCase() === protectedDomain.toLowerCase()) {
      continue;
    }
    
    // Check for domain similarity
    if (isSimilarDomain(urlDomain, protectedDomain)) {
      console.log('[Vervain] Found suspicious URL:', url, 'similar to:', protectedDomain);
      
      // Determine which is the suspicious domain and which is the legitimate one
      // In this case, the URL domain is always suspicious (trying to mimic the protected domain)
      const suspiciousDomain = urlDomain;
      const legitimateDomain = protectedDomain;
      
      // Highlight the suspicious link
      link.style.backgroundColor = '#FECACA';
      link.style.color = '#DC2626';
      link.style.fontWeight = 'bold';
      link.style.padding = '2px 4px';
      link.style.border = '1px solid #DC2626';
      link.style.borderRadius = '3px';
      link.style.textDecoration = 'line-through';
      
      // Mark this link as already warned
      link.setAttribute('data-phishguard-warned', 'true');
      
      // Add warning icon
      const warningIcon = document.createElement('span');
      warningIcon.innerHTML = '⚠️';
              warningIcon.title = 'Vervain: This URL may be impersonating ' + legitimateDomain;
      link.parentNode.insertBefore(warningIcon, link.nextSibling);
      
      // Show warning notification with correct domain identification
      insertWarning(url, suspiciousDomain, legitimateDomain);
      
      // Prevent click
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        alert(`⚠️ Vervain Warning: This link may be impersonating ${legitimateDomain}`);
        return false;
      }, true);
      
      return true;
    }
  }
  
  return false;
}

// Also scan for plain text URLs in email content
function scanPlainTextUrls(container, domainsToProtect, whitelistedDomains) {
  try {
    // Get all text nodes in the container
    const textNodes = [];
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }
    
    // URL regex pattern
    const urlPattern = /(https?:\/\/[^\s<>"']+)/gi;
    
    textNodes.forEach(textNode => {
      const text = textNode.nodeValue;
      let match;
      
      while ((match = urlPattern.exec(text)) !== null) {
        try {
          const url = match[0];
          const urlDomain = new URL(url).hostname;
          
          // Skip if domain is whitelisted
          if (isDomainWhitelisted(urlDomain, whitelistedDomains)) {
            continue;
          }
          
          // Check against protected domains
          for (const protectedDomain of domainsToProtect) {
            if (!protectedDomain) continue;
            
            if (isSimilarDomain(urlDomain, protectedDomain)) {
              console.log('[Vervain] Found suspicious plain text URL:', url);
              
              // Split the text node and highlight the URL
              const beforeText = text.substring(0, match.index);
              const afterText = text.substring(match.index + url.length);
              
              const span = document.createElement('span');
              span.textContent = url;
              span.style.backgroundColor = '#FECACA';
              span.style.color = '#DC2626';
              span.style.fontWeight = 'bold';
              span.style.padding = '2px 4px';
              span.style.border = '1px solid #DC2626';
              span.style.borderRadius = '3px';
              span.style.textDecoration = 'line-through';
              
              // Replace the text node with our new elements
              const fragment = document.createDocumentFragment();
              if (beforeText) fragment.appendChild(document.createTextNode(beforeText));
              fragment.appendChild(span);
              if (afterText) fragment.appendChild(document.createTextNode(afterText));
              
              textNode.parentNode.replaceChild(fragment, textNode);
              
              // Show warning notification
              insertWarning(url, urlDomain, protectedDomain);
              
              break;
            }
          }
        } catch (error) {
          console.error('[Vervain] Error checking plain text URL:', error);
        }
      }
    });
  } catch (error) {
          console.error('[Vervain] Error scanning plain text URLs:', error);
  }
}

// Update processContainers to also scan plain text URLs
function processContainers(containers, domainsToProtect, whitelistedDomains) {
  try {
    containers.forEach(container => {
      // Get all links in the email
      const links = container.querySelectorAll('a[href]');
      
      links.forEach(link => {
        try {
          const url = link.href;
          if (!url || url.startsWith('mailto:')) return;
          
          // Extract domain from URL
          const urlDomain = new URL(url).hostname;
          
          // Skip if domain is whitelisted
          if (isDomainWhitelisted(urlDomain, whitelistedDomains)) {
            return;
          }
          
          checkLinkAgainstDomains(link, url, urlDomain, domainsToProtect);
        } catch (error) {
          console.error('[Vervain] Error checking URL:', error);
        }
      });
      
      // Also scan for plain text URLs
      scanPlainTextUrls(container, domainsToProtect, whitelistedDomains);
    });
  } catch (error) {
          console.error('[Vervain] Error processing containers:', error);
  }
}

// Scan for phishing URLs in email content with better error handling
function scanEmailContent(primaryDomain, additionalDomains, whitelistedDomains) {
      console.log('[Vervain] Scanning email content...');
  
  // Get all email content containers
  const emailContainers = document.querySelectorAll('.a3s');
  if (emailContainers.length === 0) {
    console.log('[Vervain] No email content containers found');
    return;
  }
  
  // Combine all domains to protect
  const domainsToProtect = [primaryDomain, ...additionalDomains].filter(Boolean);
  
  // Process each email container
  emailContainers.forEach(container => {
    // Scan for links in the email
    const links = container.querySelectorAll('a[href]');
    links.forEach(link => {
      try {
        const url = link.href;
        if (!url || url.startsWith('mailto:')) return;
        
        let urlDomain;
        try {
          urlDomain = new URL(url).hostname;
        } catch (e) {
          console.log('[Vervain] Invalid URL:', url);
          return;
        }
        
        // Skip if domain is whitelisted
        if (isDomainWhitelisted(urlDomain, whitelistedDomains)) {
          return;
        }
        
        // Skip common legitimate domains
        const commonLegitDomains = ['gmail.com', 'google.com', 'microsoft.com', 'apple.com', 'amazon.com'];
        if (commonLegitDomains.includes(urlDomain)) {
          console.log('[Vervain] Skipping check for known trusted domain:', urlDomain);
          return;
        }
        
        // Check link against protected domains
        checkLinkAgainstDomains(link, url, urlDomain, domainsToProtect);
      } catch (error) {
        console.error('[Vervain] Error checking link:', error);
      }
    });
    
    // Scan for plain text URLs
    scanPlainTextUrls(container, domainsToProtect, whitelistedDomains);
    
    // Scan for embedded domains in text content
    scanForEmbeddedDomains(container, domainsToProtect, whitelistedDomains);
  });
}

// NEW: Scan for embedded domains in text content
function scanForEmbeddedDomains(container, domainsToProtect, whitelistedDomains) {
  // Function intentionally disabled to prevent excessive warning symbols
  return;
}

// Helper function to escape special characters in a string for use in a RegExp
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper function for basic homograph normalization
function normalizeForHomographs(domain) {
  // Replace the most common homograph substitutions
  const homographMap = {
    '0': 'o',
    '1': 'l',
    '3': 'e',
    '5': 's'
  };
  
  let normalized = domain.toLowerCase();
  for (const [char, replacement] of Object.entries(homographMap)) {
    normalized = normalized.replace(new RegExp(char, 'g'), replacement);
  }
  
  return normalized;
}

// Helper function for more extensive homograph normalization
function normalizeWithExpandedSet(domain) {
  // More comprehensive homograph substitutions
  const expandedHomographMap = {
    '0': 'o',
    'o': 'o',
    '1': 'l',
    'l': 'l',
    'i': 'i',
    '!': 'i',
    '|': 'l',
    '3': 'e',
    'e': 'e',
    '4': 'a',
    'a': 'a',
    '5': 's',
    's': 's',
    '6': 'b',
    'b': 'b',
    '7': 't',
    't': 't',
    '8': 'b',
    '9': 'g',
    'g': 'g',
    '$': 's',
    '@': 'a',
    'rn': 'm',
    'cl': 'd'
  };
  
  let normalized = domain.toLowerCase();
  for (const [char, replacement] of Object.entries(expandedHomographMap)) {
    normalized = normalized.replace(new RegExp(char, 'g'), replacement);
  }
  
  return normalized;
}

// Improved function to check if domains are similar - with better subdomain handling
function isSimilarDomain(domain1, domain2) {
  if (!domain1 || !domain2) return false;
  
  // Normalize domains
  domain1 = domain1.toLowerCase();
  domain2 = domain2.toLowerCase();
  
      console.log('[Vervain] Comparing domains:', domain1, domain2);
  
  // If domains are identical, they're not suspicious
  if (domain1 === domain2) return false;
  
  // Check for legitimate subdomain relationship
  // If domain1 is a legitimate subdomain of domain2 (e.g., mail.example.com is a subdomain of example.com)
  if (domain1.endsWith('.' + domain2)) {
    console.log('[Vervain] Legitimate subdomain relationship detected:', domain1, 'is a subdomain of', domain2);
    return false; // Legitimate subdomain, not suspicious
  }
  
  // Check if domain2 is a subdomain of domain1
  if (domain2.endsWith('.' + domain1)) {
    console.log('[Vervain] Legitimate subdomain relationship detected:', domain2, 'is a subdomain of', domain1);
    return false; // Legitimate subdomain, not suspicious
  }

  // NEW: Check for hyphen-to-dot substitution attacks (works both ways)
  // Example: blue-securityops.com vs blue.securityops.com
  // Replace hyphens with dots and vice versa to detect this pattern
  const domain1WithDotsForHyphens = domain1.replace(/-/g, '.');
  const domain1WithHyphensForDots = domain1.replace(/\./g, '-');
  const domain2WithDotsForHyphens = domain2.replace(/-/g, '.');
  const domain2WithHyphensForDots = domain2.replace(/\./g, '-');

  // Check if domain1 with hyphens replaced by dots matches domain2
  if (domain1WithDotsForHyphens === domain2 && domain1 !== domain2) {
    console.log('[Vervain] Hyphen-to-dot substitution detected:', domain1, '→', domain1WithDotsForHyphens, 'matches', domain2);
    return true;
  }

  // Check if domain2 with hyphens replaced by dots matches domain1
  if (domain2WithDotsForHyphens === domain1 && domain1 !== domain2) {
    console.log('[Vervain] Hyphen-to-dot substitution detected:', domain2, '→', domain2WithDotsForHyphens, 'matches', domain1);
    return true;
  }

  // Check if domain1 with dots replaced by hyphens matches domain2
  if (domain1WithHyphensForDots === domain2 && domain1 !== domain2) {
    console.log('[Vervain] Dot-to-hyphen substitution detected:', domain1, '→', domain1WithHyphensForDots, 'matches', domain2);
    return true;
  }

  // Check if domain2 with dots replaced by hyphens matches domain1
  if (domain2WithHyphensForDots === domain1 && domain1 !== domain2) {
    console.log('[Vervain] Dot-to-hyphen substitution detected:', domain2, '→', domain2WithHyphensForDots, 'matches', domain1);
    return true;
  }

  // NEW: Check for combo domain tricks where protected domain appears as subdomain of attacker's domain
  // Example: monarch.verify-account.com trying to impersonate monarch.com
  const domain1Parts = domain1.split('.');
  const domain2Parts = domain2.split('.');

  // Get the base domain name (second-level domain) of the protected domain
  const domain2BaseName = domain2Parts.length > 1 ? domain2Parts[domain2Parts.length - 2] : '';
  const domain1BaseName = domain1Parts.length > 1 ? domain1Parts[domain1Parts.length - 2] : '';

  // Check if domain1 starts with domain2's base name (e.g., "monarch.something.com" when protecting "monarch.com")
  // But only if it's more than 2 parts (to avoid false positives on the domain itself)
  if (domain1Parts.length > 2 && domain1Parts[0] === domain2BaseName) {
    console.log('[Vervain] Combo domain trick detected:', domain1, 'uses protected domain', domain2BaseName, 'as subdomain');
    return true;
  }

  // Check the reverse case
  if (domain2Parts.length > 2 && domain2Parts[0] === domain1BaseName) {
    console.log('[Vervain] Combo domain trick detected:', domain2, 'uses protected domain', domain1BaseName, 'as subdomain');
    return true;
  }

  // Get base domains (second-level domain name) - using already declared domain1Parts and domain2Parts from above
  const domain1Base = domain1Parts.length > 1 ? domain1Parts[domain1Parts.length - 2] : '';
  const domain2Base = domain2Parts.length > 1 ? domain2Parts[domain2Parts.length - 2] : '';
  
  // If base domains are different and don't share significant characters, they're not similar
  if (domain1Base && domain2Base) {
    // Check for homograph attacks first (need normalized versions for other checks)
    const normalizedDomain1 = normalizeForHomographs(domain1Base);
    const normalizedDomain2 = normalizeForHomographs(domain2Base);

    // NEW: Check for hyphenated domain impersonation with homograph support
    // Example: email-m0narch.com mimicking monarch.com (catches m0narch → monarch)
    // Split on hyphens and check each part
    const domain1Parts = domain1Base.split('-');
    const domain2Parts = domain2Base.split('-');

    // Check if any hyphenated part matches the protected domain (with homograph normalization)
    // Only flag if the FULL domain base contains hyphens (to avoid false positives)
    if (domain1Parts.length > 1) {
      for (const part of domain1Parts) {
        const normalizedPart = normalizeForHomographs(part);
        if (normalizedPart === normalizedDomain2 && domain1Base !== domain2Base) {
          console.log('[Vervain] Hyphenated domain impersonation detected:', domain1Base, 'contains hyphenated part', part, '→', normalizedPart, 'matching', domain2Base);
          return true;
        }
      }
    }

    if (domain2Parts.length > 1) {
      for (const part of domain2Parts) {
        const normalizedPart = normalizeForHomographs(part);
        if (normalizedPart === normalizedDomain1 && domain2Base !== domain1Base) {
          console.log('[Vervain] Hyphenated domain impersonation detected:', domain2Base, 'contains hyphenated part', part, '→', normalizedPart, 'matching', domain1Base);
          return true;
        }
      }
    }

    // Check for homograph attacks (exact match after normalization)
    // Exact match after normalization is definitely suspicious
    if (normalizedDomain1 === normalizedDomain2 && domain1Base !== domain2Base) {
      console.log('[Vervain] Homograph attack detected:', domain1Base, '→', normalizedDomain1, 'matches', domain2Base, '→', normalizedDomain2);
      return true;
    }
    
    // More thorough homograph check with expanded character set
    const expandedNormDomain1 = normalizeWithExpandedSet(domain1Base);
    const expandedNormDomain2 = normalizeWithExpandedSet(domain2Base);
    
    if (expandedNormDomain1 === expandedNormDomain2 && domain1Base !== domain2Base) {
              console.log('[Vervain] Advanced homograph attack detected:', domain1Base, '→', expandedNormDomain1, 'matches', domain2Base, '→', expandedNormDomain2);
      return true;
    }
    
    // Check for close visual similarity
    const similarity = levenshteinDistance(domain1Base, domain2Base) / Math.max(domain1Base.length, domain2Base.length);
    
    // If domains are very similar (less than 20% difference)
    if (similarity <= 0.2) {
      console.log('[Vervain] Domains are visually similar:', domain1Base, domain2Base, 'similarity score:', similarity);
      return true;
    }
  }
  
  // By default, domains are not considered similar
  return false;
}

// Insert warning for spoofed contact
function insertSpoofedContactWarning(senderEmail, senderName, trustedEmail) {
  // Set flag to prevent mutation observer from triggering
  isModifyingDOM = true;
  
  try {
    // Create a stable identifier for this warning (without timestamp)
    const warningId = `spoofed-${senderEmail.toLowerCase()}`;
    
    // Check if this specific warning has been dismissed since last scan
    if (window.phishguardDismissedSpoofedWarnings && window.phishguardDismissedSpoofedWarnings.has(warningId)) {
      console.log('[Vervain] Contact spoofing warning already dismissed since last scan:', warningId);
      return;
    }
    
    // Only check if we already have a warning visible
    if (document.querySelector('.phishguard-warning')) {
      return;
    }
    
    console.log('[Vervain] Inserting spoofed contact warning for:', senderName, senderEmail, trustedEmail);
  
  // Create warning element
  const warningDiv = document.createElement('div');
  warningDiv.className = 'phishguard-warning';
  warningDiv.style.position = 'fixed';
  warningDiv.style.top = '20px';
  warningDiv.style.right = '20px';
  warningDiv.style.zIndex = '9999';
  warningDiv.style.backgroundColor = '#ffffff';
  warningDiv.style.border = '2px solid #DC2626';
  warningDiv.style.borderRadius = '8px';
  warningDiv.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  warningDiv.style.padding = '16px';
  warningDiv.style.width = '350px';
  warningDiv.style.animation = 'fadeIn 0.3s';
  
  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .phishguard-button {
      padding: 8px 12px;
      border-radius: 4px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      outline: none;
    }
    .phishguard-secondary {
      background-color: #f1f5f9;
      color: #334155;
    }
  `;
  document.head.appendChild(style);
  
  // Simplified warning content - focused only on trusted contact spoofing
  warningDiv.innerHTML = `
    <div style="display: flex; align-items: center; margin-bottom: 12px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
        <path d="M12 9v4"></path>
        <path d="M12 17h.01"></path>
      </svg>
      <div style="font-weight: bold; font-size: 16px; margin-left: 8px; color: #DC2626;">⚠️ CONTACT IMPERSONATION DETECTED ⚠️</div>
      <div style="margin-left: auto; cursor: pointer;" id="phishguard-close">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6 6 18"></path>
          <path d="m6 6 12 12"></path>
        </svg>
      </div>
    </div>
    <div style="margin-bottom: 12px; font-size: 14px; color: #334155;">
      <strong>CAUTION:</strong> Someone is using a trusted contact's name but with a different email address:
    </div>
    <div style="background-color: #FEF2F2; padding: 12px; border-radius: 4px; margin-bottom: 12px;">
      <div style="font-size: 14px; margin-bottom: 4px;"><strong>From:</strong> ${senderName} &lt;${senderEmail}&gt;</div>
      <div style="font-size: 14px; margin-bottom: 4px;"><strong>Expected Email:</strong> <span style="color: #047857;">${trustedEmail}</span></div>
    </div>
    <div style="display: flex; gap-2; justify-content: center; margin-top: 16px;">
      <button id="phishguard-dismiss-spoofed" class="phishguard-button phishguard-secondary">Dismiss</button>
      <button id="phishguard-whitelist-spoofed" class="phishguard-button phishguard-primary">Mark as Safe</button>
    </div>
  `;
  
  document.body.appendChild(warningDiv);
  
  // Handle close button (X)
  document.getElementById('phishguard-close').addEventListener('click', () => {
          console.log('[Vervain] Spoofed contact warning closed by user');
    warningDiv.remove();
    chrome.runtime.sendMessage({ type: "RESET_BADGE" });
  });
  
  // Handle dismiss button - temporarily hide until next scan
  document.getElementById('phishguard-dismiss-spoofed').addEventListener('click', () => {
          console.log('[Vervain] Spoofed contact warning dismissed by user (temporary until next scan)');
    
    // Store this dismissal in memory (clears on next scan)
    if (!window.phishguardDismissedSpoofedWarnings) {
      window.phishguardDismissedSpoofedWarnings = new Set();
    }
    window.phishguardDismissedSpoofedWarnings.add(warningId);
    
    warningDiv.remove();
    chrome.runtime.sendMessage({ type: "RESET_BADGE" });
  });
  
  // Handle whitelist button - add to trusted contacts
  document.getElementById('phishguard-whitelist-spoofed').addEventListener('click', () => {
          console.log('[Vervain] Contact marked as safe by user');
    
    // Add the sender email to trusted contacts
    chrome.storage.local.get(["trustedContacts"], (result) => {
      const trustedContacts = result.trustedContacts || [];
      const newContact = {
        name: senderName,
        email: senderEmail
      };
      
      // Check if contact already exists
      const exists = trustedContacts.some(contact => 
        contact.email.toLowerCase() === senderEmail.toLowerCase()
      );
      
      if (!exists) {
        trustedContacts.push(newContact);
        chrome.storage.local.set({ trustedContacts });
        console.log('[Vervain] Added to trusted contacts:', newContact);
      }
      
      warningDiv.remove();
      chrome.runtime.sendMessage({ type: "RESET_BADGE" });
      
      // Refresh the page to clear all warnings
      console.log('[Vervain] Refreshing page after marking contact as safe');
      window.location.reload();
    });
  });
  
  // Notify background script
  chrome.runtime.sendMessage({ type: "PHISHING_DETECTED" });
  
  } catch (error) {
    console.error('[Vervain] Error inserting spoofed contact warning:', error);
  } finally {
    // Reset flag after DOM modification
    isModifyingDOM = false;
  }
}

// Check if a sender is spoofing a trusted contact
function checkTrustedContactSpoofing(senderName, senderEmail, trustedContacts) {
  try {
    console.log('[Vervain] Checking trusted contact spoofing for:', senderName, senderEmail);
    
    if (!trustedContacts || trustedContacts.length === 0) {
      return null;
    }
    
    // Step 1: Hash-based exact contact lookup (O(1) performance)
    const trustedContactSet = new Set();
    const trustedDomains = new Set();
    
    // Build hash sets for fast lookup
    trustedContacts.forEach(contact => {
      const key = `${contact.email.toLowerCase()}|${contact.name.toLowerCase()}`;
      trustedContactSet.add(key);
      trustedDomains.add(extractDomain(contact.email).toLowerCase());
    });
    
    // Check for exact match first (fastest path)
    const senderKey = `${senderEmail.toLowerCase()}|${senderName.toLowerCase()}`;
    if (trustedContactSet.has(senderKey)) {
      console.log('[Vervain] Exact trusted contact match found:', senderEmail);
      return null; // No spoofing - exact match
    }
    
    // Step 2: Check for similar names in trusted domains (only if no exact match)
    const senderDomain = extractDomain(senderEmail).toLowerCase();
    
    // If sender domain is trusted, check for name similarity
    if (trustedDomains.has(senderDomain)) {
      console.log('[Vervain] Sender domain is trusted, checking for name similarity');
      
      // Find contacts with similar names in this domain
      const similarContacts = trustedContacts.filter(contact => {
        const contactDomain = extractDomain(contact.email).toLowerCase();
        if (contactDomain !== senderDomain) return false;
        
        // Check if names are similar (exact match or contains)
        const contactName = contact.name.toLowerCase();
        const senderNameLower = senderName.toLowerCase();
        
        // Exact name match
        if (contactName === senderNameLower) return true;
        
        // Partial name match (first or last name)
        const contactNameParts = contactName.split(' ');
        const senderNameParts = senderNameLower.split(' ');
        
        // Check if any name parts match
        return contactNameParts.some(part => 
          senderNameParts.some(senderPart => 
            part === senderPart || part.includes(senderPart) || senderPart.includes(part)
          )
        );
      });
      
      if (similarContacts.length > 0) {
        console.log('[Vervain] Similar name found in trusted domain:', similarContacts[0].email);
        return similarContacts[0].email; // Potential spoofing
      }
    }
    
    // Step 3: Check for exact name matches across all domains (legacy behavior)
    const exactNameMatches = trustedContacts.filter(contact => 
      contact.name.toLowerCase() === senderName.toLowerCase()
    );
    
    if (exactNameMatches.length > 0) {
      // Check if sender email is different from trusted contact email
      const trustedEmail = exactNameMatches[0].email;
      if (trustedEmail.toLowerCase() !== senderEmail.toLowerCase()) {
        console.log('[Vervain] Spoofed contact detected - exact name match:', senderName, 'using', senderEmail, 'instead of', trustedEmail);
        console.log('[Vervain] Returning trusted email for warning:', trustedEmail);
        return trustedEmail;
      }
    }
    
    return null; // No spoofing detected
    
  } catch (error) {
          console.error('[Vervain] Error checking trusted contact spoofing:', error);
    return null;
  }
}

// Scan sender domains for phishing attempts
function scanSenderDomains(primaryDomain, variations, additionalDomains, whitelistedDomains, blockedDomains, trustedContacts) {
  // Try multiple selectors for better compatibility
  const senderElements = document.querySelectorAll('.gD[email], .go[email], .g2[email]');
  console.log('[Vervain] Found sender elements:', senderElements.length);
  
  senderElements.forEach(element => {
    try {
      const senderEmail = element.getAttribute('email');
      if (!senderEmail) return;
      
      // Get sender name (display name)
      const senderName = element.innerText || '';
      
      // First check for trusted contact spoofing
      if (trustedContacts && trustedContacts.length > 0) {
        const trustedEmail = checkTrustedContactSpoofing(senderName, senderEmail, trustedContacts);
        if (trustedEmail) {
          // Show both the popup warning AND the horizontal banner above the email
          insertSpoofedContactWarning(senderEmail, senderName, trustedEmail);
          addContactImpersonationIndicator(element, senderName, senderEmail, trustedEmail);
          return;
        }
      }
      
      const senderDomain = extractDomain(senderEmail);
      if (!senderDomain) return;
      
              console.log('[Vervain] Checking sender domain:', senderDomain);
      
      // Skip if domain is whitelisted
      if (isDomainWhitelisted(senderDomain, whitelistedDomains)) {
        console.log('[Vervain] Domain is whitelisted:', senderDomain);
        return;
      }
      
      // Check if domain is blocked
      if (isDomainBlocked(senderDomain, blockedDomains)) {
        console.log('[Vervain] Domain is blocked:', senderDomain);
        insertWarning(senderEmail, senderDomain, 'Blocked Domain');
        return;
      }
      
      // Skip checks for common email providers
      const commonProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com'];
      if (commonProviders.includes(senderDomain) && (!primaryDomain || !additionalDomains || additionalDomains.length === 0)) {
        console.log('[Vervain] Skipping check for common email provider:', senderDomain);
        return;
      }
      
      // Check against primary domain
      if (primaryDomain && isSimilarDomain(senderDomain, primaryDomain)) {
        console.log('[Vervain] Domain is similar to primary domain:', senderDomain);
        // The sender domain is the suspicious one
        insertWarning(senderEmail, senderDomain, primaryDomain);
        return;
      }
      
      // Check against additional domains
      if (additionalDomains && additionalDomains.length > 0) {
        for (const additionalDomain of additionalDomains) {
          if (!additionalDomain) continue;
          
          
          if (isSimilarDomain(senderDomain, additionalDomain)) {
            console.log('[Vervain] Domain is similar to additional domain:', senderDomain, additionalDomain);
            // FIXED: The sender domain is always the suspicious one
            insertWarning(senderEmail, senderDomain, additionalDomain);
            return;
          }
        }
      }
      
      // Check against known variations
      if (variations && variations.length > 0) {
        if (isDomainSuspicious(senderDomain, primaryDomain, variations)) {
          console.log('[Vervain] Domain matches a known variation:', senderDomain);
          insertWarning(senderEmail, senderDomain, primaryDomain);
          return;
        }
      }
    } catch (error) {
      console.error('[Vervain] Error checking sender domain:', error);
    }
  });
}

// Add the levenshteinDistance function that was missing
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  
  // Create a matrix of size (m+1) x (n+1)
  const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));
  
  // Initialize the matrix
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }
  
  // Fill the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }
  
  return dp[m][n];
}

// Scan for phishing with local data to avoid extension context issues
function scanForPhishing() {
  // Prevent recursive scanning
  if (isCurrentlyScanning) {
    console.log('[Vervain] Scan already in progress, skipping...');
    return;
  }
  
  isCurrentlyScanning = true;
  
  try {
    console.log('[Vervain] Running scan...');
    
    // Try to use cached settings from localStorage if available
    const getCachedSettings = () => {
      try {
        const cachedSettings = localStorage.getItem('phishguard-settings');
        if (cachedSettings) {
          return JSON.parse(cachedSettings);
        }
      } catch (error) {
        console.error('[Vervain] Error getting cached settings:', error);
      }
      return null;
    };
  
    // Save settings to localStorage for future use
    const cacheSettings = (settings) => {
      try {
        localStorage.setItem('phishguard-settings', JSON.stringify(settings));
        console.log('[Vervain] Settings cached to localStorage');
      } catch (error) {
        console.error('[Vervain] Error caching settings:', error);
      }
    };
  
    // Helper function to safely check if extension context is valid
    function isExtensionContextValid() {
      try {
        return chrome && chrome.runtime && chrome.runtime.id;
      } catch (error) {
        return false;
      }
    }
  
    // Helper function to safely call Chrome storage APIs
    function safeChromeStorageCall(operation, fallback = null) {
      if (!isExtensionContextValid()) {
        console.warn('[Vervain] Extension context not available, using fallback');
        return fallback;
      }
      
      try {
        return operation();
      } catch (error) {
        console.error('[Vervain] Chrome API error:', error);
        return fallback;
      }
    }
  
    // Function to process settings and run scans
    const processSettings = (settings) => {
      try {
        if (!settings) {
          console.log('[Vervain] No settings available');
          return;
        }
        
        // Only require setup completion for domain scanning, not trusted contact scanning
        if (!settings.setupComplete && (!settings.trustedContacts || settings.trustedContacts.length === 0)) {
          console.log('[Vervain] Setup not complete and no trusted contacts configured');
          return;
        }

        // Check if both detection types are disabled
        const domainDetectionEnabled = settings.domainDetectionEnabled !== false;
        const contactDetectionEnabled = settings.contactDetectionEnabled !== false;

        if (!domainDetectionEnabled && !contactDetectionEnabled) {
          console.log('[Vervain] All detection disabled');
          return;
        }
        
        // Only initialize dismissed warnings sets if they don't exist (don't clear on every scan)
        if (!window.phishguardDismissedWarnings) {
          window.phishguardDismissedWarnings = new Set();
        }
        if (!window.phishguardDismissedSpoofedWarnings) {
          window.phishguardDismissedSpoofedWarnings = new Set();
        }
        
        const primaryDomain = settings.primaryDomain || '';
        const variations = settings.variations || [];
        const whitelistedDomains = settings.whitelistedDomains || [];
        const blockedDomains = settings.blockedDomains || [];
        const additionalDomains = settings.additionalDomains || [];
        const trustedContacts = settings.trustedContacts || [];
        const autoAddDomains = settings.autoAddDomains || false; // New configuration option
        
        console.log('[Vervain] Processing with settings:', {
          primaryDomain,
          variationsCount: variations.length,
          additionalDomainsCount: additionalDomains.length,
          whitelistedCount: whitelistedDomains.length,
          blockedCount: blockedDomains.length,
          trustedContactsCount: trustedContacts.length,
          autoAddDomains: autoAddDomains
        });
        
        // Don't scan if no valid domains or trusted contacts are configured
        if ((!primaryDomain || primaryDomain === '') && 
            (!additionalDomains || additionalDomains.length === 0) &&
            (!trustedContacts || trustedContacts.length === 0)) {
          console.log('[Vervain] No valid domains or trusted contacts configured to protect');
          return;
        }
        
        // Run trusted contacts check if enabled and we have contacts configured
        if (contactDetectionEnabled && trustedContacts && trustedContacts.length > 0) {
          console.log('[Vervain] Scanning for trusted contact spoofing...');
          scanTrustedContacts(trustedContacts, autoAddDomains);
        }

        // Run domain monitoring if enabled and domains are configured
        if (domainDetectionEnabled && ((primaryDomain && primaryDomain !== '') || (additionalDomains && additionalDomains.length > 0))) {
          console.log('[Vervain] Scanning for domain spoofing...');
          scanDomains(primaryDomain, variations, additionalDomains, whitelistedDomains, blockedDomains);
        }
      } catch (error) {
        console.error('[Vervain] Error processing settings:', error);
      }
    };
    
    // First try to use cached settings
    const cachedSettings = getCachedSettings();
    
    // If extension context is invalid, use cached settings if available
    if (!isExtensionContextValid()) {
      console.log('[Vervain] Extension context not available, using cached settings');
      if (cachedSettings) {
        processSettings(cachedSettings);
      } else {
        console.log('[Vervain] No cached settings available');
      }
      return;
    }
    
    // If we have a valid extension context, try to get fresh settings
    try {
      console.log('[Vervain] Attempting to get settings from extension...');
      
      // Use safe wrapper for Chrome API calls
      safeChromeStorageCall(() => {
        chrome.storage.local.get([
          "setupComplete",
          "detectionEnabled", // Legacy - for migration
          "domainDetectionEnabled",
          "contactDetectionEnabled",
          "primaryDomain",
          "variations",
          "whitelistedDomains",
          "blockedDomains",
          "additionalDomains",
          "trustedContacts",
          "autoAddDomains"
        ], (settings) => {
          // Check for runtime errors
          if (chrome.runtime.lastError) {
            console.error('[Vervain] Runtime error getting settings:', chrome.runtime.lastError);
            
            // Use cached settings as fallback
            if (cachedSettings) {
              console.log('[Vervain] Using cached settings after runtime error');
              processSettings(cachedSettings);
            }
            return;
          }
          
          // Cache the settings we just received
          cacheSettings(settings);
          
          // Process the settings
          processSettings(settings);
        });
      });
    } catch (error) {
      console.error('[Vervain] Error getting settings:', error);
      
      // If we have cached settings, use them as fallback
      if (cachedSettings) {
        console.log('[Vervain] Using cached settings after error');
        processSettings(cachedSettings);
      }
    }
  } finally {
    isCurrentlyScanning = false;
  }
}

// Function dedicated to trusted contact spoofing detection
function scanTrustedContacts(trustedContacts, autoAddDomains) {
  console.log('[Vervain] Scanning for trusted contact spoofing');
  
  // Try multiple selectors for better compatibility
  const senderElements = document.querySelectorAll('.gD[email], .go[email], .g2[email]');
  console.log('[Vervain] Found sender elements:', senderElements.length);
  
  senderElements.forEach(element => {
    try {
      const senderEmail = element.getAttribute('email');
      if (!senderEmail) return;
      
      // Get sender name (display name)
      const senderName = element.innerText || '';
      
      // Only check for trusted contact spoofing
      const trustedEmail = checkTrustedContactSpoofing(senderName, senderEmail, trustedContacts);
      if (trustedEmail) {
        // Show both the popup warning AND the horizontal banner above the email
        insertSpoofedContactWarning(senderEmail, senderName, trustedEmail);
        addContactImpersonationIndicator(element, senderName, senderEmail, trustedEmail);

        // If autoAddDomains is true, add the sender's domain to the whitelist
        if (autoAddDomains) {
          const senderDomain = extractDomain(senderEmail);
          if (senderDomain && !isDomainWhitelisted(senderDomain, trustedContacts.map(c => c.email))) {
            console.log('[Vervain] Auto-adding trusted contact\'s domain to whitelist:', senderDomain);
            
            safeChromeStorageCall(() => {
              chrome.storage.local.get(["whitelistedDomains"], (result) => {
                if (chrome.runtime.lastError) {
                  console.error('[Vervain] Error getting whitelisted domains:', chrome.runtime.lastError);
                  return;
                }
                
                const whitelistedDomains = result.whitelistedDomains || [];
                if (!whitelistedDomains.includes(senderDomain)) {
                  whitelistedDomains.push(senderDomain);
                  
                  safeChromeStorageCall(() => {
                    chrome.storage.local.set({ whitelistedDomains }, () => {
                      if (chrome.runtime.lastError) {
                        console.error('[Vervain] Error setting whitelisted domains:', chrome.runtime.lastError);
                      } else {
                        console.log('[Vervain] Added to whitelist:', senderDomain);
                      }
                    });
                  });
                }
              });
            });
          }
        }
      }
    } catch (error) {
      console.error('[Vervain] Error checking trusted contacts:', error);
    }
  });
}

// Function dedicated to domain monitoring
function scanDomains(primaryDomain, variations, additionalDomains, whitelistedDomains, blockedDomains) {
  console.log('[Vervain] Scanning for domain spoofing');
  
  // Don't scan if no domains to protect
  const domainsToProtect = [primaryDomain, ...additionalDomains].filter(Boolean);
  if (domainsToProtect.length === 0) {
    console.log('[Vervain] No domains to protect');
    return;
  }
  
  console.log('[Vervain] Domains to protect:', domainsToProtect);
  
  // Scan for suspicious sender domains
  // Try multiple selectors for better compatibility
  const senderElements = document.querySelectorAll('.gD[email], .go[email], .g2[email]');
  
  senderElements.forEach(element => {
    try {
      const senderEmail = element.getAttribute('email');
      if (!senderEmail) return;
      
      const senderDomain = extractDomain(senderEmail);
      if (!senderDomain) return;
      
      // Skip if sender domain is already a protected domain (legitimate sender)
      if (domainsToProtect.includes(senderDomain)) {
        return;
      }

      // NEW: Skip if sender domain is a legitimate subdomain of a protected domain
      const isLegitimateSubdomain = domainsToProtect.some(protectedDomain => {
        return senderDomain.endsWith('.' + protectedDomain);
      });
      if (isLegitimateSubdomain) {
        console.log('[Vervain] Skipping legitimate subdomain:', senderDomain);
        return;
      }

      // Skip if domain is whitelisted
      if (isDomainWhitelisted(senderDomain, whitelistedDomains)) {
        console.log('[Vervain] Domain is whitelisted:', senderDomain);
        return;
      }
      
      // Check if domain is blocked
      if (isDomainBlocked(senderDomain, blockedDomains)) {
        console.log('[Vervain] Domain is blocked:', senderDomain);
        insertWarning(senderEmail, senderDomain, 'Blocked Domain');
        return;
      }
      
      // Check against each protected domain
      for (const protectedDomain of domainsToProtect) {
        // Skip if protected domain is invalid
        if (!protectedDomain) continue;
        
        // Check for domain similarity - clearly mark which is which
        if (isSimilarDomain(senderDomain, protectedDomain)) {
          console.log('[Vervain] Found similar domain:', senderDomain, 'similar to protected domain:', protectedDomain);
          insertWarning(senderEmail, senderDomain, protectedDomain);
          return;
        }
      }
      
      // Check against known variations
      if (variations && variations.length > 0 && primaryDomain) {
        if (isDomainSuspicious(senderDomain, primaryDomain, variations)) {
          console.log('[Vervain] Domain matches a known variation:', senderDomain);
          insertWarning(senderEmail, senderDomain, primaryDomain);
        }
      }
    } catch (error) {
      console.error('[Vervain] Error checking sender domain:', error);
    }
  });
  
  // Scan email content for suspicious links
  const emailContainers = document.querySelectorAll('.a3s');
  emailContainers.forEach(container => {
    // Skip if this container is already scanned
    if (container.hasAttribute('data-phishguard-scanned')) {
      return;
    }
    
    // Mark as scanned to avoid duplicate checks
    container.setAttribute('data-phishguard-scanned', 'true');
    
    // Only scan actual hyperlinks, not embedded text
    const links = container.querySelectorAll('a[href]');
    let suspiciousLinksFound = 0; // Track how many suspicious links we find
    
    links.forEach(link => {
      try {
        // Skip if already warned
        if (link.hasAttribute('data-phishguard-warned')) {
          return;
        }
        
        const url = link.href;
        if (!url || url.startsWith('mailto:')) return;
        
        let urlDomain;
        try {
          urlDomain = new URL(url).hostname;
        } catch (e) {
          console.log('[Vervain] Invalid URL:', url);
          return;
        }
        
        // Skip if domain is whitelisted
        if (isDomainWhitelisted(urlDomain, whitelistedDomains)) {
          return;
        }

        // Skip if URL domain is already a protected domain (legitimate link)
        if (domainsToProtect.includes(urlDomain)) {
          return;
        }

        // NEW: Skip if URL domain is a legitimate subdomain of a protected domain
        const isLegitimateSubdomain = domainsToProtect.some(protectedDomain => {
          return urlDomain.endsWith('.' + protectedDomain);
        });
        if (isLegitimateSubdomain) {
          console.log('[Vervain] Skipping legitimate subdomain link:', urlDomain);
          return;
        }

        // Check link against protected domains
        for (const protectedDomain of domainsToProtect) {
          if (!protectedDomain) continue;
          
          if (isSimilarDomain(urlDomain, protectedDomain)) {
            console.log('[Vervain] Found suspicious URL:', url, 'similar to:', protectedDomain);
            
            // Mark this link as suspicious
            link.style.backgroundColor = '#FECACA';
            link.style.color = '#DC2626';
            link.style.fontWeight = 'bold';
            link.style.padding = '2px 4px';
            link.style.border = '1px solid #DC2626';
            link.style.borderRadius = '3px';
            link.style.textDecoration = 'line-through';
            
            // Mark this link as already warned
            link.setAttribute('data-phishguard-warned', 'true');
            
            // Add warning icon but only one (remove existing if present)
            const existingWarning = link.nextSibling;
            if (existingWarning && existingWarning.nodeType === Node.ELEMENT_NODE && existingWarning.classList.contains('phishguard-warning-icon')) {
              existingWarning.remove();
            }
            
            const warningIcon = document.createElement('span');
            warningIcon.innerHTML = '⚠️';
            warningIcon.className = 'phishguard-warning-icon';
            warningIcon.title = 'Vervain: This URL may be impersonating ' + protectedDomain;
            link.parentNode.insertBefore(warningIcon, link.nextSibling);
            
            // Only show warning notification for the first few suspicious links
            if (suspiciousLinksFound <= 3) { // Limit to 3 alerts max
              insertWarning(url, urlDomain, protectedDomain);
            }
            
            suspiciousLinksFound++;
            
            // Prevent click
            link.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              alert(`⚠️ Vervain Warning: This link may be impersonating ${protectedDomain}`);
              return false;
            }, true);
            
            break; // Stop checking this link against other protected domains
          }
        }
      } catch (error) {
        console.error('[Vervain] Error checking link:', error);
      }
    });
    
    // If we found suspicious links, add a warning header to the email
    if (suspiciousLinksFound > 0) {
      // Check if we already added a warning header
      if (!container.querySelector('.phishguard-email-warning')) {
        const warningHeader = document.createElement('div');
        warningHeader.className = 'phishguard-email-warning';
        warningHeader.style.backgroundColor = '#FEF2F2';
        warningHeader.style.color = '#DC2626';
        warningHeader.style.padding = '8px 12px';
        warningHeader.style.marginBottom = '15px';
        warningHeader.style.borderRadius = '4px';
        warningHeader.style.border = '1px solid #DC2626';
        warningHeader.style.fontWeight = 'bold';
        warningHeader.style.fontSize = '14px';
        
                  warningHeader.innerHTML = `⚠️ Vervain has detected ${suspiciousLinksFound} suspicious link${suspiciousLinksFound > 1 ? 's' : ''} in this email that may be attempting to impersonate legitimate domains.`;
        
        // Insert at the top of the container
        if (container.firstChild) {
          container.insertBefore(warningHeader, container.firstChild);
        } else {
          container.appendChild(warningHeader);
        }
      }
    }
  });
}

// Clear dismissed warnings only on fresh page load (not on every scan)
if (window.performance && window.performance.navigation.type === window.performance.navigation.TYPE_RELOAD) {
  console.log('[Vervain] Page reloaded, clearing dismissed warnings');
  if (window.phishguardDismissedWarnings) {
    window.phishguardDismissedWarnings.clear();
  }
  if (window.phishguardDismissedSpoofedWarnings) {
    window.phishguardDismissedSpoofedWarnings.clear();
  }
}

// Set up mutation observer to detect when new emails are loaded
setTimeout(() => {
  try {
    // Check if extension context is still valid
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      console.log('[Vervain] Extension context not available for observer setup');
      return;
    }
    
    // Find potential targets for the observer
    const targets = document.querySelectorAll('.AO, .nH');
    
    if (targets.length === 0) {
      console.log('[Vervain] No suitable targets found for observer');
      return;
    }
    
    // Create a mutation observer to detect when new emails are loaded
    const observer = new MutationObserver((mutations) => {
      // Don't use chrome APIs directly in the observer callback
      // Just call scanForPhishing which has its own checks
      try {
        // Skip if we're currently modifying the DOM ourselves
        if (isModifyingDOM) {
          console.log('[Vervain] Skipping scan - we are modifying DOM');
          return;
        }
        
        // Skip if we're already scanning
        if (isCurrentlyScanning) {
          console.log('[Vervain] Skipping scan - already in progress');
          return;
        }
        
        console.log('[Vervain] DOM mutations detected, scanning...');
        
        // Check if extension context is still valid before scanning
        if (typeof chrome === 'undefined' || !chrome.runtime) {
          console.log('[Vervain] Extension context invalidated during observation');
          observer.disconnect();
          return;
        }
        
        // Use requestAnimationFrame to delay the scan slightly
        // This helps avoid context invalidation issues
        requestAnimationFrame(() => {
          scanForPhishing();
        });
      } catch (error) {
        console.error('[Vervain] Error in mutation observer callback:', error);
        
        // If we get an error, disconnect the observer to prevent further issues
        try {
          observer.disconnect();
        } catch (disconnectError) {
          console.error('[Vervain] Error disconnecting observer:', disconnectError);
        }
      }
    });
    
    // Set up the observer on each potential target
    targets.forEach(target => {
      observer.observe(target, { 
        childList: true, 
        subtree: true
      });
    });
    
    console.log('[Vervain] Observers set up on targets:', targets.length);
    
    // Run an initial scan
    scanForPhishing();
  } catch (error) {
    console.error('[Vervain] Error setting up observer:', error);
  }
}, 1000);

// Force scan when tab becomes active
document.addEventListener('visibilitychange', () => {
  // Check if extension context is still valid
  if (typeof chrome === 'undefined' || !chrome.runtime) {
          console.log('[Vervain] Extension context not available for visibility change');
    return;
  }
  
  if (document.visibilityState === 'visible') {
          console.log('[Vervain] Tab became visible, scanning...');
    scanForPhishing();
  }
});
