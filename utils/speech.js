// Speech recognition instance
let recognition = null;
let silenceTimer = null;

// Initialize speech recognition
export function initializeSpeechRecognition() {
  if (!recognition) {
    try {
      recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      console.log('Speech recognition initialized successfully');
    } catch (e) {
      console.error('Failed to initialize speech recognition:', e);
      return null;
    }
  }
  return recognition;
}

// Function to start speech recognition
export function startSpeechRecognition(callback) {
  console.log('Starting speech recognition...');
  
  if (!recognition) {
    initializeSpeechRecognition();
  }
  
  if (!recognition) {
    console.error('Speech recognition not initialized');
    return;
  }

  recognition.onstart = () => {
    console.log('Speech recognition started');
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

// Function to stop speech recognition
export function stopSpeechRecognition() {
  if (recognition) {
    recognition.stop();
  }
  clearTimeout(silenceTimer);
}

// Function to speak text
export function speakText(text, onEnd) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.onend = onEnd;
  speechSynthesis.speak(utterance);
}

// Handle cleanup
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && recognition) {
    stopSpeechRecognition();
  }
});

window.addEventListener('beforeunload', () => {
  if (recognition) {
    stopSpeechRecognition();
  }
});

console.log('VoiceBridge speech utilities loaded');