
import { ApiSettings, GroundingChunk } from '../types';
import * as geminiService from './geminiService';
import * as deepseekService from './deepseekService';
import { ApiKeyStorage } from '../utils/apiKeyStorage';
import { checkRateLimit, recordUsage, isModuleRestricted } from './rateLimitService';

/**
 * Generates text from a prompt, dispatching to the correct service based on ApiSettings.
 * Normalizes the return type to always include a `text` and optional `groundingChunks`.
 * Includes rate limiting for restricted modules.
 * @param prompt The main text prompt.
 * @param systemInstruction An optional system-level instruction for the model.
 * @param useGoogleSearch Whether to enable Google Search grounding (Gemini only).
 * @param apiSettings The user's current API settings, determining the provider and key.
 * @param moduleId Optional module ID for rate limiting (write-story, batch-story-writing, rewrite, batch-rewrite).
 * @returns A promise that resolves to an object with the generated text and optional grounding chunks.
 */
export const generateText = async (
  prompt: string,
  systemInstruction?: string,
  useGoogleSearch?: boolean,
  apiSettings?: ApiSettings,
  moduleId?: string
): Promise<{ text: string; groundingChunks?: GroundingChunk[] }> => {
  // Check rate limiting for restricted modules
  if (moduleId && isModuleRestricted(moduleId)) {
    try {
      const rateLimitCheck = await checkRateLimit(moduleId);
      
      if (!rateLimitCheck.canProceed) {
        throw new Error(rateLimitCheck.errorMessage || 'Đã vượt quá giới hạn requests hàng ngày');
      }
      
      // Show warning if usage is high
      if (rateLimitCheck.warning) {
        console.warn(`Usage warning: ${rateLimitCheck.warning.message}`);
        // You can emit this to UI components if needed
        window.dispatchEvent(new CustomEvent('usage-warning', { 
          detail: rateLimitCheck.warning 
        }));
      }
    } catch (error) {
      console.error('Rate limit check failed:', error);
      // Don't prevent request if rate limit check fails, just log the error
    }
  }

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

  let result: { text: string; groundingChunks?: GroundingChunk[] };

  // Use DeepSeek if explicitly chosen and has key
  if (effectiveApiSettings?.provider === 'deepseek' && effectiveApiSettings.apiKey) {
    if (useGoogleSearch) {
      console.warn("DeepSeek does not support Google Search grounding. Proceeding without it.");
    }
    // Update last used timestamp
    ApiKeyStorage.updateLastUsed('deepseek');
    const text = await deepseekService.generateText(prompt, systemInstruction, effectiveApiSettings.apiKey);
    result = { text, groundingChunks: undefined };
  } else {
    // Default to Gemini for all other cases
    if (effectiveApiSettings?.apiKey) {
      ApiKeyStorage.updateLastUsed('gemini');
    }
    result = await geminiService.generateText(prompt, systemInstruction, useGoogleSearch, effectiveApiSettings?.apiKey);
  }

  // Record usage after successful API call (for restricted modules only)
  if (moduleId && isModuleRestricted(moduleId) && result.text) {
    try {
      await recordUsage(moduleId);
    } catch (error) {
      console.error('Failed to record usage:', error);
      // Don't fail the request if usage recording fails
    }
  }

  return result;
};

/**
 * Generates text from a prompt and expects a JSON object as output.
 * Dispatches to the correct service based on ApiSettings.
 * Includes rate limiting for restricted modules.
 * @param prompt The main text prompt.
 * @param systemInstruction An optional system-level instruction for the model.
 * @param apiSettings The user's current API settings, determining the provider and key.
 * @param moduleId Optional module ID for rate limiting (write-story, batch-story-writing, rewrite, batch-rewrite).
 * @returns A promise that resolves to the parsed JSON object of type T.
 */
export const generateTextWithJsonOutput = async <T,>(
  prompt: string,
  systemInstruction?: string,
  apiSettings?: ApiSettings,
  moduleId?: string
): Promise<T> => {
  // Check rate limiting for restricted modules
  if (moduleId && isModuleRestricted(moduleId)) {
    try {
      const rateLimitCheck = await checkRateLimit(moduleId);
      
      if (!rateLimitCheck.canProceed) {
        throw new Error(rateLimitCheck.errorMessage || 'Đã vượt quá giới hạn requests hàng ngày');
      }
      
      // Show warning if usage is high
      if (rateLimitCheck.warning) {
        console.warn(`Usage warning: ${rateLimitCheck.warning.message}`);
        window.dispatchEvent(new CustomEvent('usage-warning', { 
          detail: rateLimitCheck.warning 
        }));
      }
    } catch (error) {
      console.error('Rate limit check failed:', error);
      // Don't prevent request if rate limit check fails, just log the error
    }
  }

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

  let result: T;

  // Use DeepSeek if explicitly chosen and has key
  if (effectiveApiSettings?.provider === 'deepseek' && effectiveApiSettings.apiKey) {
    // Update last used timestamp
    ApiKeyStorage.updateLastUsed('deepseek');
    // DeepSeek doesn't support systemInstruction parameter, merge it with prompt if provided
    const combinedPrompt = systemInstruction 
      ? `${systemInstruction}\n\n${prompt}` 
      : prompt;
    result = await deepseekService.generateTextWithJsonOutput<T>(combinedPrompt, effectiveApiSettings.apiKey);
  } else {
    // Default to Gemini for all other cases
    if (effectiveApiSettings?.apiKey) {
      ApiKeyStorage.updateLastUsed('gemini');
    }
    result = await geminiService.generateTextWithJsonOutput<T>(prompt, systemInstruction, effectiveApiSettings?.apiKey);
  }

  // Record usage after successful API call (for restricted modules only)
  if (moduleId && isModuleRestricted(moduleId) && result) {
    try {
      await recordUsage(moduleId);
    } catch (error) {
      console.error('Failed to record usage:', error);
      // Don't fail the request if usage recording fails
    }
  }

  return result;
};
