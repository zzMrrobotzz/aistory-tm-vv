// DeepSeek Image Generation Service
import { dataUrlToBlob } from '../utils';

interface DeepSeekImageResponse {
    data: { b64_json: string; revised_prompt?: string; }[]; // Assuming similar structure
    // Add other fields if DeepSeek API has them, e.g., created, usage
}

interface DeepSeekErrorDetail {
    message: string;
    type?: string;
    param?: string | null;
    code?: string | number; // DeepSeek error codes might differ
}

interface DeepSeekErrorResponse {
    error: DeepSeekErrorDetail;
}


const mapAspectRatioToDeepSeekSize = (aspectRatio: string): string => {
    // These are hypothetical sizes for DeepSeek. Adjust if official sizes are known.
    switch (aspectRatio) {
        case "1:1":
            return "1024x1024";
        case "16:9":
            return "1024x576"; // Common 16:9 resolution
        case "9:16":
            return "576x1024"; // Common 9:16 resolution
        default:
            console.warn(`Unsupported aspect ratio for DeepSeek: ${aspectRatio}. Defaulting to 1024x1024.`);
            return "1024x1024";
    }
};

const getEffectiveDeepSeekApiKey = (imageApiKey?: string, generalApiKey?: string): string => {
     const effectiveApiKey =
        imageApiKey ||
        generalApiKey ||
        (typeof window !== 'undefined' ? ((window as any).process?.env?.DEEPSEEK_IMAGE_API_KEY || (window as any).process?.env?.DEEPSEEK_API_KEY)
            : (process.env.DEEPSEEK_IMAGE_API_KEY || process.env.DEEPSEEK_API_KEY));

    if (!effectiveApiKey) {
        throw new Error(
            "DeepSeek API Key không được tìm thấy. " +
            "Vui lòng nhập API Key vào ô 'DeepSeek Image API Key' trong module, " +
            "hoặc cấu hình trong Cài đặt AI chung (nếu DeepSeek là nhà cung cấp AI văn bản và dùng chung key), " +
            "hoặc đặt biến môi trường DEEPSEEK_IMAGE_API_KEY / DEEPSEEK_API_KEY."
        );
    }
    return effectiveApiKey;
};

const handleDeepSeekError = async (response: Response, signal?: AbortSignal, context: 'Image' | 'Text' = 'Image'): Promise<Error> => {
    if (signal?.aborted) return new DOMException('Aborted', 'AbortError');
    let errorDetail: DeepSeekErrorDetail = { message: `Lỗi HTTP ${response.status}: ${response.statusText}` };
    try {
            const errorData: DeepSeekErrorResponse | any = await response.json();
            if (errorData && errorData.error) {
            errorDetail = errorData.error;
            } else if (errorData && errorData.message) { 
            errorDetail.message = errorData.message;
            }
    } catch (e) {
        // Failed to parse JSON error, use status text
    }

    console.error(`DeepSeek ${context} API Error:`, errorDetail);
    let userMessage = `Lỗi từ DeepSeek ${context} API: ${errorDetail.message}`;
    if (errorDetail.code) {
        userMessage += ` (Code: ${errorDetail.code})`;
    }
        if (response.status === 401) {
        userMessage = `Lỗi xác thực DeepSeek API Key. Vui lòng kiểm tra lại API Key của bạn.`;
    } else if (response.status === 429 || (typeof errorDetail.code === 'string' && errorDetail.code.toLowerCase().includes('limit')) || (errorDetail.message.toLowerCase().includes('quota')) ) {
        userMessage = `Lỗi giới hạn request DeepSeek (Quota Exceeded hoặc Billing Limit). Vui lòng thử lại sau hoặc kiểm tra hạn ngạch tài khoản.`;
    }
    return new Error(userMessage);
};


export const generateDeepSeekImage = async (
    prompt: string,
    aspectRatio: string,
    imageApiKey?: string, // Key from ImageGenerationSuiteModule
    generalApiKey?: string, // Key from ApiSettingsComponent (if DeepSeek is text provider)
    signal?: AbortSignal
): Promise<string> => {
    const effectiveApiKey = getEffectiveDeepSeekApiKey(imageApiKey, generalApiKey);
    const size = mapAspectRatioToDeepSeekSize(aspectRatio);
    
    // Use backend proxy to avoid CORS issues
    const backendApiURL = import.meta.env.VITE_API_URL || 'https://aistory-backend.onrender.com/api';
    const apiURL = `${backendApiURL}/ai/generate-image`; 
    const modelName = "deepseek-image";

    try {
        // Get session token for backend authentication
        const sessionToken = localStorage.getItem('userToken');
        
        const response = await fetch(apiURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`,
                'x-session-token': sessionToken || ''
            },
            body: JSON.stringify({
                prompt: prompt,
                provider: 'deepseek',
                size: size,
                n: 1,
                model: modelName,
                apiKey: effectiveApiKey
            }),
            signal: signal,
        });

        if (!response.ok) {
           const errorData = await response.json().catch(() => ({}));
           throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const responseData = await response.json();

        if (responseData.success && responseData.imageUrl) {
            return responseData.imageUrl;
        } else {
            console.error("No image data received from backend proxy. Response:", responseData);
            throw new Error(responseData.message || "Không nhận được dữ liệu ảnh từ backend proxy.");
        }

    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            throw error;
        }
        console.error("Failed to generate image with DeepSeek:", error);
         if (error instanceof Error && (error.message.startsWith("Lỗi từ DeepSeek") || error.message.startsWith("Lỗi xác thực DeepSeek"))) {
            throw error; 
        }
        
        let detailedErrorMessage = `Không thể tạo ảnh DeepSeek: ${(error as Error).message}`;
        if ((error as Error).message.toLowerCase().includes('failed to fetch')) {
             detailedErrorMessage = "Lỗi kết nối mạng khi gọi DeepSeek Image API. Vui lòng kiểm tra kết nối và thử lại. Nếu sự cố vẫn tiếp diễn, API endpoint của DeepSeek có thể đã thay đổi hoặc dịch vụ đang gặp sự cố.";
        }
        throw new Error(detailedErrorMessage);
    }
};


export const refineDeepSeekImage = async (
    originalImageDataBase64: string, // Base64 string of original image
    mimeType: string, // e.g. "image/png"
    refinementPrompt: string,
    aspectRatio: string, // To determine output 'size'
    imageApiKey?: string,
    generalApiKey?: string,
    signal?: AbortSignal
): Promise<string> => { // Returns base64 data URL of the new image
    const effectiveApiKey = getEffectiveDeepSeekApiKey(imageApiKey, generalApiKey);
    
    // ASSUMPTION: DeepSeek might have an image edit endpoint similar to DALL-E.
    const apiURLEdit = "https://api.deepseek.com/v1/images/edits"; 
    const modelNameEdit = "deepseek-image-edit"; 
    
    const imageBlob = await dataUrlToBlob(`data:${mimeType};base64,${originalImageDataBase64}`);
    const size = mapAspectRatioToDeepSeekSize(aspectRatio);

    const formData = new FormData();
    formData.append('image', imageBlob, 'original_image.png');
    formData.append('prompt', refinementPrompt);
    formData.append('model', modelNameEdit);
    formData.append('n', '1'); 
    formData.append('size', size);
    formData.append('response_format', 'b64_json');

    try {
        const response = await fetch(apiURLEdit, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${effectiveApiKey}`
            },
            body: formData,
            signal: signal,
        });

        if (!response.ok) {
            throw await handleDeepSeekError(response, signal, 'Image');
        }

        const responseData: DeepSeekImageResponse = await response.json();
        if (responseData.data && responseData.data.length > 0 && responseData.data[0].b64_json) {
            return `data:image/png;base64,${responseData.data[0].b64_json}`;
        } else {
            console.error("No image data received from DeepSeek (edits) API. Response:", responseData);
            throw new Error("Không nhận được dữ liệu ảnh từ DeepSeek (edits) API.");
        }
    } catch (error) {
       if (error instanceof DOMException && error.name === 'AbortError') {
            throw error;
        }
        console.error("Failed to refine image with DeepSeek:", error);

        if (error instanceof Error && (error.message.startsWith("Lỗi từ DeepSeek") || error.message.startsWith("Lỗi xác thực DeepSeek"))) {
            throw error; 
        }

        let detailedErrorMessage = `Không thể tinh chỉnh ảnh DeepSeek: ${(error as Error).message}`;
        if ((error as Error).message.toLowerCase().includes('failed to fetch')) {
            detailedErrorMessage = `Lỗi kết nối mạng khi gọi DeepSeek Image Edit API. Chức năng này có thể không được hỗ trợ hoặc API endpoint đã thay đổi.`;
        }
        throw new Error(detailedErrorMessage);
    }
};

// --- START: Text Generation Functions for DeepSeek ---

const getEffectiveDeepSeekApiKeyForText = (apiKey?: string): string => {
    const effectiveApiKey = apiKey || (typeof window !== 'undefined' ? (window as any).process?.env?.DEEPSEEK_API_KEY : process.env.DEEPSEEK_API_KEY);

    if (!effectiveApiKey) {
        throw new Error(
            "DeepSeek API Key không được tìm thấy. " +
            "Vui lòng cấu hình trong Cài đặt AI chung hoặc đặt biến môi trường DEEPSEEK_API_KEY."
        );
    }
    return effectiveApiKey;
};

export const generateText = async (
    prompt: string,
    systemInstruction?: string,
    apiKey?: string,
    signal?: AbortSignal
): Promise<string> => {
    const effectiveApiKey = getEffectiveDeepSeekApiKeyForText(apiKey);
    const apiURL = "https://api.deepseek.com/v1/chat/completions";
    const modelName = "deepseek-chat";

    const messages: {role: string, content: string}[] = [];
    if (systemInstruction) {
        messages.push({ role: "system", content: systemInstruction });
    }
    messages.push({ role: "user", content: prompt });

    try {
        const response = await fetch(apiURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${effectiveApiKey}`
            },
            body: JSON.stringify({
                model: modelName,
                messages: messages,
            }),
            signal: signal,
        });

        if (!response.ok) {
           throw await handleDeepSeekError(response, signal, 'Text');
        }

        const responseData = await response.json();

        if (responseData.choices && responseData.choices.length > 0 && responseData.choices[0].message?.content) {
            return responseData.choices[0].message.content;
        } else {
            console.error("No text content received from DeepSeek API. Response:", responseData);
            throw new Error("Không nhận được nội dung văn bản từ DeepSeek API.");
        }
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            throw error;
        }
        console.error("Failed to generate text with DeepSeek:", error);
        if (error instanceof Error && (error.message.startsWith("Lỗi từ DeepSeek") || error.message.startsWith("Lỗi xác thực DeepSeek"))) {
            throw error; 
        }
        throw new Error(`Không thể tạo văn bản với DeepSeek: ${(error as Error).message}`);
    }
};

export const generateTextWithJsonOutput = async <T,>(
    prompt: string,
    apiKey?: string,
    signal?: AbortSignal
): Promise<T> => {
    const effectiveApiKey = getEffectiveDeepSeekApiKeyForText(apiKey);
    const apiURL = "https://api.deepseek.com/v1/chat/completions";
    const modelName = "deepseek-chat";

    try {
        const response = await fetch(apiURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${effectiveApiKey}`
            },
            body: JSON.stringify({
                model: modelName,
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" }
            }),
            signal: signal,
        });

        if (!response.ok) {
           throw await handleDeepSeekError(response, signal, 'Text');
        }

        const responseData = await response.json();

        if (responseData.choices && responseData.choices.length > 0 && responseData.choices[0].message?.content) {
            const jsonStr = responseData.choices[0].message.content;
            try {
                return JSON.parse(jsonStr) as T;
            } catch (e) {
                console.error("Failed to parse JSON response from DeepSeek:", jsonStr, e);
                throw new Error(`DeepSeek API returned invalid JSON: ${(e as Error).message}. Raw response: ${jsonStr}`);
            }
        } else {
            console.error("No text content received from DeepSeek API for JSON output. Response:", responseData);
            throw new Error("Không nhận được nội dung JSON từ DeepSeek API.");
        }
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            throw error;
        }
        console.error("Failed to generate JSON with DeepSeek:", error);
        if (error instanceof Error && (error.message.startsWith("Lỗi từ DeepSeek") || error.message.startsWith("Lỗi xác thực DeepSeek"))) {
            throw error;
        }
        throw new Error(`Không thể tạo JSON với DeepSeek: ${(error as Error).message}`);
    }
};

// --- END: Text Generation Functions for DeepSeek ---