
export interface MasteringProfile {
  lowGain: number;       // For Bass/Kicks
  midGain: number;       // For Vocals
  highGain: number;      // For Clarity
  compressionThreshold: number;
  noiseGateThreshold: number;
  outputGain: number;
  description: string;
}

export interface AudioState {
  originalBuffer: AudioBuffer | null;
  processedBuffer: AudioBuffer | null;
  fileName: string;
  isProcessing: boolean;
  activeView: 'original' | 'processed';
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  ANALYZING = 'ANALYZING',
  PROCESSING = 'PROCESSING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}
