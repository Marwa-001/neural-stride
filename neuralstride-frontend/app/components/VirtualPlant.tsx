'use client';

import { useEffect, useState, useRef } from 'react';

interface VirtualPlantProps {
  postureScore: number;
  isMonitoring: boolean;
}

export default function VirtualPlant({ postureScore, isMonitoring }: VirtualPlantProps) {
  const [plantHealth, setPlantHealth] = useState(50); // 0-100
  const [plantStage, setPlantStage] = useState(2); // 1-5 growth stages
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const lastUpdateTime = useRef<number>(Date.now());

  // Update plant health based on posture (more gradual changes)
  useEffect(() => {
    if (!isMonitoring) {
      // Reset to neutral when not monitoring
      const resetInterval = setInterval(() => {
        setPlantHealth(prev => {
          if (prev > 50) return Math.max(50, prev - 0.5);
          if (prev < 50) return Math.min(50, prev + 0.5);
          return prev;
        });
      }, 2000);
      return () => clearInterval(resetInterval);
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const deltaTime = (now - lastUpdateTime.current) / 1000; // seconds
      lastUpdateTime.current = now;

      setPlantHealth(prev => {
        let changeRate = 0;
        
        // More realistic growth/wilting rates based on posture score
        if (postureScore >= 85) {
          changeRate = 0.8; // Excellent posture - slow steady growth
        } else if (postureScore >= 70) {
          changeRate = 0.5; // Good posture - moderate growth
        } else if (postureScore >= 55) {
          changeRate = 0.2; // Fair posture - very slow growth
        } else if (postureScore >= 45) {
          changeRate = -0.1; // Below fair - slight decline
        } else if (postureScore >= 35) {
          changeRate = -0.5; // Poor posture - moderate decline
        } else if (postureScore >= 25) {
          changeRate = -1.0; // Very poor - faster decline
        } else {
          changeRate = -1.8; // Critical - rapid decline
        }
        
        // Apply change with time compensation
        const change = changeRate * deltaTime;
        const newHealth = prev + change;
        
        // Clamp between 0 and 100
        return Math.max(0, Math.min(100, newHealth));
      });
    }, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, [postureScore, isMonitoring]);

  // Determine plant stage based on health (with hysteresis to prevent flickering)
  useEffect(() => {
    if (plantHealth >= 85) setPlantStage(5); // Full bloom
    else if (plantHealth >= 68) setPlantStage(4); // Flowering
    else if (plantHealth >= 48) setPlantStage(3); // Growing
    else if (plantHealth >= 25) setPlantStage(2); // Sprout
    else setPlantStage(1); // Seed/wilted
  }, [plantHealth]);

  // Draw plant on canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawPlant(ctx, plantStage, plantHealth);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [plantStage, plantHealth]);

  const drawPlant = (ctx: CanvasRenderingContext2D, stage: number, health: number) => {
    const centerX = 150;
    const groundY = 280;

    // Draw pot
    drawPot(ctx, centerX, groundY);

    // Draw soil
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(centerX - 50, groundY - 20, 100, 20);

    // Draw plant based on stage
    switch (stage) {
      case 1:
        drawSeed(ctx, centerX, groundY - 25);
        break;
      case 2:
        drawSprout(ctx, centerX, groundY - 30, health);
        break;
      case 3:
        drawGrowingPlant(ctx, centerX, groundY - 30, health);
        break;
      case 4:
        drawFloweringPlant(ctx, centerX, groundY - 30, health);
        break;
      case 5:
        drawFullBloom(ctx, centerX, groundY - 30, health);
        break;
    }

    // Draw health sparkles for good health
    if (health > 75) {
      drawSparkles(ctx, centerX, groundY - 80, health);
    }

    // Draw status text
    drawStatusText(ctx, stage, health);
  };

  const drawPot = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    // Clay pot gradient
    const gradient = ctx.createLinearGradient(x - 60, y, x + 60, y + 40);
    gradient.addColorStop(0, '#CD853F');
    gradient.addColorStop(0.5, '#D2691E');
    gradient.addColorStop(1, '#A0522D');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x - 60, y);
    ctx.lineTo(x - 50, y + 40);
    ctx.lineTo(x + 50, y + 40);
    ctx.lineTo(x + 60, y);
    ctx.closePath();
    ctx.fill();

    // Pot rim
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x - 65, y - 5, 130, 5);
    
    // Pot shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(x - 55, y + 5, 20, 30);
  };

  const drawSeed = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    
    // Seed detail
    ctx.fillStyle = '#654321';
    ctx.beginPath();
    ctx.arc(x - 2, y - 2, 3, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawSprout = (ctx: CanvasRenderingContext2D, x: number, y: number, health: number) => {
    // Stem
    const stemHeight = 20 + (health / 100) * 15;
    ctx.strokeStyle = health > 40 ? '#228B22' : '#8B7355';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - stemHeight);
    ctx.stroke();

    // First leaves
    ctx.fillStyle = health > 40 ? '#32CD32' : '#9ACD32';
    ctx.beginPath();
    ctx.ellipse(x - 8, y - stemHeight / 2, 8, 5, -0.5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.ellipse(x + 8, y - stemHeight / 2 + 3, 8, 5, 0.5, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawGrowingPlant = (ctx: CanvasRenderingContext2D, x: number, y: number, health: number) => {
    const stemHeight = 50 + (health / 100) * 25;
    const sway = Math.sin(Date.now() / 1000) * 3;

    // Stem
    ctx.strokeStyle = health > 40 ? '#228B22' : '#8B7355';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + sway, y - stemHeight / 2, x + sway, y - stemHeight);
    ctx.stroke();

    // Multiple leaves
    const leafColor = health > 50 ? '#32CD32' : '#9ACD32';
    drawLeaf(ctx, x - 12 + sway, y - 20, leafColor, -0.5, 1.0);
    drawLeaf(ctx, x + 12 + sway, y - 30, leafColor, 0.5, 1.0);
    drawLeaf(ctx, x - 10 + sway, y - 45, leafColor, -0.3, 0.9);
    drawLeaf(ctx, x + 10 + sway, y - 55, leafColor, 0.3, 0.9);
  };

  const drawFloweringPlant = (ctx: CanvasRenderingContext2D, x: number, y: number, health: number) => {
    const stemHeight = 70 + (health / 100) * 35;
    const sway = Math.sin(Date.now() / 1000) * 5;

    // Stem
    ctx.strokeStyle = health > 50 ? '#228B22' : '#8B7355';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + sway, y - stemHeight / 2, x + sway, y - stemHeight);
    ctx.stroke();

    // Leaves
    const leafColor = health > 60 ? '#32CD32' : '#9ACD32';
    drawLeaf(ctx, x - 16 + sway, y - 30, leafColor, -0.5, 1.2);
    drawLeaf(ctx, x + 16 + sway, y - 40, leafColor, 0.5, 1.2);
    drawLeaf(ctx, x - 14 + sway, y - 55, leafColor, -0.3, 1.1);
    drawLeaf(ctx, x + 14 + sway, y - 65, leafColor, 0.3, 1.1);

    // Flower buds
    ctx.fillStyle = health > 60 ? '#FF69B4' : '#C8A2C8';
    ctx.beginPath();
    ctx.arc(x + sway, y - stemHeight, 10, 0, Math.PI * 2);
    ctx.fill();
    
    // Bud detail
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(x + sway - 2, y - stemHeight - 2, 3, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawFullBloom = (ctx: CanvasRenderingContext2D, x: number, y: number, health: number) => {
    const stemHeight = 90 + (health / 100) * 45;
    const sway = Math.sin(Date.now() / 1000) * 5;

    // Stem
    ctx.strokeStyle = '#228B22';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + sway, y - stemHeight / 2, x + sway, y - stemHeight);
    ctx.stroke();

    // Leaves
    const leafColor = '#32CD32';
    drawLeaf(ctx, x - 20 + sway, y - 35, leafColor, -0.5, 1.3);
    drawLeaf(ctx, x + 20 + sway, y - 45, leafColor, 0.5, 1.3);
    drawLeaf(ctx, x - 18 + sway, y - 65, leafColor, -0.3, 1.2);
    drawLeaf(ctx, x + 18 + sway, y - 75, leafColor, 0.3, 1.2);

    // Beautiful flower
    const flowerX = x + sway;
    const flowerY = y - stemHeight;
    const rotation = Date.now() / 3000;

    // Petals
    const petalColor = health > 80 ? '#FF1493' : '#FF69B4';
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI * 2) / 8 + rotation;
      const petalX = flowerX + Math.cos(angle) * 14;
      const petalY = flowerY + Math.sin(angle) * 14;
      
      ctx.fillStyle = petalColor;
      ctx.beginPath();
      ctx.ellipse(petalX, petalY, 9, 6, angle, 0, Math.PI * 2);
      ctx.fill();
      
      // Petal highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.ellipse(petalX - 2, petalY - 1, 3, 2, angle, 0, Math.PI * 2);
      ctx.fill();
    }

    // Center
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(flowerX, flowerY, 7, 0, Math.PI * 2);
    ctx.fill();
    
    // Center detail
    ctx.fillStyle = '#FFA500';
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI * 2) / 12;
      const dotX = flowerX + Math.cos(angle) * 3;
      const dotY = flowerY + Math.sin(angle) * 3;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawLeaf = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    angle: number,
    scale: number = 1
  ) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    
    // Leaf shape
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10 * scale, 6 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Leaf vein
    ctx.strokeStyle = 'rgba(0, 100, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-10 * scale, 0);
    ctx.lineTo(10 * scale, 0);
    ctx.stroke();
    
    ctx.restore();
  };

  const drawSparkles = (ctx: CanvasRenderingContext2D, x: number, y: number, health: number) => {
    const sparkleCount = Math.min(6, Math.floor((health - 75) / 5));
    const time = Date.now() / 1000;
    
    for (let i = 0; i < sparkleCount; i++) {
      const angle = time * 2 + i * (Math.PI * 2 / sparkleCount);
      const distance = 35 + Math.sin(time + i) * 5;
      const sparkleX = x + Math.cos(angle) * distance;
      const sparkleY = y + Math.sin(angle) * distance;
      const size = 2 + Math.sin(time * 3 + i) * 1;
      
      // Sparkle glow
      const gradient = ctx.createRadialGradient(sparkleX, sparkleY, 0, sparkleX, sparkleY, size * 2);
      gradient.addColorStop(0, '#FFD700');
      gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(sparkleX, sparkleY, size * 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Sparkle core
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(sparkleX, sparkleY, size, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawStatusText = (ctx: CanvasRenderingContext2D, stage: number, health: number) => {
    const messages = [
      '💀 Wilted',
      '🌱 Sprouting',
      '🌿 Growing',
      '🌸 Flowering',
      '🌺 Blooming!'
    ];
    
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    
    const text = messages[stage - 1];
    ctx.strokeText(text, 150, 25);
    ctx.fillText(text, 150, 25);
  };

  const getHealthColor = () => {
    if (plantHealth >= 85) return 'text-green-400';
    if (plantHealth >= 68) return 'text-lime-400';
    if (plantHealth >= 48) return 'text-yellow-400';
    if (plantHealth >= 25) return 'text-orange-400';
    return 'text-red-400';
  };

  const getStatusMessage = () => {
    if (!isMonitoring) return '😴 Plant is resting...';
    if (plantHealth >= 85) return '🌟 Thriving! Excellent posture!';
    if (plantHealth >= 68) return '🌱 Growing well! Keep it up!';
    if (plantHealth >= 48) return '🌿 Needs care. Improve posture!';
    if (plantHealth >= 25) return '😟 Wilting! Sit up straight!';
    return '💀 Critical! Plant needs help now!';
  };

  return (
    <div className="bg-gradient-to-br from-green-900/30 to-blue-900/30 rounded-lg p-6 border border-green-700/50">
      <h3 className="text-white text-xl font-semibold mb-2">
        🌱 Your Posture Plant
      </h3>
      <p className="text-gray-400 text-sm mb-4">
        Good posture helps it grow, bad posture makes it wilt!
      </p>

      {/* Canvas */}
      <div className="bg-gradient-to-b from-sky-200 to-green-100 rounded-lg mb-4">
        <canvas
          ref={canvasRef}
          width={300}
          height={320}
          className="mx-auto"
        />
      </div>

      {/* Plant Stats */}
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-300">Plant Health</span>
            <span className={`font-bold ${getHealthColor()}`}>
              {Math.round(plantHealth)}%
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-1000 ${
                plantHealth >= 85 ? 'bg-green-400' :
                plantHealth >= 68 ? 'bg-lime-400' :
                plantHealth >= 48 ? 'bg-yellow-400' :
                plantHealth >= 25 ? 'bg-orange-400' : 'bg-red-400'
              }`}
              style={{ width: `${plantHealth}%` }}
            />
          </div>
        </div>

        <div className="bg-white/10 rounded-lg p-3">
          <div className="text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-gray-400">Growth Stage:</span>
              <span className="text-white font-semibold">
                {['🌰 Seed', '🌱 Sprout', '🌿 Growing', '🌸 Flowering', '🌺 Full Bloom'][plantStage - 1]}
              </span>
            </div>
            <div className="text-gray-300 text-xs mt-2 text-center">
              {getStatusMessage()}
            </div>
          </div>
        </div>

        {!isMonitoring && (
          <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-3">
            <p className="text-yellow-200 text-xs text-center">
              ⚠️ Start monitoring to help your plant grow!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}