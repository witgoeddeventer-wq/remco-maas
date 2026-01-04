
import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  audioBuffer: AudioBuffer | null;
  isActive: boolean;
  label: string;
}

const Visualizer: React.FC<VisualizerProps> = ({ audioBuffer, isActive, label }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!audioBuffer || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / canvas.width);
    const amp = canvas.height / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Teken achtergrond grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += canvas.width / 10) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Teken Waveform (Full Track)
    ctx.beginPath();
    ctx.moveTo(0, amp);

    for (let i = 0; i < canvas.width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      ctx.lineTo(i, (1 + min) * amp);
      ctx.lineTo(i, (1 + max) * amp);
    }

    ctx.strokeStyle = isActive ? '#3b82f6' : '#475569';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Teken Baseline
    ctx.beginPath();
    ctx.moveTo(0, amp);
    ctx.lineTo(canvas.width, amp);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.stroke();

  }, [audioBuffer, isActive]);

  return (
    <div className={`relative w-full h-40 rounded-3xl bg-slate-950 border-2 transition-all duration-500 overflow-hidden ${isActive ? 'border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.15)]' : 'border-slate-800'}`}>
      <canvas ref={canvasRef} width={1200} height={160} className="w-full h-full opacity-80" />
      
      {/* UI Overlay */}
      <div className="absolute top-4 left-6 flex flex-col gap-1">
        <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isActive ? 'text-blue-400' : 'text-slate-500'}`}>
          {label}
        </span>
      </div>

      {audioBuffer && (
        <div className="absolute bottom-4 right-6 text-[10px] font-mono text-slate-500 bg-black/40 px-2 py-1 rounded backdrop-blur-sm">
          Duration: {formatTime(audioBuffer.duration)} | {audioBuffer.sampleRate}Hz
        </div>
      )}

      {!isActive && (
        <div className="absolute inset-0 bg-slate-950/40 pointer-events-none"></div>
      )}
    </div>
  );
};

export default Visualizer;
