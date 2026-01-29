// NeuralStride Popup Script

let isMonitoring = false;
let currentScore = 0;
let sessionStartTime = null;
let updateInterval = null;

// DOM Elements
const plantDisplay = document.getElementById('plantDisplay');
const plantStatus = document.getElementById('plantStatus');
const scoreValue = document.getElementById('scoreValue');
const scoreFill = document.getElementById('scoreFill');
const sessionTime = document.getElementById('sessionTime');
const streak = document.getElementById('streak');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const openDashboard = document.getElementById('openDashboard');
const openSettings = document.getElementById('openSettings');

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Popup loaded');
    await loadStatus();
    await loadStats();
});

// Load current status
async function loadStatus() {
    try {
        const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
        
        isMonitoring = response.isMonitoring;
        currentScore = response.currentScore || 0;
        
        updateUI(response);
        
        if (isMonitoring) {
            showStopButton();
            startUIUpdates();
        } else {
            showStartButton();
        }
    } catch (error) {
        console.error('Error loading status:', error);
    }
}

// Load statistics
async function loadStats() {
    try {
        const result = await chrome.storage.local.get(['stats']);
        if (result.stats) {
            streak.textContent = result.stats.currentStreak || 0;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Update UI based on status
function updateUI(status) {
    const score = status.currentScore || 0;
    const state = status.plantState || 'dormant';
    
    // Update plant display
    const plantEmojis = {
        'dormant': '🌰',
        'seedling': '🌱',
        'sprout': '🌿',
        'growing': '🌿',
        'flowering': '🌸',
        'bloom': '🌺',
        'wilting': '🥀'
    };
    
    const statusMessages = {
        'dormant': 'Not Monitoring',
        'seedling': 'Just Started!',
        'sprout': 'Growing Well',
        'growing': 'Healthy Growth',
        'flowering': 'Blooming Nicely!',
        'bloom': 'Perfect Health! 🎉',
        'wilting': 'Needs Attention!'
    };
    
    plantDisplay.textContent = plantEmojis[state] || '🌱';
    plantStatus.textContent = statusMessages[state] || 'Your Posture Plant';
    
    // Update score
    scoreValue.textContent = Math.round(score);
    scoreFill.style.width = `${score}%`;
    
    // Update score bar color
    scoreFill.classList.remove('good', 'fair', 'poor');
    if (score >= 70) {
        scoreFill.classList.add('good');
    } else if (score >= 50) {
        scoreFill.classList.add('fair');
    } else {
        scoreFill.classList.add('poor');
    }
}

// Start monitoring
startBtn.addEventListener('click', async () => {
    try {
        await chrome.runtime.sendMessage({ action: 'startMonitoring' });
        isMonitoring = true;
        sessionStartTime = Date.now();
        showStopButton();
        startUIUpdates();
    } catch (error) {
        console.error('Error starting monitoring:', error);
    }
});

// Stop monitoring
stopBtn.addEventListener('click', async () => {
    try {
        await chrome.runtime.sendMessage({ action: 'stopMonitoring' });
        isMonitoring = false;
        sessionStartTime = null;
        showStartButton();
        stopUIUpdates();
    } catch (error) {
        console.error('Error stopping monitoring:', error);
    }
});

// Show/hide buttons
function showStartButton() {
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
}

function showStopButton() {
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
}

// Start UI updates
function startUIUpdates() {
    if (updateInterval) clearInterval(updateInterval);
    
    updateInterval = setInterval(async () => {
        // Update session time
        if (sessionStartTime) {
            const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            sessionTime.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // Get updated status
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
            updateUI(response);
        } catch (error) {
            console.error('Error updating UI:', error);
        }
    }, 1000);
}

// Stop UI updates
function stopUIUpdates() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
    sessionTime.textContent = '--';
}

// Open full dashboard
openDashboard.addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:3000' });
});

// Open settings
openSettings.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
});


// Test notification button
const testNotification = document.getElementById('testNotification');
if (testNotification) {
    testNotification.addEventListener('click', async () => {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: '../icons/plant-states/wilting-48.png',
            title: '🥀 Your Plant is Wilting!',
            message: 'Your posture is poor. Sit up straight!',
            priority: 2
        });
    });
}