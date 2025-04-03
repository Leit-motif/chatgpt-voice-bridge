// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('VoiceBridge for ChatGPT installed');
  // Initialize extension state
  chrome.storage.local.set({
    isActive: true,
    voiceEnabled: true
  });
});

// Listen for content script connections
chrome.runtime.onConnect.addListener((port) => {
  console.log('Connection established with content script');
  
  port.onMessage.addListener((msg) => {
    if (msg.type === 'status') {
      console.log('Status update:', msg.status);
    }
  });
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message);
  if (message.type === 'getState') {
    chrome.storage.local.get(['isActive', 'voiceEnabled'], (result) => {
      sendResponse(result);
    });
    return true; // Will respond asynchronously
  }
}); 