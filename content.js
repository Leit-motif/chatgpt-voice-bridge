// Load speech utilities dynamically
let speechUtils = null;

async function loadSpeechUtils() {
  const src = chrome.runtime.getURL('utils/speech.js');
  try {
    speechUtils = await import(src);
    console.log('Speech utilities loaded successfully');
  } catch (error) {
    console.error('Failed to load speech utilities:', error);
  }
}

console.log('VoiceBridge content script loaded');
console.log('Current URL:', window.location.href);
console.log('Current hostname:', window.location.hostname);
console.log('Current pathname:', window.location.pathname);

// Global variables
let voiceBridge = null;
let isInitialized = false;
let buttonCheckInterval = null;
let silenceTimer = null;
let port = null;

// Wait for speech utilities to be available
function waitForSpeechUtils(maxAttempts = 10) {
  let attempts = 0;
  
  return new Promise((resolve, reject) => {
    function check() {
      attempts++;
      console.log(`Checking for speech utilities (attempt ${attempts})`);
      
      if (window.voiceBridgeUtils) {
        console.log('Speech utilities found');
        resolve(window.voiceBridgeUtils);
      } else if (attempts >= maxAttempts) {
        console.error('Speech utilities not found after maximum attempts');
        reject(new Error('Speech utilities not available'));
      } else {
        setTimeout(check, 500);
      }
    }
    
    check();
  });
}

// Initialize connection with background script
try {
  port = chrome.runtime.connect({ name: 'voicebridge' });
  console.log('Connected to background script');
} catch (e) {
  console.error('Failed to connect to background script:', e);
}

// Simple function to check if we're on a chat page
function isValidPage() {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;
  
  // Debug logging
  console.log('Page validation check:');
  console.log('Current URL:', window.location.href);
  console.log('Hostname:', hostname);
  console.log('Pathname:', pathname);
  
  // More lenient domain check
  const validDomain = hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com');
  console.log('Valid domain?', validDomain);
  
  // More lenient path check
  const validPath = pathname.includes('/c/');
  console.log('Valid path?', validPath);
  
  const result = validDomain && validPath;
  console.log('Final validation result:', result);
  
  return result;
}

// Initialize everything
async function initializeAll() {
  console.log('Initializing everything...');
  
  try {
    // Load speech utilities if not already loaded
    if (!speechUtils) {
      await loadSpeechUtils();
    }
    
    // Initialize speech recognition
    if (speechUtils) {
      speechUtils.initializeSpeechRecognition();
    }
    
    // Create button if needed
    if (!document.getElementById('voice-indicator-container')) {
      ensureVoiceButton();
    }
    
    // Start button check if not already running
    startButtonCheck();
  } catch (error) {
    console.error('Initialization failed:', error);
  }
}

// Initialize on page load
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  console.log('Document already loaded, initializing immediately');
  initializeAll();
} else {
  console.log('Document not ready, waiting for load events');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded fired');
    initializeAll();
  });
  
  window.addEventListener('load', () => {
    console.log('Window load fired');
    initializeAll();
  });
}

// Force initialization after delays to catch any edge cases
setTimeout(() => {
  console.log('First timeout check (1s)');
  initializeAll();
}, 1000);

setTimeout(() => {
  console.log('Second timeout check (3s)');
  initializeAll();
}, 3000);

setTimeout(() => {
  console.log('Final timeout check (5s)');
  initializeAll();
}, 5000);

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
  if (message.type === 'toggleVoice') {
    if (message.enabled) {
      if (!isInitialized) {
        initializeExtension();
      } else if (voiceBridge) {
        voiceBridge.startListening();
      }
    } else if (voiceBridge) {
      voiceBridge.stopListening();
    }
    sendResponse({ success: true });
  }
  return true;
});

// Function to find chat interface more robustly
function findChatInterface() {
  console.log('Finding chat interface...');
  
  // Try multiple possible selectors
  const selectors = [
    'main',
    '#__next main',
    '[role="main"]',
    '.chat-interface',
    '.chat-container'
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      console.log('Found chat interface using selector:', selector);
      return element;
    }
  }
  
  // Try searching through shadow DOM
  function searchShadowDOM(root) {
    if (!root) return null;
    
    if (root.tagName && root.tagName.toLowerCase() === 'main') {
      return root;
    }
    
    const elements = root.querySelectorAll('*');
    for (const element of elements) {
      if (element.shadowRoot) {
        const found = searchShadowDOM(element.shadowRoot);
        if (found) return found;
      }
      
      if (element.tagName && element.tagName.toLowerCase() === 'main') {
        return element;
      }
    }
    
    return null;
  }
  
  const shadowResult = searchShadowDOM(document.body);
  if (shadowResult) {
    console.log('Found chat interface in shadow DOM');
    return shadowResult;
  }
  
  console.log('Chat interface not found');
  return null;
}

// Create or ensure voice button exists
function ensureVoiceButton() {
  console.log('Ensuring voice button exists...');
  
  if (!isValidPage()) {
    console.log('Not a valid page, skipping button creation');
    return null;
  }

  // Wait for the chat interface to be ready using new finder
  const chatInterface = findChatInterface();
  if (!chatInterface) {
    console.log('Chat interface not ready yet, will retry...');
    setTimeout(ensureVoiceButton, 1000);
    return null;
  }
  
  // Remove any existing button first
  const existing = document.getElementById('voice-indicator-container');
  if (existing) {
    console.log('Removing existing button');
    existing.remove();
  }

  console.log('Creating new button...');
  const button = document.createElement('div');
  button.id = 'voice-indicator-container';
  button.style.cssText = `
    position: fixed;
    bottom: 100px;
    right: 20px;
    z-index: 999999;
    pointer-events: auto;
  `;
  
  button.innerHTML = `
    <div id="voice-indicator" style="
      background: #FF0000;
      color: white;
      padding: 15px;
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      width: 50px;
      height: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      transition: all 0.3s ease;
      position: relative;
    ">
      <div id="voice-icon">🎤</div>
      <div id="voice-status" style="
        position: absolute;
        bottom: 100%;
        right: 0;
        background: #333;
        color: white;
        padding: 5px 10px;
        border-radius: 5px;
        font-size: 14px;
        margin-bottom: 5px;
        white-space: nowrap;
        display: none;
        pointer-events: none;
      ">Click to start</div>
    </div>
  `;

  // Try to append to the chat interface first, fall back to body if needed
  try {
    chatInterface.appendChild(button);
    console.log('Button appended to chat interface');
  } catch (e) {
    console.error('Failed to append to chat interface:', e);
    document.body.appendChild(button);
    console.log('Button appended to body as fallback');
  }
  
  // Add hover effect
  const indicator = button.querySelector('#voice-indicator');
  const status = button.querySelector('#voice-status');
  
  indicator.addEventListener('mouseover', () => {
    indicator.style.transform = 'scale(1.1)';
    status.style.display = 'block';
  });
  
  indicator.addEventListener('mouseout', () => {
    indicator.style.transform = 'scale(1)';
    status.style.display = 'none';
  });
  
  // Add click handler
  indicator.addEventListener('click', () => {
    if (!voiceBridge) {
      initializeVoiceBridge();
    } else {
      voiceBridge.toggleListening();
    }
  });

  console.log('Voice button created successfully');
  return button;
}

// Initialize the extension after checking state
function initializeExtension() {
  console.log('Initializing extension...');
  try {
    chrome.runtime.sendMessage({ type: 'getState' }, (response) => {
      console.log('Got extension state:', response);
      if (response?.voiceEnabled && !isInitialized) {
        voiceBridge = initializeVoiceBridge();
        isInitialized = true;
        console.log('VoiceBridge initialized successfully');
      }
    });
  } catch (error) {
    console.error('Error initializing extension:', error);
  }
}

// Function to wait for chat interface to load
function waitForChatInterface() {
  console.log('Waiting for chat interface...');
  const maxAttempts = 10;
  let attempts = 0;

  function checkForInterface() {
    attempts++;
    console.log(`Check attempt ${attempts}/${maxAttempts}`);

    if (isValidPage()) {
      console.log('Chat interface found, initializing...');
      initializeExtension();
      return;
    }

    if (attempts < maxAttempts) {
      setTimeout(checkForInterface, 1000);
    } else {
      console.log('Failed to find chat interface after maximum attempts');
    }
  }

  checkForInterface();
}

// Start checking when the script loads
waitForChatInterface();

// Initialize voice bridge functionality
function initializeVoiceBridge() {
  console.log('Initializing voice bridge...');
  
  let isListening = false;
  const button = document.querySelector('#voice-indicator');
  const status = document.querySelector('#voice-status');

  function updateStatus(text, isActive = false) {
    console.log('Status update:', text);
    status.textContent = text;
    status.style.display = 'block';
    button.style.background = isActive ? '#FF0000' : '#666';
    setTimeout(() => {
      if (status.textContent === text) {
        status.style.display = 'none';
      }
    }, 2000);
  }

  function toggleListening() {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }

  function startListening() {
    console.log('Starting listening...');
    isListening = true;
    updateStatus('Listening...', true);
    if (speechUtils) {
      speechUtils.startSpeechRecognition((text) => {
        console.log('Got text:', text);
        sendMessage(text);
      });
    }
  }

  function stopListening() {
    console.log('Stopping listening...');
    isListening = false;
    updateStatus('Paused');
    if (speechUtils) {
      speechUtils.stopSpeechRecognition();
    }
  }

  function sendMessage(text) {
    console.log('Sending message:', text);
    const textarea = document.querySelector('textarea[data-virtualkeyboard="true"]');
    const sendButton = document.querySelector('button[class*="absolute"]');
    
    if (textarea && sendButton) {
      // Set proper attributes for the textarea
      if (!textarea.id) {
        textarea.id = 'voice-bridge-input';
      }
      if (!textarea.name) {
        textarea.name = 'voice-bridge-input';
      }
      
      // Create and dispatch proper input events
      const inputEvent = new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text
      });
      
      const changeEvent = new Event('change', {
        bubbles: true,
        cancelable: true
      });
      
      // Set the value and dispatch events
      textarea.value = text;
      textarea.dispatchEvent(inputEvent);
      textarea.dispatchEvent(changeEvent);
      
      // Click the send button after a short delay to ensure events are processed
      setTimeout(() => {
        sendButton.click();
        updateStatus('Message sent');
      }, 100);
    } else {
      console.error('Could not find textarea or send button');
      updateStatus('Error: Could not send message');
    }
  }

  // Set up response observer
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length) {
        const response = document.querySelector('div[class*="markdown"]');
        if (response) {
          const text = response.innerText;
          if (text) {
            updateStatus('Speaking...');
            speechUtils.speakText(text, () => {
              if (isListening) {
                updateStatus('Listening...', true);
              }
            });
          }
        }
      }
    }
  });

  const main = document.querySelector('main');
  if (main) {
    observer.observe(main, { childList: true, subtree: true });
  }

  voiceBridge = {
    toggleListening,
    startListening,
    stopListening,
    updateStatus
  };

  return voiceBridge;
}

// Modify the button check interval
function startButtonCheck() {
  console.log('Starting button check interval');
  if (buttonCheckInterval) {
    clearInterval(buttonCheckInterval);
  }
  
  buttonCheckInterval = setInterval(() => {
    const button = document.getElementById('voice-indicator-container');
    const chatInterface = findChatInterface();
    
    if (isValidPage() && (!button || (chatInterface && !chatInterface.contains(button)))) {
      console.log('Button missing or not in chat interface, recreating...');
      ensureVoiceButton();
    }
  }, 1000); // Increased interval to reduce CPU usage
}

// Start the process
if (isValidPage()) {
  ensureVoiceButton();
  startButtonCheck();
}

// Also check when URL changes
let lastUrl = window.location.href;
new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    console.log('URL changed, checking page...');
    if (isValidPage()) {
      ensureVoiceButton();
      startButtonCheck();
    }
  }
}).observe(document, { subtree: true, childList: true });

function startSTT(callback) {
  console.log('Starting speech recognition...');
  if (!recognition) {
    console.error('Speech recognition not initialized');
    return;
  }

  recognition.onstart = () => {
    console.log('Speech recognition started');
    const voiceStatus = document.querySelector('#voice-status');
    if (voiceStatus) voiceStatus.textContent = 'Listening...';
  };

  recognition.onresult = (event) => {
    console.log('Speech recognition result received');
    const text = Array.from(event.results)
      .map(result => result[0].transcript)
      .join('');
    console.log('Recognized text:', text);

    // Clear any existing silence timer
    clearTimeout(silenceTimer);
    
    // Set a new silence timer
    silenceTimer = setTimeout(() => {
      console.log('Silence detected, processing text');
      recognition.stop();
      callback(text);
    }, 2000); // 2 seconds of silence
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    if (event.error === 'not-allowed') {
      alert('Please allow microphone access to use voice control.');
    }
  };

  recognition.onend = () => {
    console.log('Speech recognition ended');
    // Clear any pending silence timer
    clearTimeout(silenceTimer);
    // Restart recognition if it was stopped due to silence
    if (recognition && !recognition.error) {
      console.log('Restarting speech recognition');
      try {
        recognition.start();
      } catch (e) {
        console.error('Error restarting speech recognition:', e);
      }
    }
  };

  try {
    recognition.start();
  } catch (e) {
    console.error('Error starting speech recognition:', e);
  }
} 