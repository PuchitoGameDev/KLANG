import React, { useEffect, useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';

export default function Equalizer() {
  const { analyser, isPlaying } = usePlayer();
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!analyser || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!canvasRef.current) return;
      requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i] / 2.5; // Ajuste de sensibilidad
        
        // Toma el color de la variable CSS del tema actual
        const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#3b82f6';
        
        ctx.fillStyle = themeColor;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };

    draw();
  }, [analyser, isPlaying]);

  return (
    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px', height: '80px', width: '100%' }}>
      <canvas ref={canvasRef} width="300" height="80" style={{ width: '100%', height: '100%' }} />
    </div>
  );
}