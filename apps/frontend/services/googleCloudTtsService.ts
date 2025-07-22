import { GoogleCloudVoice } from '../types';

const API_BASE_URL = "https://texttospeech.googleapis.com/v1";

export const fetchGoogleCloudVoices = async (
  apiKey: string, 
  signal?: AbortSignal
): Promise<GoogleCloudVoice[]> => {
  if (!apiKey) throw new Error("Google Cloud API Key is required.");
  const response = await fetch(`${API_BASE_URL}/voices?key=${apiKey}`, {
    signal: signal,
  });
  if (!response.ok) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `Failed to fetch Google Cloud voices: ${response.status} ${response.statusText}`;
    throw new Error(message);
  }
  const data = await response.json();
  
  // Return all valid voices from the API without pre-filtering by type
  return (data.voices as GoogleCloudVoice[]).filter(v => v.name && v.languageCodes && v.languageCodes.length > 0);
};

export const generateGoogleCloudSpeech = async (apiKey: string, text: string, voiceName: string, signal?: AbortSignal): Promise<Blob> => {
  if (!apiKey) throw new Error("Google Cloud API Key is required.");
  if (!text) throw new Error("Text to speak is required.");
  if (!voiceName) throw new Error("Voice name is required.");
  
  // Extract language code from voice name (e.g., "en-US-Wavenet-A" -> "en-US")
  const languageCode = voiceName.split('-').slice(0, 2).join('-');
  if (!languageCode) {
    throw new Error(`Could not determine language code from voice name: ${voiceName}`);
  }

  const response = await fetch(`${API_BASE_URL}/text:synthesize?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text: text },
      voice: { languageCode: languageCode, name: voiceName },
      audioConfig: { audioEncoding: 'MP3' }
    }),
    signal: signal,
  });

  if (!response.ok) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `Google Cloud TTS failed: ${response.status} ${response.statusText}`;
    const customError = new Error(message) as any;
    customError.statusCode = response.status;
    throw customError;
  }
  const data = await response.json();
  if (!data.audioContent) {
    throw new Error("No audio content received from Google Cloud API.");
  }
  
  // Decode base64 to blob
  const byteCharacters = atob(data.audioContent);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: 'audio/mpeg' });
};