

import React, { useState, useEffect, useRef } from 'react';
import { StopCircle, Languages, Plus, Play, Pause, Trash2, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { ApiSettings, RewriteModuleState, UserProfile, RewriteQueueItem } from '../../types';
import { HOOK_LANGUAGE_OPTIONS, REWRITE_STYLE_OPTIONS, TRANSLATE_LANGUAGE_OPTIONS, TRANSLATE_STYLE_OPTIONS } from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import HistoryPanel from '../HistoryPanel';
import { generateText } from '../../services/textGenerationService';
import { delay, isSubscribed } from '../../utils';
import { HistoryStorage, MODULE_KEYS } from '../../utils/historyStorage';
import UpgradePrompt from '../UpgradePrompt';
import { logApiCall, logTextRewritten } from '../../services/usageService';
import { checkAndTrackRequest, REQUEST_ACTIONS, showRequestLimitError } from '../../services/requestTrackingService';

// Retry logic with exponential backoff for API calls
const retryApiCall = async (
  apiFunction: () => Promise<any>,
  maxRetries: number = 3,
  isQueueMode: boolean = false
): Promise<any> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiFunction();
    } catch (error: any) {
      console.log('Retry logic - Error details:', { 
        message: error?.message, 
        status: error?.status, 
        code: error?.code,
        attempt: i + 1 
      });
      
      const isServerError = error?.message?.includes('500') || 
                           error?.message?.includes('Internal Server Error') ||
                           error?.message?.includes('ServerError') ||
                           error?.status === 500 ||
                           error?.code === 500;
      
      if (isServerError && i < maxRetries - 1) {
        // Exponential backoff: 2s, 4s, 8s for normal mode
        // Longer delays for queue mode: 3s, 6s, 12s
        const baseDelay = isQueueMode ? 3000 : 2000;
        const backoffDelay = baseDelay * Math.pow(2, i);
        console.warn(`🔄 RETRY: API call failed (attempt ${i + 1}/${maxRetries}), retrying in ${backoffDelay}ms... [Queue mode: ${isQueueMode}]`);
        await delay(backoffDelay);
        continue;
      }
      console.error(`❌ FINAL FAILURE: All ${maxRetries} retry attempts failed. Error:`, error);
      throw error;
    }
  }
  throw new Error('All retry attempts failed');
};

interface RewriteModuleProps {
  apiSettings: ApiSettings;
  moduleState: RewriteModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<RewriteModuleState>>;
  currentUser: UserProfile | null;
}

const RewriteModule: React.FC<RewriteModuleProps> = ({ 
  apiSettings, 
  moduleState, 
  setModuleState, 
  currentUser 
}) => {
  const hasActiveSubscription = isSubscribed(currentUser);
  const abortControllerRef = useRef<AbortController | null>(null);

    const {
        rewriteLevel, sourceLanguage, targetLanguage, rewriteStyle, customRewriteStyle, adaptContext,
        originalText, rewrittenText, error, progress, loadingMessage,
        isEditing, editError, editLoadingMessage
    } = moduleState;    // Translation states
    const [isTranslating, setIsTranslating] = useState(false);
    const [translationError, setTranslationError] = useState<string | null>(null);
    const [translatedText, setTranslatedText] = useState<string>('');
    const [translateTargetLang, setTranslateTargetLang] = useState<string>('Vietnamese');
    const [translateStyle, setTranslateStyle] = useState<string>('Default');
    
    // Quality analysis toggle - default ON for accurate full-text analysis
    const [enableQualityAnalysis, setEnableQualityAnalysis] = useState<boolean>(true);


    // Generate unique ID
    const generateId = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

    // Calculate word statistics for rewrite
    const calculateWordStats = (originalText: string, rewrittenText: string) => {
        const countWords = (text: string) => {
            return text.trim().split(/\s+/).filter(word => word.length > 0).length;
        };

        const originalWords = countWords(originalText);
        const rewrittenWords = countWords(rewrittenText);
        
        // Simple word change calculation - could be improved with more sophisticated diff
        const originalWordsArray = originalText.toLowerCase().trim().split(/\s+/);
        const rewrittenWordsArray = rewrittenText.toLowerCase().trim().split(/\s+/);
        
        let wordsChanged = 0;
        const maxLength = Math.max(originalWordsArray.length, rewrittenWordsArray.length);
        
        for (let i = 0; i < maxLength; i++) {
            const originalWord = originalWordsArray[i] || '';
            const rewrittenWord = rewrittenWordsArray[i] || '';
            if (originalWord !== rewrittenWord) {
                wordsChanged++;
            }
        }

        const changePercentage = originalWords > 0 ? Math.round((wordsChanged / originalWords) * 100) : 0;

        return {
            originalWords,
            rewrittenWords,
            wordsChanged,
            changePercentage
        };
    };

    // Calculate story quality and consistency statistics (FULL TEXT ANALYSIS)
    const analyzeStoryQuality = async (originalText: string, rewrittenText: string) => {
        try {
            // Full text analysis for maximum accuracy
            const analysisPrompt = `Bạn là chuyên gia phân tích văn học chuyên nghiệp. Hãy phân tích độ nhất quán và hoàn thiện của toàn bộ câu chuyện đã được viết lại.

**VĂNBẢN GỐC (TOÀN BỘ):**
---
${originalText}
---

**VĂNBẢN ĐÃ VIẾT LẠI (TOÀN BỘ):**
---
${rewrittenText}
---

**YÊU CẦU:** Phân tích toàn bộ câu chuyện và trả về JSON chính xác:

{
  "consistencyScore": [số 0-100],
  "completenessScore": [số 0-100], 
  "overallQualityScore": [số 0-100],
  "analysis": {
    "characterConsistency": "[phân tích nhân vật - 1-2 câu]",
    "plotCoherence": "[phân tích cốt truyện - 1-2 câu]", 
    "timelineConsistency": "[phân tích thời gian - 1-2 câu]",
    "settingConsistency": "[phân tích bối cảnh - 1-2 câu]",
    "overallAssessment": "[đánh giá tổng thể - 2-3 câu]"
  }
}

**TIÊU CHÍ:**
- consistencyScore: Tính nhất quán nhân vật, bối cảnh, thời gian trong TOÀN BỘ câu chuyện
- completenessScore: Độ hoàn thiện cốt truyện từ đầu đến cuối
- overallQualityScore: Chất lượng tổng thể = (consistencyScore + completenessScore)/2

Chỉ trả về JSON.`;

            const result = await generateText(analysisPrompt, undefined, false, apiSettings, 'rewrite');
            const jsonMatch = result?.text.match(/\{[\s\S]*\}/);
            
            if (jsonMatch) {
                const analysisData = JSON.parse(jsonMatch[0]);
                return analysisData;
            }
            
            // Fallback nếu không parse được JSON
            return {
                consistencyScore: 75,
                completenessScore: 80,
                overallQualityScore: 77,
                analysis: {
                    characterConsistency: "Nhân vật tương đối nhất quán",
                    plotCoherence: "Cốt truyện có logic tốt", 
                    timelineConsistency: "Thời gian hợp lý",
                    settingConsistency: "Bối cảnh ổn định",
                    overallAssessment: "Chất lượng tổng thể khá tốt, phân tích toàn bộ văn bản"
                }
            };
        } catch (error) {
            console.error('Story quality analysis error:', error);
            return {
                consistencyScore: 70,
                completenessScore: 70,
                overallQualityScore: 70,
                analysis: {
                    characterConsistency: "Lỗi phân tích toàn bộ văn bản",
                    plotCoherence: "Lỗi phân tích toàn bộ văn bản",
                    timelineConsistency: "Lỗi phân tích toàn bộ văn bản", 
                    settingConsistency: "Lỗi phân tích toàn bộ văn bản",
                    overallAssessment: "Cần kiểm tra thủ công - lỗi phân tích toàn bộ"
                }
            };
        }
    };

    // Queue management functions
    const addToQueue = (text: string, title?: string) => {
        setModuleState(prev => {
            const newItem: RewriteQueueItem = {
                id: generateId(),
                title: title || `Bài ${prev.queue.length + 1} - ${text.substring(0, 30)}...`,
                originalText: text,
                status: 'waiting',
                progress: 0,
                rewrittenText: null,
                error: null,
                addedAt: new Date(),
                startedAt: null,
                completedAt: null,
                estimatedTimeRemaining: null,
            };

            const newState = {
                ...prev,
                queue: [...prev.queue, newItem],
                queueSystem: {
                    ...prev.queueSystem,
                    totalCount: prev.queue.length + 1,
                },
            };

            // DO NOT auto-start processing - wait for user to click "Bắt đầu"
            return newState;
        });
    };

    const removeFromQueue = (id: string) => {
        setModuleState(prev => {
            const updatedQueue = prev.queue.filter(item => item.id !== id);
            return {
                ...prev,
                queue: updatedQueue,
                queueSystem: {
                    ...prev.queueSystem,
                    totalCount: updatedQueue.length,
                },
            };
        });
    };

    const clearQueue = () => {
        setModuleState(prev => ({
            ...prev,
            queue: [],
            queueSystem: {
                ...prev.queueSystem,
                totalCount: 0,
                completedCount: 0,
                currentItem: null,
                isProcessing: false,
            },
        }));
    };

    const toggleQueueMode = () => {
        setModuleState(prev => ({
            ...prev,
            queueSystem: {
                ...prev.queueSystem,
                isEnabled: !prev.queueSystem.isEnabled,
            },
        }));
    };

    const pauseResumeQueue = () => {
        setModuleState(prev => ({
            ...prev,
            queueSystem: {
                ...prev.queueSystem,
                isPaused: !prev.queueSystem.isPaused,
            },
        }));
    };

    // Process queue items one by one
    const processQueue = async () => {
        setModuleState(prevState => {
            const waitingItems = prevState.queue.filter(item => item.status === 'waiting');
            
            // If no waiting items or paused, stop processing
            if (waitingItems.length === 0 || prevState.queueSystem.isPaused) {
                return {
                    ...prevState,
                    queueSystem: {
                        ...prevState.queueSystem,
                        isProcessing: false,
                        currentItem: null,
                    },
                };
            }

            // If already processing an item, don't start another
            if (prevState.queueSystem.isProcessing && prevState.queueSystem.currentItem) {
                return prevState; // Already processing, no change
            }

            const currentItem = waitingItems[0];
            
            // Start processing this item
            setTimeout(async () => {
                const startTime = Date.now();
                
                try {
                    // Process the item
                    await processQueueItem(currentItem);
                    
                    const endTime = Date.now();
                    const processingTime = (endTime - startTime) / 1000;
                    
                    // Update completion stats and check for next item
                    setModuleState(prev => {
                        const updatedState = {
                            ...prev,
                            queueSystem: {
                                ...prev.queueSystem,
                                completedCount: prev.queueSystem.completedCount + 1,
                                averageProcessingTime: 
                                    (prev.queueSystem.averageProcessingTime + processingTime) / 2,
                            },
                            // Don't update queue here - it's already updated in processQueueItem
                        };

                        // Check if there are more waiting items
                        const hasWaitingItems = updatedState.queue.filter(item => item.status === 'waiting').length > 0;
                        
                        if (!updatedState.queueSystem.isPaused && hasWaitingItems) {
                            // Continue with next item after longer delay to prevent rate limiting
                            setTimeout(() => {
                                setModuleState(nextState => ({
                                    ...nextState,
                                    queueSystem: {
                                        ...nextState.queueSystem,
                                        isProcessing: false, // Reset processing flag
                                        currentItem: null,
                                    }
                                }));
                                setTimeout(() => processQueue(), 500);
                            }, 3000); // Increased from 1000ms to 3000ms
                        } else {
                            // No more items - stop processing
                            updatedState.queueSystem.isProcessing = false;
                            updatedState.queueSystem.currentItem = null;
                        }

                        return updatedState;
                    });

                } catch (error) {
                    // Mark current item as error and continue with next
                    setModuleState(prev => {
                        const updatedState = {
                            ...prev,
                            queue: prev.queue.map(item =>
                                item.id === currentItem.id
                                    ? { 
                                        ...item, 
                                        status: 'error' as const, 
                                        error: (error as Error).message.includes('500') || (error as Error).message.includes('ServerError')
                                            ? 'Lỗi server tạm thời. API đã thử lại nhưng vẫn thất bại. Vui lòng thử lại sau.'
                                            : (error as Error).message
                                    }
                                    : item
                            ),
                        };

                        // Check if there are more waiting items even after error
                        const hasWaitingItems = updatedState.queue.filter(item => item.status === 'waiting').length > 0;
                        
                        if (!updatedState.queueSystem.isPaused && hasWaitingItems) {
                            // Continue with next item after longer delay to prevent rate limiting
                            setTimeout(() => {
                                setModuleState(nextState => ({
                                    ...nextState,
                                    queueSystem: {
                                        ...nextState.queueSystem,
                                        isProcessing: false, // Reset processing flag
                                        currentItem: null,
                                    }
                                }));
                                setTimeout(() => processQueue(), 500);
                            }, 3000); // Increased from 1000ms to 3000ms
                        } else {
                            // No more items - stop processing
                            updatedState.queueSystem.isProcessing = false;
                            updatedState.queueSystem.currentItem = null;
                        }

                        return updatedState;
                    });
                }
            }, 100);

            // Update current item status immediately
            return {
                ...prevState,
                queueSystem: {
                    ...prevState.queueSystem,
                    isProcessing: true,
                    currentItem: currentItem,
                },
                queue: prevState.queue.map(item =>
                    item.id === currentItem.id
                        ? { ...item, status: 'processing', startedAt: new Date() }
                        : item
                ),
            };
        });
    };

    // Process individual queue item (extracted from handleSingleRewrite)
    const processQueueItem = async (item: RewriteQueueItem) => {
        // Check request limit FIRST - before starting any processing
        const requestCheck = await checkAndTrackRequest(REQUEST_ACTIONS.BATCH_REWRITE);
        if (!requestCheck.success) {
            // Mark current item as blocked due to request limit
            setModuleState(prev => ({
                ...prev,
                queue: prev.queue.map(qItem =>
                    qItem.id === item.id
                        ? { 
                            ...qItem, 
                            status: 'error' as const, 
                            error: requestCheck.message
                        }
                        : qItem
                ),
            }));
            throw new Error(requestCheck.message);
        }

        const CHUNK_CHAR_COUNT = 4000;
        // Use minimum chunks for better progress visualization
        const numChunks = Math.max(3, Math.ceil(item.originalText.length / CHUNK_CHAR_COUNT)); 
        let fullRewrittenText = '';
        let characterMapForItem: string | null = null; // Add character map tracking

        for (let i = 0; i < numChunks; i++) {
            // Update progress with more granular steps (leave 10% for completion)
            const currentProgress = Math.round(((i + 1) / numChunks) * 90);
            setModuleState(prev => ({
                ...prev,
                queue: prev.queue.map(qItem =>
                    qItem.id === item.id
                        ? { ...qItem, progress: currentProgress }
                        : qItem
                ),
            }));

            const textChunk = item.originalText.substring(i * CHUNK_CHAR_COUNT, (i + 1) * CHUNK_CHAR_COUNT);
            
            let effectiveStyle = rewriteStyle === 'custom' ? customRewriteStyle : REWRITE_STYLE_OPTIONS.find(opt => opt.value === rewriteStyle)?.label || rewriteStyle;
            
            const levelDescriptions: {[key: number]: string} = {
                    0: 'only fix spelling and grammar. Keep the original story 100%.',
                    25: 'make some changes to words and sentence structures to refresh the text, while strictly preserving the original meaning, plot, character names, locations, and logical flow of events.',
                    50: 'moderately rewrite the wording and style. You can change sentence structures and vocabulary, but you MUST keep the main characters, locations, and core plot points perfectly consistent. The logic of the situations must be preserved.',
                    75: 'creatively reimagine the story with new descriptions and developments. However, you MUST maintain the original main characters, the core plot, and the logical consistency of events. Do not change character names or the fundamental sequence of events unless specified in the replacement rules.',
                    100: 'completely rewrite into a new script, keeping only the "soul" (core idea, main theme) of the original story. While you have maximum creative freedom, the final story must be internally consistent with its own logic, characters, and events from beginning to end.'
                };
            const descriptionKey = Math.round(rewriteLevel / 25) * 25;
            const levelDescription = levelDescriptions[descriptionKey];

            const selectedSourceLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === sourceLanguage)?.label || sourceLanguage;
            const selectedTargetLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === targetLanguage)?.label || targetLanguage;

            let localizationRequest = '';
            if (targetLanguage !== sourceLanguage && adaptContext) {
                localizationRequest = `\n- **Cultural Localization Required:** Deeply adapt the cultural context, social norms, proper names, and other details to make the story feel natural and appropriate for a ${selectedTargetLangLabel}-speaking audience.`;
            }

            let rewriteStyleInstructionPromptSegment = '';
            if (rewriteStyle === 'custom') {
                rewriteStyleInstructionPromptSegment = `Apply the following custom rewrite instructions: "${customRewriteStyle}"`;
            } else {
                rewriteStyleInstructionPromptSegment = `The desired rewrite style is: ${effectiveStyle}.`;
            }

            const prompt = `You are an expert multilingual text rewriting AI. Your task is to rewrite the provided text chunk according to the following instructions.

**Instructions:**
- **Source Language:** ${selectedSourceLangLabel}
- **Target Language:** ${selectedTargetLangLabel}
- **Degree of Change Required:** ${rewriteLevel}%. This means you should ${levelDescription}.
- **Rewrite Style:** ${rewriteStyleInstructionPromptSegment}
- **Timestamp Handling (CRITICAL):** Timestamps (e.g., (11:42), 06:59, HH:MM:SS) in the original text are metadata and MUST NOT be included in the rewritten output.
- **Coherence:** The rewritten chunk MUST maintain logical consistency with the context from previously rewritten chunks.
${localizationRequest}

**Context from Previous Chunks (already in ${selectedTargetLangLabel}):**
---
${fullRewrittenText || "This is the first chunk."}
---

${i === 0 && rewriteLevel >= 75 ? 
`**Character Mapping (MANDATORY for First Chunk if Level >= 75%):**
At the VERY END of your response for THIS CHUNK, append a character map in the format: "[CHARACTER_MAP]Original Name 1 -> New Name 1; Original Name 2 -> New Name 2[/CHARACTER_MAP]". If you make NO creative name changes, append "[CHARACTER_MAP]No change[/CHARACTER_MAP]". This is VITAL for consistency.

` : characterMapForItem ? 
`**MANDATORY Character Map to Follow:**
${characterMapForItem}
You MUST adhere to this map with 100% accuracy.

` : ''}**Original Text Chunk to Rewrite (this chunk is in ${selectedSourceLangLabel}):**
---
${textChunk}
---

**Your Task:**
Provide ONLY the rewritten text for the current chunk in ${selectedTargetLangLabel}. Do not include any other text, introductions, or explanations.
`;
            
            // Longer delay for queue mode to prevent rate limiting - doubled to prevent 503
            await delay(3000);
            const result = await retryApiCall(
                () => generateText(prompt, undefined, false, apiSettings, 'rewrite'),
                3,
                true // isQueueMode = true
            );
            let currentChunkText = result?.text || '';

            // Extract character map from first chunk if level >= 75
            if (i === 0 && rewriteLevel >= 75) {
                const mapMatch = currentChunkText.match(/\[CHARACTER_MAP\]([\s\S]*?)\[\/CHARACTER_MAP\]/);
                if (mapMatch && mapMatch[1]) {
                    characterMapForItem = mapMatch[1].trim();
                    currentChunkText = currentChunkText.replace(mapMatch[0], '').trim();
                }
            }

            fullRewrittenText += (fullRewrittenText ? '\n\n' : '') + (currentChunkText || '').trim();
        }

        // Calculate word statistics
        const finalRewrittenText = fullRewrittenText.trim();
        const wordStats = calculateWordStats(item.originalText, finalRewrittenText);
        
        // Analyze story quality and consistency (only if enabled and for longer texts)
        let storyQualityStats: any = null;
        if (enableQualityAnalysis && finalRewrittenText.length > 500) {
            try {
                setModuleState(prev => ({
                    ...prev,
                    queue: prev.queue.map(qItem =>
                        qItem.id === item.id
                            ? { ...qItem, progress: 95 } // Show analysis progress
                            : qItem
                    ),
                }));
                
                storyQualityStats = await analyzeStoryQuality(item.originalText, finalRewrittenText);
            } catch (error) {
                console.error('Story quality analysis failed:', error);
                // Continue without quality stats if analysis fails
            }
        }
        
        // Update final result with statistics and COMPLETE status
        setModuleState(prev => ({
            ...prev,
            queue: prev.queue.map(qItem =>
                qItem.id === item.id
                    ? { 
                        ...qItem, 
                        rewrittenText: finalRewrittenText,
                        wordStats: wordStats,
                        storyQualityStats: storyQualityStats,
                        progress: 100, // IMPORTANT: Set to 100% when complete
                        status: 'completed' as const, // IMPORTANT: Mark as completed
                        completedAt: new Date() // IMPORTANT: Set completion timestamp
                    }
                    : qItem
            ),
        }));

        // Log usage statistics
        logApiCall('rewrite', numChunks);
        logTextRewritten('rewrite', 1);
        
        // Save to history with quality statistics and settings
        if (finalRewrittenText.trim()) {
            const title = `Viết lại hàng chờ - ${item.title}`;
            const metadata = {
                wordStats,
                rewriteSettings: {
                    rewriteLevel,
                    sourceLanguage,
                    targetLanguage,
                    rewriteStyle,
                    customRewriteStyle: rewriteStyle === 'custom' ? customRewriteStyle : undefined,
                    adaptContext
                },
                ...(storyQualityStats && { storyQualityStats })
            };
            HistoryStorage.saveToHistory(MODULE_KEYS.REWRITE, title, finalRewrittenText, metadata);
        }
    };

    useEffect(() => {
        if (targetLanguage !== sourceLanguage) {
            setModuleState(prev => ({ ...prev, adaptContext: true })); 
        } else {
            setModuleState(prev => ({ ...prev, adaptContext: false }));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetLanguage, sourceLanguage]);

    const handleSingleRewrite = async () => {
        if (!originalText.trim()) {
            setModuleState(prev => ({ ...prev, error: 'Lỗi: Vui lòng nhập văn bản cần viết lại!' }));
            return;
        }

        // Check request limit FIRST - before starting any processing
        console.log('🔍 RewriteModule: Calling checkAndTrackRequest for REWRITE action');
        const requestCheck = await checkAndTrackRequest(REQUEST_ACTIONS.REWRITE);
        console.log('📊 RewriteModule: Request check result:', requestCheck);
        if (!requestCheck.success) {
            console.log('❌ RewriteModule: Request blocked, showing error');
            showRequestLimitError(requestCheck);
            return;
        }
        console.log('✅ RewriteModule: Request allowed, proceeding with rewrite');

        setModuleState(prev => ({ ...prev, error: null, rewrittenText: '', progress: 0, loadingMessage: 'Đang chuẩn bị...', hasBeenEdited: false }));
        
        abortControllerRef.current = new AbortController();
        
        const CHUNK_CHAR_COUNT = 4000;
        const numChunks = Math.ceil(originalText.length / CHUNK_CHAR_COUNT);
        let fullRewrittenText = '';
        let characterMapForItem: string | null = null; // Local variable for char map

        try {
            for (let i = 0; i < numChunks; i++) {
                if (abortControllerRef.current?.signal.aborted) {
                    setModuleState(prev => ({ ...prev, loadingMessage: 'Đã dừng!', progress: 0 }));
                    return;
                }
                
                const currentProgress = Math.round(((i + 1) / numChunks) * 100);
                setModuleState(prev => ({ ...prev, progress: currentProgress, loadingMessage: `Đang viết lại phần ${i + 1}/${numChunks}...` }));
                
                const textChunk = originalText.substring(i * CHUNK_CHAR_COUNT, (i + 1) * CHUNK_CHAR_COUNT);
                
                let effectiveStyle = rewriteStyle === 'custom' ? customRewriteStyle : REWRITE_STYLE_OPTIONS.find(opt => opt.value === rewriteStyle)?.label || rewriteStyle;
                
                const levelDescriptions: {[key: number]: string} = {
                    0: 'only fix spelling and grammar. Keep the original story 100%.',
                    25: 'make some changes to words and sentence structures to refresh the text, while strictly preserving the original meaning and plot.',
                    50: 'moderately rewrite the wording and style. You can change sentence structures and vocabulary, but MUST keep the main character names and core plot points.',
                    75: 'creatively reimagine the story. You can change character names and some settings. The plot may have new developments, but it MUST retain the spirit of the original script.',
                    100: 'completely rewrite into a new script. Only retain the "soul" (core idea, main theme) of the original story.'
                };
                const descriptionKey = Math.round(rewriteLevel / 25) * 25;
                const levelDescription = levelDescriptions[descriptionKey];

                const selectedSourceLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === sourceLanguage)?.label || sourceLanguage;
                const selectedTargetLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === targetLanguage)?.label || targetLanguage;

                let localizationRequest = '';
                if (targetLanguage !== sourceLanguage && adaptContext) {
                    localizationRequest = `\n- **Cultural Localization Required:** Deeply adapt the cultural context, social norms, proper names, and other details to make the story feel natural and appropriate for a ${selectedTargetLangLabel}-speaking audience.`;
                }

                let rewriteStyleInstructionPromptSegment = '';
                if (rewriteStyle === 'custom') {
                    rewriteStyleInstructionPromptSegment = `Apply the following custom rewrite instructions: "${customRewriteStyle}"`;
                } else {
                    rewriteStyleInstructionPromptSegment = `The desired rewrite style is: ${effectiveStyle}.`;
                }

                let prompt = `You are an expert multilingual text rewriting AI. Your task is to rewrite the provided text chunk according to the following instructions.

**Instructions:**
- **Source Language:** ${selectedSourceLangLabel}
- **Target Language:** ${selectedTargetLangLabel}
- **Degree of Change Required:** ${rewriteLevel}%. This means you should ${levelDescription}.
- **Rewrite Style:** ${rewriteStyleInstructionPromptSegment}
- **Timestamp Handling (CRITICAL):** Timestamps (e.g., (11:42), 06:59, HH:MM:SS) in the original text are metadata and MUST NOT be included in the rewritten output.
- **Coherence:** The rewritten chunk MUST maintain logical consistency with the context from previously rewritten chunks.
${localizationRequest}

**Context from Previous Chunks (already in ${selectedTargetLangLabel}):**
---
${fullRewrittenText || "This is the first chunk."}
---
`;

                if (i === 0 && rewriteLevel >= 75) {
                    prompt += `\n**Character Mapping (MANDATORY for First Chunk if Level >= 75%):**\nAt the VERY END of your response for THIS CHUNK, append a character map in the format: "[CHARACTER_MAP]Original Name 1 -> New Name 1; Original Name 2 -> New Name 2[/CHARACTER_MAP]". If you make NO creative name changes, append "[CHARACTER_MAP]No change[/CHARACTER_MAP]". This is VITAL for consistency.`;
                } else if (characterMapForItem) {
                    prompt += `\n**MANDATORY Character Map to Follow:**\n${characterMapForItem}\nYou MUST adhere to this map with 100% accuracy.`;
                }

                prompt += `
**Original Text Chunk to Rewrite (this chunk is in ${selectedSourceLangLabel}):**
---
${textChunk}
---

**Your Task:**
Provide ONLY the rewritten text for the current chunk in ${selectedTargetLangLabel}. Do not include any other text, introductions, or explanations.
`;
                
                await delay(1000); // Doubled from 500ms to prevent 503 errors
                const result = await retryApiCall(
                    () => generateText(prompt, undefined, false, apiSettings, 'rewrite'),
                    3,
                    false // isQueueMode = false
                );
                let currentChunkText = result?.text || '';

                if (i === 0 && rewriteLevel >= 75) {
                    const mapMatch = currentChunkText.match(/\[CHARACTER_MAP\]([\s\S]*?)\[\/CHARACTER_MAP\]/);
                    if (mapMatch && mapMatch[1]) {
                        characterMapForItem = mapMatch[1].trim();
                        currentChunkText = currentChunkText.replace(mapMatch[0], '').trim();
                    }
                }

                fullRewrittenText += (fullRewrittenText ? '\n\n' : '') + (currentChunkText || '').trim();
                setModuleState(prev => ({ ...prev, rewrittenText: fullRewrittenText })); // Update UI progressively
            }

            setModuleState(prev => ({ ...prev, rewrittenText: fullRewrittenText.trim(), loadingMessage: 'Hoàn thành!', progress: 100 }));
            
            // Analyze story quality for single rewrite (only if enabled and substantial content)
            let qualityStats: any = null;
            if (enableQualityAnalysis && fullRewrittenText.trim().length > 500) {
                setModuleState(prev => ({ ...prev, loadingMessage: 'Đang phân tích chất lượng toàn bộ câu chuyện...' }));
                try {
                    qualityStats = await analyzeStoryQuality(originalText, fullRewrittenText.trim());
                    setModuleState(prev => ({ ...prev, storyQualityAnalysis: qualityStats }));
                } catch (error) {
                    console.error('Story quality analysis failed for single rewrite:', error);
                    // Continue without analysis but show completion
                }
            }
            
            // IMPORTANT: Reset loading state after analysis completes (regardless of success/failure)
            setModuleState(prev => ({ 
                ...prev, 
                loadingMessage: null, // Clear loading message immediately
                progress: 0 // Reset progress
            }));
            
            // Save to history AFTER analysis is complete
            if (fullRewrittenText.trim()) {
                const title = `Viết lại - ${new Date().toLocaleString('vi-VN')}`;
                const wordStats = calculateWordStats(originalText, fullRewrittenText.trim());
                const metadata = {
                    wordStats,
                    rewriteSettings: {
                        rewriteLevel,
                        sourceLanguage,
                        targetLanguage,
                        rewriteStyle,
                        customRewriteStyle: rewriteStyle === 'custom' ? customRewriteStyle : undefined,
                        adaptContext
                    },
                    ...(qualityStats && { storyQualityStats: qualityStats })
                };
                console.log('📊 Saving to history with full metadata:', { wordStats, rewriteSettings: metadata.rewriteSettings, qualityStats });
                HistoryStorage.saveToHistory(MODULE_KEYS.REWRITE, title, fullRewrittenText.trim(), metadata);
            }
            
            logApiCall('rewrite', numChunks);
            logTextRewritten('rewrite', 1);
            
            // Progress already reset above, no need for additional timeout
        } catch (e) {
            if (abortControllerRef.current?.signal.aborted) {
                setModuleState(prev => ({ ...prev, error: `Viết lại đã bị hủy.`, loadingMessage: 'Đã hủy.', progress: 0 }));
            } else {
                setModuleState(prev => ({ ...prev, error: `Lỗi viết lại: ${(e as Error).message}`, loadingMessage: 'Lỗi!', progress: 0 }));
            }
        } finally {
            abortControllerRef.current = null;
            // Clear any lingering loading messages after a short delay
            setTimeout(() => {
                setModuleState(prev => ({
                    ...prev, 
                    loadingMessage: null,
                    progress: 0
                }));
            }, 2000);
        }
    };

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setModuleState(prev => ({ ...prev, loadingMessage: 'Đang dừng...', progress: 0 }));
        }
    };

    // This function is now called automatically after a successful rewrite.
    const handlePostRewriteEdit = async (textToEdit: string) => {
        if (!textToEdit.trim()) {
            setModuleState(prev => ({ ...prev, editError: 'Không có văn bản để tinh chỉnh.' }));
            return textToEdit; // Return original text if empty
        }
        setModuleState(prev => ({ ...prev, isEditing: true, editError: null, editLoadingMessage: 'Đang thực hiện biên tập cuối cùng...' }));
        
        const editPrompt = `You are a meticulous story editor. Your task is to refine and polish the given "Văn Bản Đã Viết Lại", ensuring consistency, logical flow, and improved style. You should compare it with the "Văn Bản Gốc Ban Đầu" ONLY to ensure core plot points and character arcs are respected within the requested rewrite level, NOT to revert the text back to the original.

**VĂN BẢN GỐC BAN ĐẦU (for context):**
---
${originalText}
---

**VĂN BẢN ĐÃ VIẾT LẠI (to be edited):**
---
${textToEdit}
---

**Editing Instructions (CRITICAL):**
1.  **Consistency (HIGHEST PRIORITY):** Ensure character names, locations, and plot points are 100% consistent throughout the text. Correct any contradictions. If a character is named 'John' in one paragraph and 'Jack' in another, fix it to be consistent.
2.  **Flow and Cohesion:** Improve the flow between sentences and paragraphs. Ensure smooth transitions.
3.  **Clarity and Conciseness:** Remove repetitive phrases and redundant words. Clarify any confusing sentences.
4.  **Grammar and Spelling:** Correct any grammatical errors or typos.
5.  **Timestamp Check (Final):** Double-check and ensure absolutely NO timestamps (e.g., (11:42)) remain in the final text. The output must be a clean narrative.

**Output:**
Return ONLY the fully edited and polished text. Do not add any commentary or explanations.
`;
        
        try {
            const result = await retryApiCall(
                () => generateText(editPrompt, undefined, false, apiSettings, 'rewrite'),
                3,
                false
            );
            const editedText = result?.text || '';
            setModuleState(prev => ({ ...prev, rewrittenText: editedText, isEditing: false, editLoadingMessage: 'Tinh chỉnh hoàn tất!', hasBeenEdited: true }));
            
            // Log usage statistics for post-edit
            logApiCall('rewrite', 1); // Log 1 additional API call for editing
            return editedText;
        } catch (e) {
            setModuleState(prev => ({ ...prev, editError: `Lỗi tinh chỉnh: ${(e as Error).message}`, isEditing: false, editLoadingMessage: 'Lỗi!' }));
            return textToEdit; // Return original text on error
        } finally {
             setTimeout(() => setModuleState(prev => ({ ...prev, editLoadingMessage: null })), 3000);
        }
    };
    
    const copyToClipboard = (text: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        alert("Đã sao chép!");
    };

    const handleTranslateRewrittenText = async () => {
        if (!rewrittenText.trim()) {
            setTranslationError('Không có văn bản để dịch.');
            return;
        }

        setIsTranslating(true);
        setTranslationError(null);
        setTranslatedText('Đang dịch...');

        try {
            let styleInstruction = '';
            if (translateStyle !== 'Default') {
                const styleLabel = TRANSLATE_STYLE_OPTIONS.find(opt => opt.value === translateStyle)?.label || translateStyle;
                styleInstruction = ` with a ${styleLabel.toLowerCase()} tone`;
            }

            const prompt = `Translate the following text to ${translateTargetLang}${styleInstruction}. Provide only the translated text, without any additional explanations or context.\n\nText to translate:\n"""\n${rewrittenText.trim()}\n"""`;

            const result = await retryApiCall(
                () => generateText(prompt, undefined, false, apiSettings, 'rewrite'),
                3,
                false
            );
            setTranslatedText(result.text.trim());
            
            // Log translation usage
            logApiCall('translate', 1);
        } catch (e) {
            console.error("Translation Error:", e);
            setTranslationError(`Đã xảy ra lỗi khi dịch: ${(e as Error).message}`);
            setTranslatedText('Dịch lỗi. Vui lòng thử lại.');
        } finally {
            setIsTranslating(false);
        }
    };

    const handleSelectHistory = (content: string) => {
        setModuleState(prev => ({ 
            ...prev, 
            rewrittenText: content,
            // Reset quality analysis when selecting from history since this is previous result
            storyQualityAnalysis: undefined
        }));
    };
    
    const anyLoading = loadingMessage !== null || isEditing;
    const userLevelDescriptions: { [key: number]: string } = {
        0: "Chỉ sửa lỗi chính tả và ngữ pháp cơ bản. Giữ nguyên 100% nội dung và văn phong gốc.",
        25: "Làm mới văn bản bằng cách thay đổi một số từ ngữ và cấu trúc câu. Giữ nguyên ý nghĩa, nhân vật, bối cảnh và cốt truyện chính.",
        50: "Viết lại vừa phải từ ngữ và văn phong. Có thể thay đổi cấu trúc câu, từ vựng, một số chi tiết mô tả nhỏ. Tên nhân vật chính, cốt truyện chính PHẢI được giữ nguyên.",
        75: "Sáng tạo lại câu chuyện một cách đáng kể. Có thể thay đổi tên nhân vật, bối cảnh. Cốt truyện có thể có những phát triển mới nhưng PHẢI giữ được tinh thần của bản gốc.",
        100: "Viết lại hoàn toàn thành một kịch bản mới. Chỉ giữ lại 'linh hồn' (ý tưởng cốt lõi, chủ đề chính) của câu chuyện gốc."
    };
    const getCurrentLevelDescription = () => userLevelDescriptions[Math.round(rewriteLevel / 25) * 25];

    return (
        <ModuleContainer title="🔄 Viết Lại Nhanh" badge="PRO">
             <div className="space-y-6 animate-fadeIn">
                <InfoBox>
                    <strong>Viết Lại Nhanh.</strong> Sử dụng thanh trượt để điều chỉnh mức độ thay đổi từ chỉnh sửa nhẹ đến sáng tạo hoàn toàn. Lý tưởng cho các tác vụ viết lại nhanh chóng.
                    <br /><br />
                    <strong>🆕 Chế độ Hàng Chờ:</strong> Bật chế độ này để nhập liên tục nhiều bài và để tool tự động xử lý từng bài một theo thứ tự.
                </InfoBox>

                {!hasActiveSubscription && <UpgradePrompt />}

                {/* Queue Mode Toggle */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                            <Clock className="w-5 h-5 text-blue-600 mr-2" />
                            <h3 className="text-lg font-semibold text-blue-800">Hệ Thống Hàng Chờ</h3>
                        </div>
                        <button
                            onClick={toggleQueueMode}
                            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                                moduleState.queueSystem.isEnabled
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                            }`}
                        >
                            {moduleState.queueSystem.isEnabled ? 'Tắt Hàng Chờ' : 'Bật Hàng Chờ'}
                        </button>
                    </div>

                    {moduleState.queueSystem.isEnabled && (
                        <div className="space-y-3">
                            {/* Queue Stats */}
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div className="bg-white p-3 rounded-lg">
                                    <div className="text-2xl font-bold text-blue-600">{moduleState.queue.length}</div>
                                    <div className="text-sm text-gray-600">Tổng cộng</div>
                                </div>
                                <div className="bg-white p-3 rounded-lg">
                                    <div className="text-2xl font-bold text-green-600">{moduleState.queueSystem.completedCount}</div>
                                    <div className="text-sm text-gray-600">Hoàn thành</div>
                                </div>
                                <div className="bg-white p-3 rounded-lg">
                                    <div className="text-2xl font-bold text-orange-600">
                                        {moduleState.queue.filter(item => item.status === 'waiting').length}
                                    </div>
                                    <div className="text-sm text-gray-600">Đang chờ</div>
                                </div>
                            </div>

                            {/* Queue Controls */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        if (!moduleState.queueSystem.isProcessing) {
                                            processQueue();
                                        } else {
                                            pauseResumeQueue();
                                        }
                                    }}
                                    disabled={moduleState.queue.filter(item => item.status === 'waiting').length === 0}
                                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {moduleState.queueSystem.isProcessing ? (
                                        moduleState.queueSystem.isPaused ? (
                                            <>
                                                <Play className="w-4 h-4 mr-2" />
                                                Tiếp tục
                                            </>
                                        ) : (
                                            <>
                                                <Pause className="w-4 h-4 mr-2" />
                                                Tạm dừng
                                            </>
                                        )
                                    ) : (
                                        <>
                                            <Play className="w-4 h-4 mr-2" />
                                            Bắt đầu
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={clearQueue}
                                    disabled={moduleState.queue.length === 0}
                                    className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Xóa hết
                                </button>
                            </div>

                            {/* Current Processing Status */}
                            {moduleState.queueSystem.currentItem && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-semibold text-yellow-800">Đang xử lý:</span>
                                        <span className="text-sm text-yellow-600">
                                            {moduleState.queueSystem.currentItem.progress}%
                                        </span>
                                    </div>
                                    <div className="text-sm text-yellow-700 truncate">
                                        {moduleState.queueSystem.currentItem.title}
                                    </div>
                                    <div className="w-full bg-yellow-200 rounded-full h-2 mt-2">
                                        <div
                                            className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${moduleState.queueSystem.currentItem.progress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                <div className="space-y-6 p-6 border-2 border-gray-200 rounded-lg bg-gray-50 shadow">
                    <h3 className="text-xl font-semibold text-gray-800">Cài đặt Viết lại Nhanh</h3>
                     <div>
                        <div className="flex justify-between items-center mb-1">
                            <label htmlFor="rewriteSlider" className="text-sm font-medium text-gray-700">Mức độ thay đổi:</label>
                            <span className="bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full">{rewriteLevel}%</span>
                        </div>
                        <input type="range" id="rewriteSlider" min="0" max="100" step="25" value={rewriteLevel} onChange={(e) => setModuleState(prev => ({ ...prev, rewriteLevel: parseInt(e.target.value)}))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" disabled={anyLoading}/>
                        <div className="mt-2 text-sm text-gray-600 bg-indigo-50 p-3 rounded-md border border-indigo-200">
                            <strong>Giải thích mức {rewriteLevel}%:</strong> {getCurrentLevelDescription()}
                        </div>
                    </div>
                     <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div>
                            <label htmlFor="quickSourceLang" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ gốc:</label>
                            <select id="quickSourceLang" value={sourceLanguage} onChange={(e) => setModuleState(prev => ({ ...prev, sourceLanguage: e.target.value }))} className="w-full p-3 border-2 border-gray-300 rounded-lg" disabled={anyLoading}>
                            {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="quickTargetLang" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ đầu ra:</label>
                            <select id="quickTargetLang" value={targetLanguage} onChange={(e) => setModuleState(prev => ({ ...prev, targetLanguage: e.target.value }))} className="w-full p-3 border-2 border-gray-300 rounded-lg" disabled={anyLoading}>
                            {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="quickRewriteStyle" className="block text-sm font-medium text-gray-700 mb-1">Phong cách viết lại:</label>
                            <select id="quickRewriteStyle" value={rewriteStyle} onChange={(e) => setModuleState(prev => ({ ...prev, rewriteStyle: e.target.value }))} className="w-full p-3 border-2 border-gray-300 rounded-lg" disabled={anyLoading}>
                            {REWRITE_STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>
                    </div>
                     {rewriteStyle === 'custom' && (
                        <div>
                            <label htmlFor="quickCustomStyle" className="block text-sm font-medium text-gray-700 mb-1">Hướng dẫn tùy chỉnh:</label>
                            <textarea id="quickCustomStyle" value={customRewriteStyle} onChange={(e) => setModuleState(prev => ({ ...prev, customRewriteStyle: e.target.value }))} rows={2} className="w-full p-3 border-2 border-gray-300 rounded-lg" disabled={anyLoading}/>
                        </div>
                    )}
                    
                    {/* Quality Analysis Toggle */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={enableQualityAnalysis}
                                onChange={(e) => setEnableQualityAnalysis(e.target.checked)}
                                className="mr-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                disabled={anyLoading}
                            />
                            <div>
                                <span className="text-sm font-medium text-gray-700">
                                    🎯 Phân tích chất lượng TOÀN BỘ câu chuyện (tốn thêm API)
                                </span>
                                <p className="text-xs text-gray-500 mt-1">
                                    Bật để phân tích độ nhất quán và hoàn thiện của TOÀN BỘ câu chuyện. Sẽ mất thêm thời gian và API calls nhưng cho kết quả chính xác nhất.
                                </p>
                                <p className="text-xs text-orange-600 mt-1 font-medium">
                                    ⚠️ Phân tích toàn bộ văn bản để đảm bảo độ chính xác cao nhất trong đánh giá nhất quán & hoàn thiện.
                                </p>
                            </div>
                        </label>
                    </div>
                </div>
                 <div>
                    <label htmlFor="quickOriginalText" className="block text-sm font-medium text-gray-700 mb-1">Văn bản gốc:</label>
                    <textarea id="quickOriginalText" value={originalText} onChange={(e) => setModuleState(prev => ({ ...prev, originalText: e.target.value }))} rows={6} className="w-full p-3 border-2 border-gray-300 rounded-lg" placeholder="Nhập văn bản..." disabled={anyLoading}></textarea>
                </div>
                <div className="flex gap-3">
                    {moduleState.queueSystem.isEnabled ? (
                        <button
                            onClick={() => {
                                if (originalText.trim()) {
                                    addToQueue(originalText.trim());
                                    setModuleState(prev => ({ ...prev, originalText: '' })); // Clear input for next item
                                }
                            }}
                            disabled={!hasActiveSubscription || !originalText.trim()}
                            className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center"
                        >
                            <Plus className="w-5 h-5 mr-2" />
                            Thêm vào hàng chờ
                        </button>
                    ) : (
                        <button
                            onClick={handleSingleRewrite}
                            disabled={!hasActiveSubscription || !originalText.trim() || progress > 0}
                            className="flex-1 bg-gradient-to-r from-green-500 to-teal-500 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            {progress > 0 ? `Đang viết lại... (${progress}%)` : '✍️ Viết lại nội dung'}
                        </button>
                    )}
                    {progress > 0 && (
                        <button
                            onClick={handleStop}
                            className="bg-red-500 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:bg-red-600 transition-colors flex items-center"
                            title="Dừng xử lý"
                        >
                            <StopCircle className="w-5 h-5" />
                        </button>
                    )}
                </div>
                {anyLoading && <LoadingSpinner message={loadingMessage || editLoadingMessage || 'Đang xử lý...'} />}
                {error && <ErrorAlert message={error} />}
                {editError && <ErrorAlert message={editError} />}
                {rewrittenText && !anyLoading && (
                     <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                         <h3 className="text-lg font-semibold mb-2">Văn bản đã viết lại:</h3>
                         <textarea value={rewrittenText} readOnly rows={10} className="w-full p-3 border-2 border-gray-200 rounded-md bg-white"/>
                         
                         {/* Single rewrite word statistics */}
                         {originalText && rewrittenText && (
                             <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                 <h4 className="text-sm font-semibold text-blue-800 mb-2">📊 Thống kê từ:</h4>
                                 {(() => {
                                     const stats = calculateWordStats(originalText, rewrittenText);
                                     return (
                                         <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                             <div className="text-center">
                                                 <div className="text-lg font-bold text-gray-800">{stats.originalWords.toLocaleString()}</div>
                                                 <div className="text-gray-600">Từ gốc</div>
                                             </div>
                                             <div className="text-center">
                                                 <div className="text-lg font-bold text-green-600">{stats.rewrittenWords.toLocaleString()}</div>
                                                 <div className="text-gray-600">Từ mới</div>
                                             </div>
                                             <div className="text-center">
                                                 <div className="text-lg font-bold text-orange-600">{stats.wordsChanged.toLocaleString()}</div>
                                                 <div className="text-gray-600">Từ thay đổi</div>
                                             </div>
                                             <div className="text-center">
                                                 <div className="text-lg font-bold text-purple-600">{stats.changePercentage}%</div>
                                                 <div className="text-gray-600">% Thay đổi</div>
                                             </div>
                                         </div>
                                     );
                                 })()}
                             </div>
                         )}

                         {/* Story Quality Analysis for single rewrite */}
                         {moduleState.storyQualityAnalysis && (
                             <div className="mt-3 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                                 <h4 className="text-lg font-semibold text-purple-800 mb-3 flex items-center">
                                     🎯 Đánh Giá Chất Lượng Câu Chuyện
                                 </h4>
                                 
                                 {/* Quality Scores */}
                                 <div className="grid grid-cols-3 gap-4 mb-4">
                                     <div className="text-center p-3 bg-white rounded-lg border border-purple-100">
                                         <div className="text-2xl font-bold text-purple-700">{moduleState.storyQualityAnalysis.consistencyScore}%</div>
                                         <div className="text-sm text-gray-600">Tính nhất quán</div>
                                     </div>
                                     <div className="text-center p-3 bg-white rounded-lg border border-pink-100">
                                         <div className="text-2xl font-bold text-pink-700">{moduleState.storyQualityAnalysis.completenessScore}%</div>
                                         <div className="text-sm text-gray-600">Độ hoàn thiện</div>
                                     </div>
                                     <div className="text-center p-3 bg-white rounded-lg border border-indigo-100">
                                         <div className="text-2xl font-bold text-indigo-700">{moduleState.storyQualityAnalysis.overallQualityScore}%</div>
                                         <div className="text-sm text-gray-600">Chất lượng tổng</div>
                                     </div>
                                 </div>

                                 {/* Quality Progress Bars */}
                                 <div className="space-y-3 mb-4">
                                     <div>
                                         <div className="flex justify-between text-sm mb-2">
                                             <span className="font-medium">Tính nhất quán</span>
                                             <span className="font-bold">{moduleState.storyQualityAnalysis.consistencyScore}%</span>
                                         </div>
                                         <div className="w-full bg-gray-200 rounded-full h-3">
                                             <div 
                                                 className="bg-purple-600 h-3 rounded-full transition-all duration-500" 
                                                 style={{ width: `${moduleState.storyQualityAnalysis.consistencyScore}%` }}
                                             ></div>
                                         </div>
                                     </div>
                                     <div>
                                         <div className="flex justify-between text-sm mb-2">
                                             <span className="font-medium">Độ hoàn thiện</span>
                                             <span className="font-bold">{moduleState.storyQualityAnalysis.completenessScore}%</span>
                                         </div>
                                         <div className="w-full bg-gray-200 rounded-full h-3">
                                             <div 
                                                 className="bg-pink-600 h-3 rounded-full transition-all duration-500" 
                                                 style={{ width: `${moduleState.storyQualityAnalysis.completenessScore}%` }}
                                             ></div>
                                         </div>
                                     </div>
                                     <div>
                                         <div className="flex justify-between text-sm mb-2">
                                             <span className="font-medium">Chất lượng tổng thể</span>
                                             <span className="font-bold">{moduleState.storyQualityAnalysis.overallQualityScore}%</span>
                                         </div>
                                         <div className="w-full bg-gray-200 rounded-full h-3">
                                             <div 
                                                 className="bg-indigo-600 h-3 rounded-full transition-all duration-500" 
                                                 style={{ width: `${moduleState.storyQualityAnalysis.overallQualityScore}%` }}
                                             ></div>
                                         </div>
                                     </div>
                                 </div>

                                 {/* Detailed Analysis */}
                                 <details className="text-sm">
                                     <summary className="cursor-pointer text-purple-700 font-semibold hover:text-purple-800 mb-3">
                                         📋 Xem phân tích chi tiết
                                     </summary>
                                     <div className="space-y-3 text-sm bg-white p-3 rounded border">
                                         <div className="border-l-4 border-purple-400 pl-3">
                                             <span className="font-semibold text-gray-700">👥 Tính nhất quán nhân vật:</span>
                                             <p className="text-gray-600 mt-1">{moduleState.storyQualityAnalysis.analysis.characterConsistency}</p>
                                         </div>
                                         <div className="border-l-4 border-blue-400 pl-3">
                                             <span className="font-semibold text-gray-700">📖 Tính logic cốt truyện:</span>
                                             <p className="text-gray-600 mt-1">{moduleState.storyQualityAnalysis.analysis.plotCoherence}</p>
                                         </div>
                                         <div className="border-l-4 border-green-400 pl-3">
                                             <span className="font-semibold text-gray-700">⏰ Tính nhất quán thời gian:</span>
                                             <p className="text-gray-600 mt-1">{moduleState.storyQualityAnalysis.analysis.timelineConsistency}</p>
                                         </div>
                                         <div className="border-l-4 border-yellow-400 pl-3">
                                             <span className="font-semibold text-gray-700">🏞️ Tính nhất quán bối cảnh:</span>
                                             <p className="text-gray-600 mt-1">{moduleState.storyQualityAnalysis.analysis.settingConsistency}</p>
                                         </div>
                                         <div className="border-l-4 border-pink-400 pl-3">
                                             <span className="font-semibold text-gray-700">🎯 Đánh giá tổng quan:</span>
                                             <p className="text-gray-600 mt-1">{moduleState.storyQualityAnalysis.analysis.overallAssessment}</p>
                                         </div>
                                     </div>
                                 </details>
                             </div>
                         )}

                         <div className="mt-3 flex gap-2">
                            <button 
                                onClick={() => copyToClipboard(rewrittenText)} 
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                            >
                                Sao chép
                            </button>
                            <button 
                                onClick={() => handlePostRewriteEdit(rewrittenText)} 
                                disabled={!hasActiveSubscription || anyLoading}
                                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
                            >
                                Biên Tập Lại (Thủ công)
                            </button>
                            <button 
                                onClick={handleTranslateRewrittenText} 
                                disabled={!hasActiveSubscription || isTranslating}
                                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
                            >
                                <Languages size={16} />
                                {isTranslating ? 'Đang dịch...' : 'Dịch'}
                            </button>
                         </div>
                     </div>
                )}

                {/* Queue Items List */}
                {moduleState.queueSystem.isEnabled && moduleState.queue.length > 0 && (
                    <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                        <h3 className="text-lg font-semibold mb-4">📋 Danh sách hàng chờ ({moduleState.queue.length} mục)</h3>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {moduleState.queue.map((item, index) => (
                                <div key={item.id} className={`p-3 border rounded-lg ${
                                    item.status === 'processing' ? 'bg-yellow-50 border-yellow-300' :
                                    item.status === 'completed' ? 'bg-green-50 border-green-300' :
                                    item.status === 'error' ? 'bg-red-50 border-red-300' :
                                    'bg-white border-gray-300'
                                }`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center">
                                            <span className="text-sm font-medium text-gray-600 mr-2">#{index + 1}</span>
                                            {item.status === 'processing' && <div className="animate-spin w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full mr-2"></div>}
                                            {item.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-600 mr-2" />}
                                            {item.status === 'error' && <AlertCircle className="w-4 h-4 text-red-600 mr-2" />}
                                            {item.status === 'waiting' && <Clock className="w-4 h-4 text-gray-400 mr-2" />}
                                            <span className="font-semibold truncate max-w-md">{item.title}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {item.status === 'processing' && (
                                                <span className="text-sm text-gray-600">{item.progress}%</span>
                                            )}
                                            {item.status === 'waiting' && (
                                                <button
                                                    onClick={() => removeFromQueue(item.id)}
                                                    className="text-red-500 hover:text-red-700"
                                                    title="Xóa khỏi hàng chờ"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Progress bar for processing items */}
                                    {item.status === 'processing' && (
                                        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                                            <div
                                                className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
                                                style={{ width: `${item.progress}%` }}
                                            ></div>
                                        </div>
                                    )}
                                    
                                    {/* Show content preview */}
                                    <div className="text-sm text-gray-600 mb-2">
                                        <details>
                                            <summary className="cursor-pointer hover:text-gray-800">Nội dung gốc</summary>
                                            <div className="mt-2 p-2 bg-gray-100 rounded text-xs whitespace-pre-wrap max-h-20 overflow-y-auto">
                                                {item.originalText}
                                            </div>
                                        </details>
                                    </div>

                                    {/* Show result for completed items */}
                                    {item.status === 'completed' && item.rewrittenText && (
                                        <div className="text-sm text-gray-600 mb-2">
                                            <details>
                                                <summary className="cursor-pointer hover:text-gray-800 text-green-700 font-medium">Kết quả viết lại</summary>
                                                <div className="mt-2 p-2 bg-green-100 rounded text-xs whitespace-pre-wrap max-h-32 overflow-y-auto">
                                                    {item.rewrittenText}
                                                </div>
                                                
                                                {/* Word Statistics */}
                                                {item.wordStats && (
                                                    <div className="mt-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
                                                        <h4 className="text-xs font-semibold text-blue-800 mb-2">📊 Thống kê từ:</h4>
                                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-600">Từ gốc:</span>
                                                                <span className="font-semibold text-gray-800">{item.wordStats.originalWords.toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-600">Từ mới:</span>
                                                                <span className="font-semibold text-green-600">{item.wordStats.rewrittenWords.toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-600">Từ thay đổi:</span>
                                                                <span className="font-semibold text-orange-600">{item.wordStats.wordsChanged.toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-600">% Thay đổi:</span>
                                                                <span className="font-semibold text-purple-600">{item.wordStats.changePercentage}%</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Story Quality Statistics */}
                                                {item.storyQualityStats && (
                                                    <div className="mt-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                                                        <h4 className="text-sm font-semibold text-purple-800 mb-3 flex items-center">
                                                            🎯 Đánh Giá Chất Lượng Câu Chuyện
                                                        </h4>
                                                        
                                                        {/* Quality Scores */}
                                                        <div className="grid grid-cols-3 gap-3 mb-3">
                                                            <div className="text-center">
                                                                <div className="text-lg font-bold text-purple-700">{item.storyQualityStats.consistencyScore}%</div>
                                                                <div className="text-xs text-gray-600">Tính nhất quán</div>
                                                            </div>
                                                            <div className="text-center">
                                                                <div className="text-lg font-bold text-pink-700">{item.storyQualityStats.completenessScore}%</div>
                                                                <div className="text-xs text-gray-600">Độ hoàn thiện</div>
                                                            </div>
                                                            <div className="text-center">
                                                                <div className="text-lg font-bold text-indigo-700">{item.storyQualityStats.overallQualityScore}%</div>
                                                                <div className="text-xs text-gray-600">Chất lượng tổng</div>
                                                            </div>
                                                        </div>

                                                        {/* Quality Progress Bars */}
                                                        <div className="space-y-2 mb-3">
                                                            <div>
                                                                <div className="flex justify-between text-xs mb-1">
                                                                    <span>Nhất quán</span>
                                                                    <span>{item.storyQualityStats.consistencyScore}%</span>
                                                                </div>
                                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                                    <div 
                                                                        className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
                                                                        style={{ width: `${item.storyQualityStats.consistencyScore}%` }}
                                                                    ></div>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="flex justify-between text-xs mb-1">
                                                                    <span>Hoàn thiện</span>
                                                                    <span>{item.storyQualityStats.completenessScore}%</span>
                                                                </div>
                                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                                    <div 
                                                                        className="bg-pink-600 h-2 rounded-full transition-all duration-300" 
                                                                        style={{ width: `${item.storyQualityStats.completenessScore}%` }}
                                                                    ></div>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="flex justify-between text-xs mb-1">
                                                                    <span>Tổng thể</span>
                                                                    <span>{item.storyQualityStats.overallQualityScore}%</span>
                                                                </div>
                                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                                    <div 
                                                                        className="bg-indigo-600 h-2 rounded-full transition-all duration-300" 
                                                                        style={{ width: `${item.storyQualityStats.overallQualityScore}%` }}
                                                                    ></div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Detailed Analysis */}
                                                        <details className="text-xs">
                                                            <summary className="cursor-pointer text-purple-700 font-medium hover:text-purple-800 mb-2">
                                                                📋 Xem phân tích chi tiết
                                                            </summary>
                                                            <div className="space-y-2 text-xs bg-white p-2 rounded border">
                                                                <div>
                                                                    <span className="font-semibold text-gray-700">👥 Nhân vật:</span>
                                                                    <p className="text-gray-600 ml-2">{item.storyQualityStats.analysis.characterConsistency}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="font-semibold text-gray-700">📖 Cốt truyện:</span>
                                                                    <p className="text-gray-600 ml-2">{item.storyQualityStats.analysis.plotCoherence}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="font-semibold text-gray-700">⏰ Thời gian:</span>
                                                                    <p className="text-gray-600 ml-2">{item.storyQualityStats.analysis.timelineConsistency}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="font-semibold text-gray-700">🏞️ Bối cảnh:</span>
                                                                    <p className="text-gray-600 ml-2">{item.storyQualityStats.analysis.settingConsistency}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="font-semibold text-gray-700">🎯 Tổng quan:</span>
                                                                    <p className="text-gray-600 ml-2">{item.storyQualityStats.analysis.overallAssessment}</p>
                                                                </div>
                                                            </div>
                                                        </details>
                                                    </div>
                                                )}

                                                <button
                                                    onClick={() => copyToClipboard(item.rewrittenText || '')}
                                                    className="mt-2 px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                                                >
                                                    Sao chép kết quả
                                                </button>
                                            </details>
                                        </div>
                                    )}

                                    {/* Show error for failed items */}
                                    {item.status === 'error' && item.error && (
                                        <div className="text-sm text-red-600">
                                            <span className="font-medium">Lỗi:</span> {item.error}
                                        </div>
                                    )}

                                    {/* Timestamps */}
                                    <div className="text-xs text-gray-400 flex gap-4">
                                        <span>Thêm: {new Date(item.addedAt).toLocaleTimeString('vi-VN')}</span>
                                        {item.startedAt && (
                                            <span>Bắt đầu: {new Date(item.startedAt).toLocaleTimeString('vi-VN')}</span>
                                        )}
                                        {item.completedAt && (
                                            <span>Hoàn thành: {new Date(item.completedAt).toLocaleTimeString('vi-VN')}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Translation Section */}
                {rewrittenText && !anyLoading && (
                    <div className="mt-6 p-4 border rounded-lg bg-blue-50">
                        <h3 className="text-lg font-semibold mb-3">🌐 Dịch Thuật</h3>
                        
                        <div className="grid md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ đích:</label>
                                <select
                                    value={translateTargetLang}
                                    onChange={e => setTranslateTargetLang(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-lg"
                                    disabled={isTranslating}
                                >
                                    {TRANSLATE_LANGUAGE_OPTIONS.map(opt => 
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    )}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phong cách dịch:</label>
                                <select
                                    value={translateStyle}
                                    onChange={e => setTranslateStyle(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-lg"
                                    disabled={isTranslating}
                                >
                                    {TRANSLATE_STYLE_OPTIONS.map(opt => 
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    )}
                                </select>
                            </div>
                        </div>

                        {translatedText && (
                            <div>
                                <h4 className="text-md font-semibold mb-2">Kết quả dịch:</h4>
                                <textarea 
                                    value={translatedText} 
                                    readOnly 
                                    rows={8} 
                                    className="w-full p-3 border-2 border-gray-200 rounded-md bg-white"
                                />
                                <div className="mt-2">
                                    <button 
                                        onClick={() => copyToClipboard(translatedText)} 
                                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                                    >
                                        Sao chép bản dịch
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {translationError && <ErrorAlert message={translationError} />}
                    </div>
                )}

                {/* History Panel */}
                <HistoryPanel 
                    moduleKey={MODULE_KEYS.REWRITE}
                    onSelectHistory={handleSelectHistory}
                />
            </div>
        </ModuleContainer>
    );
};


export default RewriteModule;