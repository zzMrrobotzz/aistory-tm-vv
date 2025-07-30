import React, { useState, useEffect, useRef } from 'react';
import { StopCircle, Languages, Plus, Play, Pause, Trash2, Clock, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
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
  const {
    rewriteLevel, sourceLanguage, targetLanguage, rewriteStyle, customRewriteStyle, adaptContext,
    originalText, rewrittenText, error, progress, loadingMessage,
    isEditing, editError, editLoadingMessage, hasBeenEdited, translation,
    // Queue system properties
    queue = [], queueSystem = { isEnabled: false, isPaused: false, isProcessing: false, currentItem: null, completedCount: 0, totalCount: 0, averageProcessingTime: 60 }
  } = moduleState;
  
  const [currentAbortController, setCurrentAbortController] = useState<AbortController | null>(null);
  const hasActiveSubscription = isSubscribed(currentUser);
  
  // Translation states
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [translatedText, setTranslatedText] = useState<string>('');
  const [translateTargetLang, setTranslateTargetLang] = useState<string>('Vietnamese');
  const [translateStyle, setTranslateStyle] = useState<string>('Default');

  // Update state helper
  const updateState = (updates: Partial<RewriteModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };

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
    if (!text.trim()) return;
    
    updateState({
      queue: [...queue, {
        id: generateId(),
        title: title || `Bài ${queue.length + 1} - ${text.substring(0, 30)}...`,
        originalText: text,
        status: 'waiting',
        progress: 0,
        rewrittenText: null,
        error: null,
        addedAt: new Date(),
        startedAt: null,
        completedAt: null,
        estimatedTimeRemaining: null,
      }],
      queueSystem: {
        ...queueSystem,
        totalCount: queue.length + 1,
      },
    });
  };

  const removeFromQueue = (id: string) => {
    const updatedQueue = queue.filter(item => item.id !== id);
    updateState({
      queue: updatedQueue,
      queueSystem: {
        ...queueSystem,
        totalCount: updatedQueue.length,
      },
    });
  };

  const clearQueue = () => {
    updateState({
      queue: [],
      queueSystem: {
        ...queueSystem,
        totalCount: 0,
        completedCount: 0,
        isProcessing: false,
        isPaused: false,
        currentItem: null,
      },
    });
  };

  const toggleQueueMode = () => {
    updateState({
      queueSystem: {
        ...queueSystem,
        isEnabled: !queueSystem.isEnabled,
      },
    });
  };

  useEffect(() => {
    if (targetLanguage !== sourceLanguage) {
      updateState({ adaptContext: true });
    } else {
      updateState({ adaptContext: false });
    }
  }, [targetLanguage, sourceLanguage]);

  const handleCancel = () => {
    if(currentAbortController) {
      currentAbortController.abort();
      if(isEditing) {
        updateState({ editLoadingMessage: "Đang hủy tinh chỉnh..." });
      } else {
        updateState({ loadingMessage: "Đang hủy viết lại..." });
      }
    }
  };

  const handleSingleRewrite = async () => {
    if (!originalText.trim()) {
      updateState({ error: 'Lỗi: Vui lòng nhập văn bản cần viết lại!' });
      return;
    }

    const abortCtrl = new AbortController();
    setCurrentAbortController(abortCtrl);
    updateState({ error: null, rewrittenText: '', progress: 0, loadingMessage: 'Đang chuẩn bị...', hasBeenEdited: false });
    
    const CHUNK_CHAR_COUNT = 4000;
    const numChunks = Math.ceil(originalText.length / CHUNK_CHAR_COUNT);
    let fullRewrittenText = '';
    let characterMapForItem: string | null = null; // Local variable for char map

    try {
      for (let i = 0; i < numChunks; i++) {
        if (abortCtrl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
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
        
        if (i > 0) await delay(500, abortCtrl.signal); 
        const result = await generateText(prompt, undefined, false, apiSettings);
        let currentChunkText = result.text;

        if (i === 0 && rewriteLevel >= 75) {
          const mapMatch = currentChunkText.match(/\[CHARACTER_MAP\]([\s\S]*?)\[\/CHARACTER_MAP\]/);
          if (mapMatch && mapMatch[1]) {
            characterMapForItem = mapMatch[1].trim();
            currentChunkText = currentChunkText.replace(mapMatch[0], '').trim();
          }
        }

        fullRewrittenText += (fullRewrittenText ? '\n\n' : '') + (currentChunkText || '').trim();
        updateState({ rewrittenText: fullRewrittenText }); // Update UI progressively
      }
      
      // Save to history
      const stats = calculateWordStats(originalText, fullRewrittenText.trim());
      const title = `[${rewriteLevel}%] ${originalText.substring(0, 30)}... (${stats.changePercentage}% thay đổi)`;
      HistoryStorage.saveToHistory(MODULE_KEYS.REWRITE, title, fullRewrittenText.trim());
      
      updateState({ rewrittenText: fullRewrittenText.trim(), loadingMessage: 'Hoàn thành!', progress: 100 });
      logTextRewritten();
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        updateState({ error: `Viết lại đã bị hủy.`, loadingMessage: 'Đã hủy.', progress: 0 });
      } else {
        updateState({ error: `Lỗi viết lại: ${(e as Error).message}`, loadingMessage: 'Lỗi!', progress: 0 });
      }
    } finally {
      setCurrentAbortController(null);
      setTimeout(() => setModuleState(prev => (prev.loadingMessage?.includes("Hoàn thành") || prev.loadingMessage?.includes("Lỗi") || prev.loadingMessage?.includes("hủy")) ? {...prev, loadingMessage: null} : prev), 3000);
    }
  };

  const handlePostRewriteEdit = async () => {
    if (!rewrittenText.trim()) {
      updateState({ editError: 'Không có văn bản để tinh chỉnh.' });
      return;
    }

    const abortCtrl = new AbortController();
    setCurrentAbortController(abortCtrl);
    updateState({ isEditing: true, editError: null, editLoadingMessage: 'Đang tinh chỉnh logic...', hasBeenEdited: false });
    
    const editPrompt = `You are a meticulous story editor. Your task is to refine and polish the given "Văn Bản Đã Viết Lại", ensuring consistency, logical flow, and improved style. You should compare it with the "Văn Bản Gốc Ban Đầu" ONLY to ensure core plot points and character arcs are respected within the requested rewrite level, NOT to revert the text back to the original.

**VĂN BẢN GỐC BAN ĐẦU (for context):**
---
${originalText}
---

**VĂN BẢN ĐÃ VIẾT LẠI (to be edited):**
---
${rewrittenText}
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
      const result = await generateText(editPrompt, undefined, false, apiSettings);
      if (abortCtrl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      updateState({ rewrittenText: result.text || '', isEditing: false, editLoadingMessage: 'Tinh chỉnh hoàn tất!', hasBeenEdited: true });
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        updateState({ editError: 'Tinh chỉnh đã bị hủy.', editLoadingMessage: 'Đã hủy.' });
      } else {
        updateState({ editError: `Lỗi tinh chỉnh: ${(e as Error).message}`, isEditing: false, editLoadingMessage: 'Lỗi!' });
      }
    } finally {
      setCurrentAbortController(null);
      setTimeout(() => setModuleState(prev => (prev.editLoadingMessage?.includes("hoàn tất") || prev.editLoadingMessage?.includes("Lỗi") || prev.editLoadingMessage?.includes("hủy")) ? {...prev, editLoadingMessage: null} : prev), 3000);
    }
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

  // Queue processing functions (từ code gốc)
  const processQueueItem = async (item: RewriteQueueItem) => {
    const CHUNK_CHAR_COUNT = 4000;
    const numChunks = Math.max(3, Math.ceil(item.originalText.length / CHUNK_CHAR_COUNT)); 
    let fullRewrittenText = '';
    let characterMapForItem: string | null = null;

    for (let i = 0; i < numChunks; i++) {
      const currentProgress = Math.round(((i + 1) / numChunks) * 90);
      updateState({
        queue: queue.map(qItem =>
          qItem.id === item.id
            ? { ...qItem, progress: currentProgress }
            : qItem
        ),
      });

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
      
      await delay(500);
      const result = await generateText(prompt, undefined, false, apiSettings);
      let currentChunkText = result?.text || '';

      if (i === 0 && rewriteLevel >= 75) {
        const mapMatch = currentChunkText.match(/\[CHARACTER_MAP\]([\s\S]*?)\[\/CHARACTER_MAP\]/);
        if (mapMatch && mapMatch[1]) {
          characterMapForItem = mapMatch[1].trim();
          currentChunkText = currentChunkText.replace(mapMatch[0], '').trim();
        }
      }

      fullRewrittenText += (fullRewrittenText ? '\n\n' : '') + (currentChunkText || '').trim();
    }

    return fullRewrittenText.trim();
  };

  const startQueueProcessing = async () => {
    if (queueSystem.isProcessing) return;

    updateState({
      queueSystem: {
        ...queueSystem,
        isProcessing: true,
        isPaused: false,
      },
    });

    const waitingItems = queue.filter(item => item.status === 'waiting');
    
    for (const item of waitingItems) {
      if (queueSystem.isPaused) break;

      updateState({
        queue: queue.map(qItem =>
          qItem.id === item.id
            ? { ...qItem, status: 'processing', startedAt: new Date() }
            : qItem
        ),
        queueSystem: {
          ...queueSystem,
          currentItem: item,
        },
      });

      try {
        const rewrittenText = await processQueueItem(item);
        
        updateState({
          queue: queue.map(qItem =>
            qItem.id === item.id
              ? { ...qItem, status: 'completed', rewrittenText, completedAt: new Date(), progress: 100 }
              : qItem
          ),
          queueSystem: {
            ...queueSystem,
            completedCount: queueSystem.completedCount + 1,
          },
        });

        // Save to history
        const stats = calculateWordStats(item.originalText, rewrittenText);
        const title = `[Queue] [${rewriteLevel}%] ${item.originalText.substring(0, 30)}... (${stats.changePercentage}% thay đổi)`;
        HistoryStorage.saveToHistory(MODULE_KEYS.REWRITE, title, rewrittenText);
        
      } catch (error) {
        updateState({
          queue: queue.map(qItem =>
            qItem.id === item.id
              ? { ...qItem, status: 'error', error: (error as Error).message }
              : qItem
          ),
        });
      }
    }

    updateState({
      queueSystem: {
        ...queueSystem,
        isProcessing: false,
        currentItem: null,
      },
    });
  };

  const pauseQueueProcessing = () => {
    updateState({
      queueSystem: {
        ...queueSystem,
        isPaused: true,
      },
    });
  };

  const resumeQueueProcessing = () => {
    updateState({
      queueSystem: {
        ...queueSystem,
        isPaused: false,
      },
    });
    startQueueProcessing();
  };

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    alert("Đã sao chép!");
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
                queueSystem.isEnabled
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
              }`}
            >
              {queueSystem.isEnabled ? 'Tắt Hàng Chờ' : 'Bật Hàng Chờ'}
            </button>
          </div>

          {queueSystem.isEnabled && (
            <div className="space-y-3">
              {/* Queue Stats */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-white p-3 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{queue.length}</div>
                  <div className="text-sm text-gray-600">Tổng cộng</div>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{queueSystem.completedCount}</div>
                  <div className="text-sm text-gray-600">Hoàn thành</div>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{queue.filter(item => item.status === 'waiting').length}</div>
                  <div className="text-sm text-gray-600">Đang chờ</div>
                </div>
              </div>

              {/* Queue Controls */}
              <div className="flex gap-2">
                {!queueSystem.isProcessing ? (
                  <button
                    onClick={startQueueProcessing}
                    disabled={queue.length === 0}
                    className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Bắt đầu
                  </button>
                ) : (
                  <button
                    onClick={queueSystem.isPaused ? resumeQueueProcessing : pauseQueueProcessing}
                    className="flex-1 bg-yellow-600 text-white py-2 px-4 rounded-lg hover:bg-yellow-700 flex items-center justify-center"
                  >
                    {queueSystem.isPaused ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
                    {queueSystem.isPaused ? 'Tiếp tục' : 'Tạm dừng'}
                  </button>
                )}
                <button
                  onClick={clearQueue}
                  disabled={queueSystem.isProcessing}
                  className="bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Queue Items */}
              {queue.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {queue.map((item) => (
                    <div key={item.id} className="bg-white p-3 rounded-lg border flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{item.title}</div>
                        <div className="text-xs text-gray-500">
                          Status: {item.status} | Progress: {item.progress}%
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.status === 'processing' && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
                        {item.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-600" />}
                        {item.status === 'error' && <AlertCircle className="w-4 h-4 text-red-600" />}
                        <button
                          onClick={() => removeFromQueue(item.id)}
                          disabled={queueSystem.isProcessing && item.status === 'processing'}
                          className="text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
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
        
        {anyLoading ? (
          <div className="flex space-x-3">
            <button
              disabled 
              className="w-2/3 bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg shadow-md cursor-not-allowed"
              >
              {loadingMessage || editLoadingMessage || "Đang xử lý..."}
            </button>
            <button
              onClick={handleCancel}
              className="w-1/3 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md"
              aria-label="Hủy tác vụ hiện tại"
            >
              Hủy ⏹️
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            {queueSystem.isEnabled ? (
              <button
                onClick={() => addToQueue(originalText)}
                disabled={!hasActiveSubscription || !originalText.trim()}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 disabled:opacity-50 flex items-center justify-center"
              >
                <Plus className="w-5 h-5 mr-2" />
                Thêm vào hàng chờ
              </button>
            ) : (
              <button onClick={handleSingleRewrite} disabled={anyLoading || !originalText.trim()} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 disabled:opacity-50">
                Viết lại Văn bản
              </button>
            )}
          </div>
        )}

        {error && <ErrorAlert message={error} />}
        {editError && <ErrorAlert message={editError} />}
        
        {rewrittenText && !anyLoading && (
          <div className="mt-6 p-4 border rounded-lg bg-gray-50">
            <h3 className="text-lg font-semibold mb-2">Văn bản đã viết lại:</h3>
            <textarea value={rewrittenText} readOnly rows={10} className="w-full p-3 border-2 border-gray-200 rounded-md bg-white"/>
            <div className="mt-3 flex gap-2">
              <button onClick={() => copyToClipboard(rewrittenText)} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">Sao chép</button>
              <button onClick={handlePostRewriteEdit} className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600">Biên Tập & Tinh Chỉnh</button>
            </div>
          </div>
        )}

        {/* Translation Section */}
        {rewrittenText && !anyLoading && (
          <div className="mt-6 p-4 border rounded-lg bg-blue-50">
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <Languages className="w-5 h-5 mr-2 text-blue-600" />
              Dịch văn bản đã viết lại
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ đích:</label>
                <select 
                  value={translateTargetLang} 
                  onChange={(e) => setTranslateTargetLang(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  disabled={isTranslating}
                >
                  {TRANSLATE_LANGUAGE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phong cách dịch:</label>
                <select 
                  value={translateStyle} 
                  onChange={(e) => setTranslateStyle(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  disabled={isTranslating}
                >
                  {TRANSLATE_STYLE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <button 
              onClick={handleTranslateRewrittenText}
              disabled={isTranslating || !hasActiveSubscription}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 mb-4"
            >
              {isTranslating ? 'Đang dịch...' : 'Dịch văn bản'}
            </button>
            
            {translationError && <ErrorAlert message={translationError} />}
            
            {translatedText && translatedText !== 'Đang dịch...' && translatedText !== 'Dịch lỗi. Vui lòng thử lại.' && (
              <div>
                <h4 className="font-semibold mb-2">Văn bản đã dịch:</h4>
                <textarea 
                  value={translatedText} 
                  readOnly 
                  rows={8} 
                  className="w-full p-3 border border-gray-300 rounded-lg bg-white"
                />
                <button 
                  onClick={() => copyToClipboard(translatedText)} 
                  className="mt-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  Sao chép bản dịch
                </button>
              </div>
            )}
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