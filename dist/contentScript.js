// Content script for Vervain - thin DOM-only layer
// All detection logic lives in the service worker; this script extracts
// sender data from the Gmail DOM, sends it to the background for scanning,
// and renders the resulting verdicts.

let isCurrentlyScanning = false;
let isModifyingDOM = false;

// Dismissed warnings (cleared on page reload)
const dismissedWarnings = new Set();
const dismissedContactWarnings = new Set();

// --- Helpers ---

function extractDomain(email) {
  const match = email.match(/@([^@]+)$/);
  return match ? match[1] : '';
}

function isExtensionContextValid() {
  return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
}

// --- Warning UI ---

// NOTE: The innerHTML usage below renders extension-owned UI with data
// returned from our own service worker (verdict objects). No untrusted
// user input is interpolated — the sender email / domain / evidence
// strings originate from Gmail DOM attributes that Chrome already
// sanitises, and they are only displayed inside fixed layout templates.

function insertWarning(senderEmail, domain, verdict) {
  const warningId = 'domain-' + domain.toLowerCase();
  if (dismissedWarnings.has(warningId)) return;
  if (document.querySelector('.phishguard-warning')) return;

  isModifyingDOM = true;
  try {
    const warningDiv = document.createElement('div');
    warningDiv.className = 'phishguard-warning';
    warningDiv.style.cssText =
      'position:fixed;top:20px;right:20px;z-index:9999;' +
      'background:#fff;border:2px solid #DC2626;border-radius:8px;' +
      'box-shadow:0 4px 12px rgba(0,0,0,0.15);padding:16px;width:350px;' +
      'animation:vervain-fadeIn 0.3s;' +
      'font-family:Google Sans,Roboto,Arial,sans-serif;font-size:14px;color:#334155;';

    // Build warning content safely using DOM APIs
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;margin-bottom:12px;';

    const icon = document.createElement('span');
    icon.style.cssText = 'font-size:18px;margin-right:8px;';
    icon.textContent = '\u26A0\uFE0F';

    const title = document.createElement('div');
    title.style.cssText = 'font-weight:bold;font-size:15px;color:#DC2626;flex:1;';
    title.textContent = 'Suspicious Email Domain';

    const closeBtn = document.createElement('div');
    closeBtn.style.cssText = 'cursor:pointer;font-size:18px;color:#64748b;margin-left:8px;';
    closeBtn.textContent = '\u2715';

    header.appendChild(icon);
    header.appendChild(title);
    header.appendChild(closeBtn);

    const ruleDiv = document.createElement('div');
    ruleDiv.style.cssText = 'margin-bottom:12px;';
    const ruleLabel = document.createElement('strong');
    ruleLabel.textContent = 'Rule: ';
    ruleDiv.appendChild(ruleLabel);
    ruleDiv.appendChild(document.createTextNode(verdict.rule));

    const detailBox = document.createElement('div');
    detailBox.style.cssText = 'background:#FEF2F2;padding:12px;border-radius:4px;margin-bottom:12px;';

    const fromLine = document.createElement('div');
    fromLine.style.marginBottom = '4px';
    const fromLabel = document.createElement('strong');
    fromLabel.textContent = 'From: ';
    fromLine.appendChild(fromLabel);
    fromLine.appendChild(document.createTextNode(senderEmail));

    const domainLine = document.createElement('div');
    domainLine.style.marginBottom = '4px';
    const domainLabel = document.createElement('strong');
    domainLabel.textContent = 'Domain: ';
    const domainSpan = document.createElement('span');
    domainSpan.style.color = '#DC2626';
    domainSpan.textContent = domain;
    domainLine.appendChild(domainLabel);
    domainLine.appendChild(domainSpan);

    const evidenceLine = document.createElement('div');
    evidenceLine.style.cssText = 'font-size:13px;color:#64748b;';
    evidenceLine.textContent = verdict.evidence;

    detailBox.appendChild(fromLine);
    detailBox.appendChild(domainLine);
    detailBox.appendChild(evidenceLine);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;justify-content:center;';

    const dismissBtn = document.createElement('button');
    dismissBtn.textContent = 'Dismiss';
    dismissBtn.style.cssText = 'padding:8px 12px;border-radius:4px;font-weight:500;cursor:pointer;border:none;background:#f1f5f9;color:#334155;';

    btnRow.appendChild(dismissBtn);

    warningDiv.appendChild(header);
    warningDiv.appendChild(ruleDiv);
    warningDiv.appendChild(detailBox);
    warningDiv.appendChild(btnRow);

    document.body.appendChild(warningDiv);

    closeBtn.addEventListener('click', function() {
      warningDiv.remove();
      chrome.runtime.sendMessage({ type: 'RESET_BADGE' });
    });
    dismissBtn.addEventListener('click', function() {
      dismissedWarnings.add(warningId);
      warningDiv.remove();
      chrome.runtime.sendMessage({ type: 'RESET_BADGE' });
    });

    chrome.runtime.sendMessage({ type: 'PHISHING_DETECTED' });
  } catch (error) {
    console.error('[Vervain] Error inserting warning:', error);
  } finally {
    isModifyingDOM = false;
  }
}

function addContactImpersonationIndicator(element, senderName, senderEmail, evidence) {
  var warningKey = senderEmail.toLowerCase();
  if (dismissedContactWarnings.has(warningKey)) return;

  isModifyingDOM = true;
  try {
    var emailContainer = element;
    var depth = 0;
    while (emailContainer && !emailContainer.classList.contains('zA') && !emailContainer.classList.contains('zF') && depth < 10) {
      emailContainer = emailContainer.parentElement;
      depth++;
    }
    if (!emailContainer) return;

    var existing = emailContainer.querySelector('.phishguard-contact-indicator');
    if (existing) existing.remove();

    var indicator = document.createElement('div');
    indicator.className = 'phishguard-contact-indicator';
    indicator.style.cssText =
      'background:#fff;color:#334155;padding:16px;margin:8px 0;' +
      'border:2px solid #DC2626;border-radius:8px;' +
      'font-family:Google Sans,Roboto,Arial,sans-serif;font-size:14px;font-weight:500;' +
      'box-shadow:0 4px 12px rgba(0,0,0,0.15);position:relative;z-index:1000;';

    var titleDiv = document.createElement('div');
    titleDiv.style.cssText = 'font-weight:600;margin-bottom:4px;';
    titleDiv.textContent = 'Potential Contact Impersonation';

    var detailDiv = document.createElement('div');
    detailDiv.style.cssText = 'font-size:13px;opacity:0.9;line-height:1.4;';
    var nameB = document.createElement('strong');
    nameB.textContent = senderName;
    detailDiv.appendChild(nameB);
    detailDiv.appendChild(document.createTextNode(' (' + senderEmail + ') \u2014 ' + evidence));

    indicator.appendChild(titleDiv);
    indicator.appendChild(detailDiv);

    emailContainer.insertBefore(indicator, emailContainer.firstChild);
    chrome.runtime.sendMessage({ type: 'PHISHING_DETECTED' });
  } catch (error) {
    console.error('[Vervain] Error adding contact indicator:', error);
  } finally {
    isModifyingDOM = false;
  }
}

// --- Email data extraction ---

function extractEmailData() {
  var senderEl = document.querySelector('.gD[email]');
  var senderEmail = senderEl ? senderEl.getAttribute('email') : '';
  var senderName = senderEl ? (senderEl.getAttribute('name') || senderEl.innerText || '') : '';

  var subjectEl = document.querySelector('.hP');
  var subject = subjectEl ? subjectEl.innerText : '';

  var bodyEl = document.querySelector('.a3s.aiL');
  var body = '';
  var truncated = false;
  var originalLength = 0;
  var cleanBodyEl = null;
  if (bodyEl) {
    cleanBodyEl = bodyEl.cloneNode(true);
    cleanBodyEl.querySelectorAll(
      '.phishguard-email-warning, .phishguard-contact-indicator, .phishguard-warning-icon, ' +
      '.vervain-ai-results, .vervain-ai-btn, .vervain-link-badge, .vervain-link-warn, .phishguard-warning'
    ).forEach(function(el) { el.remove(); });
    // Also strip any Vervain-injected inline styling artifacts from links
    cleanBodyEl.querySelectorAll('[data-vervain-link-scanned]').forEach(function(el) {
      el.removeAttribute('title');
    });

    body = cleanBodyEl.innerText || '';
    originalLength = body.length;
    if (body.length > 80000) {
      body = body.substring(0, 80000);
      truncated = true;
    }
  }

  var urls = [];
  if (cleanBodyEl) {
    cleanBodyEl.querySelectorAll('a[href]').forEach(function(link) {
      var href = link.getAttribute('href');
      if (href && !href.startsWith('mailto:') && !href.startsWith('#')) {
        urls.push(href);
      }
    });
  }

  return { senderName: senderName, senderEmail: senderEmail, subject: subject, body: body, urls: urls, truncated: truncated, originalLength: originalLength };
}

// --- AI / Deep Scan Results Panel ---

function buildResultsPanelHTML(result) {
  var confidence = result.confidence;
  var label = result.label;
  var pushed = result.pushed;
  var verify = result.verify;
  var reasoning = result.reasoning;

  var color, bgColor, borderColor, barColor;
  if (label === 'safe') {
    color = '#15803d'; bgColor = '#f0fdf4'; borderColor = '#86efac'; barColor = '#22c55e';
  } else if (label === 'caution') {
    color = '#a16207'; bgColor = '#fefce8'; borderColor = '#fde047'; barColor = '#eab308';
  } else {
    color = '#dc2626'; bgColor = '#fef2f2'; borderColor = '#fca5a5'; barColor = '#ef4444';
  }

  var pushedKeys = [
    { key: 'pressure', label: 'Pressure' }, { key: 'urgency', label: 'Urgency' },
    { key: 'surprise', label: 'Surprise' }, { key: 'highStakes', label: 'High-stakes' },
    { key: 'excitement', label: 'Excitement' }, { key: 'desperation', label: 'Desperation' }
  ];

  // Build PUSHED section with DOM
  var pushedContainer = document.createElement('div');
  pushedKeys.forEach(function(p) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:flex-start;gap:6px;margin-bottom:4px;';
    if (pushed && pushed[p.key] && pushed[p.key].detected) {
      var dot = document.createElement('span');
      dot.style.cssText = 'color:' + color + ';font-weight:600;flex-shrink:0;';
      dot.textContent = '\u25CF';
      var text = document.createElement('span');
      var b = document.createElement('strong');
      b.textContent = p.label;
      text.appendChild(b);
      if (pushed[p.key].evidence) {
        text.appendChild(document.createTextNode(' \u2014 ' + pushed[p.key].evidence));
      }
      row.appendChild(dot);
      row.appendChild(text);
    } else {
      var circle = document.createElement('span');
      circle.style.color = '#94a3b8';
      circle.textContent = '\u25CB ' + p.label;
      row.appendChild(circle);
    }
    pushedContainer.appendChild(row);
  });

  // Build VERIFY section with DOM
  var verifyLabels = {
    view: 'View Carefully',
    evaluate: 'Evaluate Context',
    request: 'Request Examination',
    interrogate: 'Interrogate Action',
    freeze: 'Freeze Indicators',
    instincts: 'Your Instincts'
  };
  var verifyContainer = document.createElement('div');
  if (verify && verify.length > 0) {
    verify.forEach(function(v) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:flex-start;gap:6px;margin-bottom:4px;';
      var icon = document.createElement('span');
      if (v.status === 'warning') {
        icon.style.cssText = 'color:' + color + ';font-weight:bold;flex-shrink:0;';
        icon.textContent = '!';
      } else {
        icon.style.cssText = 'color:#22c55e;font-weight:bold;flex-shrink:0;';
        icon.textContent = '\u2713';
      }
      var text = document.createElement('span');
      var flagName = verifyLabels[v.flag] || v.flag;
      text.appendChild(document.createTextNode(v.detail));
      row.appendChild(icon);
      row.appendChild(text);
      verifyContainer.appendChild(row);
    });
  }

  // Build full panel with DOM
  var panel = document.createElement('div');
  panel.style.cssText =
    'font-family:Google Sans,Roboto,Arial,sans-serif;font-size:13px;color:#334155;' +
    'background:' + bgColor + ';border:1px solid ' + borderColor + ';border-radius:8px;' +
    'padding:16px;margin:8px 0 12px 0;position:relative;z-index:100;';

  var headerRow = document.createElement('div');
  headerRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;';
  var panelTitle = document.createElement('div');
  panelTitle.style.cssText = 'font-weight:600;font-size:14px;color:' + color + ';';
  panelTitle.textContent = 'AI Phishing Analysis';
  var collapseBtn = document.createElement('button');
  collapseBtn.className = 'vervain-ai-collapse';
  collapseBtn.style.cssText = 'background:none;border:none;cursor:pointer;color:#94a3b8;font-size:18px;padding:0 4px;';
  collapseBtn.title = 'Collapse';
  collapseBtn.textContent = '\u25B2';
  headerRow.appendChild(panelTitle);
  headerRow.appendChild(collapseBtn);

  var panelBody = document.createElement('div');
  panelBody.className = 'vervain-ai-panel-body';

  // Confidence bar
  var confSection = document.createElement('div');
  confSection.style.marginBottom = '12px';
  var confRow = document.createElement('div');
  confRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:4px;';
  var confLabel = document.createElement('span');
  confLabel.style.fontWeight = '600';
  confLabel.textContent = 'Confidence:';
  var barOuter = document.createElement('div');
  barOuter.style.cssText = 'flex:1;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;';
  var barInner = document.createElement('div');
  barInner.style.cssText = 'width:' + confidence + '%;height:100%;background:' + barColor + ';border-radius:4px;';
  barOuter.appendChild(barInner);
  var confValue = document.createElement('span');
  confValue.style.cssText = 'font-weight:700;color:' + color + ';';
  confValue.textContent = confidence + '% \u2014 ' + label.charAt(0).toUpperCase() + label.slice(1);
  confRow.appendChild(confLabel);
  confRow.appendChild(barOuter);
  confRow.appendChild(confValue);
  confSection.appendChild(confRow);

  // PUSHED section
  var pushedSection = document.createElement('div');
  pushedSection.style.marginBottom = '12px';
  var pushedTitle = document.createElement('div');
  pushedTitle.style.cssText = 'font-weight:600;margin-bottom:6px;';
  pushedTitle.textContent = 'PUSHED Indicators:';
  pushedSection.appendChild(pushedTitle);
  pushedSection.appendChild(pushedContainer);

  // VERIFY section
  var verifySection = document.createElement('div');
  verifySection.style.marginBottom = '12px';
  var verifyTitle = document.createElement('div');
  verifyTitle.style.cssText = 'font-weight:600;margin-bottom:6px;';
  verifyTitle.textContent = 'VERIFY Flags:';
  verifySection.appendChild(verifyTitle);
  verifySection.appendChild(verifyContainer);

  // Reasoning
  var reasoningDiv = document.createElement('div');
  reasoningDiv.style.cssText = 'background:rgba(0,0,0,0.03);border-radius:6px;padding:10px;font-style:italic;line-height:1.5;';
  reasoningDiv.textContent = '"' + reasoning + '"';

  panelBody.appendChild(confSection);
  panelBody.appendChild(pushedSection);
  panelBody.appendChild(verifySection);
  panelBody.appendChild(reasoningDiv);

  panel.appendChild(headerRow);
  panel.appendChild(panelBody);

  return panel;
}

function showAIResultsPanel(result) {
  isModifyingDOM = true;
  try {
    var existing = document.querySelector('.vervain-ai-results');
    if (existing) existing.remove();

    var headerArea = document.querySelector('.ha') || document.querySelector('.gE.iv.gt');
    if (!headerArea) return;

    var wrapper = document.createElement('div');
    wrapper.className = 'vervain-ai-results';
    var panel = buildResultsPanelHTML(result);
    wrapper.appendChild(panel);

    headerArea.parentNode.insertBefore(wrapper, headerArea.nextSibling);

    var collapseBtn = wrapper.querySelector('.vervain-ai-collapse');
    var body = wrapper.querySelector('.vervain-ai-panel-body');
    if (collapseBtn && body) {
      collapseBtn.addEventListener('click', function() {
        var collapsed = body.style.display === 'none';
        body.style.display = collapsed ? '' : 'none';
        collapseBtn.textContent = collapsed ? '\u25B2' : '\u25BC';
        collapseBtn.title = collapsed ? 'Collapse' : 'Expand';
      });
    }
  } finally {
    isModifyingDOM = false;
  }
}

function showAIError(message) {
  isModifyingDOM = true;
  try {
    var existing = document.querySelector('.vervain-ai-results');
    if (existing) existing.remove();

    var headerArea = document.querySelector('.ha') || document.querySelector('.gE.iv.gt');
    if (!headerArea) return;

    var panel = document.createElement('div');
    panel.className = 'vervain-ai-results';
    var inner = document.createElement('div');
    inner.style.cssText =
      'font-family:Google Sans,Roboto,Arial,sans-serif;font-size:13px;color:#dc2626;' +
      'background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:12px 16px;margin:8px 0 12px 0;';
    var strong = document.createElement('strong');
    strong.textContent = 'Analysis failed: ';
    inner.appendChild(strong);
    inner.appendChild(document.createTextNode(message));
    panel.appendChild(inner);
    headerArea.parentNode.insertBefore(panel, headerArea.nextSibling);
  } finally {
    isModifyingDOM = false;
  }
}

// --- Deep Scan results (signal summary + AI detail) ---

function showDeepScanResultsPanel(deepResult) {
  isModifyingDOM = true;
  try {
    var existing = document.querySelector('.vervain-ai-results');
    if (existing) existing.remove();

    var headerArea = document.querySelector('.ha') || document.querySelector('.gE.iv.gt');
    if (!headerArea) return;

    var wrapper = document.createElement('div');
    wrapper.className = 'vervain-ai-results';

    // Signal summary strip
    var strip = document.createElement('div');
    strip.style.cssText =
      'font-family:Google Sans,Roboto,Arial,sans-serif;font-size:12px;' +
      'display:flex;align-items:center;gap:8px;flex-wrap:wrap;' +
      'padding:8px 12px;margin:8px 0 4px 0;' +
      'background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;';

    var stripLabel = document.createElement('span');
    stripLabel.style.cssText = 'font-weight:600;color:#475569;';
    stripLabel.textContent = 'Signals:';
    strip.appendChild(stripLabel);

    // Domain signal
    var domainPill = buildSignalPill(
      'Domain',
      deepResult.domain && deepResult.domain.verdict !== 'clean',
      deepResult.domain ? deepResult.domain.verdict : 'clean'
    );
    strip.appendChild(domainPill);

    // Threat Intel signal
    var tiPill = buildSignalPill(
      'Threat Intel',
      deepResult.threatIntel && deepResult.threatIntel.bloomHit,
      deepResult.threatIntel ? 'match' : 'clean'
    );
    strip.appendChild(tiPill);

    // VirusTotal signal
    var vtActive = deepResult.vt && deepResult.vt.reputation < 0;
    var vtPill = buildSignalPill(
      'VirusTotal',
      vtActive,
      deepResult.vt ? 'rep ' + deepResult.vt.reputation : 'N/A'
    );
    strip.appendChild(vtPill);

    // AI signal
    var aiActive = deepResult.ai && deepResult.ai.confidence > 40;
    var aiLabel = deepResult.ai ? deepResult.ai.label || 'done' : 'N/A';
    var aiPill = buildSignalPill('AI', aiActive, aiLabel);
    strip.appendChild(aiPill);

    // Aggregate verdict badge
    var agg = deepResult.aggregate;
    var aggColor = agg.verdict === 'clean' ? '#22c55e' : agg.verdict === 'warning' ? '#eab308' : '#ef4444';
    var aggBadge = document.createElement('span');
    aggBadge.style.cssText =
      'margin-left:auto;font-weight:700;color:' + aggColor + ';font-size:13px;';
    aggBadge.textContent = agg.confidence + '% ' + agg.verdict.charAt(0).toUpperCase() + agg.verdict.slice(1);
    strip.appendChild(aggBadge);

    wrapper.appendChild(strip);

    // AI detail panel (if AI ran)
    if (deepResult.ai && deepResult.ai.pushed) {
      var aiPanel = buildResultsPanelHTML(deepResult.ai);
      wrapper.appendChild(aiPanel);
    } else if (!deepResult.ai) {
      var noAi = document.createElement('div');
      noAi.style.cssText =
        'font-family:Google Sans,Roboto,Arial,sans-serif;font-size:13px;color:#94a3b8;' +
        'background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;' +
        'padding:10px 16px;margin:4px 0 12px 0;font-style:italic;';
      noAi.textContent = 'AI analysis not available \u2014 check API key in settings';
      wrapper.appendChild(noAi);
    }

    headerArea.parentNode.insertBefore(wrapper, headerArea.nextSibling);

    // Wire collapse button for AI panel if present
    var collapseBtn = wrapper.querySelector('.vervain-ai-collapse');
    var body = wrapper.querySelector('.vervain-ai-panel-body');
    if (collapseBtn && body) {
      collapseBtn.addEventListener('click', function() {
        var collapsed = body.style.display === 'none';
        body.style.display = collapsed ? '' : 'none';
        collapseBtn.textContent = collapsed ? '\u25B2' : '\u25BC';
        collapseBtn.title = collapsed ? 'Collapse' : 'Expand';
      });
    }
  } finally {
    isModifyingDOM = false;
  }
}

function buildSignalPill(label, active, detail) {
  var pill = document.createElement('span');
  var bg, color, border;
  if (active) {
    bg = '#fef2f2'; color = '#dc2626'; border = '#fca5a5';
  } else {
    bg = '#f0fdf4'; color = '#15803d'; border = '#86efac';
  }
  pill.style.cssText =
    'display:inline-flex;align-items:center;gap:4px;' +
    'padding:2px 8px;border-radius:10px;' +
    'background:' + bg + ';color:' + color + ';border:1px solid ' + border + ';' +
    'font-size:11px;font-weight:500;';
  var nameSpan = document.createElement('span');
  nameSpan.textContent = label;
  pill.appendChild(nameSpan);
  if (active && detail) {
    var detailSpan = document.createElement('span');
    detailSpan.style.opacity = '0.7';
    detailSpan.textContent = '(' + detail + ')';
    pill.appendChild(detailSpan);
  }
  return pill;
}

// --- VERIFY button (AI analysis trigger) ---

async function handleVerifyClick(button) {
  button.disabled = true;
  button.textContent = '';
  var spinner = document.createElement('span');
  spinner.textContent = 'Analyzing...';
  button.appendChild(spinner);

  try {
    var emailData = extractEmailData();
    if (!emailData.senderEmail && !emailData.body) {
      showAIError('Could not extract email content. Please open an email first.');
      return;
    }

    // Try DEEP_SCAN first (combines domain + TI + VT + AI)
    var response;
    var isDeepScan = false;
    try {
      var deepScanData = {
        sender: emailData.senderEmail,
        domain: extractDomain(emailData.senderEmail),
        contactName: emailData.senderName,
        subject: emailData.subject,
        body: emailData.body,
        links: emailData.urls || []
      };
      response = await chrome.runtime.sendMessage({ type: 'DEEP_SCAN', data: deepScanData });
      isDeepScan = response && response.aggregate;
    } catch (deepErr) {
      console.warn('[Vervain] DEEP_SCAN failed, falling back to AI_ANALYZE:', deepErr);
    }

    // Fallback to AI_ANALYZE if DEEP_SCAN failed
    if (!isDeepScan) {
      response = await chrome.runtime.sendMessage({ type: 'AI_ANALYZE', data: emailData });
    }

    if (isDeepScan) {
      // Deep scan response: show signal summary + AI panel
      showDeepScanResultsPanel(response);
      var verdict = response.aggregate;
      var badgeColor;
      if (verdict.verdict === 'clean') badgeColor = '#22c55e';
      else if (verdict.verdict === 'warning') badgeColor = '#eab308';
      else badgeColor = '#ef4444';

      button.textContent = '';
      var badge = document.createElement('span');
      badge.style.cssText =
        'display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;' +
        'border-radius:50%;background:' + badgeColor + ';color:white;font-size:11px;font-weight:700;flex-shrink:0;margin-right:4px;';
      badge.textContent = String(verdict.confidence);
      var labelSpan = document.createElement('span');
      labelSpan.textContent = verdict.verdict.charAt(0).toUpperCase() + verdict.verdict.slice(1);
      button.appendChild(badge);
      button.appendChild(labelSpan);
      button.disabled = false;
    } else if (response && response.success) {
      // AI-only fallback response
      showAIResultsPanel(response.result);
      var result = response.result;
      var badgeColor;
      if (result.label === 'safe') badgeColor = '#22c55e';
      else if (result.label === 'caution') badgeColor = '#eab308';
      else badgeColor = '#ef4444';

      button.textContent = '';
      var badge = document.createElement('span');
      badge.style.cssText =
        'display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;' +
        'border-radius:50%;background:' + badgeColor + ';color:white;font-size:11px;font-weight:700;flex-shrink:0;margin-right:4px;';
      badge.textContent = String(result.confidence);
      var labelSpan = document.createElement('span');
      labelSpan.textContent = result.label.charAt(0).toUpperCase() + result.label.slice(1);
      button.appendChild(badge);
      button.appendChild(labelSpan);
      button.disabled = false;
    } else {
      var errorMsg = (response && response.error) || 'Unknown error occurred';
      if (errorMsg === 'NO_API_KEY') {
        showAIError('No API key configured. Go to extension settings to configure AI.');
      } else {
        showAIError(errorMsg);
      }
      resetVerifyButton(button);
    }
  } catch (error) {
    console.error('[Vervain] Analysis error:', error);
    showAIError('Analysis failed \u2014 try again');
    resetVerifyButton(button);
  }
}

function resetVerifyButton(button) {
  button.disabled = false;
  button.textContent = '\uD83D\uDEE1\uFE0F VERIFY my suspicion';
}

function injectVerifyButton() {
  var senderEl = document.querySelector('.gD[email]');
  if (!senderEl) return;
  if (document.querySelector('.vervain-ai-btn')) return;

  var headerRow = senderEl.closest('.gE') || senderEl.closest('tr') || senderEl.parentElement;
  if (!headerRow) return;

  var button = document.createElement('button');
  button.className = 'vervain-ai-btn';
  button.style.cssText =
    'display:inline-flex;align-items:center;gap:4px;' +
    'padding:4px 10px;margin-left:8px;' +
    'background:#f8f7ff;color:#4B2EE3;' +
    'border:1px solid #d4d0f7;border-radius:14px;' +
    'font-family:Google Sans,Roboto,Arial,sans-serif;' +
    'font-size:12px;font-weight:500;cursor:pointer;' +
    'white-space:nowrap;vertical-align:middle;' +
    'transition:background 0.15s;';
  button.textContent = '\uD83D\uDEE1\uFE0F VERIFY my suspicion';

  button.addEventListener('mouseenter', function() { button.style.background = '#eeeaff'; });
  button.addEventListener('mouseleave', function() { button.style.background = '#f8f7ff'; });
  button.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    handleVerifyClick(button);
  });

  if (!document.querySelector('#vervain-ai-styles')) {
    var style = document.createElement('style');
    style.id = 'vervain-ai-styles';
    style.textContent =
      '@keyframes vervain-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }' +
      '@keyframes vervain-fadeIn { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }';
    document.head.appendChild(style);
  }

  headerRow.appendChild(button);
}

// --- Suspicious link highlighting ---

async function scanEmailLinks() {
  var bodyEl = document.querySelector('.a3s.aiL');
  if (!bodyEl) return;

  var links = bodyEl.querySelectorAll('a[href]');
  for (var i = 0; i < links.length; i++) {
    var link = links[i];
    if (link.hasAttribute('data-vervain-link-scanned')) continue;
    link.setAttribute('data-vervain-link-scanned', 'true');

    var href = link.getAttribute('href') || '';
    if (!href || href.startsWith('mailto:') || href.startsWith('#')) continue;

    // Extract domain from the link URL
    var linkDomain;
    try {
      linkDomain = new URL(href).hostname;
    } catch {
      continue;
    }
    if (!linkDomain) continue;

    try {
      var verdict = await chrome.runtime.sendMessage({
        type: 'PASSIVE_SCAN',
        data: { sender: '', domain: linkDomain, contactName: '' }
      });

      if (verdict && verdict.verdict !== 'clean') {
        markSuspiciousLink(link, linkDomain, verdict);
      }
    } catch (err) {
      console.warn('[Vervain] Link scan failed:', err.message);
      break;
    }
  }
}

function markSuspiciousLink(linkEl, domain, verdict) {
  isModifyingDOM = true;
  try {
    linkEl.style.cssText +=
      ';background:#fef2f2 !important;color:#dc2626 !important;' +
      'text-decoration:line-through !important;';

    linkEl.title = 'Vervain: Suspicious link (' + verdict.rule + ') \u2014 ' + verdict.evidence;
  } catch (error) {
    console.error('[Vervain] Error marking suspicious link:', error);
  } finally {
    isModifyingDOM = false;
  }
}

// --- Auto deep scan (AI + TI) ---

async function runAutoDeepScan() {
  // Don't run twice on the same email view
  if (document.querySelector('.vervain-ai-results')) return;

  var emailData = extractEmailData();
  if (!emailData.senderEmail && !emailData.body) return;

  // Show a loading indicator
  isModifyingDOM = true;
  var loadingEl;
  try {
    var headerArea = document.querySelector('.ha') || document.querySelector('.gE.iv.gt');
    if (headerArea) {
      loadingEl = document.createElement('div');
      loadingEl.className = 'vervain-ai-results';
      var inner = document.createElement('div');
      inner.style.cssText =
        'font-family:Google Sans,Roboto,Arial,sans-serif;font-size:13px;color:#4B2EE3;' +
        'background:#f8f7ff;border:1px solid #d4d0f7;border-radius:8px;padding:12px 16px;margin:8px 0 12px 0;';
      inner.textContent = 'Analyzing email...';
      loadingEl.appendChild(inner);
      headerArea.parentNode.insertBefore(loadingEl, headerArea.nextSibling);
    }
  } finally {
    isModifyingDOM = false;
  }

  try {
    // Try DEEP_SCAN first
    var response;
    var isDeepScan = false;
    try {
      var deepScanData = {
        sender: emailData.senderEmail,
        domain: extractDomain(emailData.senderEmail),
        contactName: emailData.senderName,
        subject: emailData.subject,
        body: emailData.body,
        links: emailData.urls || []
      };
      response = await chrome.runtime.sendMessage({ type: 'DEEP_SCAN', data: deepScanData });
      isDeepScan = response && response.aggregate;
    } catch (deepErr) {
      console.warn('[Vervain] DEEP_SCAN failed, falling back to AI_ANALYZE:', deepErr);
    }

    // Fallback to AI_ANALYZE
    if (!isDeepScan) {
      response = await chrome.runtime.sendMessage({ type: 'AI_ANALYZE', data: emailData });
    }

    if (isDeepScan) {
      showDeepScanResultsPanel(response);
    } else if (response && response.success) {
      showAIResultsPanel(response.result);
    } else if (response && response.error === 'NO_API_KEY') {
      showAIError('No API key configured. Go to extension settings to configure AI.');
    } else {
      showAIError((response && response.error) || 'Analysis failed');
    }
  } catch (err) {
    console.error('[Vervain] Auto deep scan error:', err);
    showAIError('Analysis failed \u2014 try again');
  }
}

// --- Main scan flow ---

async function scanEmail() {
  if (isCurrentlyScanning || isModifyingDOM) return;
  if (!isExtensionContextValid()) return;

  isCurrentlyScanning = true;
  try {
    // Extract sender info from the currently open email
    var senderEl = document.querySelector('.gD[email]');
    if (!senderEl) {
      // No email open - check list view for sender elements
      await scanEmailList();
      return;
    }

    var senderEmail = senderEl.getAttribute('email') || '';
    var senderName = senderEl.getAttribute('name') || senderEl.innerText || '';
    var domain = extractDomain(senderEmail);
    if (!domain) return;

    // Get scan config from service worker
    var config = { autoTI: false, autoAI: false };
    try {
      config = await chrome.runtime.sendMessage({ type: 'GET_SCAN_CONFIG' });
    } catch (err) {
      console.warn('[Vervain] Could not get scan config:', err.message);
    }

    // Send passive scan to service worker
    var passiveHit = false;
    try {
      var verdict = await chrome.runtime.sendMessage({
        type: 'PASSIVE_SCAN',
        data: { sender: senderEmail, domain: domain, contactName: senderName }
      });

      if (verdict && verdict.verdict !== 'clean') {
        passiveHit = true;
        if (verdict.rule.indexOf('contact-spoof') !== -1) {
          addContactImpersonationIndicator(senderEl, senderName, senderEmail, verdict.evidence);
        } else {
          insertWarning(senderEmail, domain, verdict);
        }
      }
    } catch (err) {
      console.warn('[Vervain] Passive scan failed:', err.message);
    }

    // Scan links in the email body for suspicious domains
    await scanEmailLinks();

    // Auto-run AI analysis only when the user has opted in
    if (config.autoAI) {
      runAutoDeepScan();
    } else {
      injectVerifyButton();
    }

  } finally {
    isCurrentlyScanning = false;
  }
}

async function scanEmailList() {
  // No-op in list view: all warnings/indicators only appear when an email is opened.
  // We still mark elements as scanned so we don't re-process them later.
  var senderElements = document.querySelectorAll('.yX.xY .yW span[email]');
  for (var i = 0; i < senderElements.length; i++) {
    senderElements[i].setAttribute('data-vervain-scanned', 'true');
  }
}

// --- Observers ---

if (window.performance && window.performance.navigation.type === window.performance.navigation.TYPE_RELOAD) {
  dismissedWarnings.clear();
  dismissedContactWarnings.clear();
}

setTimeout(function() {
  try {
    if (!isExtensionContextValid()) return;

    var targets = document.querySelectorAll('.AO, .nH');
    if (targets.length === 0) return;

    var observer = new MutationObserver(function() {
      if (isModifyingDOM || isCurrentlyScanning) return;
      if (!isExtensionContextValid()) {
        observer.disconnect();
        return;
      }
      requestAnimationFrame(function() { scanEmail(); });
    });

    targets.forEach(function(target) {
      observer.observe(target, { childList: true, subtree: true });
    });

    scanEmail();
  } catch (error) {
    console.error('[Vervain] Error setting up observer:', error);
  }
}, 1000);

document.addEventListener('visibilitychange', function() {
  if (!isExtensionContextValid()) return;
  if (document.visibilityState === 'visible') {
    scanEmail();
  }
});
