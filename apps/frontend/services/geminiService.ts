
import { GoogleGenAI, GenerateContentResponse, GenerateContentParameters, Part, GroundingChunk as GenAIGroundingChunk } from "@google/genai";
import { MODEL_TEXT, MODEL_IMAGE, GroundingChunk } from '../types';

const getEnvApiKey = () => {
  // No longer check environment variables - API keys are managed through ApiKeyStorage
  return null;
};

let ai: GoogleGenAI | null = null;
let lastUsedEffectiveApiKey: string | undefined = undefined;


const getAIInstance = (userApiKey?: string): GoogleGenAI => {
  const effectiveApiKey = userApiKey && userApiKey.trim() !== "" ? userApiKey.trim() : null;

  if (!effectiveApiKey) {
    throw new Error("Invalid or missing Gemini API Key. Please configure your API key in the settings panel.");
  }

  if (!ai || effectiveApiKey !== lastUsedEffectiveApiKey) {
    try {
      ai = new GoogleGenAI({ apiKey: effectiveApiKey });
      lastUsedEffectiveApiKey = effectiveApiKey;
    } catch (error) {
       console.error("Failed to initialize GoogleGenAI:", error);
       throw new Error(`Failed to initialize GoogleGenAI. Ensure the effective API_KEY is valid. Error: ${(error as Error).message}`);
    }
  }
  return ai;
};

export const generateText = async (
  prompt: string, 
  systemInstruction?: string,
  useGoogleSearch?: boolean,
  geminiUserApiKey?: string // Added to accept user-provided key
): Promise<{text: string, groundingChunks?: GroundingChunk[]}> => {
  try {
    const aiInstance = getAIInstance(geminiUserApiKey); // Pass user key to instance getter
    const contents: Part[] = [{ text: prompt }];
    
    const request: GenerateContentParameters = {
      model: MODEL_TEXT,
      contents: { role: 'user', parts: contents },
      config: {},
    };

    if (systemInstruction && request.config) {
      request.config.systemInstruction = systemInstruction;
    }
    
    if (useGoogleSearch && request.config) {
        request.config.tools = [{googleSearch: {}}];
        if (request.config.responseMimeType === "application/json") {
            delete request.config.responseMimeType;
        }
    }

    const response: GenerateContentResponse = await aiInstance.models.generateContent(request);
    
    const text = response.text;
    let groundingChunks: GroundingChunk[] | undefined = undefined;

    if (useGoogleSearch && response.candidates && response.candidates[0]?.groundingMetadata?.groundingChunks) {
        groundingChunks = response.candidates[0].groundingMetadata.groundingChunks
            .filter((chunk: GenAIGroundingChunk) => chunk.web && chunk.web.uri && chunk.web.title)
            .map((chunk: GenAIGroundingChunk) => ({
                web: {
                    uri: chunk.web!.uri!,
                    title: chunk.web!.title!,
                }
            }));
    }
    
    return { text, groundingChunks };

  } catch (error) {
    console.error("Error generating text with Gemini:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    if (errorMessage.toLowerCase().includes("api key not valid") || errorMessage.toLowerCase().includes("api_key_invalid")) {
        throw new Error("Invalid Gemini API Key. Please check your configuration.");
    }
    throw new Error(`Gemini API text generation failed: ${errorMessage}`);
  }
};


export const generateTextWithJsonOutput = async <T,>(prompt: string, systemInstruction?: string, geminiUserApiKey?: string): Promise<T> => {
  try {
    const aiInstance = getAIInstance(geminiUserApiKey); // Pass user key
    const contents: Part[] = [{ text: prompt }];
    
    const request: GenerateContentParameters = {
      model: MODEL_TEXT,
      contents: { role: 'user', parts: contents },
      config: {
        responseMimeType: "application/json",
      },
    };

    if (systemInstruction && request.config) {
      request.config.systemInstruction = systemInstruction;
    }

    const response: GenerateContentResponse = await aiInstance.models.generateContent(request);
    let jsonStr = response.text.trim();

    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    
    try {
      return JSON.parse(jsonStr) as T;
    } catch (e) {
      console.error("Failed to parse JSON response from Gemini:", jsonStr, e);
      throw new Error(`Gemini API returned invalid JSON: ${(e as Error).message}. Raw response: ${jsonStr}`);
    }

  } catch (error) {
    console.error("Error generating JSON with Gemini:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
     if (errorMessage.toLowerCase().includes("api key not valid") || errorMessage.toLowerCase().includes("api_key_invalid")) {
        throw new Error("Invalid Gemini API Key. Please check your configuration.");
    }
    throw new Error(`Gemini API JSON generation failed: ${errorMessage}`);
  }
};


export const generateImage = async (prompt: string, aspectRatio: string = "16:9", geminiUserApiKey?: string): Promise<string> => {
  try {
    const aiInstance = getAIInstance(geminiUserApiKey); // Pass user key
    
    const response = await aiInstance.models.generateImages({
        model: MODEL_IMAGE,
        prompt: prompt, // Use the direct prompt from the user
        config: { 
            numberOfImages: 1, 
            outputMimeType: 'image/png',
            aspectRatio: aspectRatio // Pass aspectRatio directly in config
        }
    });

    if (response.generatedImages && response.generatedImages.length > 0 && response.generatedImages[0].image?.imageBytes) {
      return response.generatedImages[0].image.imageBytes;
    } else {
      console.error("No image data received from Gemini API. Response:", response);
      throw new Error("No image data received from Gemini API.");
    }
  } catch (error) {
    console.error("Error generating image with Gemini:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
     if (errorMessage.toLowerCase().includes("api key not valid") || errorMessage.toLowerCase().includes("api_key_invalid")) {
        throw new Error("Invalid Gemini API Key. Please check your configuration.");
    }
    // Handle billing-related errors specifically
    if (errorMessage.toLowerCase().includes("imagen api is only accessible to billed users") || 
        errorMessage.toLowerCase().includes("billing")) {
        throw new Error("Gemini Imagen API yêu cầu tài khoản có billing được kích hoạt. Vui lòng thiết lập billing cho Google Cloud project của bạn hoặc sử dụng engine khác như Stability AI.");
    }
    throw new Error(`Gemini API image generation failed: ${errorMessage}`);
  }
};

/**
 * Generates textual content (like a detailed image prompt) from an image and a text prompt using a multimodal model.
 * This is part 1 of a two-step image refinement process for Gemini.
 */
export const generateTextFromImageAndText = async (
  base64ImageData: string,
  mimeType: string, // e.g., 'image/png', 'image/jpeg'
  textPrompt: string,
  systemInstruction?: string,
  geminiUserApiKey?: string
): Promise<string> => {
  try {
    const aiInstance = getAIInstance(geminiUserApiKey);
    const imagePart = {
      inlineData: {
        data: base64ImageData,
        mimeType: mimeType,
      },
    };
    const textPart = { text: textPrompt };

    const request: GenerateContentParameters = {
      model: MODEL_TEXT, // Use multimodal text model
      contents: { role: 'user', parts: [imagePart, textPart] },
      config: {},
    };

    if (systemInstruction && request.config) {
      request.config.systemInstruction = systemInstruction;
    }
    
    const response: GenerateContentResponse = await aiInstance.models.generateContent(request);
    return response.text;

  } catch (error) {
    console.error("Error generating text from image and text with Gemini:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    if (errorMessage.toLowerCase().includes("api key not valid") || errorMessage.toLowerCase().includes("api_key_invalid")) {
        throw new Error("Invalid Gemini API Key. Please check your configuration.");
    }
    throw new Error(`Gemini API text from image+text generation failed: ${errorMessage}`);
  }
};
