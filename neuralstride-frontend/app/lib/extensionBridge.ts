'use client';

// FIXED: Complete rewrite of extension bridge with robust communication
export class ExtensionBridge {
  private extensionId: string | null = null;
  private isExtensionAvailable: boolean = false;
  private messageQueue: any[] = [];
  private retryCount: number = 0;
  private maxRetries: number = 3;
  private connectionCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    console.log('🔗 ExtensionBridge constructor called');
    this.init();
  }

  private async init() {
    // Wait for DOM to be ready
    if (typeof window === 'undefined') {
      console.log('⏳ Window not available yet (SSR)');
      return;
    }

    // Try to discover extension ID
    await this.discoverExtensionId();
    
    // Set up periodic connection checks
    this.setupConnectionMonitoring();
  }

  // FIXED: Dynamic extension ID discovery
  private async discoverExtensionId(): Promise<void> {
    console.log('🔍 Attempting to discover extension ID...');
    
    // @ts-ignore
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      console.log('❌ Chrome runtime not available');
      return;
    }

    // Method 1: Try known extension ID first (for development)
    const knownId = 'edifjoehbcbkeimfjndlafjfpgjolnoh';
    const connected = await this.tryConnect(knownId);
    
    if (connected) {
      this.extensionId = knownId;
      console.log('✅ Connected using known extension ID:', knownId);
      return;
    }

    // Method 2: Listen for extension messages to discover ID
    console.log('📡 Waiting for extension to announce itself...');
    
    // Extension should send a message when content script loads
    window.addEventListener('message', (event) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'NEURALSTRIDE_CONTENT_SCRIPT_READY') {
        console.log('✅ Extension content script announced itself');
        // The extension is present, try to ping it
        if (!this.isExtensionAvailable) {
          setTimeout(() => this.checkExtension(), 500);
        }
      }
    });
  }

  // FIXED: Robust connection attempt with retry
  private async tryConnect(extensionId: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        // @ts-ignore
        chrome.runtime.sendMessage(
          extensionId,
          { action: 'ping' },
          (response: any) => {
            // @ts-ignore
            if (chrome.runtime.lastError) {
              console.log('❌ Ping failed:', chrome.runtime.lastError.message);
              resolve(false);
            } else if (response && response.status === 'connected') {
              console.log('✅ Extension ping successful:', response);
              resolve(true);
            } else {
              resolve(false);
            }
          }
        );
      } catch (error) {
        console.error('❌ Error during ping:', error);
        resolve(false);
      }
    });
  }

  // FIXED: Improved connection check with retry mechanism
  async checkExtension() {
    console.log('🔍 Checking for extension... (Attempt', this.retryCount + 1, '/', this.maxRetries, ')');
    
    if (typeof window === 'undefined') {
      console.log('❌ Window not available (SSR)');
      return;
    }
    
    // @ts-ignore
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      console.log('❌ Chrome runtime not available');
      this.isExtensionAvailable = false;
      return;
    }

    // If we don't have an extension ID, try to discover it
    if (!this.extensionId) {
      await this.discoverExtensionId();
    }

    // If still no extension ID, we can't connect
    if (!this.extensionId) {
      console.log('❌ No extension ID available');
      
      // Retry
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        setTimeout(() => this.checkExtension(), 2000);
      }
      return;
    }

    try {
      console.log('📤 Sending ping to extension:', this.extensionId);
      
      const connected = await this.tryConnect(this.extensionId);
      
      if (connected) {
        this.isExtensionAvailable = true;
        this.retryCount = 0;
        
        // Process queued messages
        this.processMessageQueue();
        
        console.log('✅ Extension connection established!');
      } else {
        this.isExtensionAvailable = false;
        
        // Retry
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          setTimeout(() => this.checkExtension(), 2000);
        } else {
          console.log('⚠️ Max retries reached. Extension may not be installed or enabled.');
        }
      }
    } catch (error) {
      console.error('❌ Error checking extension:', error);
      this.isExtensionAvailable = false;
    }
  }

  // FIXED: Message queuing system
  private queueMessage(message: any) {
    console.log('📥 Queuing message:', message);
    this.messageQueue.push(message);
    
    // Try to process queue immediately
    if (this.isExtensionAvailable) {
      this.processMessageQueue();
    }
  }

  private processMessageQueue() {
    if (!this.isExtensionAvailable || this.messageQueue.length === 0) {
      return;
    }

    console.log('📤 Processing', this.messageQueue.length, 'queued messages');
    
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.sendMessageNow(message);
    }
  }

  // FIXED: Direct message sending with error handling
  private sendMessageNow(message: any): void {
    if (!this.extensionId) {
      console.log('❌ Cannot send message: no extension ID');
      return;
    }

    try {
      console.log('📤 Sending message:', message);
      
      // @ts-ignore
      chrome.runtime.sendMessage(
        this.extensionId,
        message,
        (response: any) => {
          // @ts-ignore
          if (chrome.runtime.lastError) {
            console.log('❌ Message send failed:', chrome.runtime.lastError.message);
            this.isExtensionAvailable = false;
            
            // Re-queue the message for retry
            this.queueMessage(message);
            
            // Try to reconnect
            setTimeout(() => this.checkExtension(), 1000);
          } else {
            console.log('✅ Message sent successfully:', response);
          }
        }
      );
    } catch (error) {
      console.error('❌ Error sending message:', error);
      this.isExtensionAvailable = false;
      this.queueMessage(message);
    }
  }

  // FIXED: Reliable posture data sending
  sendPostureData(data: {
    postureScore: number;
    cervicalAngle: number;
    isPersonDetected: boolean;
  }) {
    const message = {
      action: 'updatePosture',
      data: data
    };

    if (!this.isExtensionAvailable) {
      // Queue for later if not connected
      this.queueMessage(message);
      
      // Try to reconnect
      if (this.retryCount === 0) {
        this.checkExtension();
      }
      return;
    }

    this.sendMessageNow(message);
  }

  // FIXED: Reliable session status sending
  sendSessionStatus(isActive: boolean) {
    const message = {
      action: 'sessionStatus',
      isActive: isActive
    };

    if (!this.isExtensionAvailable) {
      // Queue for later if not connected
      this.queueMessage(message);
      
      // Try to reconnect
      if (this.retryCount === 0) {
        this.checkExtension();
      }
      return;
    }

    this.sendMessageNow(message);
  }

  // FIXED: Periodic connection monitoring
  private setupConnectionMonitoring() {
    // Check connection every 10 seconds
    this.connectionCheckInterval = setInterval(() => {
      if (!this.isExtensionAvailable) {
        console.log('🔄 Connection lost, attempting to reconnect...');
        this.retryCount = 0;
        this.checkExtension();
      }
    }, 10000);
  }

  // Cleanup
  destroy() {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }
  }

  // FIXED: Get connection status for UI
  getConnectionStatus(): { connected: boolean; extensionId: string | null } {
    return {
      connected: this.isExtensionAvailable,
      extensionId: this.extensionId
    };
  }
}

export const extensionBridge = new ExtensionBridge();