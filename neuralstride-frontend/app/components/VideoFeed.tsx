'use client';

import { useRef, useEffect, useState } from 'react';
import { useMediaPipe, PostureMetrics } from '../lib/useMediaPipe';
import { useVoiceCoach } from '../lib/useVoiceCoach';
import SpineHeatmap from './SpineHeatmap';
import VirtualPlant from './VirtualPlant';
import { extensionBridge } from '../lib/extensionBridge';

export default function VideoFeed() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');
  const [metrics, setMetrics] = useState<PostureMetrics>({
    postureScore: 0,
    cervicalAngle: 0,
    isPersonDetected: false,
    shoulderAlignment: 0,
    headForward: 0
  });

  // Session statistics
  const [sessionTime, setSessionTime] = useState(0);
  const [avgScore, setAvgScore] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [goodPostureTime, setGoodPostureTime] = useState(0);
  const sessionStartTime = useRef<number>(0);

  const { isReady, detectPose, error: mediaPipeError } = useMediaPipe();
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const voiceCoach = useVoiceCoach({
    enabled: voiceEnabled,
    voice: 'female',
    frequency: 'medium'
  });

  // Initialize extension bridge
  useEffect(() => {
    console.log('🔗 VideoFeed mounted, initializing extension bridge...');
    extensionBridge.checkExtension();

    // Notify extension that web app is ready
    window.postMessage({ 
      type: 'NEURALSTRIDE_WEBAPP_READY',
      source: 'webapp' 
    }, '*');
  }, []);

  // Listen for extension messages (two-way sync)
  useEffect(() => {
    const handleExtensionMessage = (event: MessageEvent) => {
      // Only accept messages from same origin
      if (event.origin !== window.location.origin) return;

      console.log('📨 Web app received message:', event.data);

      if (event.data.type === 'NEURALSTRIDE_START_MONITORING' && 
          event.data.source === 'extension') {
        console.log('▶️ Extension triggered start!');
        if (!isStreaming) {
          startCamera();
        }
      }
      
      if (event.data.type === 'NEURALSTRIDE_STOP_MONITORING' &&
          event.data.source === 'extension') {
        console.log('⏸️ Extension triggered stop!');
        if (isStreaming) {
          stopCamera();
        }
      }

      if (event.data.type === 'NEURALSTRIDE_CONTENT_SCRIPT_READY') {
        console.log('✅ Extension content script is ready');
      }
    };
    
    window.addEventListener('message', handleExtensionMessage);
    return () => window.removeEventListener('message', handleExtensionMessage);
  }, [isStreaming]);

  // Session timer
  useEffect(() => {
    if (!isStreaming) return;

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - sessionStartTime.current) / 1000);
      setSessionTime(elapsed);

      // Track good posture time
      if (metrics.postureScore >= 70) {
        setGoodPostureTime(prev => prev + 1);
      }

      // Record score for average calculation
      if (metrics.isPersonDetected) {
        setScores(prev => [...prev, metrics.postureScore]);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isStreaming, metrics.postureScore, metrics.isPersonDetected]);

  // Calculate average score
  useEffect(() => {
    if (scores.length > 0) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      setAvgScore(Math.round(avg));
    }
  }, [scores]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
        sessionStartTime.current = Date.now();
        setSessionTime(0);
        setScores([]);
        setGoodPostureTime(0);

        // Notify extension
        extensionBridge.sendSessionStatus(true);
        
        // Announce session start
        setTimeout(() => {
          voiceCoach.announceSessionStart();
        }, 1000);

        console.log('✅ Camera started successfully');
      }
    } catch (err) {
      setError('Camera access denied. Please allow camera permissions.');
      console.error('❌ Camera error:', err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      setIsStreaming(false);

      // Notify extension
      extensionBridge.sendSessionStatus(false);

      // Announce session end with stats
      if (sessionTime > 30) { // Only if session was longer than 30 seconds
        setTimeout(() => {
          voiceCoach.announceSessionEnd(sessionTime, avgScore);
        }, 500);
      }

      console.log('⏹️ Camera stopped');
    }
  };

  // Main pose detection loop
  useEffect(() => {
    if (!isStreaming || !isReady || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Set canvas size to match video
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    let lastFeedbackTime = 0;
    const FEEDBACK_INTERVAL = 5000; // Provide feedback every 5 seconds max

    const processFrame = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const result = detectPose(video, canvas);
        
        if (result) {
          setMetrics(result);

          // Send to extension
          extensionBridge.sendPostureData({
            postureScore: result.postureScore,
            cervicalAngle: result.cervicalAngle,
            isPersonDetected: result.isPersonDetected
          });

          // Provide voice feedback (throttled)
          if (result.isPersonDetected) {
            const now = Date.now();
            if (now - lastFeedbackTime > FEEDBACK_INTERVAL) {
              voiceCoach.providePostureFeedback(result.postureScore);
              lastFeedbackTime = now;
            }
          }
        }
      }
      requestAnimationFrame(processFrame);
    };

    // Start processing when video is ready
    video.onloadeddata = () => {
      console.log('📹 Video loaded, starting pose detection');
      processFrame();
    };

    return () => {
      video.onloadeddata = null;
    };
  }, [isStreaming, isReady, detectPose, voiceCoach]);

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 45) return 'text-yellow-400';
    return 'text-red-400';
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const goodPosturePercent = sessionTime > 0 
    ? Math.round((goodPostureTime / sessionTime) * 100) 
    : 0;

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      {/* Video Container */}
      <div className="relative w-full max-w-4xl bg-black rounded-lg overflow-hidden shadow-2xl">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-auto"
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full"
        />

        {!isStreaming && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <div className="text-6xl mb-4">📹</div>
              <p className="text-white text-lg">Camera Off</p>
              <p className="text-gray-400 text-sm mt-2">Click "Start Monitoring" to begin</p>
            </div>
          </div>
        )}

        {/* Status Badge */}
        {isStreaming && (
          <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm px-4 py-2 rounded-lg">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${metrics.isPersonDetected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-white text-sm font-semibold">
                {metrics.isPersonDetected ? '✅ Detecting' : '❌ No Person'}
              </span>
            </div>
          </div>
        )}

        {/* Voice Status */}
        {isStreaming && voiceEnabled && (
          <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm px-4 py-2 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎤</span>
              <span className="text-white text-sm font-semibold">
                Voice Coach Active
              </span>
            </div>
          </div>
        )}

        {/* Session Timer */}
        {isStreaming && (
          <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-sm px-4 py-2 rounded-lg">
            <div className="text-white text-sm">
              <span className="font-semibold">Session: </span>
              <span className="text-cyan-400 font-mono">{formatTime(sessionTime)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Metrics and Stats Display */}
      {isStreaming && metrics.isPersonDetected && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full max-w-7xl">
          {/* Left Column - Main Metrics */}
          <div className="lg:col-span-2 space-y-4">
            {/* Posture Score */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <div className="text-gray-300 text-sm mb-2">Posture Score</div>
              <div className={`text-5xl font-bold ${getScoreColor(metrics.postureScore)}`}>
                {metrics.postureScore}
                <span className="text-2xl">/100</span>
              </div>
              <div className="mt-3 w-full bg-gray-700 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full transition-all duration-500 ${
                    metrics.postureScore >= 70 ? 'bg-green-400' :
                    metrics.postureScore >= 45 ? 'bg-yellow-400' : 'bg-red-400'
                  }`}
                  style={{ width: `${metrics.postureScore}%` }}
                />
              </div>
            </div>

            {/* Detailed Metrics Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                <div className="text-gray-300 text-sm mb-1">Cervical Angle</div>
                <div className="text-3xl font-bold text-cyan-400">
                  {metrics.cervicalAngle}°
                </div>
                <div className="text-gray-400 text-xs mt-1">Ideal: 155-165°</div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                <div className="text-gray-300 text-sm mb-1">Shoulder Align</div>
                <div className="text-3xl font-bold text-purple-400">
                  {metrics.shoulderAlignment}%
                </div>
                <div className="text-gray-400 text-xs mt-1">Symmetry check</div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                <div className="text-gray-300 text-sm mb-1">Head Forward</div>
                <div className="text-3xl font-bold text-orange-400">
                  {metrics.headForward}%
                </div>
                <div className="text-gray-400 text-xs mt-1">Lower is better</div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                <div className="text-gray-300 text-sm mb-1">Avg Score</div>
                <div className={`text-3xl font-bold ${getScoreColor(avgScore)}`}>
                  {avgScore}
                </div>
                <div className="text-gray-400 text-xs mt-1">This session</div>
              </div>
            </div>

            {/* Session Statistics */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <h3 className="text-white text-lg font-semibold mb-4">
                📊 Session Statistics
              </h3>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-gray-400 text-sm">Good Posture Time</div>
                  <div className="text-2xl font-bold text-green-400">
                    {formatTime(goodPostureTime)}
                  </div>
                </div>
                
                <div>
                  <div className="text-gray-400 text-sm">Posture Quality</div>
                  <div className="text-2xl font-bold text-blue-400">
                    {goodPosturePercent}%
                  </div>
                </div>
              </div>

              <div>
                <div className="text-gray-400 text-sm mb-2">
                  Good Posture: {goodPosturePercent}% of session
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <div 
                    className="h-3 rounded-full bg-green-400 transition-all"
                    style={{ width: `${goodPosturePercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Spine Heatmap */}
          <div className="lg:col-span-1">
            <SpineHeatmap
              postureScore={metrics.postureScore}
              cervicalAngle={metrics.cervicalAngle}
              isPersonDetected={metrics.isPersonDetected}
            />
          </div>
        </div>
      )}

      {/* Virtual Plant */}
      <div className="w-full max-w-md">
        <VirtualPlant
          postureScore={metrics.postureScore}
          isMonitoring={isStreaming && metrics.isPersonDetected}
        />
      </div>

      {/* Errors */}
      {(error || mediaPipeError) && (
        <div className="bg-red-500/20 border border-red-500 text-red-200 px-6 py-4 rounded-lg max-w-4xl w-full">
          <div className="font-semibold mb-1">⚠️ Error</div>
          <div>{error || mediaPipeError}</div>
        </div>
      )}

      {/* MediaPipe Loading */}
      {!isReady && !mediaPipeError && (
        <div className="bg-blue-500/20 border border-blue-500 text-blue-200 px-6 py-4 rounded-lg max-w-4xl w-full">
          <div className="flex items-center gap-3">
            <div className="animate-spin text-2xl">⌛</div>
            <div>
              <div className="font-semibold">Loading AI Models...</div>
              <div className="text-sm opacity-80">This may take 5-10 seconds</div>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-4 flex-wrap justify-center">
        <button
          onClick={startCamera}
          disabled={isStreaming || !isReady}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg font-semibold text-lg shadow-lg transition-all hover:scale-105 active:scale-95"
        >
          {isReady ? '▶️ Start Monitoring' : '⌛ Loading AI...'}
        </button>
        
        <button
          onClick={stopCamera}
          disabled={!isStreaming}
          className="bg-red-600 hover:bg-red-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg font-semibold text-lg shadow-lg transition-all hover:scale-105 active:scale-95"
        >
          ⏹️ Stop
        </button>
        
        <button
          onClick={() => setVoiceEnabled(!voiceEnabled)}
          disabled={!isStreaming}
          className={`${voiceEnabled ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'} disabled:bg-gray-500 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg font-semibold text-lg shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-2`}
        >
          <span>{voiceEnabled ? '🔊' : '🔇'}</span>
          <span>Voice {voiceEnabled ? 'On' : 'Off'}</span>
        </button>
      </div>

      {/* Info Card */}
      {!isStreaming && (
        <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-700/50 rounded-lg p-6 max-w-2xl">
          <h3 className="text-white text-xl font-semibold mb-3">
            🧠 How NeuralStride Works
          </h3>
          <ul className="text-gray-300 space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-1">✓</span>
              <span>Uses AI to detect your posture in real-time using your webcam</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-1">✓</span>
              <span>Calculates posture score based on neck angle, shoulder alignment, and head position</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-1">✓</span>
              <span>Voice coach provides real-time feedback to help you improve</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-1">✓</span>
              <span>Your virtual plant grows with good posture and wilts with bad posture</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-1">✓</span>
              <span>Chrome extension syncs with web app for continuous monitoring</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}