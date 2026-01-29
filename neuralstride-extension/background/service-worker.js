console.log('NeuralStride extension loaded - v2.0');

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

chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  console.log('External message from web app:', request);
  
  if (request.action === 'ping') {
    console.log('Ping received from web app');
    sendResponse({ status: 'connected' });
    return true;
  }
  
  if (request.action === 'updatePosture') {
    console.log('Posture data received:', request.data);
    currentScore = request.data.postureScore;
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
    
    // Show notification for poor posture (with cooldown)
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
    
    sendResponse({ status: 'updated' });
    return true;
  }
  
  if (request.action === 'sessionStatus') {
    console.log('Session status:', request.isActive);
    isMonitoring = request.isActive;
    if (!request.isActive) {
      updatePlantIcon(0);
    }
    sendResponse({ status: 'received' });
    return true;
  }
  
  return true;
});

function startMonitoring() {
  isMonitoring = true;
  console.log('✅ Monitoring started from extension');
  
  // Notify web app to start monitoring
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
  
  // Notify web app to stop monitoring
  notifyWebApp('extensionStoppedMonitoring');
  
  updatePlantIcon(0);
}

function notifyWebApp(action) {
  // Send message to all localhost:3000 tabs
  chrome.tabs.query({ url: 'http://localhost:3000/*' }, (tabs) => {
    console.log(`📤 Notifying ${tabs.length} web app tabs: ${action}`);
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: action }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('⚠️ Web app not ready:', chrome.runtime.lastError.message);
          } else {
            console.log('✅ Web app notified successfully');
          }
        });
      }
    });
  });
}

function updatePlantIcon(score) {
  console.log('🎨 updatePlantIcon called with score:', score);
  
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
}

chrome.runtime.onConnect.addListener((port) => {
  console.log('🔌 Port connected:', port.name);
});

// Cleanup on extension unload
chrome.runtime.onSuspend.addListener(() => {
  console.log('💤 Extension suspending - cleaning up');
  isMonitoring = false;
});