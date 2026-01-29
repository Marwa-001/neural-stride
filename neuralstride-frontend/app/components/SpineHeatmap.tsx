'use client';

import { useEffect, useRef } from 'react';

interface SpineHeatmapProps {
  postureScore: number;
  cervicalAngle: number;
  isPersonDetected: boolean;
}

export default function SpineHeatmap({ postureScore, cervicalAngle, isPersonDetected }: SpineHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !isPersonDetected) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate stress levels for different spine regions
    const cervicalStress = calculateCervicalStress(cervicalAngle);
    const thoracicStress = calculateThoracicStress(postureScore, cervicalAngle);
    const lumbarStress = calculateLumbarStress(postureScore);

    // Draw spine
    drawSpine(ctx, cervicalStress, thoracicStress, lumbarStress);
    
    // Draw legend
    drawLegend(ctx);

  }, [postureScore, cervicalAngle, isPersonDetected]);

  const calculateCervicalStress = (angle: number): number => {
    // Ideal: 155-165°
    // Calculate stress percentage based on deviation from ideal
    
    if (angle >= 155 && angle <= 165) return 0; // Optimal
    
    if (angle > 165) {
      // Too upright (rare, but possible)
      const deviation = angle - 165;
      return Math.min(25, deviation * 3);
    }
    
    // Forward head posture (most common issue)
    if (angle >= 145) {
      return 20 + (155 - angle) * 2; // 20-40% stress
    } else if (angle >= 135) {
      return 40 + (145 - angle) * 3; // 40-70% stress
    } else if (angle >= 125) {
      return 70 + (135 - angle) * 2.5; // 70-95% stress
    } else {
      return Math.min(100, 95 + (125 - angle) * 0.5); // 95-100% stress
    }
  };

  const calculateThoracicStress = (score: number, cervicalAngle: number): number => {
    // Thoracic (mid-back) stress correlates with overall posture
    // but is less severe than cervical issues
    
    let baseStress = Math.max(0, 100 - score) * 0.7; // 70% of inverse score
    
    // Add additional stress if cervical angle is very poor
    if (cervicalAngle < 140) {
      baseStress += 15; // Cascading effect from neck
    }
    
    return Math.min(100, baseStress);
  };

  const calculateLumbarStress = (score: number): number => {
    // Lumbar (lower back) stress is generally less than upper body
    // unless posture is very poor
    
    if (score >= 70) {
      return 10; // Minimal stress with good posture
    } else if (score >= 50) {
      return 20 + (70 - score) * 1.5; // 20-50% stress
    } else if (score >= 30) {
      return 50 + (50 - score) * 2; // 50-90% stress
    } else {
      return Math.min(100, 90 + (30 - score) * 0.5); // 90-100% stress
    }
  };

  const getStressColor = (stress: number): string => {
    if (stress <= 20) return '#10B981'; // Green - Optimal
    if (stress <= 40) return '#84CC16'; // Light green - Good
    if (stress <= 60) return '#F59E0B'; // Yellow - Caution
    if (stress <= 80) return '#F97316'; // Orange - Warning
    return '#EF4444'; // Red - Critical
  };

  const getStressLabel = (stress: number): string => {
    if (stress <= 20) return 'Optimal';
    if (stress <= 40) return 'Good';
    if (stress <= 60) return 'Caution';
    if (stress <= 80) return 'Warning';
    return 'Critical';
  };

  const drawSpine = (
    ctx: CanvasRenderingContext2D,
    cervicalStress: number,
    thoracicStress: number,
    lumbarStress: number
  ) => {
    const centerX = 150;
    const startY = 60;
    const vertebraHeight = 18;
    const vertebraWidth = 45;
    const spacing = 4;

    // Cervical vertebrae (7) - C1-C7
    for (let i = 0; i < 7; i++) {
      const y = startY + i * (vertebraHeight + spacing);
      // Add slight random variation for realism
      const stress = Math.max(0, Math.min(100, cervicalStress + (Math.random() - 0.5) * 8));
      const width = vertebraWidth - i * 1.5; // Narrower at top
      drawVertebra(ctx, centerX, y, width, vertebraHeight, stress, `C${i + 1}`);
    }

    // Thoracic vertebrae (12) - T1-T12
    for (let i = 0; i < 12; i++) {
      const y = startY + 7 * (vertebraHeight + spacing) + i * (vertebraHeight + spacing);
      const stress = Math.max(0, Math.min(100, thoracicStress + (Math.random() - 0.5) * 10));
      // Natural curve - wider in middle
      const widthModifier = Math.sin((i / 12) * Math.PI) * 6;
      const width = vertebraWidth + widthModifier;
      drawVertebra(ctx, centerX, y, width, vertebraHeight, stress, `T${i + 1}`);
    }

    // Lumbar vertebrae (5) - L1-L5
    for (let i = 0; i < 5; i++) {
      const y = startY + 19 * (vertebraHeight + spacing) + i * (vertebraHeight + spacing);
      const stress = Math.max(0, Math.min(100, lumbarStress + (Math.random() - 0.5) * 12));
      const width = vertebraWidth + 8; // Larger lumbar vertebrae
      drawVertebra(ctx, centerX, y, width, vertebraHeight, stress, `L${i + 1}`);
    }

    // Draw spine centerline
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(centerX, startY);
    ctx.lineTo(centerX, startY + 24 * (vertebraHeight + spacing));
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw region labels
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#A0A0A0';
    
    ctx.fillText('Cervical', centerX + 75, startY + 60);
    ctx.fillText('Thoracic', centerX + 75, startY + 240);
    ctx.fillText('Lumbar', centerX + 75, startY + 480);
  };

  const drawVertebra = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    stress: number,
    label?: string
  ) => {
    const color = getStressColor(stress);
    
    // Draw vertebra body with gradient
    const gradient = ctx.createLinearGradient(x - width / 2, y, x + width / 2, y + height);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, adjustColorBrightness(color, -20));
    
    ctx.fillStyle = gradient;
    ctx.shadowColor = color;
    ctx.shadowBlur = stress > 60 ? 12 : 6;
    
    // Rounded rectangle for vertebra
    const radius = 4;
    ctx.beginPath();
    ctx.moveTo(x - width / 2 + radius, y);
    ctx.lineTo(x + width / 2 - radius, y);
    ctx.quadraticCurveTo(x + width / 2, y, x + width / 2, y + radius);
    ctx.lineTo(x + width / 2, y + height - radius);
    ctx.quadraticCurveTo(x + width / 2, y + height, x + width / 2 - radius, y + height);
    ctx.lineTo(x - width / 2 + radius, y + height);
    ctx.quadraticCurveTo(x - width / 2, y + height, x - width / 2, y + height - radius);
    ctx.lineTo(x - width / 2, y + radius);
    ctx.quadraticCurveTo(x - width / 2, y, x - width / 2 + radius, y);
    ctx.closePath();
    ctx.fill();

    // Reset shadow
    ctx.shadowBlur = 0;

    // Add highlight for 3D effect
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(x - width / 2 + 4, y + 2, width - 8, 4);

    // Add label if provided
    if (label) {
      ctx.font = '9px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillText(label, x, y + height / 2 + 3);
    }

    // Add stress indicator (small dot)
    if (stress > 60) {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(x + width / 2 - 6, y + height / 2, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const adjustColorBrightness = (color: string, amount: number): string => {
    const num = parseInt(color.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
    const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  };

  const drawLegend = (ctx: CanvasRenderingContext2D) => {
    const legendX = 15;
    const legendY = 60;
    const boxSize = 14;
    const spacing = 22;

    const legend = [
      { label: 'Optimal', color: '#10B981', range: '0-20%' },
      { label: 'Good', color: '#84CC16', range: '20-40%' },
      { label: 'Caution', color: '#F59E0B', range: '40-60%' },
      { label: 'Warning', color: '#F97316', range: '60-80%' },
      { label: 'Critical', color: '#EF4444', range: '80-100%' }
    ];

    // Legend title
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('Stress Level', legendX, legendY - 10);

    ctx.font = '10px Arial';

    legend.forEach((item, index) => {
      const y = legendY + index * spacing;

      // Color box with border
      ctx.fillStyle = item.color;
      ctx.fillRect(legendX, y, boxSize, boxSize);
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(legendX, y, boxSize, boxSize);

      // Label
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(item.label, legendX + boxSize + 6, y + boxSize - 3);
    });
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-white text-xl font-semibold mb-2">
        🦴 Spine Stress Analysis
      </h3>
      <p className="text-gray-400 text-xs mb-4">
        Real-time visualization of spinal stress distribution
      </p>
      
      {!isPersonDetected ? (
        <div className="flex items-center justify-center h-[600px] text-gray-400">
          <div className="text-center">
            <div className="text-5xl mb-3">🔍</div>
            <p className="text-sm">Start monitoring to see spine visualization</p>
          </div>
        </div>
      ) : (
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={300}
            height={600}
            className="mx-auto"
          />
          
          {/* Real-time status */}
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-white/10 rounded p-2">
              <div className="text-gray-400">Cervical</div>
              <div className={`font-bold ${
                calculateCervicalStress(cervicalAngle) <= 40 ? 'text-green-400' :
                calculateCervicalStress(cervicalAngle) <= 70 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {Math.round(calculateCervicalStress(cervicalAngle))}%
              </div>
              <div className="text-gray-500 text-[10px]">
                {getStressLabel(calculateCervicalStress(cervicalAngle))}
              </div>
            </div>
            
            <div className="bg-white/10 rounded p-2">
              <div className="text-gray-400">Thoracic</div>
              <div className={`font-bold ${
                calculateThoracicStress(postureScore, cervicalAngle) <= 40 ? 'text-green-400' :
                calculateThoracicStress(postureScore, cervicalAngle) <= 70 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {Math.round(calculateThoracicStress(postureScore, cervicalAngle))}%
              </div>
              <div className="text-gray-500 text-[10px]">
                {getStressLabel(calculateThoracicStress(postureScore, cervicalAngle))}
              </div>
            </div>
            
            <div className="bg-white/10 rounded p-2">
              <div className="text-gray-400">Lumbar</div>
              <div className={`font-bold ${
                calculateLumbarStress(postureScore) <= 40 ? 'text-green-400' :
                calculateLumbarStress(postureScore) <= 70 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {Math.round(calculateLumbarStress(postureScore))}%
              </div>
              <div className="text-gray-500 text-[10px]">
                {getStressLabel(calculateLumbarStress(postureScore))}
              </div>
            </div>
          </div>

          {/* Health Tip */}
          <div className="mt-4 bg-blue-900/30 border border-blue-700/50 rounded-lg p-3">
            <div className="text-blue-200 text-xs">
              <div className="font-semibold mb-1">💡 Health Tip</div>
              {calculateCervicalStress(cervicalAngle) > 60 ? (
                <p>Your neck is under high stress. Move your screen to eye level and sit back in your chair.</p>
              ) : calculateThoracicStress(postureScore, cervicalAngle) > 60 ? (
                <p>Your mid-back needs support. Use a lumbar pillow and keep shoulders back.</p>
              ) : calculateLumbarStress(postureScore) > 60 ? (
                <p>Lower back stress detected. Ensure your feet are flat and hips at 90°.</p>
              ) : (
                <p>Great posture! Keep your spine aligned and take regular breaks.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}