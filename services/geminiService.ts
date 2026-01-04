
import { GoogleGenAI, Type } from "@google/genai";
import { MasteringProfile } from "../types";
import { AudioAnalysis } from "./audioProcessor";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getMasteringAdvice(
  audioFileName: string, 
  analysis: AudioAnalysis
): Promise<MasteringProfile> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Je bent een world-class mastering engineer. Scan data voor track "${audioFileName}":
    - RMS Luidheid: ${analysis.rms} dB
    - Piek: ${analysis.peak} dB
    - Duur: ${analysis.duration}s

    Baseer je bewerking op deze cijfers. Als de RMS boven de -10dB is, wees voorzichtig met boosten. Als de piek bijna 0dB is, gebruik meer compressie. Verwijder ruis indien de RMS erg laag is. Focus op balans tussen kicks en vocals.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          lowGain: { type: Type.NUMBER, description: "Gain voor lage frequenties (dB)." },
          midGain: { type: Type.NUMBER, description: "Gain voor vocalen (dB)." },
          highGain: { type: Type.NUMBER, description: "Gain voor hoog/air (dB)." },
          compressionThreshold: { type: Type.NUMBER, description: "Compressor drempel (dB)." },
          noiseGateThreshold: { type: Type.NUMBER, description: "Noise gate drempel (dB)." },
          outputGain: { type: Type.NUMBER, description: "Makeup gain multiplier (bijv. 1.1)." },
          description: { type: Type.STRING, description: "Uitleg van de uitgevoerde scan en actie." }
        },
        required: ["lowGain", "midGain", "highGain", "compressionThreshold", "noiseGateThreshold", "outputGain", "description"]
      }
    }
  });

  try {
    return JSON.parse(response.text.trim()) as MasteringProfile;
  } catch (e) {
    return {
      lowGain: 1.5,
      midGain: 1.0,
      highGain: 0.5,
      compressionThreshold: -12,
      noiseGateThreshold: -50,
      outputGain: 1.0,
      description: "Fallback mastering profiel toegepast."
    };
  }
}
