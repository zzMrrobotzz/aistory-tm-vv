

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

    const updateState = (updates: Partial<RewriteModuleState>) => {
        setModuleState(prev => ({ ...prev, ...updates }));
    };

    // Generate unique ID
    const generateId = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

    // Queue management functions
    const addToQueue = (text: string, title?: string) => {
        const newItem: RewriteQueueItem = {
            id: generateId(),
            title: title || `Bài ${moduleState.queue.length + 1} - ${text.substring(0, 30)}...`,
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

        updateState({
            queue: [...moduleState.queue, newItem],
            queueSystem: {
                ...moduleState.queueSystem,
                totalCount: moduleState.queue.length + 1,
            },
        });

        // Start processing if not already processing
        setTimeout(() => {
            if (!moduleState.queueSystem.isProcessing && moduleState.queueSystem.isEnabled) {
                processQueue();
            }
        }, 100);
    };

    const removeFromQueue = (id: string) => {
        const updatedQueue = moduleState.queue.filter(item => item.id !== id);
        updateState({
            queue: updatedQueue,
            queueSystem: {
                ...moduleState.queueSystem,
                totalCount: updatedQueue.length,
            },
        });
    };

    const clearQueue = () => {
        updateState({
            queue: [],
            queueSystem: {
                ...moduleState.queueSystem,
                totalCount: 0,
                completedCount: 0,
                currentItem: null,
                isProcessing: false,
            },
        });
    };

    const toggleQueueMode = () => {
        updateState({
            queueSystem: {
                ...moduleState.queueSystem,
                isEnabled: !moduleState.queueSystem.isEnabled,
            },
        });
    };

    const pauseResumeQueue = () => {
        updateState({
            queueSystem: {
                ...moduleState.queueSystem,
                isPaused: !moduleState.queueSystem.isPaused,
            },
        });
    };

    // Process queue items one by one
    const processQueue = async () => {
        const waitingItems = moduleState.queue.filter(item => item.status === 'waiting');
        if (waitingItems.length === 0 || moduleState.queueSystem.isPaused) {
            updateState({
                queueSystem: {
                    ...moduleState.queueSystem,
                    isProcessing: false,
                    currentItem: null,
                },
            });
            return;
        }

        const currentItem = waitingItems[0];
        const startTime = Date.now();

        // Update current item status
        updateState({
            queueSystem: {
                ...moduleState.queueSystem,
                isProcessing: true,
                currentItem: currentItem,
            },
            queue: moduleState.queue.map(item =>
                item.id === currentItem.id
                    ? { ...item, status: 'processing', startedAt: new Date() }
                    : item
            ),
        });

        try {
            // Use existing rewrite logic
            await processQueueItem(currentItem);
            
            const endTime = Date.now();
            const processingTime = (endTime - startTime) / 1000; // seconds
            
            // Update completion stats
            updateState({
                queueSystem: {
                    ...moduleState.queueSystem,
                    completedCount: moduleState.queueSystem.completedCount + 1,
                    averageProcessingTime: 
                        (moduleState.queueSystem.averageProcessingTime + processingTime) / 2,
                },
                queue: moduleState.queue.map(item =>
                    item.id === currentItem.id
                        ? { ...item, status: 'completed', completedAt: new Date(), progress: 100 }
                        : item
                ),
            });

        } catch (error) {
            // Mark current item as error
            updateState({
                queue: moduleState.queue.map(item =>
                    item.id === currentItem.id
                        ? { ...item, status: 'error', error: (error as Error).message }
                        : item
                ),
            });
        }

        // Continue with next item after a short delay
        setTimeout(() => {
            if (!moduleState.queueSystem.isPaused && moduleState.queueSystem.isEnabled) {
                processQueue();
            }
        }, 1000);
    };

    // Process individual queue item (extracted from handleSingleRewrite)
    const processQueueItem = async (item: RewriteQueueItem) => {
        const CHUNK_CHAR_COUNT = 4000;
        const numChunks = Math.ceil(item.originalText.length / CHUNK_CHAR_COUNT);
        let fullRewrittenText = '';

        for (let i = 0; i < numChunks; i++) {
            // Update progress
            const currentProgress = Math.round(((i + 1) / numChunks) * 100);
            updateState({
                queue: moduleState.queue.map(qItem =>
                    qItem.id === item.id
                        ? { ...qItem, progress: currentProgress }
                        : qItem
                ),
            });

            const textChunk = item.originalText.substring(i * CHUNK_CHAR_COUNT, (i + 1) * CHUNK_CHAR_COUNT);
            
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

        // Update final result
        updateState({
            queue: moduleState.queue.map(qItem =>
                qItem.id === item.id
                    ? { ...qItem, rewrittenText: fullRewrittenText.trim() }
                    : qItem
            ),
        });

        // Log usage statistics
        logApiCall('rewrite', numChunks);
        logTextRewritten('rewrite', 1);
    };

    useEffect(() => {
        if (targetLanguage !== sourceLanguage) {
            updateState({ adaptContext: true }); 
        } else {
            updateState({ adaptContext: false });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetLanguage, sourceLanguage]);

    const handleSingleRewrite = async () => {
         if (!originalText.trim()) {
            updateState({ error: 'Lỗi: Vui lòng nhập văn bản cần viết lại!' });
            return;
        }
        updateState({ error: null, rewrittenText: '', progress: 0, loadingMessage: 'Đang chuẩn bị...', hasBeenEdited: false });
        
        // Create new AbortController for this operation
        abortControllerRef.current = new AbortController();
        
        const CHUNK_CHAR_COUNT = 4000;
        const numChunks = Math.ceil(originalText.length / CHUNK_CHAR_COUNT);
        let fullRewrittenText = '';

        try {
            for (let i = 0; i < numChunks; i++) {
                // Check if operation was aborted
                if (abortControllerRef.current?.signal.aborted) {
                    updateState({ loadingMessage: 'Đã dừng!', progress: 0 });
                    return;
                }
                updateState({ progress: Math.round(((i + 1) / numChunks) * 100), loadingMessage: `Đang viết lại phần ${i + 1}/${numChunks}...` });
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
                
                await delay(500); // Simulate API call delay
                const result = await generateText(prompt, undefined, false, apiSettings);
                fullRewrittenText += (fullRewrittenText ? '\n\n' : '') + (result?.text || '').trim();
                updateState({ rewrittenText: fullRewrittenText }); // Update UI progressively
            }
            updateState({ rewrittenText: fullRewrittenText.trim(), loadingMessage: 'Hoàn thành!', progress: 100 });
            
            // Save to history on successful completion
            if (fullRewrittenText.trim()) {
                const title = `Viết lại - ${new Date().toLocaleString('vi-VN')}`;
                HistoryStorage.saveToHistory(MODULE_KEYS.REWRITE, title, fullRewrittenText.trim());
            }
            
            // Log usage statistics
            logApiCall('rewrite', numChunks); // Log API calls used
            logTextRewritten('rewrite', 1); // Log 1 text rewritten
            
            // Reset progress to 0 after completion to enable button
            setTimeout(() => updateState({ progress: 0 }), 1500);
        } catch (e) {
            if (abortControllerRef.current?.signal.aborted) {
                updateState({ loadingMessage: 'Đã dừng!', progress: 0 });
            } else {
                updateState({ error: `Lỗi viết lại: ${(e as Error).message}`, loadingMessage: 'Lỗi!', progress: 0 });
            }
        } finally {
            abortControllerRef.current = null;
            setTimeout(() => updateState({ loadingMessage: null }), 3000);
        }
    };

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            updateState({ loadingMessage: 'Đang dừng...', progress: 0 });
        }
    };

    const handlePostRewriteEdit = async () => {
         if (!rewrittenText.trim()) {
            updateState({ editError: 'Không có văn bản để tinh chỉnh.' });
            return;
        }
        updateState({ isEditing: true, editError: null, editLoadingMessage: 'Đang tinh chỉnh logic...', hasBeenEdited: false });
        
        const editPrompt = `You are a meticulous story editor. Your task is to refine and polish the given text, ensuring consistency, logical flow, and improved style.

**Text to Edit:**
---
${rewrittenText}
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
            updateState({ rewrittenText: result?.text || '', isEditing: false, editLoadingMessage: 'Tinh chỉnh hoàn tất!', hasBeenEdited: true });
            
            // Log usage statistics for post-edit
            logApiCall('rewrite', 1); // Log 1 additional API call for editing
        } catch (e) {
            updateState({ editError: `Lỗi tinh chỉnh: ${(e as Error).message}`, isEditing: false, editLoadingMessage: 'Lỗi!' });
        } finally {
             setTimeout(() => updateState({ editLoadingMessage: null }), 3000);
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
        updateState({ rewrittenText: content });
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
        <ModuleContainer title="🔄 Viết Lại Nhanh">
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
                        <input type="range" id="rewriteSlider" min="0" max="100" step="25" value={rewriteLevel} onChange={(e) => updateState({ rewriteLevel: parseInt(e.target.value)})} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" disabled={anyLoading}/>
                        <div className="mt-2 text-sm text-gray-600 bg-indigo-50 p-3 rounded-md border border-indigo-200">
                            <strong>Giải thích mức {rewriteLevel}%:</strong> {getCurrentLevelDescription()}
                        </div>
                    </div>
                     <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div>
                            <label htmlFor="quickSourceLang" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ gốc:</label>
                            <select id="quickSourceLang" value={sourceLanguage} onChange={(e) => updateState({ sourceLanguage: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg" disabled={anyLoading}>
                            {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="quickTargetLang" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ đầu ra:</label>
                            <select id="quickTargetLang" value={targetLanguage} onChange={(e) => updateState({ targetLanguage: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg" disabled={anyLoading}>
                            {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="quickRewriteStyle" className="block text-sm font-medium text-gray-700 mb-1">Phong cách viết lại:</label>
                            <select id="quickRewriteStyle" value={rewriteStyle} onChange={(e) => updateState({ rewriteStyle: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg" disabled={anyLoading}>
                            {REWRITE_STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>
                    </div>
                     {rewriteStyle === 'custom' && (
                        <div>
                            <label htmlFor="quickCustomStyle" className="block text-sm font-medium text-gray-700 mb-1">Hướng dẫn tùy chỉnh:</label>
                            <textarea id="quickCustomStyle" value={customRewriteStyle} onChange={(e) => updateState({ customRewriteStyle: e.target.value })} rows={2} className="w-full p-3 border-2 border-gray-300 rounded-lg" disabled={anyLoading}/>
                        </div>
                    )}
                </div>
                 <div>
                    <label htmlFor="quickOriginalText" className="block text-sm font-medium text-gray-700 mb-1">Văn bản gốc:</label>
                    <textarea id="quickOriginalText" value={originalText} onChange={(e) => updateState({ originalText: e.target.value })} rows={6} className="w-full p-3 border-2 border-gray-300 rounded-lg" placeholder="Nhập văn bản..." disabled={anyLoading}></textarea>
                </div>
                <div className="flex gap-3">
                    {moduleState.queueSystem.isEnabled ? (
                        <button
                            onClick={() => {
                                if (originalText.trim()) {
                                    addToQueue(originalText.trim());
                                    updateState({ originalText: '' }); // Clear input for next item
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
                         <div className="mt-3 flex gap-2">
                            <button 
                                onClick={() => copyToClipboard(rewrittenText)} 
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                            >
                                Sao chép
                            </button>
                            <button 
                                onClick={handlePostRewriteEdit} 
                                disabled={!hasActiveSubscription || anyLoading}
                                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
                            >
                                Biên Tập & Tinh Chỉnh
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