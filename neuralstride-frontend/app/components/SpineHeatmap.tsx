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

  // FIXED: More accurate cervical stress calculation based on research
  const calculateCervicalStress = (angle: number): number => {
    // Research shows ideal cervical angle is 155-165° when sitting
    // Forward head posture (FHP) is the most common issue
    
    // Perfect posture
    if (angle >= 155 && angle <= 165) return 5; // Minimal baseline stress
    
    // Slightly too upright (rare)
    if (angle > 165) {
      const deviation = angle - 165;
      return Math.min(30, 5 + deviation * 4);
    }
    
    // FORWARD HEAD POSTURE (most common issue)
    // This is exponential - gets worse quickly as angle decreases
    
    if (angle >= 150) {
      // Mild FHP: 150-155°
      return 15 + (155 - angle) * 3; // 15-30% stress
    } else if (angle >= 145) {
      // Moderate FHP: 145-150°
      return 30 + (150 - angle) * 5; // 30-55% stress
    } else if (angle >= 135) {
      // Severe FHP: 135-145°
      return 55 + (145 - angle) * 4; // 55-95% stress
    } else if (angle >= 125) {
      // Critical FHP: 125-135°
      return 95 + (135 - angle) * 0.5; // 95-100% stress
    } else {
      // Extreme FHP: <125°
      return 100; // Maximum stress
    }
  };

  // FIXED: Improved thoracic stress - cascades from cervical issues
  const calculateThoracicStress = (score: number, cervicalAngle: number): number => {
    // Base stress from overall posture score
    let baseStress = Math.max(0, 100 - score) * 0.6; // 60% weight
    
    // Add cascading stress from severe cervical issues
    if (cervicalAngle < 145) {
      // Severe forward head posture causes upper back rounding
      const cascadeStress = (145 - cervicalAngle) * 2;
      baseStress += Math.min(40, cascadeStress);
    }
    
    // Thoracic region is moderately affected
    return Math.min(100, baseStress);
  };

  // FIXED: Improved lumbar stress calculation
  const calculateLumbarStress = (score: number): number => {
    // Lower back is less directly affected but still important
    
    if (score >= 80) {
      return 10; // Minimal stress with excellent posture
    } else if (score >= 70) {
      return 15 + (80 - score) * 1.5; // 15-30% stress
    } else if (score >= 60) {
      return 30 + (70 - score) * 2; // 30-50% stress
    } else if (score >= 50) {
      return 50 + (60 - score) * 2.5; // 50-75% stress
    } else if (score >= 40) {
      return 75 + (50 - score) * 2; // 75-95% stress
    } else {
      return Math.min(100, 95 + (40 - score) * 0.5); // 95-100% stress
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

    // FIXED: Cervical vertebrae (7) - C1-C7 - MOST IMPORTANT for posture
    for (let i = 0; i < 7; i++) {
      const y = startY + i * (vertebraHeight + spacing);
      // Add realistic variation - stress increases toward C7 (lower cervical)
      const stressVariation = i * 3; // Lower cervical vertebrae under more stress
      const stress = Math.max(0, Math.min(100, cervicalStress + stressVariation + (Math.random() - 0.5) * 5));
      const width = vertebraWidth - i * 1.5; // Narrower at top
      drawVertebra(ctx, centerX, y, width, vertebraHeight, stress, `C${i + 1}`);
    }

    // FIXED: Thoracic vertebrae (12) - T1-T12
    for (let i = 0; i < 12; i++) {
      const y = startY + 7 * (vertebraHeight + spacing) + i * (vertebraHeight + spacing);
      // Mid-thoracic (T5-T8) tends to have highest stress
      const midThoracicBonus = Math.abs(i - 6) < 3 ? 10 : 0;
      const stress = Math.max(0, Math.min(100, thoracicStress + midThoracicBonus + (Math.random() - 0.5) * 8));
      // Natural curve - wider in middle
      const widthModifier = Math.sin((i / 12) * Math.PI) * 6;
      const width = vertebraWidth + widthModifier;
      drawVertebra(ctx, centerX, y, width, vertebraHeight, stress, `T${i + 1}`);
    }

    // FIXED: Lumbar vertebrae (5) - L1-L5
    for (let i = 0; i < 5; i++) {
      const y = startY + 19 * (vertebraHeight + spacing) + i * (vertebraHeight + spacing);
      // L4-L5 typically under most stress in lumbar region
      const lowerLumbarBonus = i >= 3 ? 12 : 0;
      const stress = Math.max(0, Math.min(100, lumbarStress + lowerLumbarBonus + (Math.random() - 0.5) * 10));
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
    ctx.fillText('(Neck)', centerX + 75, startY + 73);
    
    ctx.fillText('Thoracic', centerX + 75, startY + 240);
    ctx.fillText('(Upper Back)', centerX + 75, startY + 253);
    
    ctx.fillText('Lumbar', centerX + 75, startY + 480);
    ctx.fillText('(Lower Back)', centerX + 75, startY + 493);
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

    // FIXED: Add stress indicator (pulsing dot for high stress)
    if (stress > 60) {
      const pulse = Math.sin(Date.now() / 300) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
      ctx.beginPath();
      ctx.arc(x + width / 2 - 6, y + height / 2, 2.5, 0, Math.PI * 2);
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

          {/* FIXED: More accurate health tips based on actual measurements */}
          <div className="mt-4 bg-blue-900/30 border border-blue-700/50 rounded-lg p-3">
            <div className="text-blue-200 text-xs">
              <div className="font-semibold mb-1">💡 Health Tip</div>
              {cervicalAngle < 145 ? (
                <p><strong>Critical:</strong> Severe forward head posture detected (angle: {Math.round(cervicalAngle)}°). Bring your screen to eye level and pull your head back.</p>
              ) : cervicalAngle < 155 ? (
                <p><strong>Warning:</strong> Forward head posture (angle: {Math.round(cervicalAngle)}°). Move your screen higher and sit back in your chair.</p>
              ) : calculateThoracicStress(postureScore, cervicalAngle) > 60 ? (
                <p>Your mid-back needs support. Use a lumbar pillow and keep shoulders back and relaxed.</p>
              ) : calculateLumbarStress(postureScore) > 60 ? (
                <p>Lower back stress detected. Ensure your feet are flat and hips at 90°. Take a short walk.</p>
              ) : (
                <p>Great posture! (angle: {Math.round(cervicalAngle)}°) Keep your spine aligned and remember to take regular breaks every 30 minutes.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}