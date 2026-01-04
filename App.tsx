
import React, { useState, useRef, useEffect } from 'react';
import { 
  CloudArrowUpIcon, 
  PlayIcon, 
  PauseIcon, 
  ArrowDownTrayIcon, 
  SparklesIcon,
  MusicalNoteIcon,
  TrashIcon,
  AdjustmentsHorizontalIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  CpuChipIcon
} from '@heroicons/react/24/solid';
import { AudioState, ProcessingStatus, MasteringProfile } from './types';
import { processAudio, bufferToWav, scanAudio, AudioAnalysis } from './services/audioProcessor';
import { getMasteringAdvice } from './services/geminiService';
import Visualizer from './components/Visualizer';

const App: React.FC = () => {
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState(0);
  const [audioState, setAudioState] = useState<AudioState>({
    originalBuffer: null,
    processedBuffer: null,
    fileName: '',
    isProcessing: false,
    activeView: 'original'
  });
  const [analysis, setAnalysis] = useState<AudioAnalysis | null>(null);
  const [profile, setProfile] = useState<MasteringProfile | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const animationRef = useRef<number>(0);

  // Playback progress tracker
  useEffect(() => {
    if (isPlaying) {
      const update = () => {
        const offset = pauseTimeRef.current;
        const played = audioCtxRef.current!.currentTime - startTimeRef.current;
        setCurrentTime(played);
        animationRef.current = requestAnimationFrame(update);
      };
      animationRef.current = requestAnimationFrame(update);
    } else {
      cancelAnimationFrame(animationRef.current);
    }
    return () => cancelAnimationFrame(animationRef.current);
  }, [isPlaying]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    reset();
    setStatus(ProcessingStatus.UPLOADING);
    setProgress(10);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      
      try {
        const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
        setAudioState(prev => ({
          ...prev,
          originalBuffer: decodedBuffer,
          fileName: file.name
        }));

        // STAP 1: Full Track Scan
        setStatus(ProcessingStatus.ANALYZING);
        setProgress(30);
        const audioData = scanAudio(decodedBuffer);
        setAnalysis(audioData);
        setProgress(50);
        
        // STAP 2: AI Beslissing
        const advice = await getMasteringAdvice(file.name, audioData);
        setProfile(advice);
        setProgress(70);
        
        // STAP 3: Volledige Track Mastering (Offline Rendering)
        setStatus(ProcessingStatus.PROCESSING);
        const processed = await processAudio(decodedBuffer, advice);
        
        setAudioState(prev => ({
          ...prev,
          processedBuffer: processed,
          activeView: 'processed'
        }));
        setProgress(100);
        setStatus(ProcessingStatus.COMPLETE);
      } catch (err) {
        console.error(err);
        setStatus(ProcessingStatus.ERROR);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const togglePlayback = () => {
    if (isPlaying) {
      sourceNodeRef.current?.stop();
      setIsPlaying(false);
      pauseTimeRef.current = audioCtxRef.current!.currentTime - startTimeRef.current;
    } else {
      const ctx = audioCtxRef.current;
      const buffer = audioState.activeView === 'original' 
        ? audioState.originalBuffer 
        : audioState.processedBuffer;

      if (!ctx || !buffer) return;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => {
        setIsPlaying(false);
        if (currentTime >= buffer.duration - 0.1) {
          pauseTimeRef.current = 0;
          setCurrentTime(0);
        }
      };
      
      const offset = pauseTimeRef.current % buffer.duration;
      source.start(0, offset);
      sourceNodeRef.current = source;
      startTimeRef.current = ctx.currentTime - offset;
      setIsPlaying(true);
    }
  };

  const toggleView = (view: 'original' | 'processed') => {
    const wasPlaying = isPlaying;
    if (wasPlaying) togglePlayback();
    setAudioState(prev => ({ ...prev, activeView: view }));
    if (wasPlaying) setTimeout(togglePlayback, 50);
  };

  const handleExport = () => {
    if (!audioState.processedBuffer) return;
    const blob = bufferToWav(audioState.processedBuffer);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SonicAI_Mastered_${audioState.fileName}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    if (isPlaying) {
      sourceNodeRef.current?.stop();
      setIsPlaying(false);
    }
    setAudioState({
      originalBuffer: null,
      processedBuffer: null,
      fileName: '',
      isProcessing: false,
      activeView: 'original'
    });
    setProfile(null);
    setAnalysis(null);
    setStatus(ProcessingStatus.IDLE);
    setProgress(0);
    pauseTimeRef.current = 0;
    setCurrentTime(0);
  };

  const getProgressLabel = () => {
    if (status === ProcessingStatus.UPLOADING) return "Track importeren...";
    if (status === ProcessingStatus.ANALYZING) return "Volledige track scannen (RMS & Peaks)...";
    if (status === ProcessingStatus.PROCESSING) return "AI Mastering toepassen op gehele tijdslijn...";
    if (status === ProcessingStatus.COMPLETE) return "Mastering voltooid.";
    return "Klaar voor analyse";
  };

  const currentDuration = audioState.activeView === 'original' 
    ? audioState.originalBuffer?.duration || 0 
    : audioState.processedBuffer?.duration || 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 flex flex-col items-center">
      <header className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 mb-6">
          <CpuChipIcon className="w-5 h-5" />
          <span className="text-xs font-black uppercase tracking-[0.2em]">Deep Learning Mastering Engine</span>
        </div>
        <h1 className="text-6xl font-black mb-4 tracking-tighter bg-gradient-to-b from-white to-slate-500 bg-clip-text text-transparent">
          SonicAI Studio
        </h1>
        <p className="text-slate-500 max-w-lg mx-auto font-medium">
          Professionele nabewerking voor je volledige track. Automatische ruisonderdrukking en luidheidsoptimalisatie.
        </p>
      </header>

      <main className="w-full bg-slate-900/40 backdrop-blur-3xl border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl relative">
        {status !== ProcessingStatus.IDLE && status !== ProcessingStatus.COMPLETE && (
          <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-800 z-50">
            <div 
              className="h-full bg-blue-500 transition-all duration-500 ease-out shadow-[0_0_15px_rgba(59,130,246,0.5)]"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        )}

        {!audioState.originalBuffer ? (
          <div className="p-24 flex flex-col items-center justify-center text-center">
            <label className="w-40 h-40 mb-10 rounded-full bg-slate-800/50 flex items-center justify-center text-slate-400 cursor-pointer border-2 border-dashed border-slate-700 hover:border-blue-500 hover:text-blue-500 transition-all group active:scale-95">
              <CloudArrowUpIcon className="w-16 h-16 group-hover:-translate-y-2 transition-transform" />
              <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
            </label>
            <h2 className="text-3xl font-black text-white mb-3">Importeer Volledige Track</h2>
            <p className="text-slate-500 max-w-sm mb-10 leading-relaxed font-medium">Sleep je audiobestand hierheen voor een diepe scan van de hele tijdslijn.</p>
            <label className="px-12 py-5 bg-white text-black hover:bg-slate-200 rounded-2xl font-black transition-all cursor-pointer shadow-xl active:scale-95">
              KIES BESTAND
              <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Studio Header */}
            <div className="p-10 border-b border-slate-800 bg-slate-950/40 flex flex-wrap justify-between items-end gap-8">
              <div className="flex-1">
                <div className="flex items-center gap-3 text-blue-500 mb-2">
                  <MusicalNoteIcon className="w-5 h-5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{getProgressLabel()}</span>
                </div>
                <h3 className="text-2xl font-black text-white truncate max-w-md">{audioState.fileName}</h3>
              </div>

              {analysis && (
                <div className="flex gap-10 bg-slate-900/50 p-6 rounded-3xl border border-slate-800">
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Full Scan Peak</p>
                    <p className="text-xl font-mono font-bold text-white">{analysis.peak} <span className="text-xs text-slate-500">dB</span></p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Average RMS</p>
                    <p className="text-xl font-mono font-bold text-white">{analysis.rms} <span className="text-xs text-slate-500">dB</span></p>
                  </div>
                </div>
              )}
            </div>

            {/* Visualizers with Active Playhead */}
            <div className="p-10 space-y-10 relative">
              <div className="relative group">
                <Visualizer 
                  audioBuffer={audioState.originalBuffer} 
                  isActive={audioState.activeView === 'original'} 
                  label="Bron Signaal (Full Track)"
                />
                {isPlaying && currentDuration > 0 && (
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_white] z-10 pointer-events-none"
                    style={{ left: `${(currentTime / currentDuration) * 100}%` }}
                  ></div>
                )}
              </div>
              
              <div className="relative group">
                <Visualizer 
                  audioBuffer={audioState.processedBuffer} 
                  isActive={audioState.activeView === 'processed'} 
                  label="AI Mastered Signaal (Full Track)"
                />
                {isPlaying && currentDuration > 0 && (
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.8)] z-10 pointer-events-none"
                    style={{ left: `${(currentTime / currentDuration) * 100}%` }}
                  ></div>
                )}
              </div>
            </div>

            {/* Main Controls */}
            <div className="p-10 bg-slate-950/60 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-10">
              <div className="flex bg-slate-900 p-2 rounded-[2rem] border border-slate-800 shadow-inner">
                <button 
                  onClick={() => toggleView('original')}
                  className={`px-10 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${audioState.activeView === 'original' ? 'bg-slate-800 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Origineel
                </button>
                <button 
                  onClick={() => toggleView('processed')}
                  disabled={status !== ProcessingStatus.COMPLETE}
                  className={`px-10 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${audioState.activeView === 'processed' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : status === ProcessingStatus.COMPLETE ? 'text-slate-500 hover:text-slate-300' : 'text-slate-700 cursor-not-allowed'}`}
                >
                  Mastered
                </button>
              </div>

              <button 
                onClick={togglePlayback}
                disabled={status === ProcessingStatus.ANALYZING || status === ProcessingStatus.PROCESSING}
                className="w-24 h-24 bg-white hover:bg-blue-50 text-black rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all disabled:opacity-50"
              >
                {isPlaying ? <PauseIcon className="w-12 h-12" /> : <PlayIcon className="w-12 h-12 ml-1" />}
              </button>

              <div className="flex gap-5">
                <button onClick={reset} className="p-5 bg-slate-800 text-slate-400 hover:text-red-400 rounded-3xl transition-all active:scale-95">
                  <TrashIcon className="w-7 h-7" />
                </button>
                <button 
                  onClick={handleExport}
                  disabled={status !== ProcessingStatus.COMPLETE}
                  className="px-10 py-5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest flex items-center gap-4 transition-all shadow-xl shadow-emerald-600/10 active:scale-95"
                >
                  <ArrowDownTrayIcon className="w-6 h-6" />
                  Exporteren
                </button>
              </div>
            </div>

            {/* Technical Detail Footer */}
            {profile && (
              <div className="px-10 py-8 bg-blue-600/5 border-t border-slate-800">
                <div className="flex items-center gap-3 mb-4 text-blue-400">
                  <AdjustmentsHorizontalIcon className="w-5 h-5" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em]">AI Processing Report</span>
                </div>
                <div className="grid md:grid-cols-2 gap-8">
                  <p className="text-slate-400 text-sm leading-relaxed font-medium">{profile.description}</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-black/20 p-3 rounded-xl border border-slate-800">
                      <p className="text-[9px] text-slate-600 font-bold uppercase mb-1">Low End</p>
                      <p className="font-mono text-sm text-emerald-400">+{profile.lowGain}dB</p>
                    </div>
                    <div className="bg-black/20 p-3 rounded-xl border border-slate-800">
                      <p className="text-[9px] text-slate-600 font-bold uppercase mb-1">Vocals</p>
                      <p className="font-mono text-sm text-emerald-400">+{profile.midGain}dB</p>
                    </div>
                    <div className="bg-black/20 p-3 rounded-xl border border-slate-800">
                      <p className="text-[9px] text-slate-600 font-bold uppercase mb-1">Gate</p>
                      <p className="font-mono text-sm text-emerald-400">{profile.noiseGateThreshold}dB</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      
      <footer className="mt-16 text-slate-600 text-xs font-bold tracking-widest uppercase">
        Powered by Google Gemini-3 & WebAudio DSP
      </footer>
    </div>
  );
};

export default App;
