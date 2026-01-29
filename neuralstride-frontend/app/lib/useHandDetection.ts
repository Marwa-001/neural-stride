'use client';

import { useState, useEffect, useRef } from 'react';
import { Hands, Results } from '@mediapipe/hands';

export interface HandGesture {
  detected: boolean;
  confidence: number;
  letterMatch: string | null;
}

export function useHandDetection() {
  const [hands, setHands] = useState<Hands | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    initializeHands();
  }, []);

  const initializeHands = async () => {
    try {
      const handsInstance = new Hands({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
      });

      handsInstance.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      handsInstance.onResults((results: Results) => {
        // Results will be processed in component
      });

      await handsInstance.initialize();
      setHands(handsInstance);
      setIsReady(true);
    } catch (err) {
      setError('Failed to initialize hand detection: ' + (err as Error).message);
      console.error(err);
    }
  };

  const detectHand = async (video: HTMLVideoElement): Promise<Results | null> => {
    if (!hands || !isReady) return null;
    
    try {
      await hands.send({ image: video });
      return null; // Results come through onResults callback
    } catch (err) {
      console.error('Hand detection error:', err);
      return null;
    }
  };

  const recognizeASLLetter = (landmarks: any[]): string | null => {
    if (!landmarks || landmarks.length < 21) return null;

    // Simple gesture recognition for a few ASL letters
    // We'll implement A, B, C, L, O, Y as examples

    const thumb = landmarks[4];
    const index = landmarks[8];
    const middle = landmarks[12];
    const ring = landmarks[16];
    const pinky = landmarks[20];
    const wrist = landmarks[0];

    // Helper: Check if finger is extended
    const isExtended = (tip: any, pip: any, wrist: any) => {
      return tip.y < pip.y; // Tip is above PIP joint
    };

    const thumbExtended = isExtended(thumb, landmarks[2], wrist);
    const indexExtended = isExtended(index, landmarks[6], wrist);
    const middleExtended = isExtended(middle, landmarks[10], wrist);
    const ringExtended = isExtended(ring, landmarks[14], wrist);
    const pinkyExtended = isExtended(pinky, landmarks[18], wrist);

    // Letter A: Fist with thumb on side
    if (!indexExtended && !middleExtended && !ringExtended && !pinkyExtended && thumbExtended) {
      return 'A';
    }

    // Letter B: All fingers extended except thumb
    if (indexExtended && middleExtended && ringExtended && pinkyExtended && !thumbExtended) {
      return 'B';
    }

    // Letter C: Curved hand
    const avgFingerY = (index.y + middle.y + ring.y + pinky.y) / 4;
    const isCurved = Math.abs(avgFingerY - wrist.y) < 0.2;
    if (isCurved && thumbExtended) {
      return 'C';
    }

    // Letter L: Index extended, thumb extended, others closed
    if (indexExtended && thumbExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      return 'L';
    }

    // Letter O: All fingers in circle
    const thumbIndexDistance = Math.sqrt(
      Math.pow(thumb.x - index.x, 2) + Math.pow(thumb.y - index.y, 2)
    );
    if (thumbIndexDistance < 0.1 && !middleExtended && !ringExtended && !pinkyExtended) {
      return 'O';
    }

    // Letter Y: Thumb and pinky extended
    if (thumbExtended && pinkyExtended && !indexExtended && !middleExtended && !ringExtended) {
      return 'Y';
    }

    return null;
  };

  return {
    hands,
    isReady,
    error,
    detectHand,
    recognizeASLLetter
  };
}