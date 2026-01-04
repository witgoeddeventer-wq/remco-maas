
import { MasteringProfile } from '../types';

export interface AudioAnalysis {
  rms: number;
  peak: number;
  duration: number;
  sampleRate: number;
  channels: number;
}

/**
 * Scant de VOLLEDIGE audio buffer voor technische karakteristieken.
 */
export function scanAudio(buffer: AudioBuffer): AudioAnalysis {
  const duration = buffer.duration;
  const channels = buffer.numberOfChannels;
  let totalSumSquares = 0;
  let absolutePeak = 0;

  // We scannen alle kanalen voor een compleet beeld van de track
  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c);
    let channelSumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      const sample = data[i];
      channelSumSquares += sample * sample;
      if (Math.abs(sample) > absolutePeak) absolutePeak = Math.abs(sample);
    }
    totalSumSquares += channelSumSquares;
  }

  // Gemiddelde RMS over alle samples in de volledige track
  const totalSamples = buffer.length * channels;
  const rms = Math.sqrt(totalSumSquares / totalSamples);
  const rmsDb = 20 * Math.log10(rms || 0.00001);
  const peakDb = 20 * Math.log10(absolutePeak || 0.00001);

  return {
    rms: Math.round(rmsDb * 10) / 10,
    peak: Math.round(peakDb * 10) / 10,
    duration: Math.round(duration * 100) / 100,
    sampleRate: buffer.sampleRate,
    channels: channels
  };
}

/**
 * Automates the mastering process using Web Audio DSP nodes for the FULL track length.
 */
export async function processAudio(
  sourceBuffer: AudioBuffer,
  profile: MasteringProfile
): Promise<AudioBuffer> {
  // De OfflineAudioContext wordt aangemaakt met de EXACTE lengte van de bron
  const offlineCtx = new OfflineAudioContext(
    sourceBuffer.numberOfChannels,
    sourceBuffer.length,
    sourceBuffer.sampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = sourceBuffer;

  // Mastering Chain
  const noiseGate = offlineCtx.createDynamicsCompressor();
  noiseGate.threshold.setValueAtTime(profile.noiseGateThreshold, 0);
  noiseGate.ratio.setValueAtTime(12, 0);
  noiseGate.attack.setValueAtTime(0.003, 0);
  noiseGate.release.setValueAtTime(0.25, 0);

  const hpFilter = offlineCtx.createBiquadFilter();
  hpFilter.type = 'highpass';
  hpFilter.frequency.setValueAtTime(40, 0);

  const lowShelf = offlineCtx.createBiquadFilter();
  lowShelf.type = 'lowshelf';
  lowShelf.frequency.setValueAtTime(200, 0);
  lowShelf.gain.setValueAtTime(profile.lowGain, 0);

  const midPeak = offlineCtx.createBiquadFilter();
  midPeak.type = 'peaking';
  midPeak.frequency.setValueAtTime(2500, 0);
  midPeak.gain.setValueAtTime(profile.midGain, 0);

  const highShelf = offlineCtx.createBiquadFilter();
  highShelf.type = 'highshelf';
  highShelf.frequency.setValueAtTime(8000, 0);
  highShelf.gain.setValueAtTime(profile.highGain, 0);

  const masterCompressor = offlineCtx.createDynamicsCompressor();
  masterCompressor.threshold.setValueAtTime(profile.compressionThreshold, 0);
  masterCompressor.ratio.setValueAtTime(4, 0);

  const gainNode = offlineCtx.createGain();
  gainNode.gain.setValueAtTime(profile.outputGain, 0);

  // Verbinden van de volledige keten
  source
    .connect(hpFilter)
    .connect(noiseGate)
    .connect(lowShelf)
    .connect(midPeak)
    .connect(highShelf)
    .connect(masterCompressor)
    .connect(gainNode)
    .connect(offlineCtx.destination);

  source.start(0);
  // Rendert de volledige track asynchroon
  return await offlineCtx.startRendering();
}

export function bufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  function setUint16(data: number) { view.setUint16(pos, data, true); pos += 2; }
  function setUint32(data: number) { view.setUint32(pos, data, true); pos += 4; }

  setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157);
  setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan);
  setUint32(buffer.sampleRate); setUint32(buffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2); setUint16(16); setUint32(0x61746164);
  setUint32(length - pos - 4);

  for (i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));
  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }
  return new Blob([bufferArray], { type: 'audio/wav' });
}
