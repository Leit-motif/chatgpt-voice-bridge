document.addEventListener('DOMContentLoaded', () => {
  const voiceToggle = document.getElementById('voiceToggle');
  const status = document.getElementById('status');

  // Load current state
  chrome.storage.local.get(['voiceEnabled'], (result) => {
    voiceToggle.checked = result.voiceEnabled ?? true;
    updateStatus(voiceToggle.checked);
  });

  // Handle toggle changes
  voiceToggle.addEventListener('change', (e) => {
    const isEnabled = e.target.checked;
    chrome.storage.local.set({ voiceEnabled: isEnabled });
    updateStatus(isEnabled);

    // Notify active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url.includes('chat.openai.com')) {
        try {
          chrome.tabs.sendMessage(tabs[0].id, { 
            type: 'toggleVoice',
            enabled: isEnabled 
          });
        } catch (error) {
          console.log('Could not send message to content script:', error);
        }
      }
    });
  });

  function updateStatus(enabled) {
    status.textContent = enabled ? 'Voice control is active' : 'Voice control is paused';
    status.style.color = enabled ? '#2196F3' : '#666';
  }
}); 