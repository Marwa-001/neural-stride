'use client';

import { useState, useRef, useCallback } from 'react';

interface VoiceCoachSettings {
  enabled: boolean;
  voice: 'male' | 'female';
  frequency: 'low' | 'medium' | 'high';
}

export function useVoiceCoach(settings: VoiceCoachSettings) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const lastPostureState = useRef<'good' | 'fair' | 'poor' | null>(null);
  const stateChangeTimeRef = useRef<number>(0);
  const hasSpokenForStateRef = useRef(false);
  const consecutivePoorCount = useRef(0);
  const lastSpeakTime = useRef(0);
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

  const getVoice = () => {
    if (!synth) return null;
    const voices = synth.getVoices();
    
    if (settings.voice === 'female') {
      return voices.find(v => v.name.includes('Female') || v.name.includes('Samantha')) || voices[0];
    } else {
      return voices.find(v => v.name.includes('Male') || v.name.includes('Daniel')) || voices[0];
    }
  };

  const speak = useCallback((text: string) => {
    if (!synth || !settings.enabled) return;

    // Prevent speaking too frequently (minimum 3 seconds between speeches)
    const now = Date.now();
    if (now - lastSpeakTime.current < 3000) {
      console.log('⏸️ Skipping speech - too soon since last message');
      return;
    }

    // Cancel any ongoing speech
    try {
      synth.cancel();
    } catch (e) {
      console.log('Cancel failed, continuing...');
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = getVoice();
    if (voice) utterance.voice = voice;
    
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 0.9;

    utterance.onstart = () => {
      setIsSpeaking(true);
      lastSpeakTime.current = Date.now();
      console.log('🎤 Speaking:', text);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      console.log('✅ Speech ended');
    };

    utterance.onerror = (event) => {
      setIsSpeaking(false);
      if (event.error !== 'interrupted' && event.error !== 'canceled') {
        console.warn('Speech warning:', event.error);
      }
    };

    console.log('🔢 Attempting to speak:', text);
    
    // Small delay to ensure synthesis is ready
    setTimeout(() => {
      try {
        synth.speak(utterance);
      } catch (error) {
        console.warn('Speech failed:', error);
        setIsSpeaking(false);
      }
    }, 100);
  }, [synth, settings.enabled, settings.voice]);

  const providePostureFeedback = useCallback((postureScore: number) => {
    if (!settings.enabled) return;

    let currentState: 'good' | 'fair' | 'poor';
    
    // Adjusted thresholds for more realistic feedback
    if (postureScore >= 70) {
      currentState = 'good';
    } else if (postureScore >= 45) {
      currentState = 'fair';
    } else {
      currentState = 'poor';
    }

    const now = Date.now();

    // State change detected
    if (currentState !== lastPostureState.current) {
      console.log('📊 State change:', lastPostureState.current, '→', currentState);
      stateChangeTimeRef.current = now;
      hasSpokenForStateRef.current = false;
      lastPostureState.current = currentState;
    }

    // Only speak after state has been stable for the delay period
    const delayMap = {
      'low': 10000,    // 10 seconds
      'medium': 7000,  // 7 seconds
      'high': 5000     // 5 seconds
    };
    
    const requiredDelay = delayMap[settings.frequency];
    const timeInState = now - stateChangeTimeRef.current;

    if (timeInState >= requiredDelay && !hasSpokenForStateRef.current) {
      hasSpokenForStateRef.current = true;
      
      switch (currentState) {
        case 'poor':
          speak("Your posture is declining. Sit up straighter.");
          consecutivePoorCount.current++;
          break;
        case 'fair':
          if (lastPostureState.current === 'poor') {
            speak("Better! Keep improving your posture.");
          } else {
            speak("Your posture needs some adjustment.");
          }
          consecutivePoorCount.current = 0;
          break;
        case 'good':
          speak("Excellent posture! Keep it up.");
          consecutivePoorCount.current = 0;
          break;
      }
    }
    
    // Emergency alert for critical posture (immediate, overrides delay)
    if (postureScore < 30 && timeInState > 3000) {
      if (!hasSpokenForStateRef.current || consecutivePoorCount.current >= 3) {
        speak("Critical! Your posture needs immediate correction.");
        hasSpokenForStateRef.current = true;
        consecutivePoorCount.current = 0;
      }
    }
  }, [settings.enabled, settings.frequency, speak]);

  const provideBreakReminder = useCallback(() => {
    if (!settings.enabled) return;
    
    const messages = [
      "Time for a quick break. Stand up and stretch for 30 seconds.",
      "You've been working hard. Take a moment to stretch your neck and shoulders.",
      "Break time! Roll your shoulders back and take a deep breath.",
      "Let's take a neural reset. Stand up and move around for a bit."
    ];
    
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    speak(randomMessage);
  }, [settings.enabled, speak]);

  const provideEncouragement = useCallback((avgScore: number) => {
    if (!settings.enabled) return;

    if (avgScore >= 85) {
      speak("Outstanding work today! Your posture has been excellent.");
    } else if (avgScore >= 70) {
      speak("Great job maintaining good posture. Keep up the healthy habits.");
    } else if (avgScore >= 55) {
      speak("You're doing well, but there's room for improvement. Stay mindful of your posture.");
    } else {
      speak("Your posture needs attention. Remember to sit up straight throughout the day.");
    }
  }, [settings.enabled, speak]);

  const announceSessionStart = useCallback(() => {
    if (!settings.enabled) return;
    speak("NeuralStride monitoring activated. I'll help you maintain healthy posture throughout your session.");
  }, [settings.enabled, speak]);

  const announceSessionEnd = useCallback((duration: number, avgScore: number) => {
    if (!settings.enabled) return;
    
    const minutes = Math.floor(duration / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    let timeString = '';
    if (hours > 0) {
      timeString = `${hours} hour${hours > 1 ? 's' : ''} and ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
    } else {
      timeString = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    
    speak(`Session complete. You worked for ${timeString} with an average posture score of ${Math.round(avgScore)}. Great effort!`);
  }, [settings.enabled, speak]);

  return {
    isSpeaking,
    speak,
    providePostureFeedback,
    provideBreakReminder,
    provideEncouragement,
    announceSessionStart,
    announceSessionEnd
  };
}