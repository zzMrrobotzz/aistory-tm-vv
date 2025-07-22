// OpenAI DALL-E Image Generation Service
import { dataUrlToBlob } from '../utils';

interface DallEResponse {
    created: number;
    data: { b64_json?: string; url?: string; revised_prompt?: string; }[]; // Support b64_json or url
}

interface DallEErrorDetail {
    code: string | null;
    message: string;
    param: string | null;
    type: string;
}

interface DallEErrorResponse {
    error: DallEErrorDetail;
}

const mapAspectRatioToDallE3Size = (aspectRatio: string): string => {
    switch (aspectRatio) {
        case "1:1":
            return "1024x1024";
        case "16:9":
            return "1792x1024";
        case "9:16":
            return "1024x1792";
        default:
            console.warn(`Unsupported aspect ratio for DALL-E 3: ${aspectRatio}. Defaulting to 1024x1024.`);
            return "1024x1024";
    }
};

const getEffectiveOpenAIApiKey = (apiKey?: string): string => {
    const envKey = typeof window !== 'undefined' ? (window as any).process?.env?.OPENAI_API_KEY : process.env.OPENAI_API_KEY;
    const effectiveApiKey = apiKey || envKey;
    if (!effectiveApiKey) {
        throw new Error(
            "OpenAI API Key không được tìm thấy. " +
            "Vui lòng nhập API Key vào ô 'ChatGPT (DALL-E) API Key' trong module " +
            "hoặc cấu hình biến môi trường OPENAI_API_KEY."
        );
    }
    return effectiveApiKey;
};

const handleOpenAIError = async (response: Response, signal?: AbortSignal): Promise<Error> => {
    if (signal?.aborted) return new DOMException('Aborted', 'AbortError');
    const errorData: DallEErrorResponse = await response.json();
    const errorDetail = errorData.error || { message: `Lỗi HTTP ${response.status}`, type: 'unknown_error', code: null, param: null };
    
    console.error("DALL-E API Error (raw detail):", JSON.stringify(errorDetail, null, 2));

    let userMessage = `Lỗi từ DALL-E API`;
    if (errorDetail.type) {
        userMessage += ` (Loại: ${errorDetail.type})`;
    }

    if (errorDetail.message && errorDetail.message.toLowerCase() !== 'null') {
        userMessage += `: ${errorDetail.message}`;
    } else if (errorDetail.type === 'image_generation_user_error' && (!errorDetail.message || errorDetail.message.toLowerCase() === 'null')) {
        userMessage += ". Nguyên nhân có thể do prompt không hợp lệ, vi phạm chính sách nội dung của OpenAI, hoặc lỗi cấu hình khác. Hãy thử điều chỉnh prompt.";
    }
    
    if (errorDetail.code) {
        userMessage += ` (Code: ${errorDetail.code})`;
    }
    
    if (response.status && (userMessage === `Lỗi từ DALL-E API` || (errorDetail.type && userMessage === `Lỗi từ DALL-E API (Loại: ${errorDetail.type})`))) {
            userMessage += ` (Status: ${response.status})`;
    }
    
    if (response.status === 401) {
        userMessage = "Lỗi xác thực OpenAI API Key. Vui lòng kiểm tra lại API Key của bạn.";
    } else if (response.status === 429) {
        userMessage = "Lỗi giới hạn request OpenAI (Quota Exceeded). Vui lòng thử lại sau hoặc kiểm tra hạn ngạch tài khoản.";
    } else if (errorDetail.code === 'billing_hard_limit_reached') {
            userMessage = "Lỗi giới hạn thanh toán OpenAI (Billing Hard Limit Reached). Vui lòng kiểm tra tài khoản OpenAI của bạn.";
    }
    
    console.error("DALL-E API Error (constructed user message):", userMessage);
    return new Error(userMessage);
};


export const generateDallEImage = async (
    prompt: string,
    aspectRatio: string,
    apiKey?: string,
    signal?: AbortSignal
): Promise<string> => {
    const effectiveApiKey = getEffectiveOpenAIApiKey(apiKey);
    const size = mapAspectRatioToDallE3Size(aspectRatio);
    const apiURL = "https://api.openai.com/v1/images/generations";

    try {
        const response = await fetch(apiURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${effectiveApiKey}`
            },
            body: JSON.stringify({
                model: "dall-e-3", 
                prompt: prompt,
                n: 1,
                size: size,
                response_format: "b64_json" // Request base64
            }),
            signal: signal,
        });

        if (!response.ok) {
            throw await handleOpenAIError(response, signal);
        }

        const responseData: DallEResponse = await response.json();

        if (responseData.data && responseData.data.length > 0 && responseData.data[0].b64_json) {
            // Store revised_prompt if available (useful for display)
            // This function is part of a module, it should return the image.
            // The revised_prompt handling should be in the module component.
            return `data:image/png;base64,${responseData.data[0].b64_json}`;
        } else {
            console.error("No image data received from DALL-E API. Response:", responseData);
            throw new Error("Không nhận được dữ liệu ảnh từ DALL-E API.");
        }

    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            throw error;
        }
        const errorMessage = (error instanceof Error) ? error.message : String(error);
        console.error("Failed to generate image with DALL-E (final catch):", errorMessage);
        if (error instanceof Error && (error.message.startsWith("Lỗi từ DALL-E API") || error.message.startsWith("Lỗi xác thực OpenAI API Key") || error.message.startsWith("Lỗi giới hạn request OpenAI"))) {
            throw error; 
        }
        throw new Error(`Không thể tạo ảnh DALL-E: ${errorMessage}`);
    }
};

export const generateOpenAiSpeech = async (
    apiKey: string,
    text: string,
    voiceId: string,
    modelId: string, // 'tts-1' or 'tts-1-hd'
    signal?: AbortSignal
): Promise<Blob> => {
    const effectiveApiKey = getEffectiveOpenAIApiKey(apiKey);
    const apiURL = "https://api.openai.com/v1/audio/speech";

    if (!text) throw new Error("Text to speak is required.");
    if (!voiceId) throw new Error("Voice ID is required.");
    if (!modelId) throw new Error("Model ID is required.");

    try {
        const response = await fetch(apiURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${effectiveApiKey}`
            },
            body: JSON.stringify({
                model: modelId,
                input: text,
                voice: voiceId,
                response_format: 'mp3'
            }),
            signal: signal,
        });

        if (!response.ok) {
            throw await handleOpenAIError(response, signal);
        }
        // The response body is the audio file itself
        return response.blob();
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            throw error;
        }
        const errorMessage = (error instanceof Error) ? error.message : String(error);
        console.error("Failed to generate speech with OpenAI (final catch):", errorMessage);
        if (error instanceof Error && (error.message.startsWith("Lỗi từ DALL-E API") || error.message.startsWith("Lỗi xác thực OpenAI API Key") || error.message.startsWith("Lỗi giới hạn request OpenAI"))) {
            // Re-throw handled errors
            throw new Error(error.message.replace("DALL-E", "OpenAI TTS"));
        }
        throw new Error(`Không thể tạo audio OpenAI TTS: ${errorMessage}`);
    }
};

export const editDallEImage = async (
    originalImageDataBase64: string, // Base64 string of the original image, no "data:image/png;base64," prefix
    mimeType: string, // e.g. "image/png"
    refinementPrompt: string,
    aspectRatio: string, // Used to determine 'size' for DALL-E
    apiKey?: string,
    signal?: AbortSignal
): Promise<string> => { // Returns base64 data URL of the new image
    const effectiveApiKey = getEffectiveOpenAIApiKey(apiKey);
    // DALL-E edits API expects the image as a file upload (multipart/form-data)
    // It also expects 'image/png' format. We must ensure the input is PNG.
    // If mimeType is not png, we'd ideally convert it. For simplicity, we'll assume PNG or pass as is.

    const imageBlob = await dataUrlToBlob(`data:${mimeType};base64,${originalImageDataBase64}`);
    
    // DALL-E requires a square image for edits, or a mask for non-square.
    // For simplicity without masking, we'll ask for a square output.
    // Alternatively, we can try sending the original aspect ratio and see if DALL-E handles it for edits without a mask.
    // The documentation says: "The image to edit. Must be a valid PNG file, less than 4MB, and square."
    // If non-square, a transparent mask is needed.
    // Let's try sending it as "1024x1024" and rely on the prompt for content.
    // This might crop or letterbox the original.
    const size = "1024x1024"; // DALL-E image edits API requires square images or a mask.

    const formData = new FormData();
    formData.append('image', imageBlob, 'original_image.png'); // Ensure it's treated as PNG
    formData.append('prompt', refinementPrompt); // Prompt describing the *full desired image*
    formData.append('model', "dall-e-2"); // DALL-E 2 is used for edits/variations
    formData.append('n', '1');
    formData.append('size', size);
    formData.append('response_format', 'b64_json');

    const apiURL = "https://api.openai.com/v1/images/edits";

    try {
        const response = await fetch(apiURL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${effectiveApiKey}`
                // Content-Type is set automatically by FormData
            },
            body: formData,
            signal: signal,
        });

        if (!response.ok) {
           throw await handleOpenAIError(response, signal);
        }

        const responseData: DallEResponse = await response.json();
        if (responseData.data && responseData.data.length > 0 && responseData.data[0].b64_json) {
            return `data:image/png;base64,${responseData.data[0].b64_json}`;
        } else {
            console.error("No image data received from DALL-E edits API. Response:", responseData);
            throw new Error("Không nhận được dữ liệu ảnh từ DALL-E Edits API.");
        }
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            throw error;
        }
        const errorMessage = (error instanceof Error) ? error.message : String(error);
        console.error("Failed to edit image with DALL-E (final catch):", errorMessage);
         if (error instanceof Error && (error.message.startsWith("Lỗi từ DALL-E API") || error.message.startsWith("Lỗi xác thực OpenAI API Key") || error.message.startsWith("Lỗi giới hạn request OpenAI"))) {
            throw error; 
        }
        throw new Error(`Không thể tinh chỉnh ảnh DALL-E: ${errorMessage}`);
    }
};