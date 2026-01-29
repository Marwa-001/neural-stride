'use client';

import { useState, useEffect, useRef } from 'react';

interface SignLanguageLearningProps {
  isActive: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
}

const ASL_LETTERS = [
  { letter: 'A', description: 'Fist with thumb on side', image: '✊👍' },
  { letter: 'B', description: 'Flat hand, fingers together', image: '🖐️' },
  { letter: 'L', description: 'Index finger and thumb form L', image: '👌' },
  { letter: 'Y', description: 'Thumb and pinky extended', image: '🤙' }
];

export default function SignLanguageLearning({ isActive, videoRef }: SignLanguageLearningProps) {
  const [currentLetter, setCurrentLetter] = useState(0);
  const [detectedLetter, setDetectedLetter] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [message, setMessage] = useState('Initializing hand detection...');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handsRef = useRef<any>(null);

  useEffect(() => {
    if (!isActive) return;

    // Check if script already loaded
    if ((window as any).Hands) {
      initHands();
      return;
    }

    // Load MediaPipe script
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/hands.js';
    script.async = true;
    
    script.onload = () => {
      console.log('MediaPipe Hands loaded');
      initHands();
    };

    script.onerror = () => {
      setMessage('Failed to load hand detection. Check internet connection.');
    };

    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [isActive]);

  const initHands = () => {
    try {
      const Hands = (window as any).Hands;
      
      const hands = new Hands({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`;
        }
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
      });

      hands.onResults((results: any) => {
        if (canvasRef.current) {
          drawResults(results);
        }
      });

      handsRef.current = hands;
      setIsReady(true);
      setMessage('Ready! Show your hand...');
      
      // Start detection loop
      detectHands();
    } catch (err) {
      console.error('Init hands error:', err);
      setMessage('Error initializing hands: ' + (err as Error).message);
    }
  };

  const detectHands = async () => {
    if (!handsRef.current || !videoRef.current || !isActive) return;

    if (videoRef.current.readyState === 4) {
      try {
        await handsRef.current.send({ image: videoRef.current });
      } catch (err) {
        console.error('Detection error:', err);
      }
    }

    requestAnimationFrame(detectHands);
  };

  const drawResults = (results: any) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match video
    if (videoRef.current) {
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      
      // Draw hand
      drawHand(ctx, landmarks, canvas.width, canvas.height);

      // Recognize letter
      const recognized = recognizeLetter(landmarks);
      setDetectedLetter(recognized);

      // Check if correct
      if (recognized === ASL_LETTERS[currentLetter].letter) {
        setScore(prev => prev + 1);
        setMessage('✅ Correct! Moving to next letter...');
        
        setTimeout(() => {
          if (currentLetter < ASL_LETTERS.length - 1) {
            setCurrentLetter(prev => prev + 1);
            setMessage('Ready! Show your hand...');
          } else {
            alert(`🎉 Congratulations! You learned ${ASL_LETTERS.length} letters! Score: ${score + 1}`);
            setCurrentLetter(0);
            setScore(0);
            setMessage('Ready! Show your hand...');
          }
        }, 1500);
      }
    } else {
      setDetectedLetter(null);
    }
  };

  const drawHand = (ctx: CanvasRenderingContext2D, landmarks: any[], width: number, height: number) => {
    // Draw connections
    const connections = [
      [0,1],[1,2],[2,3],[3,4], // Thumb
      [0,5],[5,6],[6,7],[7,8], // Index
      [0,9],[9,10],[10,11],[11,12], // Middle
      [0,13],[13,14],[14,15],[15,16], // Ring
      [0,17],[17,18],[18,19],[19,20], // Pinky
      [5,9],[9,13],[13,17] // Palm
    ];

    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 3;

    connections.forEach(([start, end]) => {
      const startPoint = landmarks[start];
      const endPoint = landmarks[end];
      
      ctx.beginPath();
      ctx.moveTo(startPoint.x * width, startPoint.y * height);
      ctx.lineTo(endPoint.x * width, endPoint.y * height);
      ctx.stroke();
    });

    // Draw points
    ctx.fillStyle = '#00FFFF';
    landmarks.forEach((point: any) => {
      ctx.beginPath();
      ctx.arc(point.x * width, point.y * height, 6, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  const recognizeLetter = (landmarks: any[]): string | null => {
    const thumb = landmarks[4];
    const index = landmarks[8];
    const middle = landmarks[12];
    const ring = landmarks[16];
    const pinky = landmarks[20];

    const isExtended = (tip: any, pip: any) => tip.y < pip.y;

    const thumbExt = isExtended(thumb, landmarks[2]);
    const indexExt = isExtended(index, landmarks[6]);
    const middleExt = isExtended(middle, landmarks[10]);
    const ringExt = isExtended(ring, landmarks[14]);
    const pinkyExt = isExtended(pinky, landmarks[18]);

    // Letter A: Fist with thumb out
    if (!indexExt && !middleExt && !ringExt && !pinkyExt && thumbExt) return 'A';
    
    // Letter B: All fingers up except thumb
    if (indexExt && middleExt && ringExt && pinkyExt && !thumbExt) return 'B';
    
    // Letter L: Index and thumb out
    if (indexExt && thumbExt && !middleExt && !ringExt && !pinkyExt) return 'L';
    
    // Letter Y: Thumb and pinky out
    if (thumbExt && pinkyExt && !indexExt && !middleExt && !ringExt) return 'Y';

    return null;
  };

  const skipLetter = () => {
    if (currentLetter < ASL_LETTERS.length - 1) {
      setCurrentLetter(prev => prev + 1);
      setMessage('Ready! Show your hand...');
    }
  };

  if (!isActive) return null;

  return (
    <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 rounded-lg p-6 border border-indigo-700">
      <h3 className="text-white text-2xl font-bold mb-4">
        🤟 Learn Sign Language (ASL)
      </h3>

      {!isReady ? (
        <div className="text-center text-gray-300 py-8">
          <div className="animate-spin text-4xl mb-2">⌛</div>
          <div>{message}</div>
        </div>
      ) : (
        <>
          {/* Current Letter */}
          <div className="bg-white/10 rounded-lg p-6 mb-4">
            <div className="text-center">
              <div className="text-6xl mb-2">{ASL_LETTERS[currentLetter].image}</div>
              <div className="text-5xl font-bold text-yellow-400 mb-2">
                Letter: {ASL_LETTERS[currentLetter].letter}
              </div>
              <div className="text-gray-300">
                {ASL_LETTERS[currentLetter].description}
              </div>
            </div>
          </div>

          {/* Canvas */}
          <div className="relative mb-4">
            <canvas
              ref={canvasRef}
              className="w-full rounded-lg bg-black/50"
            />
            
            {/* Detection Feedback */}
            <div className="absolute top-4 right-4 bg-black/70 px-4 py-2 rounded-lg">
              {detectedLetter ? (
                <div className={`text-2xl font-bold ${
                  detectedLetter === ASL_LETTERS[currentLetter].letter 
                    ? 'text-green-400' 
                    : 'text-red-400'
                }`}>
                  {detectedLetter === ASL_LETTERS[currentLetter].letter ? '✅' : '❌'} 
                  {detectedLetter}
                </div>
              ) : (
                <div className="text-gray-400">{message}</div>
              )}
            </div>
          </div>

          {/* Progress */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-white/10 rounded-lg p-4 text-center">
              <div className="text-gray-400 text-sm">Score</div>
              <div className="text-3xl font-bold text-green-400">{score}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4 text-center">
              <div className="text-gray-400 text-sm">Progress</div>
              <div className="text-3xl font-bold text-blue-400">
                {currentLetter + 1}/{ASL_LETTERS.length}
              </div>
            </div>
          </div>

          {/* Skip Button */}
          <button
            onClick={skipLetter}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg"
          >
            Skip This Letter →
          </button>
        </>
      )}
    </div>
  );
}