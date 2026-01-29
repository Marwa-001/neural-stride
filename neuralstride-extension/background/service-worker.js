console.log('NeuralStride extension loaded - v2.1 FIXED');

let isMonitoring = false;
let currentScore = 50;
let plantState = 'growing';
let lastNotificationTime = 0;
const NOTIFICATION_COOLDOWN = 60000; // 1 minute between notifications

chrome.runtime.onInstalled.addListener(() => {
  console.log('NeuralStride installed');
  chrome.storage.local.set({
    settings: {
      voiceEnabled: true,
      voiceType: 'female',
      notifications: true,
      autoStart: false,
      updateInterval: 5
    },
    stats: {
      totalSessions: 0,
      totalMinutes: 0,
      bestScore: 0,
      currentStreak: 0
    }
  });
  updatePlantIcon(50);
});

// FIXED: Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);
  
  if (request.action === 'startMonitoring') {
    startMonitoring();
    sendResponse({ success: true });
  }
  
  if (request.action === 'stopMonitoring') {
    stopMonitoring();
    sendResponse({ success: true });
  }
  
  if (request.action === 'getStatus') {
    sendResponse({
      isMonitoring: isMonitoring,
      currentScore: currentScore,
      plantState: plantState
    });
  }
  
  if (request.action === 'updateScore') {
    currentScore = request.score;
    updatePlantIcon(request.score);
    sendResponse({ success: true });
  }
  
  return true;
});

// FIXED: Improved external message handling for web app communication
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  console.log('📨 External message from web app:', request);
  
  // FIXED: Add ping response
  if (request.action === 'ping') {
    console.log('🏓 Ping received from web app');
    sendResponse({ status: 'connected', extensionId: chrome.runtime.id });
    return true;
  }
  
  // FIXED: Handle posture updates with better validation
  if (request.action === 'updatePosture') {
    console.log('📊 Posture data received:', request.data);
    
    if (!request.data) {
      console.error('❌ No data in posture update');
      sendResponse({ status: 'error', message: 'No data provided' });
      return true;
    }
    
    currentScore = request.data.postureScore || 0;
    isMonitoring = true;
    updatePlantIcon(currentScore);
    
    // Save data to storage
    chrome.storage.local.set({
      lastPostureData: {
        score: request.data.postureScore,
        angle: request.data.cervicalAngle,
        detected: request.data.isPersonDetected,
        timestamp: Date.now()
      }
    });
    
    // FIXED: Show notification for poor posture (with cooldown)
    if (currentScore < 40) {
      const now = Date.now();
      if (now - lastNotificationTime > NOTIFICATION_COOLDOWN) {
        chrome.storage.local.get(['settings'], (result) => {
          if (result.settings && result.settings.notifications) {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: '../icons/plant-states/wilting-48.png',
              title: '🥀 Poor Posture Detected',
              message: `Your posture score is ${currentScore}. Sit up straight!`,
              priority: 2
            });
            lastNotificationTime = now;
          }
        });
      }
    }
    
    sendResponse({ status: 'updated', currentScore: currentScore });
    return true;
  }
  
  // FIXED: Handle session status with two-way sync
  if (request.action === 'sessionStatus') {
    console.log('📡 Session status:', request.isActive);
    
    const wasMonitoring = isMonitoring;
    isMonitoring = request.isActive;
    
    if (!request.isActive) {
      updatePlantIcon(0);
    }
    
    // FIXED: If state changed, notify all tabs
    if (wasMonitoring !== isMonitoring) {
      const action = isMonitoring ? 'extensionStartedMonitoring' : 'extensionStoppedMonitoring';
      notifyWebApp(action);
    }
    
    sendResponse({ status: 'received', wasMonitoring: wasMonitoring, isMonitoring: isMonitoring });
    return true;
  }
  
  return true;
});

function startMonitoring() {
  isMonitoring = true;
  console.log('✅ Monitoring started from extension');
  
  // FIXED: Notify web app to start monitoring
  notifyWebApp('extensionStartedMonitoring');
  
  chrome.notifications.create({
    type: 'basic',
    iconUrl: '../icons/plant-states/growing-48.png',
    title: '🌱 NeuralStride Started',
    message: 'Posture monitoring is now active'
  });
}

function stopMonitoring() {
  isMonitoring = false;
  console.log('⏸️ Monitoring stopped from extension');
  
  // FIXED: Notify web app to stop monitoring
  notifyWebApp('extensionStoppedMonitoring');
  
  updatePlantIcon(0);
}

// FIXED: Improved web app notification with better error handling and retries
function notifyWebApp(action) {
  console.log('📤 Attempting to notify web app:', action);
  
  // Send message to all localhost:3000 tabs
  chrome.tabs.query({ url: 'http://localhost:3000/*' }, (tabs) => {
    console.log(`📡 Found ${tabs.length} web app tabs`);
    
    if (tabs.length === 0) {
      console.log('⚠️ No web app tabs found. User may need to open http://localhost:3000');
      return;
    }
    
    tabs.forEach((tab, index) => {
      if (!tab.id) {
        console.log(`⚠️ Tab ${index} has no ID`);
        return;
      }
      
      console.log(`📤 Sending "${action}" to tab ${tab.id}`);
      
      // FIXED: Add retry mechanism for tab messaging
      const sendWithRetry = (retryCount = 0) => {
        chrome.tabs.sendMessage(tab?.id, { action: action }, (response) => {
          if (chrome.runtime.lastError) {
            console.log(`⚠️ Tab ${tab.id} message failed:`, chrome.runtime.lastError.message);
            
            // Retry up to 3 times
            if (retryCount < 3) {
              console.log(`🔄 Retrying (${retryCount + 1}/3)...`);
              setTimeout(() => sendWithRetry(retryCount + 1), 1000);
            } else {
              console.log(`❌ Tab ${tab.id} not responding after 3 retries`);
            }
          } else {
            console.log(`✅ Tab ${tab.id} responded:`, response);
          }
        });
      };
      
      sendWithRetry();
    });
  });
  
  // FIXED: Also check for tabs on 127.0.0.1:3000
  chrome.tabs.query({ url: 'http://127.0.0.1:3000/*' }, (tabs) => {
    if (tabs.length > 0) {
      console.log(`📡 Found ${tabs.length} additional tabs on 127.0.0.1:3000`);
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { action: action }, (response) => {
            if (chrome.runtime.lastError) {
              console.log('⚠️ 127.0.0.1 tab not ready:', chrome.runtime.lastError.message);
            } else {
              console.log('✅ 127.0.0.1 tab notified successfully');
            }
          });
        }
      });
    }
  });
}

// FIXED: Improved plant icon update with better logging
function updatePlantIcon(score) {
  console.log('🎨 updatePlantIcon called with score:', score, 'isMonitoring:', isMonitoring);
  
  let state;
  if (!isMonitoring || score === 0) {
    state = 'dormant';
  } else if (score >= 85) {
    state = 'bloom';
  } else if (score >= 70) {
    state = 'flowering';
  } else if (score >= 50) {
    state = 'growing';
  } else if (score >= 30) {
    state = 'sprout';
  } else {
    state = 'wilting';
  }
  
  plantState = state;
  console.log('🌱 Plant state:', state);
  
  if (isMonitoring && score > 0) {
    const badgeText = Math.round(score).toString();
    console.log('🔢 Setting badge text:', badgeText);
    
    chrome.action.setBadgeText({ text: badgeText }, () => {
      if (chrome.runtime.lastError) {
        console.error('❌ Badge text error:', chrome.runtime.lastError);
      } else {
        console.log('✅ Badge text set successfully');
      }
    });
    
    const badgeColor = score >= 70 ? '#10B981' : 
                       score >= 50 ? '#F59E0B' : '#EF4444';
    console.log('🎨 Setting badge color:', badgeColor);
    
    chrome.action.setBadgeBackgroundColor({ color: badgeColor }, () => {
      if (chrome.runtime.lastError) {
        console.error('❌ Badge color error:', chrome.runtime.lastError);
      } else {
        console.log('✅ Badge color set successfully');
      }
    });
  } else {
    console.log('🔄 Clearing badge (not monitoring or score 0)');
    chrome.action.setBadgeText({ text: '' });
  }
  
  // FIXED: Store current state for popup to access
  chrome.storage.local.set({
    currentState: {
      isMonitoring: isMonitoring,
      score: score,
      plantState: state,
      timestamp: Date.now()
    }
  });
}

chrome.runtime.onConnect.addListener((port) => {
  console.log('🔌 Port connected:', port.name);
});

// FIXED: Cleanup on extension unload
chrome.runtime.onSuspend.addListener(() => {
  console.log('💤 Extension suspending - cleaning up');
  isMonitoring = false;
  
  // Save final state
  chrome.storage.local.set({
    lastSuspendState: {
      isMonitoring: false,
      timestamp: Date.now()
    }
  });
});

// FIXED: Send extension ID to console for easy copying
console.log('🆔 Extension ID:', chrome.runtime.id);
console.log('📋 Copy this ID to extensionBridge.ts if needed');