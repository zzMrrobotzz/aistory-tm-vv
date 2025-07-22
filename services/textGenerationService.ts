
import { ApiSettings, GroundingChunk } from '../types';
import * as geminiService from './geminiService';
import * as deepseekService from './deepseekService';

/**
 * Generates text from a prompt, dispatching to the correct service based on ApiSettings.
 * Normalizes the return type to always include a `text` and optional `groundingChunks`.
 * @param prompt The main text prompt.
 * @param systemInstruction An optional system-level instruction for the model.
 * @param useGoogleSearch Whether to enable Google Search grounding (Gemini only).
 * @param apiSettings The user's current API settings, determining the provider and key.
 * @returns A promise that resolves to an object with the generated text and optional grounding chunks.
 */
export const generateText = async (
  prompt: string,
  systemInstruction?: string,
  useGoogleSearch?: boolean,
  apiSettings?: ApiSettings
): Promise<{ text: string; groundingChunks?: GroundingChunk[] }> => {
  // Default to Gemini if DeepSeek is not explicitly chosen and configured
  if (apiSettings?.provider === 'deepseek' && apiSettings.apiKey) {
    if (useGoogleSearch) {
      console.warn("DeepSeek does not support Google Search grounding. Proceeding without it.");
    }
    const text = await deepseekService.generateText(prompt, systemInstruction, apiSettings.apiKey);
    return { text, groundingChunks: undefined };
  }
  
  // Default to Gemini for all other cases
  return geminiService.generateText(prompt, systemInstruction, useGoogleSearch, apiSettings?.apiKey);
};

/**
 * Generates text from a prompt and expects a JSON object as output.
 * Dispatches to the correct service based on ApiSettings.
 * @param prompt The main text prompt.
 * @param systemInstruction An optional system-level instruction for the model.
 * @param apiSettings The user's current API settings, determining the provider and key.
 * @returns A promise that resolves to the parsed JSON object of type T.
 */
export const generateTextWithJsonOutput = async <T,>(
  prompt: string,
  systemInstruction?: string,
  apiSettings?: ApiSettings
): Promise<T> => {
   // Default to Gemini if DeepSeek is not explicitly chosen and configured
  if (apiSettings?.provider === 'deepseek' && apiSettings.apiKey) {
    return deepseekService.generateTextWithJsonOutput<T>(prompt, apiSettings.apiKey);
  }

  // Default to Gemini for all other cases
  return geminiService.generateTextWithJsonOutput<T>(prompt, systemInstruction, apiSettings?.apiKey);
};
