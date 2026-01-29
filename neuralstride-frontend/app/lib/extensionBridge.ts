'use client';

export class ExtensionBridge {
  private extensionId: string = 'edifjoehbcbkeimfjndlafjfpgjolnoh';
  private isExtensionAvailable: boolean = false;

  constructor() {
    console.log('🔗 ExtensionBridge constructor called');
  }

  async checkExtension() {
    console.log('🔍 Checking for extension...');
    
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

    try {
      console.log('📤 Sending ping to extension:', this.extensionId);
      
      // @ts-ignore
      chrome.runtime.sendMessage(
        this.extensionId,
        { action: 'ping' },
        (response: any) => {
          // @ts-ignore
          if (chrome.runtime.lastError) {
            // @ts-ignore
            console.log('❌ Extension not responding:', chrome.runtime.lastError.message);
            this.isExtensionAvailable = false;
          } else {
            this.isExtensionAvailable = true;
            console.log('✅ Extension connected!', response);
          }
        }
      );
    } catch (error) {
      console.error('❌ Error checking extension:', error);
      this.isExtensionAvailable = false;
    }
  }

  sendPostureData(data: {
    postureScore: number;
    cervicalAngle: number;
    isPersonDetected: boolean;
  }) {
    if (!this.isExtensionAvailable) {
      return;
    }

    try {
      console.log('📤 Sending posture data:', data.postureScore);
      
      // @ts-ignore
      chrome.runtime.sendMessage(
        this.extensionId,
        {
          action: 'updatePosture',
          data: data
        }
      );
    } catch (error) {
      console.error('❌ Error sending posture data:', error);
    }
  }

  sendSessionStatus(isActive: boolean) {
    if (!this.isExtensionAvailable) {
      return;
    }

    try {
      console.log('📤 Sending session status:', isActive);
      
      // @ts-ignore
      chrome.runtime.sendMessage(
        this.extensionId,
        {
          action: 'sessionStatus',
          isActive: isActive
        }
      );
    } catch (error) {
      console.error('❌ Error sending session status:', error);
    }
  }
}

export const extensionBridge = new ExtensionBridge();