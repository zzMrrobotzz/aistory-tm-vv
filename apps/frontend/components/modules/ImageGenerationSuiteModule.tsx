
import React, { useState, useEffect } from 'react';
import { 
    ApiSettings, 
    ImageGenerationSuiteModuleState, 
    ImageGenerationEngine, 
    GeneratedImageItem,
    ImageGenerationSuiteActiveTab,
    GeminiSubPromptsResponse,
    UserProfile
} from '../../types';
import { ASPECT_RATIO_OPTIONS, STABILITY_STYLE_PRESETS, IMAGE_GENERATION_ENGINE_OPTIONS, PREDEFINED_ART_STYLES, HOOK_LANGUAGE_OPTIONS } from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { generateTextWithJsonOutput as geminiGenerateTextWithJsonOutput, generateImage as generateGeminiImage, generateTextFromImageAndText } from '../../services/geminiService';
import { generateTextWithJsonOutput } from '../../services/textGenerationService';
import { generateStabilityImage, refineStabilityImage } from '../../services/stabilityAiService';
import { generateDallEImage, editDallEImage } from '../../services/openaiService'; 
import { generateDeepSeekImage, refineDeepSeekImage } from '../../services/deepseekService'; 
import { delay, dataUrlToBlob, isSubscribed } from '../../utils'; 
import UpgradePrompt from '../UpgradePrompt';
import { logApiCall, logImageGenerated } from '../../services/usageService';
import { ApiKeyStorage } from '../../utils/apiKeyStorage';

interface ImageGenerationSuiteModuleProps {
  apiSettings: ApiSettings;
  moduleState: ImageGenerationSuiteModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<ImageGenerationSuiteModuleState>>;
  currentUser: UserProfile | null;
}

// Helper to convert base64 URL to pure base64 string and mime type
const parseDataUrl = (dataUrl: string): { base64: string; mimeType: string } | null => {
    const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return null;
    return { mimeType: match[1], base64: match[2] };
};


const ImageGenerationSuiteModule: React.FC<ImageGenerationSuiteModuleProps> = ({
  apiSettings, moduleState, setModuleState, currentUser
}) => {
  const hasActiveSubscription = isSubscribed(currentUser);
  const {
    activeTab, selectedArtStyle, aspectRatio, imageEngine, imageCount,
    stabilityApiKey, chatGptApiKey, deepSeekImageApiKey, 
    stabilityStyle, stabilityNegativePrompt,
    hookText, generatedSingleImages, singleImageOverallError, singleImageProgressMessage,
    promptsInput, generatedBatchImages, batchOverallError, batchProgressMessage,
    hookTextForCtxPrompts, generatedCtxPrompts, ctxPromptsError, ctxPromptsLoadingMessage, // New state for prompt generator
    settingsError,
    // Refinement state
    showRefinementModal, activeRefinementItem, refinementPrompt, isRefining, refinementError
  } = moduleState;

  const updateState = (updates: Partial<ImageGenerationSuiteModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };
  
  const [isProcessing, setIsProcessing] = useState(false); 

  const geminiUserApiKey = apiSettings.provider === 'gemini' ? apiSettings.apiKey : undefined;
  const deepseekGeneralApiKey = apiSettings.provider === 'deepseek' ? apiSettings.apiKey : undefined;
  
  // Get API keys from storage for image generation
  const activeApiKeys = ApiKeyStorage.getActiveApiSettings();
  const effectiveDeepSeekKey = deepSeekImageApiKey?.trim() || deepseekGeneralApiKey || activeApiKeys.deepseek;
  const effectiveStabilityKey = stabilityApiKey?.trim() || activeApiKeys.stability;
  const effectiveChatGptKey = chatGptApiKey?.trim() || activeApiKeys.openai;
  
  // Cleanup object URLs on unmount or when images change
  useEffect(() => {
    const allImageUrls = [...generatedSingleImages, ...generatedBatchImages].map(item => item.imageUrl).filter(Boolean) as string[];
    return () => {
      allImageUrls.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
      if (activeRefinementItem?.originalImageDataUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(activeRefinementItem.originalImageDataUrl);
      }
    };
  }, [generatedSingleImages, generatedBatchImages, activeRefinementItem]);

  const generateSubPrompts = async (currentHookText: string, isContextual: boolean): Promise<string[]> => {
    try {
      console.log('generateSubPrompts started', { currentHookText: currentHookText?.length, isContextual });
      const styleInfo = PREDEFINED_ART_STYLES.find(s => s.value === selectedArtStyle);
      const styleKeywordForSubPromptEng = (styleInfo && styleInfo.value !== 'default') ? styleInfo.value.replace(/_/g, ' ') : null;

      let contextualizationInstruction = "";
      if (isContextual) {
          contextualizationInstruction = `
          **CONTEXTUALIZATION INSTRUCTION (CRITICAL):**
          1. First, carefully identify the primary language of the "Story Hook / Content" provided below.
          2. THEN, based on the identified language, apply the following contextualization to the ENGLISH image prompts you generate:
              - **IF the primary language is Vietnamese (Tiếng Việt):** Generate English image prompts that incorporate elements reflecting Vietnamese culture, settings (e.g., Vietnamese landscapes, traditional houses, bustling city scenes like Hanoi or Saigon with specific landmarks if appropriate), characters (e.g., traditional attire like 'áo dài', 'nón lá' if contextually fitting, or modern Vietnamese fashion), objects, or social customs. The goal is to make the images feel authentic to a Vietnamese setting and narrative.
              - **IF the primary language is Korean (한국어):** Generate English image prompts that incorporate elements reflecting Korean culture, settings (e.g., Korean cityscapes like Seoul with Namsan Tower, traditional hanok villages, serene temples), characters (e.g., modern K-fashion, K-drama inspired looks, or traditional 'hanbok' if appropriate for the story's period), objects (e.g., specific Korean foods, items from K-dramas), or social customs. The goal is to make the images feel authentic to a Korean setting and narrative.
              - **IF the primary language is English or any other language not specified above:** Generate general English image prompts without specific cultural contextualization, unless the story content itself strongly implies a specific culture (e.g., a story explicitly set in ancient Rome). In such cases, use the story's implied cultural context.
          This contextualization should be subtle and natural, fitting the story's narrative and tone. Do not force cultural elements if they feel out of place for the specific scene.`;
      } else {
          contextualizationInstruction = `
          **CONTEXTUALIZATION INSTRUCTION:** Generate general English image prompts based on the content.`;
      }
      
      let styleInstructionForLLM = "";
      if (styleKeywordForSubPromptEng) {
          styleInstructionForLLM = `\n**CRITICAL STYLE INSTRUCTION:** For each generated prompt, you MUST incorporate the art style: "${styleKeywordForSubPromptEng}". For example, if the style is "anime style", a prompt might be "A character looking at a sunset, in an anime style".`;
      } else {
          styleInstructionForLLM = `\n**CRITICAL STYLE INSTRUCTION:** The art style is "Mặc định (AI tự quyết)". DO NOT add any specific art style keywords to the prompts; let the image model decide based on the prompt's content.`;
      }

      const subPromptsGenerationPrompt = `
      You are an AI expert at converting story hooks or full narratives into a sequence of visual image prompts.
      Analyze the following "Story Hook / Content".
      Your goal is to identify distinct visual scenes, moments, or key elements within this content.
      For these identified elements, generate a dynamic number of detailed image prompts. The number of prompts should be based on the richness and visual potential of the input content.
      Each generated image prompt MUST BE IN ENGLISH.
      ${contextualizationInstruction}
      ${styleInstructionForLLM}

      Story Hook / Content:
      ---
      ${currentHookText}
      ---

      Return your entire response as a single JSON object with a single key "image_prompts".
      The value for "image_prompts" should be an array of strings, where each string is a complete image prompt.
      
      Example (if style was "vintage photo" and input implied 2 scenes, and input language was Korean):
      {
        "image_prompts": [
          "A young woman in a modernized hanbok walking through a neon-lit Seoul street at night, reflections in puddles, vintage photo style",
          "A traditional Korean tea ceremony in a serene hanok courtyard, details of porcelain, vintage photo style"
        ]
      }
      Example (if style was "watercolor painting" and input language was Vietnamese):
      {
        "image_prompts": [
          "A young woman in an ao dai standing by a lotus pond at sunset, serene Vietnamese countryside, watercolor painting style",
          "A bustling Hoan Kiem Lake scene with a red Huc bridge in the background, watercolor painting style"
        ]
      }
      Example (if style was "photorealistic" and input language was English, non-specific context):
      {
        "image_prompts": [
          "A detective examining clues in a dimly lit, cluttered office, rain streaking down the window, photorealistic style",
          "A vast, alien desert landscape under a twin-sun sky, a lone rover in the distance, photorealistic style"
        ]
      }

      Do not include any other text or explanation outside this JSON structure. Ensure the output is valid JSON.
      The number of prompts in the array should reflect the visual storytelling potential of the input. Aim for a reasonable number, e.g., 2-7 prompts.
      `;
      const systemInstructionForSubPrompts = `You are an AI assistant that analyzes text (hooks or stories), identifies key visual scenes, and generates multiple detailed image prompts in English, suitable for AI image generation, formatted as a JSON array. You will apply contextualization and art style instructions as provided.`;
    
      console.log('Calling generateTextWithJsonOutput with apiSettings:', apiSettings);
      const subPromptsResult = await generateTextWithJsonOutput<GeminiSubPromptsResponse>(subPromptsGenerationPrompt, systemInstructionForSubPrompts, apiSettings);
      
      console.log('generateTextWithJsonOutput result:', subPromptsResult);
      if (!subPromptsResult || !subPromptsResult.image_prompts || subPromptsResult.image_prompts.length === 0) {
        throw new Error("Không thể tạo danh sách prompt con từ nội dung được cung cấp.");
      }
      return subPromptsResult.image_prompts;
    } catch (error) {
      console.error('Error in generateSubPrompts:', error);
      throw error;
    }
  };


  const executeImageGenerationFromHook = async (isContextualImageGeneratorTab: boolean) => {
    console.log('🖼️ executeImageGenerationFromHook started', { isContextualImageGeneratorTab, hookTextLength: hookText.length });
    if (!hookText.trim()) {
      updateState({ singleImageOverallError: 'Vui lòng nhập đoạn Hook hoặc Nội dung truyện của bạn.' });
      return;
    }
    if (imageEngine === 'stability' && !effectiveStabilityKey) {
      updateState({ settingsError: 'Vui lòng cấu hình API Key cho Stability AI trong module Cài đặt → Quản Lý API Keys.', singleImageOverallError: null });
      return;
    }
    if (imageEngine === 'chatgpt' && !effectiveChatGptKey) {
      updateState({ settingsError: 'Vui lòng cấu hình API Key cho OpenAI (DALL-E) trong module Cài đặt → Quản Lý API Keys.', singleImageOverallError: null });
      return;
    }
    if (imageEngine === 'deepseek' && !effectiveDeepSeekKey) {
      updateState({ settingsError: 'Vui lòng cấu hình API Key cho DeepSeek trong module Cài đặt → Quản Lý API Keys.', singleImageOverallError: null });
      return;
    }

    console.log('🧹 Clearing previous state and starting image generation');
    updateState({ 
        generatedSingleImages: [], 
        singleImageOverallError: null, 
        singleImageProgressMessage: 'Đang chuẩn bị...', 
        settingsError: null 
    });
    setIsProcessing(true);

    try {
      console.log('📝 Step 1: Generating sub-prompts');
      updateState({singleImageProgressMessage: `Bước 1: Đang phân tích nội dung và tạo danh sách prompt ảnh ${isContextualImageGeneratorTab ? "(Ngữ cảnh Thông minh)" : ""}...`});
      await delay(1000); 
      console.log('🔍 About to call generateSubPrompts with:', { hookText: hookText.length, isContextual: isContextualImageGeneratorTab });
      let subPrompts = await generateSubPrompts(hookText, isContextualImageGeneratorTab);
      console.log('✅ generateSubPrompts completed, got:', subPrompts.length, 'prompts');
      
      // Limit subPrompts to user's imageCount setting
      if (subPrompts.length > imageCount) {
        console.log('✂️ Limiting subPrompts from', subPrompts.length, 'to', imageCount);
        subPrompts = subPrompts.slice(0, imageCount);
      }

      console.log('🎯 Creating initial image items for', subPrompts.length, 'prompts with engine:', imageEngine);
      const initialImages: GeneratedImageItem[] = subPrompts.map(p => ({ promptUsed: p, imageUrl: null, error: null, engine: imageEngine }));
      updateState({ generatedSingleImages: initialImages, singleImageProgressMessage: `Đã tạo ${subPrompts.length} prompt con. Bắt đầu tạo ảnh...` });

      const currentGeneratedImages: GeneratedImageItem[] = [...initialImages];

      console.log('🔄 Starting image generation loop for', subPrompts.length, 'images');
      for (let i = 0; i < subPrompts.length; i++) {
        const currentSubPrompt = subPrompts[i];
        console.log(`🖼️ Generating image ${i + 1}/${subPrompts.length} with engine:`, imageEngine, 'prompt preview:', currentSubPrompt.substring(0,50));
        updateState({ singleImageProgressMessage: `Bước ${i + 2}/${subPrompts.length + 1}: Đang tạo ảnh ${i + 1}/${subPrompts.length} (Prompt: ${currentSubPrompt.substring(0,50)}...)` });
        if (i > 0 || imageEngine === 'google' || imageEngine === 'chatgpt' || imageEngine === 'deepseek') await delay(1500);

        try {
          console.log('🎨 About to call image generation API for engine:', imageEngine);
          let imageUrlResult: string | null = null;
          let dalleRevisedPrompt: string | undefined = undefined;

          if (imageEngine === 'google') {
            const base64Image = await generateGeminiImage(currentSubPrompt, aspectRatio, geminiUserApiKey);
            imageUrlResult = `data:image/png;base64,${base64Image}`;
          } else if (imageEngine === 'stability') {
            if (i === 0) await delay(1000); 
            const imageBlob = await generateStabilityImage(
              effectiveStabilityKey, currentSubPrompt, stabilityStyle, aspectRatio, stabilityNegativePrompt
            );
            imageUrlResult = URL.createObjectURL(imageBlob);
          } else if (imageEngine === 'chatgpt') {
             const resultDallE = await generateDallEImage(currentSubPrompt, aspectRatio, effectiveChatGptKey);
             imageUrlResult = resultDallE;
          } else if (imageEngine === 'deepseek') {
            console.log('🔑 Calling DeepSeek with keys:', { effectiveDeepSeekKey: effectiveDeepSeekKey ? 'present' : 'missing', deepseekGeneralApiKey: deepseekGeneralApiKey ? 'present' : 'missing' });
            imageUrlResult = await generateDeepSeekImage(currentSubPrompt, aspectRatio, effectiveDeepSeekKey, deepseekGeneralApiKey);
            console.log('✅ DeepSeek image generation completed');
          }
          console.log('💾 Updating image result for index', i);
          currentGeneratedImages[i] = { ...currentGeneratedImages[i], imageUrl: imageUrlResult, error: null, dalleRevisedPrompt: dalleRevisedPrompt };
        } catch (imgErr) {
          currentGeneratedImages[i] = { ...currentGeneratedImages[i], imageUrl: null, error: `Lỗi ảnh ${i+1}: ${(imgErr as Error).message}` };
        }
        updateState({ generatedSingleImages: [...currentGeneratedImages] });
      }
      updateState({ singleImageProgressMessage: `Hoàn thành tạo ảnh từ hook/truyện${isContextualImageGeneratorTab ? " (Ngữ cảnh Thông minh)" : ""}!`});
      
      // Log image generation usage
      const imageCount = currentGeneratedImages.filter(img => img.imageUrl).length;
      logApiCall('image-generation-suite', subPrompts.length);
      logImageGenerated('image-generation-suite', imageCount);

    } catch (e) {
      let errorMessage = `Đã xảy ra lỗi: ${(e as Error).message}`;
      if ((e as Error).message.toLowerCase().includes('cors') || (e as Error).message.toLowerCase().includes('failed to fetch')) {
        errorMessage = 'Lỗi kết nối (CORS/Fetch). Điều này có thể do API key Stability không hợp lệ, chính sách bảo mật trình duyệt hoặc vấn đề mạng.';
      }
      updateState({ singleImageOverallError: errorMessage, singleImageProgressMessage: null });
    } finally {
      setIsProcessing(false);
       setTimeout(() => {
        setModuleState(prev => 
            (prev.singleImageProgressMessage?.includes("Hoàn thành tạo ảnh từ hook/truyện") )? 
            {...prev, singleImageProgressMessage: null} : prev
        );
      }, 3000);
    }
  };
  
  const handleGenerateIntelligentContextPromptsOnly = async () => {
    console.log('🚀 handleGenerateIntelligentContextPromptsOnly started');
    if (!hookTextForCtxPrompts.trim()) {
      updateState({ ctxPromptsError: 'Vui lòng nhập đoạn Hook hoặc Nội dung truyện của bạn.' });
      return;
    }
    updateState({ 
        generatedCtxPrompts: [], 
        ctxPromptsError: null, 
        ctxPromptsLoadingMessage: 'Đang phân tích nội dung và tạo danh sách prompt (Ngữ cảnh Thông minh)...', 
    });
    setIsProcessing(true);

    try {
      console.log('📝 About to call generateSubPrompts with:', { hookTextLength: hookTextForCtxPrompts.length, imageCount });
      let subPrompts = await generateSubPrompts(hookTextForCtxPrompts, true); // true for contextual
      console.log('✅ generateSubPrompts returned:', subPrompts);
      
      // Limit subPrompts to user's imageCount setting
      if (subPrompts.length > imageCount) {
        console.log('✂️ Limiting subPrompts from', subPrompts.length, 'to', imageCount);
        subPrompts = subPrompts.slice(0, imageCount);
        console.log('✅ After slice:', subPrompts);
      }
      
      console.log('🔄 About to updateState with subPrompts:', subPrompts.length);
      updateState({ 
          generatedCtxPrompts: subPrompts, 
          ctxPromptsLoadingMessage: `Hoàn thành! Đã tạo ${subPrompts.length} prompt.`,
          ctxPromptsError: null
      });
      console.log('✅ updateState completed successfully');
    } catch (e) {
      console.error('❌ Error in handleGenerateIntelligentContextPromptsOnly:', e);
      updateState({ 
          ctxPromptsError: `Lỗi khi tạo prompts: ${(e as Error).message}`, 
          ctxPromptsLoadingMessage: null 
      });
    } finally {
      console.log('🏁 Setting isProcessing to false');
      setIsProcessing(false);
      setTimeout(() => {
        console.log('🧹 Clearing loading message after 3 seconds');
        setModuleState(prev => 
            (prev.ctxPromptsLoadingMessage?.includes("Hoàn thành!") || prev.ctxPromptsError )? 
            {...prev, ctxPromptsLoadingMessage: null} : prev
        );
      }, 3000);
    }
  };


  const handleGenerateBatchImages = async () => {
    const individualPrompts = promptsInput.split('\n').map(p => p.trim()).filter(p => p !== '');
    if (individualPrompts.length === 0) {
      updateState({ batchOverallError: 'Vui lòng nhập ít nhất một prompt (tiếng Anh).', settingsError: null });
      return;
    }
    if (imageEngine === 'stability' && !effectiveStabilityKey) {
      updateState({ settingsError: 'Vui lòng cấu hình API Key cho Stability AI trong module Cài đặt → Quản Lý API Keys.', batchOverallError: null });
      return;
    }
    if (imageEngine === 'chatgpt' && !effectiveChatGptKey) {
      updateState({ settingsError: 'Vui lòng cấu hình API Key cho OpenAI (DALL-E) trong module Cài đặt → Quản Lý API Keys.', batchOverallError: null });
      return;
    }
    if (imageEngine === 'deepseek' && !effectiveDeepSeekKey) {
      updateState({ settingsError: 'Vui lòng cấu hình API Key cho DeepSeek trong module Cài đặt → Quản Lý API Keys.', batchOverallError: null });
      return;
    }

    updateState({ batchOverallError: null, generatedBatchImages: [], batchProgressMessage: null, settingsError: null });
    setIsProcessing(true);

    const initialGeneratedImages: GeneratedImageItem[] = individualPrompts.map(prompt => ({
      promptUsed: prompt, imageUrl: null, error: null, engine: imageEngine
    }));
    updateState({ generatedBatchImages: initialGeneratedImages });

    const styleInfo = PREDEFINED_ART_STYLES.find(s => s.value === selectedArtStyle);
    const styleKeywordForBatchEng = (styleInfo && styleInfo.value !== 'default') ? styleInfo.value.replace(/_/g, ' ') : null;
    const stylePrefix = styleKeywordForBatchEng ? styleKeywordForBatchEng + ", " : "";

    const newGeneratedImages: GeneratedImageItem[] = [...initialGeneratedImages];

    for (let i = 0; i < individualPrompts.length; i++) {
      const currentPromptText = individualPrompts[i];
      updateState({ batchProgressMessage: `Đang tạo ảnh ${i + 1}/${individualPrompts.length}: "${currentPromptText.substring(0, 50)}..."` });
      
      if (i > 0) await delay(1500); 

      const finalImagePrompt = `${stylePrefix}${currentPromptText}`.trim().replace(/,$/, '');
      newGeneratedImages[i].promptUsed = finalImagePrompt; 

      try {
        let imageUrl: string | null = null;
        let dalleRevisedPrompt: string | undefined = undefined;
        if (imageEngine === 'google') {
          const base64Image = await generateGeminiImage(finalImagePrompt, aspectRatio, geminiUserApiKey);
          imageUrl = `data:image/png;base64,${base64Image}`;
        } else if (imageEngine === 'stability') {
          const imageBlob = await generateStabilityImage(
            effectiveStabilityKey, finalImagePrompt, stabilityStyle, aspectRatio, stabilityNegativePrompt
          );
          imageUrl = URL.createObjectURL(imageBlob);
        } else if (imageEngine === 'chatgpt') {
           const resultDallE = await generateDallEImage(finalImagePrompt, aspectRatio, effectiveChatGptKey);
           imageUrl = resultDallE;
        } else if (imageEngine === 'deepseek') {
          imageUrl = await generateDeepSeekImage(finalImagePrompt, aspectRatio, effectiveDeepSeekKey, deepseekGeneralApiKey);
        }
        newGeneratedImages[i] = { ...newGeneratedImages[i], imageUrl: imageUrl, error: null, dalleRevisedPrompt: dalleRevisedPrompt };
      } catch (e) {
        let errorMessage = `Lỗi tạo ảnh cho prompt "${currentPromptText.substring(0,30)}...": ${(e as Error).message}`;
        if ((e as Error).message.toLowerCase().includes('cors') || (e as Error).message.toLowerCase().includes('failed to fetch')) {
          errorMessage = `Lỗi kết nối khi tạo ảnh cho prompt "${currentPromptText.substring(0,30)}...". Kiểm tra API Key hoặc thử lại.`;
        }
        newGeneratedImages[i] = { ...newGeneratedImages[i], imageUrl: null, error: errorMessage };
      }
      updateState({ generatedBatchImages: [...newGeneratedImages] });
    }

    updateState({ batchProgressMessage: `Hoàn thành ${individualPrompts.length}/${individualPrompts.length} ảnh.` });
    
    // Log batch image generation usage
    const successfulImages = newGeneratedImages.filter(img => img.imageUrl).length;
    logApiCall('image-generation-suite', individualPrompts.length);
    logImageGenerated('image-generation-suite', successfulImages);
    
    setTimeout(() => updateState({ batchProgressMessage: null }), 3000);
    setIsProcessing(false);
  };

  const openRefinementModal = (item: GeneratedImageItem, index: number, isBatch: boolean) => {
    if (!item.imageUrl) return;
    updateState({
      showRefinementModal: true,
      activeRefinementItem: {
        originalItem: item,
        itemIndex: index,
        isBatchItem: isBatch,
        originalImageDataUrl: item.imageUrl
      },
      refinementPrompt: '',
      refinementError: null,
    });
  };

  const handleRefineImage = async () => {
    if (!activeRefinementItem || !activeRefinementItem.originalImageDataUrl || !refinementPrompt.trim()) {
      updateState({ refinementError: "Dữ liệu không hợp lệ để tinh chỉnh." });
      return;
    }
    updateState({ isRefining: true, refinementError: null });

    const parsedData = parseDataUrl(activeRefinementItem.originalImageDataUrl);
    if (!parsedData) {
      updateState({ refinementError: "Không thể xử lý dữ liệu ảnh gốc.", isRefining: false });
      return;
    }
    const { base64: originalImageBase64, mimeType: originalMimeType } = parsedData;

    try {
      let refinedImageUrl: string | null = null;
      const currentEngine = activeRefinementItem.originalItem.engine;
      let newPromptForRefinedItem = activeRefinementItem.originalItem.promptUsed; // Default to original


      if (currentEngine === 'google') {
        const refinedPromptGenSystemInstruction = `You are an expert image prompt engineer. Based on the provided original image and a user's refinement request, generate a new, highly detailed text prompt for the Imagen model. This new prompt should describe an image that incorporates the user's refinements while retaining the core essence of the original image. The new prompt MUST be in English.`;
        const newTextPrompt = await generateTextFromImageAndText(
          originalImageBase64,
          originalMimeType,
          `Original prompt may have been: "${activeRefinementItem.originalItem.promptUsed}". User refinement request: "${refinementPrompt}". Generate a new detailed prompt.`,
          refinedPromptGenSystemInstruction,
          geminiUserApiKey
        );
        const refinedImageB64 = await generateGeminiImage(newTextPrompt, aspectRatio, geminiUserApiKey);
        refinedImageUrl = `data:image/png;base64,${refinedImageB64}`;
        newPromptForRefinedItem = newTextPrompt;


      } else if (currentEngine === 'stability') {
        const refinedImageBlob = await refineStabilityImage(
          stabilityApiKey,
          await dataUrlToBlob(activeRefinementItem.originalImageDataUrl),
          refinementPrompt, 
          stabilityStyle, // Pass stability style for refinement too
          // aspectRatio, // refineStabilityImage uses strength, aspect ratio is inherent in image
          // stabilityNegativePrompt // Pass negative prompt
        );
        refinedImageUrl = URL.createObjectURL(refinedImageBlob);
        newPromptForRefinedItem = refinementPrompt; 

      } else if (currentEngine === 'chatgpt') {
        refinedImageUrl = await editDallEImage(
            originalImageBase64,
            originalMimeType,
            refinementPrompt, 
            aspectRatio, 
            chatGptApiKey
        );
        newPromptForRefinedItem = refinementPrompt; 

      } else if (currentEngine === 'deepseek') {
         refinedImageUrl = await refineDeepSeekImage(
            originalImageBase64,
            originalMimeType,
            refinementPrompt,
            aspectRatio,
            effectiveDeepSeekKey,
            deepseekGeneralApiKey
        );
        newPromptForRefinedItem = refinementPrompt;
      }

      if (refinedImageUrl) {
        const updatedItem: GeneratedImageItem = {
          ...activeRefinementItem.originalItem,
          imageUrl: refinedImageUrl,
          promptUsed: newPromptForRefinedItem,
          originalImageDataUrl: activeRefinementItem.originalImageDataUrl, 
          originalPrompt: activeRefinementItem.originalItem.promptUsed,
          error: null,
        };

        if (activeRefinementItem.isBatchItem) {
          const updatedBatchImages = [...generatedBatchImages];
          updatedBatchImages[activeRefinementItem.itemIndex] = updatedItem;
          updateState({ generatedBatchImages: updatedBatchImages });
        } else {
          const updatedSingleImages = [...generatedSingleImages];
          updatedSingleImages[activeRefinementItem.itemIndex] = updatedItem;
          updateState({ generatedSingleImages: updatedSingleImages });
        }
      }
      updateState({ showRefinementModal: false, isRefining: false, activeRefinementItem: null, refinementPrompt: '' });

    } catch (e) {
      updateState({ refinementError: `Lỗi tinh chỉnh ảnh: ${(e as Error).message}`, isRefining: false });
    }
  };
  
  const TabButton: React.FC<{ tabId: ImageGenerationSuiteActiveTab; label: string, icon?: string }> = ({ tabId, label, icon }) => (
    <button
      onClick={() => { updateState({ 
          activeTab: tabId, 
          singleImageOverallError: null, batchOverallError: null, settingsError: null, ctxPromptsError: null,
          singleImageProgressMessage: null, batchProgressMessage: null, ctxPromptsLoadingMessage: null
      });}}
      className={`flex items-center space-x-2 px-4 py-3 font-medium rounded-t-lg text-base transition-colors
                  ${activeTab === tabId 
                      ? 'bg-indigo-600 text-white shadow-md' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
        aria-selected={activeTab === tabId}
        role="tab"
        disabled={isProcessing || isRefining}
    >
      {icon && <span className="text-lg">{icon}</span>}
      <span>{label}</span>
    </button>
  );

  const copyToClipboard = (textToCopy: string, buttonId?: string) => {
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    if (buttonId) {
        const btn = document.getElementById(buttonId);
        if (btn) {
            const originalText = btn.textContent;
            btn.textContent = 'Đã sao chép!';
            setTimeout(() => { btn.textContent = originalText; }, 2000);
        }
    } else {
        alert("Đã sao chép!"); // Fallback if no button ID
    }
  };

  const copyItemPromptToClipboard = (item: GeneratedImageItem) => {
    const textToCopy = item.dalleRevisedPrompt || item.promptUsed;
    // You might want a unique button ID strategy if this is called for many items,
    // or simplify to just an alert without changing button text.
    copyToClipboard(textToCopy); 
  };


  return (
    <ModuleContainer title="🎨 Xưởng Tạo Ảnh AI">
      {!hasActiveSubscription && <UpgradePrompt />}
      <InfoBox>
        <p><strong>�� Hướng dẫn:</strong> Chọn chế độ tạo ảnh mong muốn từ các tab bên dưới.</p>
        <p className="mt-1">
          <strong>"📸 Ảnh AI từ Hook/Truyện":</strong>
          {' Nhập hook hoặc nội dung truyện. AI sẽ tự phân tích và tạo nhiều prompt ảnh tiếng Anh, sau đó tạo ảnh.'}
        </p>
        <p className="mt-1">
          <strong>"📸 Ảnh AI (Ngữ Cảnh Thông minh)":</strong>
          {' Tương tự như trên, nhưng AI sẽ cố gắng tạo prompt ảnh (vẫn bằng Tiếng Anh) phản ánh bối cảnh văn hóa phù hợp với ngôn ngữ của truyện (ví dụ: Tiếng Việt sang bối cảnh Việt, Tiếng Hàn sang bối cảnh Hàn), rồi tạo ảnh.'}
        </p>
        <p className="mt-1">
          <strong>"📝 Tạo Prompt (Ngữ Cảnh Thông minh)":</strong>
          {' Nhập hook/truyện. AI sẽ phân tích và tạo danh sách prompt tiếng Anh (đã bao gồm phong cách nghệ thuật và ngữ cảnh văn hóa) để bạn sao chép và sử dụng ở nơi khác. Tab này không tự tạo ảnh.'}
        </p>
        <p className="mt-1">
          <strong>"🖼️ Ảnh Hàng Loạt (Prompts)":</strong>
          {' Nhập danh sách prompt tiếng Anh (mỗi prompt một dòng), AI sẽ tạo ảnh.'}
        </p>
        <p className="mt-1">
          <strong>Mới:</strong>
          {' Sau khi ảnh được tạo, bạn có thể nhấp vào nút "🎨 Tinh Chỉnh (i2i)" để yêu cầu AI sửa đổi hoặc thay đổi phong cách ảnh đó.'}
        </p>
        <p className="mt-1">
          <strong>Lưu ý về API:</strong>
          {' Chức năng này có thể sử dụng API của Google Imagen, Stability AI, ChatGPT (DALL-E), hoặc DeepSeek. Hãy đảm bảo bạn có API Key hợp lệ và đủ credit cho dịch vụ bạn chọn.'}
        </p>
      </InfoBox>
      
      {/* Common Settings */}
      <div className="p-6 mb-8 border-2 border-gray-200 rounded-lg bg-gray-50 shadow">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Cài đặt Chung cho Xưởng Ảnh</h3>
        {settingsError && <ErrorAlert message={settingsError} />}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
                <label htmlFor="igsImageEngine" className="block text-sm font-medium text-gray-700 mb-1">Chọn Engine Tạo Ảnh:</label>
                <select 
                    id="igsImageEngine" 
                    value={imageEngine} 
                    onChange={(e) => updateState({ imageEngine: e.target.value as ImageGenerationEngine, settingsError: null })} 
                    className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm"
                    disabled={isProcessing || isRefining}
                >
                    {IMAGE_GENERATION_ENGINE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="igsArtStyle" className="block text-sm font-medium text-gray-700 mb-1">Chọn Phong cách Nghệ thuật:</label>
                <select 
                    id="igsArtStyle" 
                    value={selectedArtStyle} 
                    onChange={(e) => updateState({ selectedArtStyle: e.target.value })} 
                    className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm"
                    disabled={isProcessing || isRefining}
                >
                    {PREDEFINED_ART_STYLES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="igsAspectRatio" className="block text-sm font-medium text-gray-700 mb-1">Tỷ lệ Khung hình Ảnh:</label>
                <select 
                    id="igsAspectRatio" 
                    value={aspectRatio} 
                    onChange={(e) => updateState({ aspectRatio: e.target.value })} 
                    className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm"
                    disabled={isProcessing || isRefining}
                >
                    {ASPECT_RATIO_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="igsImageCount" className="block text-sm font-medium text-gray-700 mb-1">Số lượng Ảnh tạo ra:</label>
                <select 
                    id="igsImageCount" 
                    value={imageCount} 
                    onChange={(e) => updateState({ imageCount: parseInt(e.target.value) })} 
                    className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm"
                    disabled={isProcessing || isRefining}
                >
                    <option value={1}>1 ảnh</option>
                    <option value={2}>2 ảnh</option>
                    <option value={3}>3 ảnh</option>
                    <option value={4}>4 ảnh</option>
                    <option value={5}>5 ảnh</option>
                    <option value={6}>6 ảnh</option>
                </select>
            </div>
        </div>
        {/* API Keys are now managed in Settings module */}
        <div className="mt-4 p-4 border rounded-lg bg-blue-50 border-blue-200">
            <div className="text-center">
                <p className="text-sm text-blue-700 mb-2">
                    🔑 <strong>API Keys được quản lý tại module Cài Đặt</strong>
                </p>
                <p className="text-xs text-blue-600">
                    Truy cập <strong>Sidebar → Cài Đặt → Quản Lý API Keys</strong> để thêm/chỉnh sửa API keys cho {imageEngine}
                </p>
            </div>
        </div>
        {/* Stability AI Specific Settings */}
        {imageEngine === 'stability' && (
            <div className="mt-6 p-4 border-t-2 border-dashed border-gray-300">
                <h4 className="text-md font-semibold text-gray-700 mb-3">Cài đặt Riêng cho Stability AI (SD3)</h4>
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="igsStabilityStyle" className="block text-sm font-medium text-gray-700 mb-1">Style Preset (SD3):</label>
                        <select id="igsStabilityStyle" value={stabilityStyle} onChange={(e) => updateState({ stabilityStyle: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={isProcessing || isRefining}>
                            {STABILITY_STYLE_PRESETS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="igsStabilityNegativePrompt" className="block text-sm font-medium text-gray-700 mb-1">Negative Prompt (SD3):</label>
                        <input type="text" id="igsStabilityNegativePrompt" value={stabilityNegativePrompt} onChange={(e) => updateState({ stabilityNegativePrompt: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Ví dụ: blurry, ugly, watermark" disabled={isProcessing || isRefining}/>
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-1 border-b-2 border-gray-300" role="tablist" aria-label="Chế độ tạo ảnh">
        <TabButton tabId="hookStory" label="Ảnh AI từ Hook/Truyện" icon="📸"/>
        <TabButton tabId="intelligentContextImageGenerator" label="Ảnh AI (Ngữ Cảnh Thông minh)" icon="🧠"/>
        <TabButton tabId="intelligentContextPromptGenerator" label="Tạo Prompt (Ngữ Cảnh Thông minh)" icon="📝"/>
        <TabButton tabId="batch" label="Ảnh Hàng Loạt (Prompts)" icon="🖼️"/>
      </div>

      {/* Tab Content */}
      {activeTab === 'hookStory' && (
        <div role="tabpanel" id="hook-story-panel" className="animate-fadeIn space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">📸 Ảnh AI từ Hook/Truyện</h3>
             <InfoBox variant="info">
                <p>AI sẽ phân tích nội dung bạn nhập, tự động tạo ra các prompt ảnh chi tiết (bằng Tiếng Anh) cho từng cảnh/ý tưởng quan trọng, sau đó tạo ảnh theo các prompt đó. Phong cách nghệ thuật và tỷ lệ khung hình sẽ được lấy từ "Cài đặt chung".</p>
            </InfoBox>
            <div>
                <label htmlFor="igsHookText" className="block text-sm font-medium text-gray-700 mb-1">Nhập Hook hoặc Nội dung truyện (để AI phân tích tạo ảnh):</label>
                <textarea 
                    id="igsHookText" 
                    value={hookText} 
                    onChange={(e) => updateState({ hookText: e.target.value, singleImageOverallError: null })} 
                    rows={5} 
                    className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500" 
                    placeholder="Dán hook, tóm tắt hoặc toàn bộ truyện của bạn vào đây..."
                    disabled={isProcessing || isRefining}
                />
            </div>
            <button 
                onClick={() => executeImageGenerationFromHook(false)} 
                disabled={!hasActiveSubscription || isProcessing || isRefining || !hookText.trim()} 
                className="w-full bg-gradient-to-r from-blue-600 to-sky-500 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
                🚀 Bắt đầu Tạo Ảnh Từ Hook/Truyện
            </button>
            {isProcessing && singleImageProgressMessage && <LoadingSpinner message={singleImageProgressMessage} />}
            {!isProcessing && singleImageProgressMessage && <p className="text-center text-blue-600 font-medium my-2">{singleImageProgressMessage}</p>}
            {singleImageOverallError && <ErrorAlert message={singleImageOverallError} />}
            {generatedSingleImages.length > 0 && (
                <div className="mt-8">
                    <h4 className="text-lg font-semibold text-gray-700 mb-3">Ảnh Đã Tạo Từ Hook/Truyện:</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {generatedSingleImages.map((item, index) => (
                            <div key={index} className="border rounded-lg p-3 shadow-sm bg-white flex flex-col">
                                {item.imageUrl ? (
                                    <img src={item.imageUrl} alt={`Generated ${index + 1}`} className="w-full h-auto rounded-md object-contain mb-2"/>
                                ) : item.error ? (
                                    <div className="w-full h-48 flex items-center justify-center bg-gray-100 rounded-md mb-2">
                                        <p className="text-red-500 text-xs text-center p-2">{item.error}</p>
                                    </div>
                                ) : (
                                    <div className="w-full h-48 flex items-center justify-center bg-gray-100 rounded-md mb-2">
                                        <LoadingSpinner message="Đang chờ..." noMargins={true}/>
                                    </div>
                                )}
                                <details className="text-xs text-gray-600 mt-auto">
                                    <summary className="cursor-pointer hover:text-indigo-600">Prompt đã sử dụng (Engine: {item.engine})</summary>
                                    <p className="mt-1 p-1 bg-gray-50 border rounded whitespace-pre-wrap">{item.dalleRevisedPrompt || item.promptUsed}</p>
                                     <button id={`copySinglePromptBtn-${index}`} onClick={() => copyToClipboard(item.dalleRevisedPrompt || item.promptUsed, `copySinglePromptBtn-${index}`)} className="mt-1 px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300">Sao chép Prompt</button>
                                </details>
                                {item.imageUrl && (
                                    <button
                                        onClick={() => openRefinementModal(item, index, false)}
                                        className="mt-2 w-full text-xs bg-purple-500 hover:bg-purple-600 text-white font-medium py-1.5 px-2 rounded-md transition-colors"
                                    >
                                       🎨 Tinh Chỉnh (i2i)
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      )}
      
      {activeTab === 'intelligentContextImageGenerator' && (
         <div role="tabpanel" id="ctx-image-gen-panel" className="animate-fadeIn space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">🧠 Ảnh AI (Ngữ Cảnh Thông minh)</h3>
             <InfoBox variant="info">
                <p>Tương tự tab "Ảnh AI từ Hook/Truyện", nhưng AI sẽ cố gắng tạo prompt ảnh (bằng Tiếng Anh) phản ánh bối cảnh văn hóa phù hợp với ngôn ngữ của truyện (ví dụ: Tiếng Việt sang bối cảnh Việt, Tiếng Hàn sang bối cảnh Hàn), sau đó tạo ảnh.</p>
            </InfoBox>
            <div>
                <label htmlFor="igsCtxHookText" className="block text-sm font-medium text-gray-700 mb-1">Nhập Hook hoặc Nội dung truyện (AI sẽ phân tích ngôn ngữ để tạo ảnh theo ngữ cảnh):</label>
                <textarea 
                    id="igsCtxHookText" 
                    value={hookText} // Reuses hookText from state for input
                    onChange={(e) => updateState({ hookText: e.target.value, singleImageOverallError: null })} 
                    rows={5} 
                    className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500" 
                    placeholder="Dán hook, tóm tắt hoặc toàn bộ truyện của bạn vào đây..."
                    disabled={isProcessing || isRefining}
                />
            </div>
            <button 
                onClick={() => executeImageGenerationFromHook(true)} 
                disabled={!hasActiveSubscription || isProcessing || isRefining || !hookText.trim()} 
                className="w-full bg-gradient-to-r from-teal-600 to-emerald-500 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
                🚀 Bắt đầu Tạo Ảnh (Ngữ Cảnh Thông minh)
            </button>
            {isProcessing && singleImageProgressMessage && <LoadingSpinner message={singleImageProgressMessage} />}
            {!isProcessing && singleImageProgressMessage && <p className="text-center text-teal-600 font-medium my-2">{singleImageProgressMessage}</p>}
            {singleImageOverallError && <ErrorAlert message={singleImageOverallError} />}
            {/* Display logic for generatedSingleImages is the same as 'hookStory' tab */}
             {generatedSingleImages.length > 0 && (
                <div className="mt-8">
                    <h4 className="text-lg font-semibold text-gray-700 mb-3">Ảnh Đã Tạo (Ngữ Cảnh Thông minh):</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {generatedSingleImages.map((item, index) => (
                            <div key={index} className="border rounded-lg p-3 shadow-sm bg-white flex flex-col">
                                {item.imageUrl ? (
                                    <img src={item.imageUrl} alt={`Generated Ctx ${index + 1}`} className="w-full h-auto rounded-md object-contain mb-2"/>
                                ) : item.error ? (
                                    <div className="w-full h-48 flex items-center justify-center bg-gray-100 rounded-md mb-2">
                                        <p className="text-red-500 text-xs text-center p-2">{item.error}</p>
                                    </div>
                                ) : (
                                     <div className="w-full h-48 flex items-center justify-center bg-gray-100 rounded-md mb-2">
                                        <LoadingSpinner message="Đang chờ..." noMargins={true}/>
                                    </div>
                                )}
                               <details className="text-xs text-gray-600 mt-auto">
                                    <summary className="cursor-pointer hover:text-indigo-600">Prompt đã sử dụng (Engine: {item.engine})</summary>
                                    <p className="mt-1 p-1 bg-gray-50 border rounded whitespace-pre-wrap">{item.dalleRevisedPrompt || item.promptUsed}</p>
                                     <button id={`copyCtxPromptBtn-${index}`} onClick={() => copyToClipboard(item.dalleRevisedPrompt || item.promptUsed, `copyCtxPromptBtn-${index}`)} className="mt-1 px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300">Sao chép Prompt</button>
                                </details>
                                {item.imageUrl && (
                                    <button
                                        onClick={() => openRefinementModal(item, index, false)}
                                        className="mt-2 w-full text-xs bg-purple-500 hover:bg-purple-600 text-white font-medium py-1.5 px-2 rounded-md transition-colors"
                                    >
                                       🎨 Tinh Chỉnh (i2i)
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      )}
      
      {activeTab === 'intelligentContextPromptGenerator' && (
        <div role="tabpanel" id="ctx-prompt-gen-panel" className="animate-fadeIn space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">📝 Tạo Prompt (Ngữ Cảnh Thông minh)</h3>
            <InfoBox variant="info">
                <p>Nhập hook hoặc nội dung truyện. AI sẽ phân tích và tạo một danh sách các prompt ảnh (bằng Tiếng Anh) đã bao gồm phong cách nghệ thuật (từ Cài đặt chung) và ngữ cảnh văn hóa (nếu ngôn ngữ đầu vào là Tiếng Việt hoặc Tiếng Hàn). Bạn có thể sao chép các prompt này để sử dụng ở nơi khác.</p>
                <p className="font-semibold mt-1">Tab này KHÔNG tự động tạo ảnh.</p>
            </InfoBox>
            <div>
                <label htmlFor="igsHookTextForCtxPrompts" className="block text-sm font-medium text-gray-700 mb-1">Nhập Hook hoặc Nội dung truyện (AI sẽ phân tích ngôn ngữ để tạo prompt theo ngữ cảnh):</label>
                <textarea 
                    id="igsHookTextForCtxPrompts" 
                    value={hookTextForCtxPrompts} 
                    onChange={(e) => updateState({ hookTextForCtxPrompts: e.target.value, ctxPromptsError: null })} 
                    rows={5} 
                    className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500" 
                    placeholder="Dán hook, tóm tắt hoặc toàn bộ truyện của bạn vào đây..."
                    disabled={isProcessing || isRefining}
                />
            </div>
             <button 
                onClick={handleGenerateIntelligentContextPromptsOnly} 
                disabled={!hasActiveSubscription || isProcessing || isRefining || !hookTextForCtxPrompts.trim()} 
                className="w-full bg-gradient-to-r from-green-600 to-lime-500 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
                🚀 Tạo Danh Sách Prompt (Ngữ Cảnh Thông minh)
            </button>
            {isProcessing && ctxPromptsLoadingMessage && <LoadingSpinner message={ctxPromptsLoadingMessage} />}
            {!isProcessing && ctxPromptsLoadingMessage && <p className="text-center text-green-600 font-medium my-2">{ctxPromptsLoadingMessage}</p>}
            {ctxPromptsError && <ErrorAlert message={ctxPromptsError} />}
            {generatedCtxPrompts.length > 0 && (
                <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                    <h4 className="text-lg font-semibold text-gray-700 mb-2">Danh Sách Prompt Đã Tạo (Tiếng Anh):</h4>
                    <textarea 
                        value={Array.isArray(generatedCtxPrompts) ? generatedCtxPrompts.join('\n\n') : ''} 
                        readOnly 
                        rows={Math.min(15, generatedCtxPrompts.length * 2 + 2)} 
                        className="w-full p-3 border-2 border-gray-200 rounded-md bg-white whitespace-pre-wrap leading-relaxed"
                        aria-label="Generated contextual prompts"
                    />
                    <button 
                        id="copyCtxPromptsBtn" 
                        onClick={() => copyToClipboard(Array.isArray(generatedCtxPrompts) ? generatedCtxPrompts.join('\n\n') : '', "copyCtxPromptsBtn")} 
                        className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                        disabled={isProcessing || isRefining}
                    >
                        📋 Sao chép Tất cả Prompts
                    </button>
                </div>
            )}
        </div>
      )}

      {activeTab === 'batch' && (
         <div role="tabpanel" id="batch-panel" className="animate-fadeIn space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">🖼️ Ảnh Hàng Loạt (Từ Prompts Tiếng Anh)</h3>
             <InfoBox variant="info">
                <p>Nhập danh sách các prompt tạo ảnh (bằng Tiếng Anh), mỗi prompt một dòng. AI sẽ tạo ảnh cho từng prompt. Phong cách nghệ thuật và tỷ lệ khung hình sẽ được lấy từ "Cài đặt chung" và tự động thêm vào mỗi prompt.</p>
            </InfoBox>
            <div>
                <label htmlFor="igsPromptsInput" className="block text-sm font-medium text-gray-700 mb-1">Nhập danh sách Prompts (Tiếng Anh, mỗi prompt một dòng):</label>
                <textarea 
                    id="igsPromptsInput" 
                    value={promptsInput} 
                    onChange={(e) => updateState({ promptsInput: e.target.value, batchOverallError: null })} 
                    rows={8} 
                    className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500" 
                    placeholder="Ví dụ:\nA majestic dragon flying over a medieval castle, cinematic lighting\nA futuristic cityscape at night with flying vehicles, neon lights"
                    disabled={isProcessing || isRefining}
                />
            </div>
            <button 
                onClick={handleGenerateBatchImages} 
                disabled={!hasActiveSubscription || isProcessing || isRefining || !promptsInput.trim()} 
                className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
                🚀 Bắt đầu Tạo Ảnh Hàng Loạt
            </button>
            {isProcessing && batchProgressMessage && <LoadingSpinner message={batchProgressMessage} />}
            {!isProcessing && batchProgressMessage && <p className="text-center text-orange-600 font-medium my-2">{batchProgressMessage}</p>}
            {batchOverallError && <ErrorAlert message={batchOverallError} />}
            {generatedBatchImages.length > 0 && (
                 <div className="mt-8">
                    <h4 className="text-lg font-semibold text-gray-700 mb-3">Ảnh Hàng Loạt Đã Tạo:</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {generatedBatchImages.map((item, index) => (
                             <div key={index} className="border rounded-lg p-3 shadow-sm bg-white flex flex-col">
                                {item.imageUrl ? (
                                    <img src={item.imageUrl} alt={`Batch ${index + 1}`} className="w-full h-auto rounded-md object-contain mb-2"/>
                                ) : item.error ? (
                                     <div className="w-full h-48 flex items-center justify-center bg-gray-100 rounded-md mb-2">
                                        <p className="text-red-500 text-xs text-center p-2">{item.error}</p>
                                    </div>
                                ) : (
                                    <div className="w-full h-48 flex items-center justify-center bg-gray-100 rounded-md mb-2">
                                        <LoadingSpinner message="Đang chờ..." noMargins={true}/>
                                    </div>
                                )}
                                <details className="text-xs text-gray-600 mt-auto">
                                    <summary className="cursor-pointer hover:text-indigo-600">Prompt đã sử dụng (Engine: {item.engine})</summary>
                                    <p className="mt-1 p-1 bg-gray-50 border rounded whitespace-pre-wrap">{item.dalleRevisedPrompt || item.promptUsed}</p>
                                     <button id={`copyBatchPromptBtn-${index}`} onClick={() => copyToClipboard(item.dalleRevisedPrompt || item.promptUsed, `copyBatchPromptBtn-${index}`)} className="mt-1 px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300">Sao chép Prompt</button>
                                </details>
                                {item.imageUrl && (
                                    <button
                                        onClick={() => openRefinementModal(item, index, true)}
                                        className="mt-2 w-full text-xs bg-purple-500 hover:bg-purple-600 text-white font-medium py-1.5 px-2 rounded-md transition-colors"
                                    >
                                       🎨 Tinh Chỉnh (i2i)
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      )}

        {/* Refinement Modal */}
        {showRefinementModal && activeRefinementItem && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-fadeIn" onClick={() => updateState({ showRefinementModal: false, activeRefinementItem: null})}>
                <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">🎨 Tinh Chỉnh Ảnh (Image-to-Image)</h3>
                    <div className="mb-4 max-h-60 overflow-hidden rounded-md">
                        <img src={activeRefinementItem.originalImageDataUrl} alt="Ảnh gốc để tinh chỉnh" className="w-full h-full object-contain"/>
                    </div>
                     <p className="text-xs text-gray-500 mb-1 italic">Prompt gốc: {activeRefinementItem.originalItem.promptUsed}</p>
                     <p className="text-xs text-gray-500 mb-3 italic">Engine: {activeRefinementItem.originalItem.engine}</p>
                    <div>
                        <label htmlFor="refinementPrompt" className="block text-sm font-medium text-gray-700 mb-1">
                            Yêu cầu Tinh chỉnh (Mô tả ảnh mới mong muốn, bằng Tiếng Anh):
                        </label>
                        <textarea
                            id="refinementPrompt"
                            value={refinementPrompt}
                            onChange={(e) => updateState({ refinementPrompt: e.target.value })}
                            rows={4}
                            className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
                            placeholder="Ví dụ: Make the character smile, change background to a beach. Hoặc: Turn this into a Picasso style painting."
                            disabled={isRefining}
                        />
                        {activeRefinementItem.originalItem.engine === 'stability' && (
                            <p className="text-xs text-gray-500 mt-1">Lưu ý: Với Stability, prompt này sẽ được sử dụng cho image-to-image. Phong cách và negative prompt từ cài đặt chung cũng sẽ được áp dụng.</p>
                        )}
                        {activeRefinementItem.originalItem.engine === 'chatgpt' && (
                             <p className="text-xs text-gray-500 mt-1">Lưu ý: Với DALL-E, prompt này mô tả toàn bộ ảnh mới bạn muốn, dựa trên ảnh gốc. Ảnh gốc có thể được sử dụng như một phần của mask (ẩn) hoặc không, tùy thuộc vào prompt.</p>
                        )}
                         {activeRefinementItem.originalItem.engine === 'deepseek' && (
                             <p className="text-xs text-orange-600 mt-1">Lưu ý: Chức năng Image-to-Image của DeepSeek đang trong giai đoạn thử nghiệm và có thể chưa hoạt động như mong đợi. Vui lòng kiểm tra tài liệu chính thức của DeepSeek.</p>
                        )}
                         {activeRefinementItem.originalItem.engine === 'google' && (
                             <p className="text-xs text-gray-500 mt-1">Lưu ý: AI sẽ tạo một prompt mới dựa trên yêu cầu của bạn và ảnh gốc, sau đó tạo ảnh từ prompt mới đó.</p>
                        )}
                    </div>
                    {isRefining && <LoadingSpinner message="Đang tinh chỉnh ảnh..." />}
                    {refinementError && <ErrorAlert message={refinementError} />}
                    <div className="mt-6 flex justify-end space-x-3">
                        <button
                            onClick={() => updateState({ showRefinementModal: false, activeRefinementItem: null })}
                            disabled={isRefining}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleRefineImage}
                            disabled={!hasActiveSubscription || isRefining || !refinementPrompt.trim()}
                            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50"
                        >
                            Bắt đầu Tinh Chỉnh
                        </button>
                    </div>
                </div>
            </div>
        )}

    </ModuleContainer>
  );
};

export default ImageGenerationSuiteModule;
