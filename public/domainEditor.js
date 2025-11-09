// Simple script to edit the primary domain
document.addEventListener('DOMContentLoaded', function() {
  const domainInput = document.getElementById('primaryDomain');
  const saveButton = document.getElementById('saveDomain');
  const statusMessage = document.getElementById('statusMessage');
  
  // Load current domain
  chrome.storage.local.get(['primaryDomain', 'setupComplete'], function(result) {
    if (result.primaryDomain) {
      domainInput.value = result.primaryDomain;
    }
  });
  
  // Save domain
  saveButton.addEventListener('click', function() {
    const newDomain = domainInput.value.trim();
    
    if (!newDomain) {
      statusMessage.textContent = 'Please enter a domain';
      statusMessage.style.color = 'red';
      return;
    }
    
    chrome.storage.local.set({
      primaryDomain: newDomain,
      setupComplete: true
    }, function() {
      statusMessage.textContent = 'Domain saved successfully!';
      statusMessage.style.color = 'green';
      
      // Generate some basic variations for the domain
      const variations = generateVariations(newDomain);
      chrome.storage.local.set({ variations });
    });
  });
  
  // Generate basic domain variations for detection
  function generateVariations(domain) {
    const variations = [];
    
    // Remove TLD for base domain
    const baseDomain = domain.split('.')[0];
    
    // Add some common variations
    variations.push({ domain: baseDomain + '1' + '.com', type: 'typo' });
    variations.push({ domain: baseDomain + '-inc.com', type: 'typo' });
    variations.push({ domain: baseDomain + 'secure.com', type: 'typo' });
    
    return variations;
  }
}); 