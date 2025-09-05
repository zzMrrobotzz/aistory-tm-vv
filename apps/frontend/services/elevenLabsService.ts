import { ELEVENLABS_API_URL } from '../constants';
import { ElevenLabsVoice } from '../types';
import { ApiKeyStorage } from '../utils/apiKeyStorage';

interface ElevenLabsUser {
    subscription: {
        character_count: number;
        character_limit: number;
        // ... other user details
    };
    // ... other user properties
}

interface ElevenLabsVoicesResponse {
    voices: ElevenLabsVoice[];
}

const handleElevenLabsError = async (response: Response, signal?: AbortSignal): Promise<Error> => {
    if (signal?.aborted) return new DOMException('Aborted', 'AbortError');
    let errorMessage = `ElevenLabs API Error: ${response.status} ${response.statusText}`;
    try {
        const errorData = await response.json();
        if (errorData.detail?.message) {
            errorMessage = errorData.detail.message;
        } else if (errorData.detail) {
            errorMessage = JSON.stringify(errorData.detail);
        }
    } catch (e) {
        // Failed to parse JSON, stick with the status text
    }

    if (response.status === 401) {
        return new Error("Invalid ElevenLabs API Key. Please check your key.");
    }
    return new Error(errorMessage);
};

export const fetchElevenLabsUser = async (
    apiKey: string,
    signal?: AbortSignal
): Promise<ElevenLabsUser> => {
    if (!apiKey) throw new Error("ElevenLabs API Key is required.");
    const response = await fetch(`${ELEVENLABS_API_URL}/v1/user`, {
        headers: { 'xi-api-key': apiKey },
        signal,
    });
    if (!response.ok) throw await handleElevenLabsError(response, signal);
    return response.json();
};

export const fetchElevenLabsVoices = async (
    apiKey: string,
    signal?: AbortSignal
): Promise<ElevenLabsVoice[]> => {
    if (!apiKey) throw new Error("ElevenLabs API Key is required.");
    const response = await fetch(`${ELEVENLABS_API_URL}/v1/voices`, {
        headers: { 'xi-api-key': apiKey },
        signal,
    });
    if (!response.ok) throw await handleElevenLabsError(response, signal);
    const data: ElevenLabsVoicesResponse = await response.json();
    return data.voices;
};

export const generateElevenLabsSpeech = async (
    apiKey: string,
    text: string,
    voiceId: string,
    modelId: string,
    signal?: AbortSignal
): Promise<Blob> => {
    if (!apiKey) throw new Error("ElevenLabs API Key is required.");
    const response = await fetch(`${ELEVENLABS_API_URL}/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'xi-api-key': apiKey,
            'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
            text: text,
            model_id: modelId,
        }),
        signal,
    });

    if (!response.ok) throw await handleElevenLabsError(response, signal);
    
    // Track daily usage for ElevenLabs API key
    const activeElevenLabsKey = ApiKeyStorage.getActiveKey('elevenlabs');
    if (activeElevenLabsKey) {
        ApiKeyStorage.trackDailyUsage(activeElevenLabsKey.id, 1);
        ApiKeyStorage.updateLastUsed('elevenlabs');
    }
    
    return response.blob();
};
