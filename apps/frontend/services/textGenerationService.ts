
import { ApiSettings, GroundingChunk } from '../types';
import * as geminiService from './geminiService';
import * as deepseekService from './deepseekService';
import { ApiKeyStorage } from '../utils/apiKeyStorage';

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
  // If no apiSettings provided, load from storage
  let effectiveApiSettings = apiSettings;
  if (!effectiveApiSettings) {
    const activeKeys = ApiKeyStorage.getActiveApiSettings();
    if (activeKeys.deepseek) {
      effectiveApiSettings = { provider: 'deepseek', apiKey: activeKeys.deepseek };
    } else {
      effectiveApiSettings = { provider: 'gemini', apiKey: activeKeys.gemini || '' };
    }
  }

  // Use DeepSeek if explicitly chosen and has key
  if (effectiveApiSettings?.provider === 'deepseek' && effectiveApiSettings.apiKey) {
    if (useGoogleSearch) {
      console.warn("DeepSeek does not support Google Search grounding. Proceeding without it.");
    }
    // Update last used timestamp
    ApiKeyStorage.updateLastUsed('deepseek');
    const text = await deepseekService.generateText(prompt, systemInstruction, effectiveApiSettings.apiKey);
    return { text, groundingChunks: undefined };
  }
  
  // Default to Gemini for all other cases
  if (effectiveApiSettings?.apiKey) {
    ApiKeyStorage.updateLastUsed('gemini');
  }
  return geminiService.generateText(prompt, systemInstruction, useGoogleSearch, effectiveApiSettings?.apiKey);
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
  // If no apiSettings provided, load from storage
  let effectiveApiSettings = apiSettings;
  if (!effectiveApiSettings) {
    const activeKeys = ApiKeyStorage.getActiveApiSettings();
    if (activeKeys.deepseek) {
      effectiveApiSettings = { provider: 'deepseek', apiKey: activeKeys.deepseek };
    } else {
      effectiveApiSettings = { provider: 'gemini', apiKey: activeKeys.gemini || '' };
    }
  }

  // Use DeepSeek if explicitly chosen and has key
  if (effectiveApiSettings?.provider === 'deepseek' && effectiveApiSettings.apiKey) {
    // Update last used timestamp
    ApiKeyStorage.updateLastUsed('deepseek');
    // DeepSeek doesn't support systemInstruction parameter, merge it with prompt if provided
    const combinedPrompt = systemInstruction 
      ? `${systemInstruction}\n\n${prompt}` 
      : prompt;
    return deepseekService.generateTextWithJsonOutput<T>(combinedPrompt, effectiveApiSettings.apiKey);
  }

  // Default to Gemini for all other cases
  if (effectiveApiSettings?.apiKey) {
    ApiKeyStorage.updateLastUsed('gemini');
  }
  return geminiService.generateTextWithJsonOutput<T>(prompt, systemInstruction, effectiveApiSettings?.apiKey);
};
