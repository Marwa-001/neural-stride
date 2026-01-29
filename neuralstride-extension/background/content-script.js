// Content script for NeuralStride - FIXED VERSION with robust two-way communication
console.log('🔗 NeuralStride content script loaded (FIXED)');

// FIXED: Track connection status
let isConnected = false;
let retryCount = 0;
const MAX_RETRIES = 5;

// FIXED: Announce presence immediately
function announcePresence() {
  console.log('📢 Announcing content script presence to web app...');
  window.postMessage({ 
    type: 'NEURALSTRIDE_CONTENT_SCRIPT_READY',
    source: 'extension',
    timestamp: Date.now()
  }, '*');
  isConnected = true;
}

// Announce on load
announcePresence();

// FIXED: Re-announce periodically until web app acknowledges
const announceInterval = setInterval(() => {
  if (!isConnected && retryCount < MAX_RETRIES) {
    console.log(`🔄 Re-announcing presence (attempt ${retryCount + 1}/${MAX_RETRIES})`);
    announcePresence();
    retryCount++;
  } else if (retryCount >= MAX_RETRIES) {
    console.log('⚠️ Web app did not acknowledge after', MAX_RETRIES, 'attempts');
    clearInterval(announceInterval);
  }
}, 2000);

// FIXED: Listen for messages from extension background with better error handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Content script received from extension:', request);
  
  try {
    if (request.action === 'extensionStartedMonitoring') {
      console.log('▶️ Extension started monitoring - notifying web app');
      
      // Send message to web app via window.postMessage
      window.postMessage({ 
        type: 'NEURALSTRIDE_START_MONITORING',
        source: 'extension',
        timestamp: Date.now()
      }, '*');
      
      sendResponse({ received: true, status: 'forwarded to web app' });
    }
    
    if (request.action === 'extensionStoppedMonitoring') {
      console.log('⏸️ Extension stopped monitoring - notifying web app');
      
      window.postMessage({ 
        type: 'NEURALSTRIDE_STOP_MONITORING',
        source: 'extension',
        timestamp: Date.now()
      }, '*');
      
      sendResponse({ received: true, status: 'forwarded to web app' });
    }
  } catch (error) {
    console.error('❌ Error handling extension message:', error);
    sendResponse({ received: false, error: error.message });
  }
  
  return true; // Keep channel open for async response
});

// FIXED: Listen for messages from web app with validation
window.addEventListener('message', (event) => {
  // FIXED: Only accept messages from same origin
  if (event.origin !== window.location.origin) {
    console.log('⚠️ Ignoring message from different origin:', event.origin);
    return;
  }
  
  // Ignore messages from extension itself
  if (event.data.source === 'extension') {
    return;
  }
  
  console.log('📨 Content script received from web app:', event.data);
  
  // FIXED: Web app ready acknowledgment
  if (event.data.type === 'NEURALSTRIDE_WEBAPP_READY') {
    console.log('✅ Web app acknowledged connection');
    isConnected = true;
    retryCount = 0;
    clearInterval(announceInterval);
    
    // Re-announce to confirm
    window.postMessage({ 
      type: 'NEURALSTRIDE_CONTENT_SCRIPT_CONFIRMED',
      source: 'extension',
      timestamp: Date.now()
    }, '*');
  }
  
  // FIXED: Forward start/stop commands to extension
  if (event.data.type === 'NEURALSTRIDE_WEBAPP_START') {
    console.log('▶️ Web app requested start - forwarding to extension');
    
    chrome.runtime.sendMessage({ 
      action: 'startMonitoring' 
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Failed to forward start to extension:', chrome.runtime.lastError);
      } else {
        console.log('✅ Start command forwarded to extension:', response);
      }
    });
  }
  
  if (event.data.type === 'NEURALSTRIDE_WEBAPP_STOP') {
    console.log('⏸️ Web app requested stop - forwarding to extension');
    
    chrome.runtime.sendMessage({ 
      action: 'stopMonitoring' 
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Failed to forward stop to extension:', chrome.runtime.lastError);
      } else {
        console.log('✅ Stop command forwarded to extension:', response);
      }
    });
  }
});

// FIXED: Notify web app that content script is ready (with retry)
let notifyAttempts = 0;
const notifyWebApp = () => {
  console.log(`📢 Notifying web app (attempt ${notifyAttempts + 1})`);
  
  window.postMessage({ 
    type: 'NEURALSTRIDE_CONTENT_SCRIPT_READY',
    source: 'extension',
    timestamp: Date.now(),
    attempt: notifyAttempts + 1
  }, '*');
  
  notifyAttempts++;
};

// Initial notification
notifyWebApp();

// Retry every 1 second for first 5 seconds
const notifyInterval = setInterval(() => {
  if (notifyAttempts < 5 && !isConnected) {
    notifyWebApp();
  } else {
    clearInterval(notifyInterval);
  }
}, 1000);

// FIXED: Log when page is fully loaded
window.addEventListener('load', () => {
  console.log('📄 Page fully loaded, content script active');
  
  // One more announcement after page load
  setTimeout(() => {
    if (!isConnected) {
      console.log('🔄 Page loaded but no connection, trying again...');
      announcePresence();
    }
  }, 1000);
});

// FIXED: Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !isConnected) {
    console.log('👁️ Page visible again, re-establishing connection...');
    retryCount = 0;
    announcePresence();
  }
});

// FIXED: Heartbeat to keep connection alive
setInterval(() => {
  if (isConnected) {
    window.postMessage({
      type: 'NEURALSTRIDE_HEARTBEAT',
      source: 'extension',
      timestamp: Date.now()
    }, '*');
  }
}, 10000); // Every 10 seconds

console.log('✅ Content script initialization complete');