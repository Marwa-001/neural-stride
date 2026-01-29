// 'use client';

import { useState, useEffect, useRef } from 'react';
import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';

export interface PostureMetrics {
  postureScore: number;
  cervicalAngle: number;
  isPersonDetected: boolean;
  shoulderAlignment: number;
  headForward: number;
}

export function useMediaPipe() {
  const [poseLandmarker, setPoseLandmarker] = useState<PoseLandmarker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState('');
  const animationFrameRef = useRef(0);

  useEffect(() => {
    initializeMediaPipe();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const initializeMediaPipe = async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      setPoseLandmarker(landmarker);
      setIsReady(true);
      console.log('✅ MediaPipe initialized successfully');
    } catch (err) {
      setError('Failed to initialize MediaPipe: ' + (err as Error).message);
      console.error('❌ MediaPipe error:', err);
    }
  };

  const calculateCervicalAngle = (landmarks: any[]): number => {
    // Use ear, shoulder, and hip - classic posture assessment method
    const leftEar = landmarks[7];
    const rightEar = landmarks[8];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];

    // Average positions for more stable measurements
    const ear = {
      x: (leftEar.x + rightEar.x) / 2,
      y: (leftEar.y + rightEar.y) / 2
    };
    const shoulder = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2
    };
    const hip = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2
    };

    // Create vectors
    const shoulderToEar = {
      x: ear.x - shoulder.x,
      y: ear.y - shoulder.y
    };
    
    const shoulderToHip = {
      x: hip.x - shoulder.x,
      y: hip.y - shoulder.y
    };

    // Calculate angle using dot product formula
    const dotProduct = (shoulderToEar.x * shoulderToHip.x) + (shoulderToEar.y * shoulderToHip.y);
    
    const magnitudeA = Math.sqrt(shoulderToEar.x ** 2 + shoulderToEar.y ** 2);
    const magnitudeB = Math.sqrt(shoulderToHip.x ** 2 + shoulderToHip.y ** 2);
    
    // Prevent division by zero
    if (magnitudeA === 0 || magnitudeB === 0) return 90;
    
    const cosTheta = dotProduct / (magnitudeA * magnitudeB);
    
    // Clamp value to prevent Math.acos errors
    const clampedCos = Math.max(-1, Math.min(1, cosTheta));
    
    const angleRad = Math.acos(clampedCos);
    const angleDeg = angleRad * (180 / Math.PI);
    
    return angleDeg;
  };

  const calculateShoulderAlignment = (landmarks: any[]): number => {
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    
    // Check if shoulders are level (y-coordinates should be similar)
    const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y);
    
    // Convert to a 0-100 scale (0 = very uneven, 100 = perfectly aligned)
    const alignment = Math.max(0, 100 - (shoulderDiff * 500));
    
    return Math.round(alignment);
  };

  const calculateHeadForwardDistance = (landmarks: any[]): number => {
    const nose = landmarks[0];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    
    const shoulderX = (leftShoulder.x + rightShoulder.x) / 2;
    
    // Measure horizontal distance between nose and shoulder midpoint
    const forwardDistance = Math.abs(nose.x - shoulderX);
    
    // Convert to percentage (0 = head directly above shoulders, 100 = very far forward)
    return Math.min(100, Math.round(forwardDistance * 200));
  };

  const calculatePostureScore = (
    cervicalAngle: number, 
    shoulderAlignment: number,
    headForward: number
  ): number => {
    // Improved scoring based on real-world posture
    // Cervical angle contribution: 60%
    // Shoulder alignment contribution: 20%
    // Head forward position contribution: 20%
    
    let cervicalScore = 0;
    
    // Real-world sitting posture angles (adjusted for natural forward lean)
    if (cervicalAngle >= 155 && cervicalAngle <= 165) {
      cervicalScore = 100; // Ideal range
    } else if (cervicalAngle >= 150) {
      cervicalScore = 95 - Math.abs(cervicalAngle - 160) * 2;
    } else if (cervicalAngle >= 145) {
      cervicalScore = 85 - (150 - cervicalAngle) * 1.5;
    } else if (cervicalAngle >= 135) {
      cervicalScore = 70 - (145 - cervicalAngle) * 2;
    } else if (cervicalAngle >= 125) {
      cervicalScore = 50 - (135 - cervicalAngle) * 2.5;
    } else if (cervicalAngle >= 115) {
      cervicalScore = 25 - (125 - cervicalAngle) * 2;
    } else {
      cervicalScore = Math.max(0, 10 - (115 - cervicalAngle) * 0.5);
    }
    
    // Penalize head being too far forward
    const headForwardScore = Math.max(0, 100 - headForward * 1.5);
    
    // Combined weighted score
    const totalScore = (
      (cervicalScore * 0.6) + 
      (shoulderAlignment * 0.2) + 
      (headForwardScore * 0.2)
    );
    
    return Math.round(Math.max(0, Math.min(100, totalScore)));
  };

  const detectPose = (
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement
  ): PostureMetrics | null => {
    if (!poseLandmarker || !isReady) return null;

    const startTimeMs = performance.now();
    const results = poseLandmarker.detectForVideo(video, startTimeMs);

    // Draw on canvas
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (results.landmarks && results.landmarks.length > 0) {
        const drawingUtils = new DrawingUtils(ctx);
        
        for (const landmarks of results.landmarks) {
          // Draw skeleton with better visibility
          drawingUtils.drawLandmarks(landmarks, {
            radius: 6,
            color: '#00FF00',
            fillColor: '#00FF00'
          });
          drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
            color: '#00FFFF',
            lineWidth: 3
          });
        }

        // Calculate all metrics
        const cervicalAngle = calculateCervicalAngle(results.landmarks[0]);
        const shoulderAlignment = calculateShoulderAlignment(results.landmarks[0]);
        const headForward = calculateHeadForwardDistance(results.landmarks[0]);
        const postureScore = calculatePostureScore(cervicalAngle, shoulderAlignment, headForward);

        return {
          postureScore: Math.round(postureScore),
          cervicalAngle: Math.round(cervicalAngle * 10) / 10,
          isPersonDetected: true,
          shoulderAlignment: shoulderAlignment,
          headForward: headForward
        };
      }
    }

    return {
      postureScore: 0,
      cervicalAngle: 0,
      isPersonDetected: false,
      shoulderAlignment: 0,
      headForward: 0
    };
  };

  return {
    isReady,
    error,
    detectPose
  };
}