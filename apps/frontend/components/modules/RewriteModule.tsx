

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
        isEditing, editError, editLoadingMessage, hasBeenEdited, translation
    } = moduleState;

    // Translation states
    const [isTranslating, setIsTranslating] = useState(false);
    const [translationError, setTranslationError] = useState<string | null>(null);
    const [translatedText, setTranslatedText] = useState<string>('');
    const [translateTargetLang, setTranslateTargetLang] = useState<string>('Vietnamese');
    const [translateStyle, setTranslateStyle] = useState<string>('Default');


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
                            queue: prev.queue.map(item =>
                                item.id === currentItem.id
                                    ? { ...item, status: 'completed', completedAt: new Date(), progress: 100 }
                                    : item
                            ),
                        };

                        // Check if there are more waiting items
                        const hasWaitingItems = updatedState.queue.filter(item => item.status === 'waiting').length > 0;
                        
                        if (!updatedState.queueSystem.isPaused && hasWaitingItems) {
                            // Continue with next item after delay
                            setTimeout(() => {
                                setModuleState(nextState => ({
                                    ...nextState,
                                    queueSystem: {
                                        ...nextState.queueSystem,
                                        isProcessing: false, // Reset processing flag
                                        currentItem: null,
                                    }
                                }));
                                setTimeout(() => processQueue(), 100);
                            }, 1000);
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
                                    ? { ...item, status: 'error', error: (error as Error).message }
                                    : item
                            ),
                        };

                        // Check if there are more waiting items even after error
                        const hasWaitingItems = updatedState.queue.filter(item => item.status === 'waiting').length > 0;
                        
                        if (!updatedState.queueSystem.isPaused && hasWaitingItems) {
                            // Continue with next item after delay
                            setTimeout(() => {
                                setModuleState(nextState => ({
                                    ...nextState,
                                    queueSystem: {
                                        ...nextState.queueSystem,
                                        isProcessing: false, // Reset processing flag
                                        currentItem: null,
                                    }
                                }));
                                setTimeout(() => processQueue(), 100);
                            }, 1000);
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
        const CHUNK_CHAR_COUNT = 4000;
        // Use minimum chunks for better progress visualization
        const numChunks = Math.max(3, Math.ceil(item.originalText.length / CHUNK_CHAR_COUNT)); 
        let fullRewrittenText = '';

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

**Original Text Chunk to Rewrite (this chunk is in ${selectedSourceLangLabel}):**
---
${textChunk}
---

**Your Task:**
Provide ONLY the rewritten text for the current chunk in ${selectedTargetLangLabel}. Do not include any other text, introductions, or explanations.
`;
            
            await delay(500);
            const result = await generateText(prompt, undefined, false, apiSettings);
            fullRewrittenText += (fullRewrittenText ? '\n\n' : '') + (result?.text || '').trim();
        }

        // Calculate word statistics
        const finalRewrittenText = fullRewrittenText.trim();
        const wordStats = calculateWordStats(item.originalText, finalRewrittenText);
        
        // Update final result with statistics
        setModuleState(prev => ({
            ...prev,
            queue: prev.queue.map(qItem =>
                qItem.id === item.id
                    ? { 
                        ...qItem, 
                        rewrittenText: finalRewrittenText,
                        wordStats: wordStats
                    }
                    : qItem
            ),
        }));

        // Log usage statistics
        logApiCall('rewrite', numChunks);
        logTextRewritten('rewrite', 1);
    };

    useEffect(() => {
        if (targetLanguage !== sourceLanguage) {
            setModuleState(prev => ({ ...prev, adaptContext: true })); 
        } else {
            setModuleState(prev => ({ ...prev, adaptContext: false }));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetLanguage, sourceLanguage]);

    // New helper function to create a replacement map for entities
    const createReplacementMap = async (text: string, targetLang: string): Promise<Record<string, string>> => {
        setModuleState(prev => ({ ...prev, loadingMessage: 'Bước 1/4: Phân tích và tạo bản đồ thay thế...' }));
        const targetLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === targetLang)?.label || targetLang;

        const prompt = `Analyze the following text to identify all primary entities (main characters, significant locations). Your task is to create a JSON map of these entities to new, culturally appropriate names for a ${targetLangLabel}-speaking audience.\n\n**Rules:**\n1.  Identify 3-5 of the most important entities.\n2.  The new names must be consistent and sound natural in ${targetLangLabel}.\n3.  Return ONLY a valid JSON object mapping the original name to the new name. Example: {"Anna": "Jessica", "Paris": "the City of Lights"}.\n\n**Text to Analyze:**\n---\n${text}\n---\n`;
        try {
            const result = await generateText(prompt, undefined, false, apiSettings);
            // Basic JSON parsing, can be made more robust
            const jsonResponse = JSON.parse(result.text.trim());
            console.log("Generated Replacement Map:", jsonResponse);
            return jsonResponse;
        } catch (error) {
            console.error("Could not create replacement map, proceeding without it.", error);
            setModuleState(prev => ({ ...prev, loadingMessage: 'Không thể tạo bản đồ thay thế, sẽ tiếp tục viết lại bình thường...' }));
            await delay(1500); // Give user time to see the message
            return {}; // Return empty map on error
        }
    };

    const handleSingleRewrite = async () => {
        if (!originalText.trim()) {
            setModuleState(prev => ({ ...prev, error: 'Lỗi: Vui lòng nhập văn bản cần viết lại!' }));
            return;
        }
        setModuleState(prev => ({ ...prev, error: null, rewrittenText: '', progress: 0, loadingMessage: 'Đang chuẩn bị...', hasBeenEdited: false }));
        
        abortControllerRef.current = new AbortController();
        
        let replacementMap: Record<string, string> = {};
        let fullRewrittenText = '';

        try {
            // STEP 1: Create Replacement Map (if applicable)
            if (rewriteLevel >= 75) {
                replacementMap = await createReplacementMap(originalText, targetLanguage);
            }

            // STEP 2 & 3: Rewrite text chunk by chunk with enhanced prompts
            const CHUNK_CHAR_COUNT = 4000;
            const numChunks = Math.max(3, Math.ceil(originalText.length / CHUNK_CHAR_COUNT));

            for (let i = 0; i < numChunks; i++) {
                if (abortControllerRef.current?.signal.aborted) {
                    setModuleState(prev => ({ ...prev, loadingMessage: 'Đã dừng!', progress: 0 }));
                    return;
                }
                
                const currentProgress = Math.round(((i + 1) / numChunks) * 100);
                setModuleState(prev => ({ ...prev, progress: currentProgress, loadingMessage: `Bước 2/4: Đang viết lại phần ${i + 1}/${numChunks}...` }));
                
                const textChunk = originalText.substring(i * CHUNK_CHAR_COUNT, (i + 1) * CHUNK_CHAR_COUNT);
                
                // --- Language-Specific Prompt Enhancement ---
                let languageEnhancement = '';
                if (targetLanguage === 'English') {
                    languageEnhancement = `As a master storyteller, your writing must be fluid, engaging, and idiomatic for a native English-speaking audience. Pay close attention to natural sentence flow, sophisticated vocabulary, and compelling narrative structures. The final output must be of publishable quality.`;
                } else if (targetLanguage === 'Vietnamese') {
                    languageEnhancement = `Với vai trò là một nhà văn tài ba, văn bản viết lại phải mượt mà, giàu cảm xúc và tự nhiên theo văn phong kể chuyện của người Việt. Câu chữ phải chau chuốt, mạch lạc, có sức lôi cuốn.`;
                }

                // --- Replacement Rules ---
                let replacementRules = '';
                if (Object.keys(replacementMap).length > 0) {
                    const rules = Object.entries(replacementMap).map(([key, value]) => `'${key}' is ALWAYS '${value}'`).join('. ');
                    replacementRules = `\n- **CRITICAL REPLACEMENT RULES:** You MUST strictly adhere to this map: ${rules}. NO EXCEPTIONS.`;
                }

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

                let rewriteStyleInstructionPromptSegment = `The desired rewrite style is: ${effectiveStyle}.`;
                if (rewriteStyle === 'custom') {
                    rewriteStyleInstructionPromptSegment = `Apply the following custom rewrite instructions: "${customRewriteStyle}"`;
                }

                const prompt = `You are an expert multilingual text rewriting AI. Your task is to rewrite the provided text chunk according to the following instructions.\n\n**Core Instructions:**\n- **Source Language:** ${selectedSourceLangLabel}\n- **Target Language:** ${selectedTargetLangLabel}\n- **Degree of Change Required:** ${rewriteLevel}%. This means you should ${levelDescription}.\n- **Rewrite Style:** ${rewriteStyleInstructionPromptSegment}\n- **Style Enhancement:** ${languageEnhancement}\n- **Timestamp Handling (CRITICAL):** Timestamps (e.g., (11:42), 06:59, HH:MM:SS) in the original text are metadata and MUST NOT be included in the rewritten output.\n- **Coherence:** The rewritten chunk MUST maintain logical consistency with the context from previously rewritten chunks.\n${localizationRequest}${replacementRules}\n\n**Context from Previous Chunks (already in ${selectedTargetLangLabel}):**\n---\n${fullRewrittenText || "This is the first chunk."}\n---\n\n**Original Text Chunk to Rewrite (this chunk is in ${selectedSourceLangLabel}):**\n---\n${textChunk}\n---\n\n**Your Task:**\nProvide ONLY the rewritten text for the current chunk in ${selectedTargetLangLabel}. Do not include any other text, introductions, or explanations.\n`;
                
                await delay(500);
                const result = await generateText(prompt, undefined, false, apiSettings);
                fullRewrittenText += (fullRewrittenText ? '\n\n' : '') + (result?.text || '').trim();
                setModuleState(prev => ({ ...prev, rewrittenText: fullRewrittenText }));
            }

            setModuleState(prev => ({ ...prev, loadingMessage: 'Bước 3/4: Đã viết lại xong, chuẩn bị biên tập cuối cùng...', progress: 100 }));
            await delay(1000);

            // STEP 4: Automatic Post-Rewrite Edit
            const finalText = await handlePostRewriteEdit(fullRewrittenText.trim());

            setModuleState(prev => ({ ...prev, rewrittenText: finalText, loadingMessage: 'Hoàn thành!', progress: 100 }));
            
            if (finalText) {
                const title = `Viết lại - ${new Date().toLocaleString('vi-VN')}`;
                HistoryStorage.saveToHistory(MODULE_KEYS.REWRITE, title, finalText);
            }
            
            logApiCall('rewrite', numChunks);
            logTextRewritten('rewrite', 1);
            
            setTimeout(() => setModuleState(prev => ({ ...prev, progress: 0 })), 1500);
        } catch (e) {
            if (abortControllerRef.current?.signal.aborted) {
                setModuleState(prev => ({ ...prev, loadingMessage: 'Đã dừng!', progress: 0 }));
            } else {
                setModuleState(prev => ({ ...prev, error: `Lỗi viết lại: ${(e as Error).message}`, loadingMessage: 'Lỗi!', progress: 0 }));
            }
        } finally {
            abortControllerRef.current = null;
            setTimeout(() => setModuleState(prev => ({ ...prev, loadingMessage: null })), 3000);
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
        
        const editPrompt = `You are a meticulous story editor. Your task is to refine and polish the given text, ensuring consistency, logical flow, and improved style.

**Text to Edit:**
---
${textToEdit}
---

**Editing Instructions:**
1.  **Consistency:** Ensure character names, locations, and plot points are consistent throughout the text. Correct any contradictions.
2.  **Flow and Cohesion:** Improve the flow between sentences and paragraphs. Ensure smooth transitions.
3.  **Clarity and Conciseness:** Remove repetitive phrases and redundant words. Clarify any confusing sentences.
4.  **Grammar and Spelling:** Correct any grammatical errors or typos.
5.  **Timestamp Check (Final):** Double-check and ensure absolutely NO timestamps (e.g., (11:42)) remain in the final text. The output must be a clean narrative.

**Output:**
Return ONLY the fully edited and polished text. Do not add any commentary or explanations.
`;
        
        try {
            const result = await generateText(editPrompt, undefined, false, apiSettings);
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

            const result = await generateText(prompt, undefined, false, apiSettings);
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
        setModuleState(prev => ({ ...prev, rewrittenText: content }));
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
                            }

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
                                    }

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