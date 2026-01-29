'use client';

import { useEffect, useRef } from 'react';

interface PostureGhostProps {
  isActive: boolean;
  canvasWidth: number;
  canvasHeight: number;
}

export default function PostureGhost({ isActive, canvasWidth, canvasHeight }: PostureGhostProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (!isActive || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let opacity = 0.3;
    let pulseDirection = 1;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Pulsing effect
      opacity += pulseDirection * 0.005;
      if (opacity >= 0.5 || opacity <= 0.2) {
        pulseDirection *= -1;
      }

      // Draw ideal posture ghost
      drawIdealPosture(ctx, canvas.width, canvas.height, opacity);

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive]);

  const drawIdealPosture = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    opacity: number
  ) => {
    // Calculate positions for ideal posture (centered)
    const centerX = width / 2;
    const scaleY = height / 720; // Scale based on video height
    const scaleX = width / 1280; // Scale based on video width

    // Ideal posture landmarks (normalized 0-1, then scaled)
    const idealLandmarks = {
      // Head
      nose: { x: centerX, y: 120 * scaleY },
      leftEye: { x: centerX - 30 * scaleX, y: 100 * scaleY },
      rightEye: { x: centerX + 30 * scaleX, y: 100 * scaleY },
      leftEar: { x: centerX - 50 * scaleX, y: 110 * scaleY },
      rightEar: { x: centerX + 50 * scaleX, y: 110 * scaleY },

      // Shoulders
      leftShoulder: { x: centerX - 100 * scaleX, y: 220 * scaleY },
      rightShoulder: { x: centerX + 100 * scaleX, y: 220 * scaleY },

      // Arms
      leftElbow: { x: centerX - 140 * scaleX, y: 320 * scaleY },
      rightElbow: { x: centerX + 140 * scaleX, y: 320 * scaleY },
      leftWrist: { x: centerX - 150 * scaleX, y: 420 * scaleY },
      rightWrist: { x: centerX + 150 * scaleX, y: 420 * scaleY },

      // Torso
      leftHip: { x: centerX - 80 * scaleX, y: 440 * scaleY },
      rightHip: { x: centerX + 80 * scaleX, y: 440 * scaleY },

      // Legs
      leftKnee: { x: centerX - 90 * scaleX, y: 560 * scaleY },
      rightKnee: { x: centerX + 90 * scaleX, y: 560 * scaleY },
      leftAnkle: { x: centerX - 100 * scaleX, y: 680 * scaleY },
      rightAnkle: { x: centerX + 100 * scaleX, y: 680 * scaleY }
    };

    // Draw ghost skeleton
    ctx.strokeStyle = `rgba(0, 255, 255, ${opacity})`;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    // Head connections
    drawLine(ctx, idealLandmarks.nose, idealLandmarks.leftEye);
    drawLine(ctx, idealLandmarks.nose, idealLandmarks.rightEye);
    drawLine(ctx, idealLandmarks.leftEye, idealLandmarks.leftEar);
    drawLine(ctx, idealLandmarks.rightEye, idealLandmarks.rightEar);

    // Torso
    drawLine(ctx, idealLandmarks.leftShoulder, idealLandmarks.rightShoulder);
    drawLine(ctx, idealLandmarks.leftShoulder, idealLandmarks.leftHip);
    drawLine(ctx, idealLandmarks.rightShoulder, idealLandmarks.rightHip);
    drawLine(ctx, idealLandmarks.leftHip, idealLandmarks.rightHip);

    // Left arm
    drawLine(ctx, idealLandmarks.leftShoulder, idealLandmarks.leftElbow);
    drawLine(ctx, idealLandmarks.leftElbow, idealLandmarks.leftWrist);

    // Right arm
    drawLine(ctx, idealLandmarks.rightShoulder, idealLandmarks.rightElbow);
    drawLine(ctx, idealLandmarks.rightElbow, idealLandmarks.rightWrist);

    // Left leg
    drawLine(ctx, idealLandmarks.leftHip, idealLandmarks.leftKnee);
    drawLine(ctx, idealLandmarks.leftKnee, idealLandmarks.leftAnkle);

    // Right leg
    drawLine(ctx, idealLandmarks.rightHip, idealLandmarks.rightKnee);
    drawLine(ctx, idealLandmarks.rightKnee, idealLandmarks.rightAnkle);

    // Draw joints as circles
    ctx.fillStyle = `rgba(0, 255, 255, ${opacity * 1.5})`;
    Object.values(idealLandmarks).forEach(point => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw alignment guide line (vertical)
    ctx.strokeStyle = `rgba(255, 255, 0, ${opacity * 0.5})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const drawLine = (
    ctx: CanvasRenderingContext2D,
    start: { x: number; y: number },
    end: { x: number; y: number }
  ) => {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  };

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      className="absolute top-0 left-0 pointer-events-none"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}