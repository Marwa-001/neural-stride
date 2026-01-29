// Content script for NeuralStride - enables two-way communication
console.log('🔗 NeuralStride content script loaded');

// Listen for messages from extension background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Content script received:', request);
  
  if (request.action === 'extensionStartedMonitoring') {
    console.log('▶️ Extension started monitoring - notifying web app');
    // Send message to web app via window.postMessage
    window.postMessage({ 
      type: 'NEURALSTRIDE_START_MONITORING',
      source: 'extension' 
    }, '*');
    sendResponse({ received: true });
  }
  
  if (request.action === 'extensionStoppedMonitoring') {
    console.log('⏸️ Extension stopped monitoring - notifying web app');
    window.postMessage({ 
      type: 'NEURALSTRIDE_STOP_MONITORING',
      source: 'extension' 
    }, '*');
    sendResponse({ received: true });
  }
  
  return true;
});

// Listen for messages from web app
window.addEventListener('message', (event) => {
  // Only accept messages from same origin
  if (event.origin !== window.location.origin) return;
  
  if (event.data.type === 'NEURALSTRIDE_WEBAPP_READY') {
    console.log('✅ Web app is ready for communication');
  }
});

// Notify web app that content script is ready
window.postMessage({ 
  type: 'NEURALSTRIDE_CONTENT_SCRIPT_READY',
  source: 'extension' 
}, '*');