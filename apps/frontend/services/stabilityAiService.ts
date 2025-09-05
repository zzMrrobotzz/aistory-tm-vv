
import { ApiKeyStorage } from '../utils/apiKeyStorage';

const STABILITY_API_BASE_URL = "https://api.stability.ai/v2/stable-image";

export const generateStabilityImage = async (
    apiKey: string, 
    prompt: string, 
    stylePreset: string, 
    aspectRatio: string = "16:9", 
    negativePrompt?: string,
    signal?: AbortSignal
): Promise<Blob> => {
    if (!apiKey) throw new Error("Stability AI API Key is required.");

    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('aspect_ratio', aspectRatio);
    formData.append('model', 'sd3'); // Assuming SD3 model
    formData.append('style_preset', stylePreset);
    formData.append('output_format', 'png');
    if (negativePrompt && negativePrompt.trim() !== "") {
        formData.append('negative_prompt', negativePrompt.trim());
    }

    const response = await fetch(`${STABILITY_API_BASE_URL}/generate/sd3`, {
        method: 'POST',
        headers: {
            'Accept': 'image/png', // Expect PNG
            'Authorization': `Bearer ${apiKey}`
        },
        body: formData,
        signal: signal,
    });

    if (!response.ok) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        let errorDetails = `Stability AI Error: ${response.status} ${response.statusText}`;
        try {
            const errorData = await response.json(); // Stability AI often returns JSON errors
            if (errorData && errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
                 errorDetails += ` - ${errorData.errors.join(', ')}`;
            } else if (errorData && errorData.message) {
                 errorDetails += ` - ${errorData.message}`;
            } else if (errorData && errorData.name) {
                 errorDetails += ` - ${errorData.name}`;
            }
        } catch (e) {
            // If error response is not JSON, try to get text
            try {
                const textError = await response.text();
                if(textError) errorDetails += ` - ${textError}`;
            } catch (textErr) {
                // ignore if text cannot be read
            }
        }
        console.error("Stability AI image generation failed:", errorDetails);
        throw new Error(errorDetails);
    }
    
    // Track daily usage for Stability AI API key
    const activeStabilityKey = ApiKeyStorage.getActiveKey('stability');
    if (activeStabilityKey) {
        ApiKeyStorage.trackDailyUsage(activeStabilityKey.id, 1);
        ApiKeyStorage.updateLastUsed('stability');
    }
    
    return response.blob();
};

export const refineStabilityImage = async (
    apiKey: string,
    initialImageBlob: Blob,
    prompt: string,
    negativePrompt?: string,
    strength: number = 0.65,
    signal?: AbortSignal
): Promise<Blob> => {
    if (!apiKey) throw new Error("Stability AI API Key is required.");

    const formData = new FormData();
    formData.append('init_image', initialImageBlob);
    formData.append('prompt', prompt);
    if (negativePrompt && negativePrompt.trim() !== "") {
        formData.append('negative_prompt', negativePrompt.trim());
    }
    formData.append('mode', 'image-to-image');
    formData.append('strength', strength.toString());
    formData.append('output_format', 'png');
    // formData.append('model', 'sd3'); // Specify model if needed for image-to-image

    const response = await fetch(`${STABILITY_API_BASE_URL}/image-to-image`, {
        method: 'POST',
        headers: {
            'Accept': 'image/png',
            'Authorization': `Bearer ${apiKey}`
        },
        body: formData,
        signal: signal,
    });

    if (!response.ok) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        let errorDetails = `Stability AI Image Refinement Error: ${response.status} ${response.statusText}`;
         try {
            const errorData = await response.json();
             if (errorData && errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
                 errorDetails += ` - ${errorData.errors.join(', ')}`;
            } else if (errorData && errorData.message) {
                 errorDetails += ` - ${errorData.message}`;
            } else if (errorData && errorData.name) {
                 errorDetails += ` - ${errorData.name}`;
            }
        } catch (e) {
            try {
                const textError = await response.text();
                if(textError) errorDetails += ` - ${textError}`;
            } catch (textErr) {
                 // ignore
            }
        }
        console.error("Stability AI image refinement failed:", errorDetails);
        throw new Error(errorDetails);
    }
    
    // Track daily usage for Stability AI API key
    const activeStabilityKey = ApiKeyStorage.getActiveKey('stability');
    if (activeStabilityKey) {
        ApiKeyStorage.trackDailyUsage(activeStabilityKey.id, 1);
        ApiKeyStorage.updateLastUsed('stability');
    }
    
    return response.blob();
};