
import React, { useEffect, useRef } from 'react';

// This component is used to generate our icons
const IconGenerator = () => {
  const canvas16Ref = useRef<HTMLCanvasElement>(null);
  const canvas48Ref = useRef<HTMLCanvasElement>(null);
  const canvas128Ref = useRef<HTMLCanvasElement>(null);

  const drawIcon = (canvas: HTMLCanvasElement, size: number) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#1e40af';
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
    ctx.fill();

    // Shield
    ctx.fillStyle = '#3b82f6';
    const shieldWidth = size * 0.7;
    const shieldHeight = size * 0.8;
    const shieldX = (size - shieldWidth) / 2;
    const shieldY = (size - shieldHeight) / 2;
    
    ctx.beginPath();
    ctx.moveTo(shieldX, shieldY + shieldHeight * 0.3);
    ctx.lineTo(shieldX, shieldY);
    ctx.lineTo(shieldX + shieldWidth, shieldY);
    ctx.lineTo(shieldX + shieldWidth, shieldY + shieldHeight * 0.3);
    ctx.bezierCurveTo(
      shieldX + shieldWidth, shieldY + shieldHeight * 0.7,
      shieldX + shieldWidth * 0.5, shieldY + shieldHeight,
      shieldX + shieldWidth * 0.5, shieldY + shieldHeight
    );
    ctx.bezierCurveTo(
      shieldX + shieldWidth * 0.5, shieldY + shieldHeight,
      shieldX, shieldY + shieldHeight * 0.7,
      shieldX, shieldY + shieldHeight * 0.3
    );
    ctx.fill();

    // Checkmark
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = size * 0.08;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(size * 0.3, size * 0.5);
    ctx.lineTo(size * 0.45, size * 0.65);
    ctx.lineTo(size * 0.7, size * 0.35);
    ctx.stroke();
  };

  useEffect(() => {
    if (canvas16Ref.current) drawIcon(canvas16Ref.current, 16);
    if (canvas48Ref.current) drawIcon(canvas48Ref.current, 48);
    if (canvas128Ref.current) drawIcon(canvas128Ref.current, 128);
  }, []);

  return (
    <div className="hidden">
      <canvas ref={canvas16Ref} width={16} height={16} id="icon16" />
      <canvas ref={canvas48Ref} width={48} height={48} id="icon48" />
      <canvas ref={canvas128Ref} width={128} height={128} id="icon128" />
    </div>
  );
};

export default IconGenerator;
