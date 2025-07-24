

import React, { useState, useEffect, useRef } from 'react';
import { StopCircle } from 'lucide-react';
import { ApiSettings, RewriteModuleState, UserProfile } from '../../types';
import { HOOK_LANGUAGE_OPTIONS, REWRITE_STYLE_OPTIONS } from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import HistoryPanel from '../HistoryPanel';
import { generateText } from '../../services/textGenerationService';
import { delay, isSubscribed } from '../../utils';
import { HistoryStorage, MODULE_KEYS } from '../../utils/historyStorage';
import UpgradePrompt from '../UpgradePrompt';


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

    const updateState = (updates: Partial<RewriteModuleState>) => {
        setModuleState(prev => ({ ...prev, ...updates }));
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
                </InfoBox>

                {!hasActiveSubscription && <UpgradePrompt />}
                
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
                    <button
                        onClick={handleSingleRewrite}
                        disabled={!hasActiveSubscription || !originalText.trim() || progress > 0}
                        className="flex-1 bg-gradient-to-r from-green-500 to-teal-500 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {progress > 0 ? `Đang viết lại... (${progress}%)` : '✍️ Viết lại nội dung'}
                    </button>
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
                         </div>
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