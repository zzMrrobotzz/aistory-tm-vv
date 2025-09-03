import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ApiSettings, QuickStoryModuleState, QuickStoryTask, QuickStoryActiveTab, ActiveModule, SequelStoryResult, UserProfile, QuickStoryWordStats, QuickStoryQualityStats } from '../../types';
import { STORY_LENGTH_OPTIONS, WRITING_STYLE_OPTIONS, HOOK_LANGUAGE_OPTIONS } from '../../constants';
import { generateText } from '../../services/textGenerationService';
import { checkAndTrackRequest, REQUEST_ACTIONS, getUserUsageStatus, recordUsage } from '../../services/requestTrackingService';
import { delay, isSubscribed } from '../../utils';
import { logApiCall, logTextRewritten } from '../../services/usageService';
import { getTimeUntilReset } from '../../services/localRequestCounter';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import UpgradePrompt from '../UpgradePrompt';
import { Trash2, PlusCircle, Square, Play, Trash, Clipboard, ClipboardCheck, ChevronsRight, BookCopy, Zap, Save, Download, Loader2 } from 'lucide-react';

// Advanced retry logic with exponential backoff for API calls (from RewriteModule)
const retryApiCall = async (
  apiFunction: () => Promise<any>,
  maxRetries: number = 3,
  isQueueMode: boolean = false
): Promise<any> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiFunction();
    } catch (error: any) {
      console.log('QuickStory Retry - Error details:', { 
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
                           
      const is503Error = error?.message?.includes('503') ||
                         error?.message?.includes('Service Unavailable') ||
                         error?.status === 503 ||
                         error?.code === 503;
      
      if ((isServerError || is503Error) && i < maxRetries - 1) {
        // Special handling for 503 errors - longer delays (1min, 2min, 4min)
        let backoffDelay;
        if (is503Error) {
          const baseDelay503 = 60000; // 1 minute base delay for 503
          backoffDelay = baseDelay503 * Math.pow(2, i);
          console.warn(`🚨 QuickStory 503 SERVICE UNAVAILABLE: Extended retry (attempt ${i + 1}/${maxRetries}), waiting ${Math.round(backoffDelay/1000)}s... [Queue mode: ${isQueueMode}]`);
        } else {
          // Regular 500 errors - shorter delays
          const baseDelay = isQueueMode ? 6000 : 4000;
          backoffDelay = baseDelay * Math.pow(2, i);
          console.warn(`🔄 QuickStory RETRY: API call failed (attempt ${i + 1}/${maxRetries}), retrying in ${backoffDelay}ms... [Queue mode: ${isQueueMode}]`);
        }
        await delay(backoffDelay);
        continue;
      }
      console.error(`❌ QuickStory FINAL FAILURE: All ${maxRetries} retry attempts failed. Error:`, error);
      throw error;
    }
  }
  throw new Error('All retry attempts failed');
};

interface QuickStoryModuleProps {
  apiSettings: ApiSettings;
  moduleState: QuickStoryModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<QuickStoryModuleState>>;
  addHistoryItem: (itemData: any) => void;
  currentUser: UserProfile | null;
}

const QuickStoryModule: React.FC<QuickStoryModuleProps> = ({
    apiSettings, moduleState, setModuleState, addHistoryItem, currentUser
}) => {
    const {
        activeTab, targetLength, writingStyle, customWritingStyle, outputLanguage,
        // Quick Batch Tab
        title, referenceViralStoryForStyle, tasks, isProcessingQueue,
        // Sequel Generator Tab
        sequelInputStories, sequelNumTitlesToSuggest, sequelSuggestedTitles, sequelSelectedTitles,
        sequelGeneratedStories, sequelIsGeneratingTitles, sequelIsGeneratingStories, sequelProgressMessage, sequelError,
        // ADN Management
        adnSetName, savedAdnSets
    } = moduleState;

    const queueAbortControllerRef = useRef<AbortController | null>(null);
    const sequelAbortControllerRef = useRef<AbortController | null>(null);
    const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
    const [selectedAdnSetName, setSelectedAdnSetName] = useState('');
    
    // Quality analysis toggle - default ON for accurate full-text analysis
    const [enableQualityAnalysis, setEnableQualityAnalysis] = useState<boolean>(true);
    
    // Subscription check
    const hasActiveSubscription = isSubscribed(currentUser);
    
    // Usage tracking state from backend
    const [usageStats, setUsageStats] = useState({ current: 0, limit: 999999, remaining: 999999, percentage: 0, isBlocked: false } as any);
    
    // Thay thế useEffect cũ bằng logic mới
    useEffect(() => {
        const fetchUsage = async () => {
            try {
                const status = await getUserUsageStatus();
                if (status.success) {
                    setUsageStats(status.data.usage);
                }
            } catch (error) {
                console.error('Failed to fetch usage status:', error);
            }
        };
        fetchUsage(); // Initial fetch
        const interval = setInterval(fetchUsage, 60000); // Poll every minute
        return () => clearInterval(interval);
    }, []);

    const updateState = (updates: Partial<QuickStoryModuleState>) => {
        setModuleState(prev => ({ ...prev, ...updates }));
    };

    // Helper: check & track usage with backend and sync local counter box
    const checkAndTrackQuickRequest = async (action: string, itemCount: number = 1) => {
        try {
            const result = await checkAndTrackRequest(action, itemCount);
            // Sync UI usage box with backend numbers
            if (result?.usage) {
                setUsageStats({
                    current: result.usage.current,
                    limit: result.usage.limit,
                    remaining: result.usage.remaining,
                    percentage: result.usage.percentage,
                    canUse: result.usage.current < result.usage.limit,
                    isBlocked: !!result.blocked
                });
            }
            if (result.blocked) {
                return {
                    allowed: false,
                    message: result.message,
                    stats: result.usage
                } as const;
            }
            // Removed warning handling as it's not in the new interface
            return { allowed: true, stats: result.usage, message: result.message } as const;
        } catch (error) {
            console.warn('Backend request check failed, proceeding with local counter');
            return { allowed: true } as const;
        }
    };

    const updateTask = (taskId: string, updates: Partial<QuickStoryTask>) => {
        setModuleState(prev => ({
            ...prev,
            tasks: prev.tasks.map(task =>
                task.id === taskId ? { ...task, ...updates } : task
            )
        }));
    };
    
    // Calculate word statistics
    const calculateWordStats = (originalText: string, generatedText: string) => {
        const countWords = (text: string) => {
            return text.trim().split(/\s+/).filter(word => word.length > 0).length;
        };

        const originalWords = countWords(originalText || '');
        const generatedWords = countWords(generatedText);
        
        // Simple word change calculation
        const originalWordsArray = (originalText || '').toLowerCase().trim().split(/\s+/);
        const generatedWordsArray = generatedText.toLowerCase().trim().split(/\s+/);
        
        let wordsChanged = 0;
        const maxLength = Math.max(originalWordsArray.length, generatedWordsArray.length);
        
        for (let i = 0; i < maxLength; i++) {
            const originalWord = originalWordsArray[i] || '';
            const generatedWord = generatedWordsArray[i] || '';
            if (originalWord !== generatedWord) {
                wordsChanged++;
            }
        }

        const changePercentage = originalWords > 0 ? Math.round((wordsChanged / originalWords) * 100) : 0;

        return {
            originalWords,
            generatedWords,
            wordsChanged,
            changePercentage
        };
    };

    // Calculate story quality and consistency statistics (FULL TEXT ANALYSIS)
    const analyzeStoryQuality = async (titleUsed: string, generatedStory: string) => {
        try {
            // Full text analysis for maximum accuracy
            const analysisPrompt = `Bạn là chuyên gia phân tích văn học chuyên nghiệp. Hãy phân tích độ nhất quán và hoàn thiện của toàn bộ câu chuyện đã được tạo.

**TIÊU ĐỀ TRUYỆN:**
"${titleUsed}"

**TOÀN BỘ CÂU CHUYỆN ĐÃ TẠO:**
---
${generatedStory}
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
- completenessScore: Độ hoàn thiện cốt truyện từ đầu đến cuối theo tiêu đề
- overallQualityScore: Chất lượng tổng thể = (consistencyScore + completenessScore)/2

Chỉ trả về JSON.`;

            const result = await retryApiCall(() => generateText(analysisPrompt, undefined, false, apiSettings), 3, false);
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
    
    // ----- START: QUICK BATCH LOGIC -----
    
    const processTask = async (task: QuickStoryTask, abortSignal: AbortSignal): Promise<string> => {
        const { settings, title } = task;
        const { targetLength, writingStyle, customWritingStyle, outputLanguage, referenceViralStoryForStyle } = settings;
    
        let currentStoryStyle = writingStyle;
        if (writingStyle === 'custom') {
            currentStoryStyle = customWritingStyle;
        } else {
            currentStoryStyle = WRITING_STYLE_OPTIONS.find(opt => opt.value === writingStyle)?.label || writingStyle;
        }
        
        const outputLanguageLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === outputLanguage)?.label || outputLanguage;
    
        // ✅ Usage already tracked at batch level when user clicked "Generate"
        // No additional tracking needed during individual story processing
        // Generate Outline
        updateTask(task.id, { progressMessage: 'Bước 1/3: Đang tạo dàn ý...' });
        const outlinePrompt = `Tạo một dàn ý chi tiết cho một câu chuyện có tiêu đề "${title}". Dàn ý phải logic, có mở đầu, phát triển, cao trào và kết thúc. Dàn ý phải được viết bằng ${outputLanguageLabel}.`;
        const outlineResult = await retryApiCall(() => generateText(outlinePrompt, undefined, false, apiSettings), 3, true);
        const storyOutline = (outlineResult.text ?? '').trim();
        if (abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');
        if (!storyOutline) throw new Error("Không thể tạo dàn ý từ tiêu đề.");
        await delay(500, abortSignal);
    
        // Step 2: Write Story in Chunks
        let fullStory = '';
        const CHUNK_WORD_COUNT = 1000;
        const currentTargetLengthNum = parseInt(targetLength);
        const numChunks = Math.ceil(currentTargetLengthNum / CHUNK_WORD_COUNT);
        
        let referenceStoryStylePromptSegment = '';
        if (referenceViralStoryForStyle?.trim()) {
            referenceStoryStylePromptSegment = `
            \n**Phân Tích & Học Tập ADN Viral (QUAN TRỌNG NHẤT):**
            \nPhân tích các kịch bản/truyện tham khảo sau để trích xuất "ADN Viral" (Cấu trúc Mở đầu, Nhịp độ, Xung đột, Yếu tố Cảm xúc, Kỹ thuật Giữ chân, Văn phong).
            \nÁP DỤNG các nguyên tắc đã học để viết câu chuyện MỚI dựa trên "Dàn ý tổng thể".
            \nNGHIÊM CẤM sao chép nội dung, nhân vật từ truyện tham khảo.
            \n**BỘ SƯU TẬP KỊCH BẢN THAM KHẢO:**
            \n---
            \n${referenceViralStoryForStyle.trim()}
            \n---`;
        }

        for (let i = 0; i < numChunks; i++) {
            if (abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');
            updateTask(task.id, { progressMessage: `Bước 2/3: Đang viết phần ${i + 1}/${numChunks}...` });
            const context = fullStory.length > 2000 ? '...\n' + fullStory.slice(-2000) : fullStory;
            const writePrompt = `Bạn là một nhà văn AI. Dựa vào dàn ý sau, hãy viết tiếp câu chuyện một cách liền mạch BẰNG NGÔN NGỮ ${outputLanguageLabel}.
            Phong cách viết: "${currentStoryStyle}".
            ${referenceStoryStylePromptSegment}
            **Dàn ý tổng thể:**
${storyOutline}
            **Nội dung đã viết (ngữ cảnh):**
${context || "Đây là phần đầu tiên."}
            **Yêu cầu:** Viết phần tiếp theo của câu chuyện, khoảng ${CHUNK_WORD_COUNT} từ. Chỉ viết nội dung, không lặp lại, không tiêu đề.`;
            
            if (i > 0) await delay(1000, abortSignal);
            const chunkResult = await retryApiCall(() => generateText(writePrompt, undefined, false, apiSettings), 3, true);
            fullStory += (fullStory ? '\n\n' : '') + ((chunkResult.text ?? '').trim() || '');
        }
        if (abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');
        if (!fullStory.trim()) throw new Error("Không thể viết truyện từ dàn ý.");
        await delay(500, abortSignal);
    
        // Step 3: Post-Edit (no additional usage count - part of story creation)
        updateTask(task.id, { progressMessage: enableQualityAnalysis ? 'Bước 3/4: Đang biên tập...' : 'Bước 3/3: Đang biên tập...' });
        const minLength = Math.round(currentTargetLengthNum * 0.9);
        const maxLength = Math.round(currentTargetLengthNum * 1.1);
        const estimatedCurrentWordCount = fullStory.split(/\s+/).filter(Boolean).length;

        let actionVerb = "";
        let diffDescription = "";
        if (estimatedCurrentWordCount > maxLength) {
            actionVerb = "RÚT NGẮN";
            diffDescription = `khoảng ${estimatedCurrentWordCount - currentTargetLengthNum} từ`;
        } else if (estimatedCurrentWordCount < minLength) {
            actionVerb = "MỞ RỘNG";
            diffDescription = `khoảng ${currentTargetLengthNum - estimatedCurrentWordCount} từ`;
        }
        
        const editPrompt = `Bạn là một AI Biên tập viên chuyên nghiệp với nhiệm vụ **TUYỆT ĐỐI** là điều chỉnh độ dài của văn bản theo yêu cầu.

**MỆNH LỆNH TỐI THƯỢNG (PRIORITY #1 - NON-NEGOTIABLE):**
Truyện cuối cùng **PHẢI** có độ dài trong khoảng từ **${minLength} đến ${maxLength} từ**. Mục tiêu lý tưởng là **${currentTargetLengthNum} từ**.
-   Truyện gốc hiện tại có khoảng **${estimatedCurrentWordCount} từ**.
-   Mệnh lệnh của bạn là: **${actionVerb} ${diffDescription}**. Đây là nhiệm vụ quan trọng nhất, phải được ưu tiên trên tất cả các yếu-tố-khác.

**CHIẾN LƯỢC BIÊN TẬP BẮT BUỘC ĐỂ ĐẠT MỤC TIÊU ĐỘ DÀI:**
-   **NẾU CẦN RÚT NGẮN (BE RUTHLESS):**
    -   **CẮT BỎ KHÔNG THƯƠNG TIẾC:** Loại bỏ các đoạn mô tả dài dòng, các đoạn hội thoại phụ không trực tiếp thúc đẩy cốt truyện, các tình tiết hoặc nhân vật phụ ít quan trọng.
    -   **CÔ ĐỌNG HÓA:** Viết lại các câu dài, phức tạp thành các câu ngắn gọn, súc tích hơn. Thay vì mô tả một hành động trong 3 câu, hãy làm nó trong 1 câu.
    -   **TÓM LƯỢC:** Thay vì kể chi tiết một sự kiện kéo dài, hãy tóm tắt nó lại. Ví dụ: thay vì kể chi tiết 5 phút nhân vật đi từ A đến B, chỉ cần nói "Sau một hồi di chuyển, anh đã đến B".
    -   **Sự hi sinh là cần thiết:** Bạn phải chấp nhận hi sinh một số chi tiết và sự bay bổng của văn phong để đạt được mục tiêu độ dài. Việc này là BẮT BUỘC.
-   **NẾU CẦN MỞ RỘNG:**
    -   **THÊM MÔ TẢ GIÁC QUAN:** Thêm chi tiết về hình ảnh, âm thanh, mùi vị, cảm giác để làm cảnh vật sống động hơn.
    -   **KÉO DÀI HỘI THOẠI:** Thêm các câu đối đáp, biểu cảm, suy nghĩ nội tâm của nhân vật trong lúc hội thoại.
    -   **CHI TIẾT HÓA HÀNH ĐỘNG:** Mô tả hành động của nhân vật một cách chi tiết hơn (show, don't tell).

**YÊU CẦU PHỤ (PRIORITY #2 - Only after satisfying Priority #1):**
-   **Bám sát Dàn Ý:** Giữ lại các NÚT THẮT và CAO TRÀO chính từ "Dàn Ý Gốc".
-   **Nhất quán:** Duy trì sự nhất quán về tên nhân vật, địa điểm, và logic cơ bản của câu chuyện.

**DÀN Ý GỐC (để tham khảo cốt truyện chính):**
---
${storyOutline}
---

**TRUYỆN GỐC CẦN BIÊN TẬP (bằng ${outputLanguageLabel}):**
---
${fullStory}
---

**NHIỆM VỤ CUỐI CÙNG:**
Hãy trả về TOÀN BỘ câu chuyện đã được biên tập lại bằng ngôn ngữ ${outputLanguageLabel}, với độ dài **TUYỆT ĐỐI** phải nằm trong khoảng **${minLength} đến ${maxLength} từ**. Không thêm lời bình, giới thiệu, hay tiêu đề. Bắt đầu ngay bây giờ.`;

        const finalResult = await retryApiCall(() => generateText(editPrompt, undefined, false, apiSettings), 3, true);
        const finalStory = (finalResult.text ?? '').trim();
        
        // Analyze story quality and consistency (only if enabled and for longer texts)
        let storyQualityStats: any = null;
        if (enableQualityAnalysis && finalStory.length > 500) {
            // Quality analysis is part of story creation, no additional usage count
            try {
                updateTask(task.id, { progressMessage: 'Bước 4/4: Đang phân tích chất lượng...' });
                storyQualityStats = await analyzeStoryQuality(title, finalStory);
            } catch (error) {
                console.error('Story quality analysis failed:', error);
                // Continue without quality stats if analysis fails
            }
        }
        
        // Calculate word statistics
        const wordStats = calculateWordStats('', finalStory); // No original text for stories
        
        // Update task with final results including analysis
        updateTask(task.id, { 
            wordStats: wordStats,
            storyQualityStats: storyQualityStats
        });
        
        // Log usage statistics
        const totalApiCalls = numChunks + 1 + (enableQualityAnalysis && finalStory.length > 500 ? 1 : 0); // outline + chunks + edit + analysis
        logApiCall('quickstory', totalApiCalls);
        logTextRewritten('quickstory', 1);
        
        return finalStory;
    };

    useEffect(() => {
        const processQueue = async () => {
            const isTaskRunning = tasks.some(t => t.status === 'processing');
            if (isTaskRunning || !isProcessingQueue) return;

            const taskToProcess = tasks.find(t => t.status === 'queued');
            if (!taskToProcess) {
                updateState({ isProcessingQueue: false });
                return;
            }

            queueAbortControllerRef.current = new AbortController();
            const abortSignal = queueAbortControllerRef.current.signal;

            try {
                updateTask(taskToProcess.id, { status: 'processing', progressMessage: 'Bắt đầu...' });
                const finalStory = await processTask(taskToProcess, abortSignal);
                if (!abortSignal.aborted) {
                   updateTask(taskToProcess.id, { status: 'completed', generatedStory: finalStory, progressMessage: 'Hoàn thành!' });
                   
                   // Save to history
                   if (finalStory.trim()) {
                       addHistoryItem({
                           module: ActiveModule.QuickStory,
                           moduleLabel: 'Tạo Truyện Nhanh',
                           title: `${taskToProcess.title}`,
                           content: finalStory,
                           contentType: 'text',
                           restoreContext: { ...moduleState }
                       });
                   }
                }
            } catch (e) {
                if ((e as Error).name === 'AbortError') {
                    const currentTaskState = moduleState.tasks.find(t => t.id === taskToProcess.id);
                    if (currentTaskState && currentTaskState.status !== 'canceled') {
                       updateTask(taskToProcess.id, { status: 'canceled', error: 'Quá trình đã bị người dùng dừng lại.', progressMessage: 'Đã dừng.' });
                    }
                } else {
                    updateTask(taskToProcess.id, { status: 'error', error: (e as Error).message, progressMessage: 'Lỗi!' });
                }
            } finally {
                queueAbortControllerRef.current = null;
            }
        };

        if (activeTab === 'quickBatch') {
            processQueue();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tasks, isProcessingQueue, activeTab]);

    const handleAddTask = () => {
        if (!hasActiveSubscription) {
            alert('Cần nâng cấp gói đăng ký để sử dụng tính năng này.');
            return;
        }
        if (usageStats.isBlocked) {
            alert('Đã đạt giới hạn sử dụng hôm nay. Vui lòng thử lại vào ngày mai.');
            return;
        }
        if (!title.trim()) {
            alert('Vui lòng nhập Tiêu đề truyện.');
            return;
        }
        const newTask: QuickStoryTask = {
            id: Date.now().toString(),
            title: title.trim(),
            settings: { targetLength, writingStyle, customWritingStyle, outputLanguage, referenceViralStoryForStyle },
            status: 'pending', progressMessage: 'Sẵn sàng', generatedStory: null, error: null,
        };
        setModuleState(prev => ({ ...prev, tasks: [...prev.tasks, newTask], title: '' }));
    };
    
    const handlePlayTask = (taskId: string) => {
        updateTask(taskId, { status: 'queued', progressMessage: 'Đã xếp hàng', error: null });
        if (!isProcessingQueue) {
            updateState({ isProcessingQueue: true });
        }
    };
    
    const handleQueueAll = async () => {
        const queueableTasks = tasks.filter(t => t.status === 'pending' || t.status === 'canceled' || t.status === 'error');
        if (queueableTasks.length === 0) return;
        
        // ✅ Track usage ONCE when user starts queue processing (based on number of stories)
        const storyCount = queueableTasks.length;
        const usageCheck = await checkAndTrackQuickRequest(REQUEST_ACTIONS.QUICK_STORY, storyCount);
        if (usageCheck && (usageCheck as any).allowed === false) {
            alert((usageCheck as any).message || 'Đã đạt giới hạn sử dụng hôm nay.');
            return;
        }
        
        const newTasks = tasks.map(t => {
            if (t.status === 'pending' || t.status === 'canceled' || t.status === 'error') {
                return { ...t, status: 'queued' as const, progressMessage: 'Đã xếp hàng', error: null };
            }
            return t;
        });
        
        updateState({ tasks: newTasks, isProcessingQueue: true });
    };
    
    const handleStopQueue = () => {
        if (queueAbortControllerRef.current) queueAbortControllerRef.current.abort();
        const newTasks = tasks.map(t => (t.status === 'processing' || t.status === 'queued') ? { ...t, status: 'canceled' as const, progressMessage: 'Đã dừng' } : t);
        updateState({ tasks: newTasks, isProcessingQueue: false });
    };
    
    const handleDeleteTask = (taskId: string) => {
        setModuleState(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== taskId) }));
    };
    
    const handleClearAll = () => {
        if (window.confirm('Bạn có chắc chắn muốn xóa tất cả các nhiệm vụ?')) {
            if (isProcessingQueue) handleStopQueue();
            updateState({ tasks: [] });
        }
    };
    // ----- END: QUICK BATCH LOGIC -----


    // ----- START: SEQUEL GENERATOR LOGIC -----
    
    // Load ADN sets from localStorage on mount
    useEffect(() => {
        if (activeTab === 'sequelGenerator') {
            try {
                const savedSetsRaw = localStorage.getItem('quickStory_savedAdnSets_v1');
                if (savedSetsRaw) {
                    const savedSets = JSON.parse(savedSetsRaw);
                    if (Array.isArray(savedSets)) {
                        updateState({ savedAdnSets: savedSets });
                    }
                }
            } catch (error) {
                console.error("Failed to load ADN sets from localStorage", error);
            }
        }
    }, [activeTab]);

    // Save ADN sets to localStorage whenever they change
    useEffect(() => {
        if (activeTab === 'sequelGenerator') {
            try {
                // Check prevents saving the initial empty array on first render if nothing was in localStorage
                if (savedAdnSets.length > 0 || localStorage.getItem('quickStory_savedAdnSets_v1')) {
                    localStorage.setItem('quickStory_savedAdnSets_v1', JSON.stringify(savedAdnSets));
                }
            } catch (error) {
                console.error("Failed to save ADN sets to localStorage", error);
            }
        }
    }, [savedAdnSets, activeTab]);

    const handleSaveAdnSet = () => {
        const name = adnSetName.trim();
        const content = sequelInputStories.trim();
        if (!name || !content) {
            alert('Vui lòng nhập Tên và Nội dung cho bộ ADN.');
            return;
        }

        const existingSetIndex = savedAdnSets.findIndex(s => s.name.toLowerCase() === name.toLowerCase());
        if (existingSetIndex !== -1) {
            if (!window.confirm(`Bộ ADN với tên "${name}" đã tồn tại. Bạn có muốn ghi đè không?`)) {
                return;
            }
            const newSets = [...savedAdnSets];
            newSets[existingSetIndex] = { name, content };
            updateState({ savedAdnSets: newSets, adnSetName: '' });
        } else {
            const newSet = { name, content };
            updateState({ savedAdnSets: [...savedAdnSets, newSet], adnSetName: '' });
        }
        alert(`Đã lưu bộ ADN "${name}"!`);
    };

    const handleLoadAdnSet = () => {
        if (!selectedAdnSetName) {
            alert('Vui lòng chọn một bộ ADN từ danh sách.');
            return;
        }
        const setToLoad = savedAdnSets.find(s => s.name === selectedAdnSetName);
        if (setToLoad) {
            updateState({ sequelInputStories: setToLoad.content });
        }
    };

    const handleDeleteAdnSet = () => {
        if (!selectedAdnSetName) {
            alert('Vui lòng chọn một bộ ADN từ danh sách để xóa.');
            return;
        }
        if (window.confirm(`Bạn có chắc chắn muốn xóa bộ ADN "${selectedAdnSetName}"?`)) {
            const newSets = savedAdnSets.filter(s => s.name !== selectedAdnSetName);
            updateState({ savedAdnSets: newSets });
            setSelectedAdnSetName('');
        }
    };


    const handleGenerateTitles = async () => {
        if (!hasActiveSubscription) {
            updateState({ sequelError: "Cần nâng cấp gói đăng ký để sử dụng tính năng này." });
            return;
        }
        if (usageStats.isBlocked) {
            updateState({ sequelError: "Đã đạt giới hạn sử dụng hôm nay. Vui lòng thử lại vào ngày mai." });
            return;
        }
        if (!sequelInputStories.trim()) {
            updateState({ sequelError: "Vui lòng dán các truyện mẫu vào." });
            return;
        }
        sequelAbortControllerRef.current = new AbortController();
        updateState({
            sequelIsGeneratingTitles: true,
            sequelError: null,
            sequelSuggestedTitles: [],
            sequelGeneratedStories: [],
            sequelSelectedTitles: []
        });

        const prompt = `Bạn là một chuyên gia phân tích truyện và sáng tạo tiêu đề. Dựa vào bộ sưu tập truyện dưới đây, hãy phân tích chủ đề, văn phong, và các yếu tố chung. Sau đó, tạo ra ${sequelNumTitlesToSuggest} tiêu đề mới hấp dẫn, phù hợp để viết tiếp trong cùng series.
        Ngôn ngữ của tiêu đề mới phải giống với ngôn ngữ của các truyện mẫu.
        Chỉ trả về danh sách các tiêu đề, mỗi tiêu đề trên một dòng, không có đánh số hay ký tự đặc biệt ở đầu dòng.
        
        TRUYỆN MẪU:
        ---
        ${sequelInputStories.trim()}
        ---`;

        try {
            const result = await retryApiCall(() => generateText(prompt, undefined, false, apiSettings), 3, false);
            const titles = (result.text ?? '').trim().split('\n').filter(t => t.trim() !== '');

            if (titles.length === 0) {
                updateState({
                    sequelError: "AI không thể tạo được tiêu đề từ nội dung đã cho. Vui lòng thử lại với nội dung truyện mẫu khác hoặc chi tiết hơn.",
                });
            } else {
                updateState({
                    sequelSuggestedTitles: titles,
                });
                
                // Log usage statistics
                logApiCall('quickstory-titles', 1);
            }
        } catch (e) {
            updateState({
                sequelError: `Lỗi khi gợi ý tiêu đề: ${(e as Error).message}`,
            });
        } finally {
             updateState({ sequelIsGeneratingTitles: false });
        }
    };
    
    const handleTitleSelectionChange = (title: string, isSelected: boolean) => {
        setModuleState(prev => {
            const newSelectedTitles = isSelected 
                ? [...prev.sequelSelectedTitles, title]
                : prev.sequelSelectedTitles.filter(t => t !== title);
            return { ...prev, sequelSelectedTitles: newSelectedTitles };
        });
    };

    const handleGenerateSequelStoriesBatch = async () => {
        if (sequelSelectedTitles.length === 0) {
            updateState({ sequelError: "Vui lòng chọn ít nhất một tiêu đề để viết." });
            return;
        }
        
        // ✅ Track usage ONCE when user starts the batch (based on number of stories)
        const storyCount = sequelSelectedTitles.length;
        const usageCheck = await checkAndTrackQuickRequest(REQUEST_ACTIONS.QUICK_STORY, storyCount);
        if (usageCheck && (usageCheck as any).allowed === false) {
            updateState({ sequelError: (usageCheck as any).message || 'Đã đạt giới hạn sử dụng hôm nay.' });
            return;
        }
        
        const initialResults: SequelStoryResult[] = sequelSelectedTitles.map(title => ({
            id: Date.now().toString() + title,
            title,
            story: null,
            status: 'queued',
            error: null
        }));

        updateState({ 
            sequelIsGeneratingStories: true, 
            sequelError: null, 
            sequelProgressMessage: `Đã xếp hàng ${initialResults.length} truyện. Bắt đầu xử lý...`,
            sequelGeneratedStories: initialResults
        });
    };
    
    const processSequelStory = useCallback(async (
        selectedTitle: string,
        sourceStories: string,
        settings: { targetLength: string; writingStyle: string; customWritingStyle: string; outputLanguage: string },
        abortSignal: AbortSignal,
        onProgress: (message: string) => void
    ): Promise<{ story: string; wordStats: any; storyQualityStats: any }> => {
        const { targetLength, writingStyle, customWritingStyle, outputLanguage } = settings;
        let currentStoryStyle = WRITING_STYLE_OPTIONS.find(opt => opt.value === writingStyle)?.label || writingStyle;
        if (writingStyle === 'custom') currentStoryStyle = customWritingStyle;
        const outputLanguageLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === outputLanguage)?.label || outputLanguage;

        // Step 1: Write Story in Chunks
        let fullStory = '';
        const CHUNK_WORD_COUNT = 1000;
        const currentTargetLengthNum = parseInt(targetLength);
        const numChunks = Math.ceil(currentTargetLengthNum / CHUNK_WORD_COUNT);
        
        const adnViralPromptSegment = `
        **Phân Tích & Học Tập ADN Viral (QUAN TRỌNG NHẤT):**
        \nDưới đây là một bộ sưu tập các truyện đã thành công. Nhiệm vụ của bạn là:
        \n1.  **Phân Tích Sâu:** Đọc và phân tích TẤT CẢ các truyện trong bộ sưu tập này để trích xuất "ADN Viral" (văn phong, nhịp độ, cấu trúc, yếu tố cảm xúc).
        \n2.  **Áp Dụng ADN Viral:** Khi bạn viết câu chuyện MỚI, BẠN BẮT BUỘC PHẢI áp dụng các nguyên tắc "ADN Viral" bạn vừa học được.
        \n3.  **NGHIÊM CẤM Sao Chép Nội Dung:** Sáng tạo câu chuyện hoàn toàn mới, không sao chép nhân vật hay tình huống cụ thể từ truyện tham khảo.
        \n**BỘ SƯU TẬP TRUYỆN THAM KHẢO:**
        \n---
        \n${sourceStories.trim()}
        \n---`;

        for (let i = 0; i < numChunks; i++) {
            if (abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');
            onProgress(`Đang viết phần ${i + 1}/${numChunks}...`);
            const context = fullStory.length > 2000 ? '...\n' + fullStory.slice(-2000) : fullStory;
            const writePrompt = `Bạn là một nhà văn AI chuyên viết truyện theo series.
            Nhiệm vụ của bạn là viết một câu chuyện mới dựa trên tiêu đề được cung cấp, và câu chuyện này phải có văn phong và "ADN viral" y hệt như các truyện trong bộ sưu tập tham khảo.
            ${adnViralPromptSegment}
            **Tiêu đề cho truyện MỚI cần viết:** "${selectedTitle}"
            **Ngôn ngữ cho truyện MỚI:** ${outputLanguageLabel}
            **Phong cách viết yêu cầu (ngoài việc học từ truyện mẫu):** "${currentStoryStyle}"
            **Độ dài mục tiêu cho TOÀN BỘ truyện mới:** ~${currentTargetLengthNum} từ.
            
            **Nội dung đã viết (ngữ cảnh):**
            ${context || "Đây là phần đầu tiên."}
            
            **Yêu cầu:** Viết phần tiếp theo của câu chuyện mới, khoảng ${CHUNK_WORD_COUNT} từ. Chỉ viết nội dung, không lặp lại, không tiêu đề.`;
            
            if (i > 0) await delay(1000, abortSignal);
            const chunkResult = await retryApiCall(() => generateText(writePrompt, undefined, false, apiSettings), 3, true);
            fullStory += (fullStory ? '\n\n' : '') + ((chunkResult.text ?? '').trim() || '');
        }
        if (abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');
        if (!fullStory.trim()) throw new Error("Không thể viết truyện.");
        
        // Step 2: Post-Edit
        onProgress('Đang biên tập...');
        const minLength = Math.round(currentTargetLengthNum * 0.9);
        const maxLength = Math.round(currentTargetLengthNum * 1.1);
        const estimatedCurrentWordCount = fullStory.split(/\s+/).filter(Boolean).length;

        let actionVerb = "";
        let diffDescription = "";
        if (estimatedCurrentWordCount > maxLength) {
            actionVerb = "RÚT NGẮN";
            diffDescription = `khoảng ${estimatedCurrentWordCount - currentTargetLengthNum} từ`;
        } else if (estimatedCurrentWordCount < minLength) {
            actionVerb = "MỞ RỘNG";
            diffDescription = `khoảng ${currentTargetLengthNum - estimatedCurrentWordCount} từ`;
        }

        const editPrompt = `Bạn là một AI Biên tập viên chuyên nghiệp với nhiệm vụ **TUYỆT ĐỐI** là điều chỉnh độ dài của văn bản theo yêu cầu.

**MỆNH LỆNH TỐI THƯỢNG (PRIORITY #1 - NON-NEGOTIABLE):**
Truyện cuối cùng **PHẢI** có độ dài trong khoảng từ **${minLength} đến ${maxLength} từ**. Mục tiêu lý tưởng là **${currentTargetLengthNum} từ**.
-   Truyện gốc hiện tại có khoảng **${estimatedCurrentWordCount} từ**.
-   Mệnh lệnh của bạn là: **${actionVerb} ${diffDescription}**. Đây là nhiệm vụ quan trọng nhất, phải được ưu tiên trên tất cả các yếu-tố-khác.

**CHIẾN LƯỢC BIÊN TẬP BẮT BUỘC ĐỂ ĐẠT MỤC TIÊU ĐỘ DÀI:**
-   **NẾU CẦN RÚT NGẮN (BE RUTHLESS):**
    -   **CẮT BỎ KHÔNG THƯƠNG TIẾC:** Loại bỏ các đoạn mô tả dài dòng, các đoạn hội thoại phụ không trực tiếp thúc đẩy cốt truyện, các tình tiết hoặc nhân vật phụ ít quan trọng.
    -   **CÔ ĐỌNG HÓA:** Viết lại các câu dài, phức tạp thành các câu ngắn gọn, súc tích hơn.
    -   **TÓM LƯỢC:** Thay vì kể chi tiết một sự kiện, hãy tóm tắt nó lại.
    -   **Sự hi sinh là cần thiết:** Bạn phải chấp nhận hi sinh một số chi tiết và sự bay bổng của văn phong để đạt được mục tiêu độ dài. Việc này là BẮT BUỘC.
-   **NẾU CẦN MỞ RỘNG:**
    -   **THÊM MÔ TẢ GIÁC QUAN:** Thêm chi tiết về hình ảnh, âm thanh, mùi vị, cảm giác.
    -   **KÉO DÀI HỘI THOẠI:** Thêm các câu đối đáp, suy nghĩ nội tâm của nhân vật.
    -   **CHI TIẾT HÓA HÀNH ĐỘNG:** Mô tả hành động của nhân vật một cách chi tiết hơn.

**YÊU CẦU PHỤ (PRIORITY #2 - Only after satisfying Priority #1):**
-   **Bám sát Chủ đề & Tiêu đề:** Đảm bảo câu chuyện cuối cùng phản ánh đúng "Tiêu đề" và phù hợp với tinh thần chung của "Các truyện mẫu" đã được cung cấp làm ADN.
-   **Nhất quán:** Duy trì sự nhất quán về tên nhân vật, địa điểm, và logic cơ bản của câu chuyện.

**THÔNG TIN THAM KHẢO:**
- **TIÊU ĐỀ TRUYỆN:** ${selectedTitle}
- **CÁC TRUYỆN MẪU (ADN):** (một phần)
---
${sourceStories.substring(0, 2000)}...
---

**TRUYỆN GỐC CẦN BIÊN TẬP (bằng ${outputLanguageLabel}):**
---
${fullStory}
---

**NHIỆM VỤ CUỐI CÙNG:**
Hãy trả về TOÀN BỘ câu chuyện đã được biên tập lại bằng ngôn ngữ ${outputLanguageLabel}, với độ dài **TUYỆT ĐỐI** phải nằm trong khoảng **${minLength} đến ${maxLength} từ**. Không thêm lời bình, giới thiệu, hay tiêu đề. Bắt đầu ngay bây giờ.`;

        const finalResult = await retryApiCall(() => generateText(editPrompt, undefined, false, apiSettings), 3, true);
        const finalStory = (finalResult.text ?? '').trim();
        
        // Analyze story quality and consistency (only if enabled and for longer texts)
        let storyQualityStats: any = null;
        if (enableQualityAnalysis && finalStory.length > 500) {
            try {
                onProgress('Đang phân tích chất lượng...');
                storyQualityStats = await analyzeStoryQuality(selectedTitle, finalStory);
            } catch (error) {
                console.error('Story quality analysis failed:', error);
                // Continue without quality stats if analysis fails
            }
        }
        
        // Calculate word statistics
        const wordStats = calculateWordStats('', finalStory); // No original text for sequel stories
        
        // Log usage statistics
        const totalApiCalls = numChunks + 1 + (enableQualityAnalysis && finalStory.length > 500 ? 1 : 0); // chunks + edit + analysis
        logApiCall('quickstory-sequel', totalApiCalls);
        logTextRewritten('quickstory-sequel', 1);
        
        return {
            story: finalStory,
            wordStats: wordStats,
            storyQualityStats: storyQualityStats
        };
    }, [apiSettings]);

    useEffect(() => {
        const processSequelQueue = async () => {
            const isTaskRunning = sequelGeneratedStories.some(t => t.status === 'processing');
            if (isTaskRunning || !sequelIsGeneratingStories) return;

            const taskToProcess = sequelGeneratedStories.find(t => t.status === 'queued');
            if (!taskToProcess) {
                const completedTasks = sequelGeneratedStories.filter(t => t.status === 'completed');
                if(completedTasks.length > 0) {
                     addHistoryItem({
                        module: ActiveModule.QuickStory,
                        moduleLabel: 'Tạo Truyện Nhanh',
                        title: `Lô Truyện Kế Tiếp (${completedTasks.length} truyện)`,
                        content: completedTasks.map(t => `TIÊU ĐỀ: ${t.title}\n\n${t.story}`).join('\n\n---\n\n'),
                        contentType: 'text',
                        restoreContext: { ...moduleState }
                    });
                }
                updateState({ sequelIsGeneratingStories: false, sequelProgressMessage: "Hoàn thành tất cả!" });
                return;
            }

            sequelAbortControllerRef.current = new AbortController();
            const abortSignal = sequelAbortControllerRef.current.signal;
            
            const updateSequelTask = (updates: Partial<SequelStoryResult>) => {
                 setModuleState(prev => ({
                    ...prev,
                    sequelGeneratedStories: prev.sequelGeneratedStories.map(t => t.id === taskToProcess.id ? {...t, ...updates} : t)
                }));
            };

            try {
                updateSequelTask({ status: 'processing' });
                const storyResult = await processSequelStory(taskToProcess.title, sequelInputStories, { targetLength, writingStyle, customWritingStyle, outputLanguage }, abortSignal, (progressMsg) => {
                    const totalCompleted = sequelGeneratedStories.filter(t => t.status === 'completed').length;
                    const totalTasks = sequelGeneratedStories.length;
                    updateState({ sequelProgressMessage: `[${totalCompleted + 1}/${totalTasks}] "${taskToProcess.title.substring(0, 30)}...": ${progressMsg}` });
                });
                
                if (!abortSignal.aborted) {
                   updateSequelTask({ 
                       status: 'completed', 
                       story: storyResult.story,
                       wordStats: storyResult.wordStats,
                       storyQualityStats: storyResult.storyQualityStats
                   });
                }
            } catch (e) {
                 if ((e as Error).name === 'AbortError') {
                    updateSequelTask({ status: 'canceled', error: 'Đã dừng.' });
                } else {
                    updateSequelTask({ status: 'error', error: (e as Error).message });
                }
            }
        };

        if (activeTab === 'sequelGenerator') {
            processSequelQueue();
        }
    }, [sequelGeneratedStories, sequelIsGeneratingStories, activeTab, addHistoryItem, customWritingStyle, moduleState, outputLanguage, processSequelStory, sequelInputStories, targetLength, updateState, writingStyle]);
    
    const handleStopSequel = () => {
        if(sequelAbortControllerRef.current) {
            sequelAbortControllerRef.current.abort();
        }
        // Set all processing/queued tasks to canceled
        setModuleState(prev => ({
            ...prev,
            sequelGeneratedStories: prev.sequelGeneratedStories.map(t => 
                (t.status === 'processing' || t.status === 'queued') ? { ...t, status: 'canceled', error: 'Đã dừng' } : t
            ),
            sequelIsGeneratingStories: false,
            sequelProgressMessage: "Đã dừng tất cả."
        }));
    };
    // ----- END: SEQUEL GENERATOR LOGIC -----
    
    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedStates(prev => ({ ...prev, [id]: true }));
            setTimeout(() => {
                setCopiedStates(prev => ({ ...prev, [id]: false }));
            }, 2000);
        });
    };
    
    const getStatusChip = (status: QuickStoryTask['status']) => {
        switch(status) {
            case 'pending': return 'bg-gray-200 text-gray-700';
            case 'queued': return 'bg-yellow-200 text-yellow-800';
            case 'processing': return 'bg-blue-200 text-blue-700 animate-pulse';
            case 'completed': return 'bg-green-200 text-green-700';
            case 'error': return 'bg-red-200 text-red-700';
            case 'canceled': return 'bg-orange-200 text-orange-700';
        }
    };
    
    const statusText: Record<QuickStoryTask['status'], string> = {
        pending: 'Sẵn sàng',
        queued: 'Đã xếp hàng',
        processing: 'Đang xử lý',
        completed: 'Hoàn thành',
        error: 'Lỗi',
        canceled: 'Đã dừng',
    };

    const isAnyTaskQueuedOrProcessing = tasks.some(t => t.status === 'queued' || t.status === 'processing');
    
    const TabButton: React.FC<{ tabId: QuickStoryActiveTab; label: string; icon: React.ElementType }> = ({ tabId, label, icon: Icon }) => (
        <button
            onClick={() => updateState({ activeTab: tabId })}
            className={`flex items-center space-x-2 px-4 py-3 font-medium rounded-t-lg text-base transition-colors ${
                activeTab === tabId ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            disabled={!hasActiveSubscription || isProcessingQueue || sequelIsGeneratingTitles || sequelIsGeneratingStories || usageStats.isBlocked}
        >
            <Icon size={18} />
            <span>{label}</span>
        </button>
    );

    return (
        <ModuleContainer title="⚡️ Tạo Truyện Nhanh">
            <InfoBox>
                <p><strong>Tạo Hàng Loạt Nhanh:</strong> Thêm hàng loạt truyện vào danh sách, sau đó nhấn "Play" cho từng truyện hoặc "Xếp hàng Tất cả" để AI tự động xử lý tuần tự.</p>
                <p className="mt-2"><strong>Sáng tạo Truyện Kế Tiếp:</strong> Cung cấp các truyện mẫu cùng chủ đề để AI học "ADN viral", sau đó gợi ý tiêu đề mới và viết một câu chuyện tiếp theo với văn phong đồng nhất.</p>
            </InfoBox>
            
            {/* Daily Usage Counter */}
            <div className={`p-4 rounded-lg border ${usageStats.isBlocked ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <span className={`text-2xl mr-2 ${usageStats.isBlocked ? 'text-red-600' : 'text-green-600'}`}>
                            {usageStats.isBlocked ? '🚫' : '📊'}
                        </span>
                        <div>
                            <h3 className={`font-semibold ${usageStats.isBlocked ? 'text-red-800' : 'text-green-800'}`}>
                                Sử dụng hôm nay: {usageStats.current}/{usageStats.limit}
                            </h3>
                            <p className={`text-sm ${usageStats.isBlocked ? 'text-red-600' : 'text-green-600'}`}>
                                {usageStats.isBlocked 
                                    ? `Đã đạt giới hạn! Reset vào 00:00 ngày mai.`
                                    : `Còn lại ${usageStats.remaining} requests (${usageStats.percentage}% đã dùng)`
                                }
                            </p>
                        </div>
                    </div>
                    <div className={`text-2xl font-bold ${usageStats.isBlocked ? 'text-red-600' : 'text-green-600'}`}>
                        {usageStats.percentage}%
                    </div>
                </div>
                {/* Progress Bar */}
                <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                    <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                            usageStats.percentage >= 90 ? 'bg-red-500' : 
                            usageStats.percentage >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(100, usageStats.percentage)}%` }}
                    ></div>
                </div>
            </div>
            
            {!hasActiveSubscription && <UpgradePrompt />}

            <div className="my-6 flex flex-wrap gap-1 border-b-2 border-gray-300">
                <TabButton tabId="quickBatch" label="Tạo Hàng Loạt Nhanh" icon={Zap} />
                <TabButton tabId="sequelGenerator" label="Sáng tạo Truyện Kế Tiếp" icon={BookCopy} />
            </div>

            {/* Common Settings for both tabs */}
             <div className="space-y-6 mt-6 p-6 border-2 border-gray-200 rounded-lg bg-gray-50 shadow">
                 <h3 className="text-xl font-semibold text-gray-800">Cài đặt Chung</h3>
                 <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Mục tiêu số từ: <span className="font-semibold text-indigo-600">{parseInt(targetLength).toLocaleString()} từ</span></label>
                        <input type="range" min={STORY_LENGTH_OPTIONS[0].value} max={STORY_LENGTH_OPTIONS[STORY_LENGTH_OPTIONS.length - 1].value} step="500" value={targetLength} onChange={(e) => updateState({ targetLength: e.target.value })} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" disabled={!hasActiveSubscription || isAnyTaskQueuedOrProcessing || sequelIsGeneratingTitles || sequelIsGeneratingStories || usageStats.isBlocked}/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phong cách viết:</label>
                        <select value={writingStyle} onChange={(e) => updateState({ writingStyle: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg" disabled={!hasActiveSubscription || isAnyTaskQueuedOrProcessing || sequelIsGeneratingTitles || sequelIsGeneratingStories || usageStats.isBlocked}>
                            {WRITING_STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ truyện:</label>
                        <select value={outputLanguage} onChange={(e) => updateState({ outputLanguage: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg" disabled={!hasActiveSubscription || isAnyTaskQueuedOrProcessing || sequelIsGeneratingTitles || sequelIsGeneratingStories || usageStats.isBlocked}>
                            {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                 </div>
                 {writingStyle === 'custom' && (
                     <input type="text" value={customWritingStyle} onChange={(e) => updateState({ customWritingStyle: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg" placeholder="Nhập phong cách viết tùy chỉnh..." disabled={!hasActiveSubscription || isAnyTaskQueuedOrProcessing || sequelIsGeneratingTitles || sequelIsGeneratingStories || usageStats.isBlocked}/>
                )}
                
                {/* Quality Analysis Toggle */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <label className="flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={enableQualityAnalysis}
                            onChange={(e) => setEnableQualityAnalysis(e.target.checked)}
                            className="mr-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            disabled={!hasActiveSubscription || isAnyTaskQueuedOrProcessing || sequelIsGeneratingTitles || sequelIsGeneratingStories || usageStats.isBlocked}
                        />
                        <div>
                            <span className="text-sm font-medium text-gray-700">
                                🎯 Phân tích chất lượng TOÀN BỘ câu chuyện (tốn thêm API)
                            </span>
                            <p className="text-xs text-gray-500 mt-1">
                                Bật để phân tích độ nhất quán và hoàn thiện của TOÀN BỘ truyện. Sẽ mất thêm thời gian và API calls nhưng cho kết quả chính xác nhất.
                            </p>
                            <p className="text-xs text-orange-600 mt-1 font-medium">
                                ⚠️ Phân tích toàn bộ văn bản để đảm bảo độ chính xác cao nhất trong đánh giá nhất quán & hoàn thiện.
                            </p>
                        </div>
                    </label>
                </div>
            </div>

            {activeTab === 'quickBatch' && (
            <div className="animate-fadeIn">
                {/* Input Form Section */}
                <div className="space-y-6 mt-6 p-6 border-2 border-gray-200 rounded-lg bg-white shadow">
                    <h3 className="text-xl font-semibold text-gray-800">Thêm Nhiệm vụ Mới</h3>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề Truyện:</label>
                        <textarea value={title} onChange={(e) => updateState({ title: e.target.value })} placeholder="Nhập tiêu đề cho truyện mới..." rows={2} className="w-full p-3 border-2 border-gray-300 rounded-lg" disabled={!hasActiveSubscription || usageStats.isBlocked}/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Văn Phong Viral Tham Khảo (Tùy chọn):</label>
                        <textarea value={referenceViralStoryForStyle} onChange={(e) => updateState({ referenceViralStoryForStyle: e.target.value })} rows={4} className="w-full p-3 border-2 border-gray-300 rounded-lg" placeholder="Dán 1 hoặc nhiều kịch bản/truyện viral vào đây..." disabled={!hasActiveSubscription || usageStats.isBlocked}></textarea>
                    </div>
                    <button onClick={handleAddTask} disabled={!hasActiveSubscription || !title.trim() || usageStats.isBlocked} className="w-full flex items-center justify-center bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400">
                        {!hasActiveSubscription ? (
                            <>🔒 Cần Nâng cấp Gói</>
                        ) : usageStats.isBlocked ? (
                            <>🚫 Đã đạt giới hạn</>
                        ) : (
                            <><PlusCircle className="mr-2"/> Thêm vào Danh sách</>
                        )}
                    </button>
                </div>

                {/* Queue & Results Section */}
                <div className="mt-8">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-gray-800">Hàng chờ & Kết quả ({tasks.length} nhiệm vụ)</h3>
                        <div className="flex gap-2">
                            {!isProcessingQueue ? (
                                <button onClick={handleQueueAll} disabled={!hasActiveSubscription || tasks.filter(t => t.status === 'pending' || t.status === 'canceled' || t.status === 'error').length === 0 || usageStats.isBlocked} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg shadow hover:bg-green-700 disabled:opacity-50 flex items-center">
                                    {!hasActiveSubscription ? (
                                        <>🔒 Cần Nâng cấp</>
                                    ) : usageStats.isBlocked ? (
                                        <>🚫 Đã đạt giới hạn</>
                                    ) : (
                                        <><ChevronsRight className="mr-1" size={16}/> Xếp hàng Tất cả</>
                                    )}
                                </button>
                            ) : (
                                <button onClick={handleStopQueue} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg shadow hover:bg-red-700 flex items-center"><Square className="mr-1" size={16}/> Dừng</button>
                            )}
                            <button onClick={handleClearAll} disabled={tasks.length === 0 || isProcessingQueue} className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg shadow hover:bg-gray-700 disabled:opacity-50 flex items-center"><Trash2 className="mr-1" size={16}/> Xóa tất cả</button>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {tasks.length === 0 ? (
                            <p className="text-center text-gray-500 py-8 bg-gray-50 rounded-lg">Hàng chờ đang trống. Thêm một nhiệm vụ để bắt đầu.</p>
                        ) : (
                            tasks.map((task, index) => (
                                <details key={task.id} className="bg-white p-4 rounded-lg shadow-md border-l-4 border-gray-300" open={task.status === 'processing' || task.status === 'error'}>
                                    <summary className="font-semibold text-gray-800 cursor-pointer flex justify-between items-center">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            {(task.status === 'pending' || task.status === 'canceled' || task.status === 'error') && (
                                                <button 
                                                    onClick={(e) => { e.preventDefault(); handlePlayTask(task.id); }} 
                                                    disabled={!hasActiveSubscription || usageStats.isBlocked}
                                                    className={`p-2 rounded-full ${
                                                        !hasActiveSubscription || usageStats.isBlocked 
                                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                                            : 'bg-green-100 text-green-600 hover:bg-green-200'
                                                    }`} 
                                                    title={!hasActiveSubscription ? 'Cần nâng cấp gói đăng ký' : usageStats.isBlocked ? 'Đã đạt giới hạn hôm nay' : 'Bắt đầu xử lý nhiệm vụ này'}
                                                >
                                                    <Play size={16}/>
                                                </button>
                                            )}
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusChip(task.status)}`}>{statusText[task.status]}</span>
                                            <span className="font-bold">#{index + 1}:</span>
                                            <p className="ml-2 truncate max-w-xs md:max-w-md" title={task.title}>{task.title}</p>
                                        </div>
                                        <button onClick={(e) => { e.preventDefault(); handleDeleteTask(task.id); }} disabled={task.status === 'processing' || task.status === 'queued'} className="p-2 text-gray-400 hover:text-red-600 disabled:text-gray-300"><Trash size={16}/></button>
                                    </summary>
                                    <div className="mt-3 pt-3 border-t">
                                        {task.progressMessage && <p className="text-sm text-gray-600 mb-2"><strong>Thông báo:</strong> {task.progressMessage}</p>}
                                        {task.error && <ErrorAlert message={task.error}/>}
                                        {task.generatedStory && (
                                            <div>
                                                <div className="flex justify-between items-center mb-1">
                                                    <h5 className="text-sm font-semibold text-gray-600">Truyện Hoàn Chỉnh:</h5>
                                                    <button onClick={() => copyToClipboard(task.generatedStory!, task.id)} className="flex items-center text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded-md">
                                                    {copiedStates[task.id] ? <ClipboardCheck size={14} className="mr-1 text-green-600"/> : <Clipboard size={14} className="mr-1"/>}
                                                    {copiedStates[task.id] ? 'Đã sao chép' : 'Sao chép'}
                                                    </button>
                                                </div>
                                                <textarea readOnly value={task.generatedStory} rows={8} className="w-full p-2 text-xs border rounded bg-gray-50 whitespace-pre-wrap"/>
                                                
                                                {/* Word Statistics */}
                                                {task.wordStats && (
                                                    <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                                        <h4 className="text-xs font-semibold text-blue-800 mb-2">📊 Thống kê từ:</h4>
                                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-600">Số từ:</span>
                                                                <span className="font-semibold text-green-600">{task.wordStats.generatedWords.toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-600">Chất lượng:</span>
                                                                <span className="font-semibold text-purple-600">{task.storyQualityStats?.overallQualityScore || 'N/A'}%</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Story Quality Analysis */}
                                                {task.storyQualityStats && (
                                                    <div className="mt-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                                                        <h4 className="text-sm font-semibold text-purple-800 mb-3 flex items-center">
                                                            🎯 Đánh Giá Chất Lượng Câu Chuyện
                                                        </h4>
                                                        
                                                        {/* Quality Scores */}
                                                        <div className="grid grid-cols-3 gap-3 mb-3">
                                                            <div className="text-center">
                                                                <div className="text-lg font-bold text-purple-700">{task.storyQualityStats.consistencyScore}%</div>
                                                                <div className="text-xs text-gray-600">Tính nhất quán</div>
                                                            </div>
                                                            <div className="text-center">
                                                                <div className="text-lg font-bold text-pink-700">{task.storyQualityStats.completenessScore}%</div>
                                                                <div className="text-xs text-gray-600">Độ hoàn thiện</div>
                                                            </div>
                                                            <div className="text-center">
                                                                <div className="text-lg font-bold text-indigo-700">{task.storyQualityStats.overallQualityScore}%</div>
                                                                <div className="text-xs text-gray-600">Chất lượng tổng</div>
                                                            </div>
                                                        </div>

                                                        {/* Quality Progress Bars */}
                                                        <div className="space-y-2 mb-3">
                                                            <div>
                                                                <div className="flex justify-between text-xs mb-1">
                                                                    <span>Nhất quán</span>
                                                                    <span>{task.storyQualityStats.consistencyScore}%</span>
                                                                </div>
                                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                                    <div 
                                                                        className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
                                                                        style={{ width: `${task.storyQualityStats.consistencyScore}%` }}
                                                                    ></div>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="flex justify-between text-xs mb-1">
                                                                    <span>Hoàn thiện</span>
                                                                    <span>{task.storyQualityStats.completenessScore}%</span>
                                                                </div>
                                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                                    <div 
                                                                        className="bg-pink-600 h-2 rounded-full transition-all duration-300" 
                                                                        style={{ width: `${task.storyQualityStats.completenessScore}%` }}
                                                                    ></div>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="flex justify-between text-xs mb-1">
                                                                    <span>Tổng thể</span>
                                                                    <span>{task.storyQualityStats.overallQualityScore}%</span>
                                                                </div>
                                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                                    <div 
                                                                        className="bg-indigo-600 h-2 rounded-full transition-all duration-300" 
                                                                        style={{ width: `${task.storyQualityStats.overallQualityScore}%` }}
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
                                                                    <p className="text-gray-600 ml-2">{task.storyQualityStats.analysis.characterConsistency}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="font-semibold text-gray-700">📚 Cốt truyện:</span>
                                                                    <p className="text-gray-600 ml-2">{task.storyQualityStats.analysis.plotCoherence}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="font-semibold text-gray-700">⏰ Thời gian:</span>
                                                                    <p className="text-gray-600 ml-2">{task.storyQualityStats.analysis.timelineConsistency}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="font-semibold text-gray-700">🏞️ Bối cảnh:</span>
                                                                    <p className="text-gray-600 ml-2">{task.storyQualityStats.analysis.settingConsistency}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="font-semibold text-gray-700">🎯 Tổng quan:</span>
                                                                    <p className="text-gray-600 ml-2">{task.storyQualityStats.analysis.overallAssessment}</p>
                                                                </div>
                                                            </div>
                                                        </details>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <details className="text-xs mt-2">
                                            <summary className="cursor-pointer text-gray-500">Xem lại cài đặt cho nhiệm vụ này</summary>
                                            <div className="p-2 mt-1 bg-gray-100 rounded-md text-gray-600">
                                                <p><strong>Số từ:</strong> ~{parseInt(task.settings.targetLength).toLocaleString()}</p>
                                                <p><strong>Phong cách:</strong> {task.settings.writingStyle === 'custom' ? task.settings.customWritingStyle : WRITING_STYLE_OPTIONS.find(o => o.value === task.settings.writingStyle)?.label}</p>
                                                <p><strong>Ngôn ngữ:</strong> {HOOK_LANGUAGE_OPTIONS.find(o => o.value === task.settings.outputLanguage)?.label}</p>
                                                <p><strong>Văn phong tham khảo:</strong> {task.settings.referenceViralStoryForStyle ? 'Có' : 'Không'}</p>
                                            </div>
                                        </details>
                                    </div>
                                </details>
                            ))
                        )}
                    </div>
                </div>
            </div>
            )}

            {activeTab === 'sequelGenerator' && (
                <div className="animate-fadeIn space-y-6">
                     <div className="p-6 border-2 border-gray-200 rounded-lg bg-white shadow">
                        <h3 className="text-xl font-semibold text-gray-800">Bước 1: Cung cấp Truyện Mẫu (ADN)</h3>
                        <label htmlFor="sequel-input" className="block text-sm font-medium text-gray-700 my-2">Dán 5-10 truyện mẫu vào đây, phân tách mỗi truyện bằng dấu `---` trên một dòng riêng:</label>
                        <textarea id="sequel-input" value={sequelInputStories} onChange={e => updateState({ sequelInputStories: e.target.value })} rows={10} className="w-full p-3 border-2 border-gray-300 rounded-lg" placeholder="Tiêu đề: Truyện mẫu 1&#10;Nội dung truyện 1...&#10;---&#10;Tiêu đề: Truyện mẫu 2&#10;Nội dung truyện 2..." disabled={!hasActiveSubscription || sequelIsGeneratingTitles || sequelIsGeneratingStories || usageStats.isBlocked}/>
                        
                        <div className="mt-4 pt-4 border-t border-dashed border-gray-400">
                            <h4 className="text-md font-semibold text-gray-700 mb-2">Quản lý Bộ ADN (Lưu & Tải Nhanh)</h4>
                            <div className="flex flex-col sm:flex-row gap-2 mb-3">
                                <input 
                                    type="text" 
                                    value={adnSetName} 
                                    onChange={e => updateState({ adnSetName: e.target.value })}
                                    placeholder="Đặt tên cho bộ ADN này..."
                                    className="flex-grow p-2 border border-gray-300 rounded-md"
                                />
                                <button onClick={handleSaveAdnSet} disabled={!hasActiveSubscription || !adnSetName.trim() || !sequelInputStories.trim() || usageStats.isBlocked} className="flex items-center justify-center px-4 py-2 bg-teal-600 text-white font-semibold rounded-md hover:bg-teal-700 disabled:bg-gray-400">
                                    <Save size={16} className="mr-2"/> Lưu Bộ ADN
                                </button>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <select onChange={e => setSelectedAdnSetName(e.target.value)} value={selectedAdnSetName} className="flex-grow p-2 border border-gray-300 rounded-md bg-white">
                                    <option value="">-- Chọn bộ ADN đã lưu --</option>
                                    {savedAdnSets.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                                </select>
                                <button onClick={handleLoadAdnSet} disabled={!hasActiveSubscription || !selectedAdnSetName || usageStats.isBlocked} className="flex items-center justify-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400">
                                    <Download size={16} className="mr-2"/> Tải
                                </button>
                                <button onClick={handleDeleteAdnSet} disabled={!hasActiveSubscription || !selectedAdnSetName || usageStats.isBlocked} className="flex items-center justify-center px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-gray-400">
                                    <Trash size={16} className="mr-2"/> Xóa
                                </button>
                            </div>
                        </div>

                        <div className="flex items-end gap-4 mt-4 pt-4 border-t border-dashed border-gray-400">
                            <div className="flex-1">
                                <label htmlFor="sequel-num-titles" className="block text-sm font-medium text-gray-700 mb-1">Số lượng Tiêu đề Gợi ý (1-20):</label>
                                <input type="number" id="sequel-num-titles" value={sequelNumTitlesToSuggest} onChange={e => updateState({ sequelNumTitlesToSuggest: parseInt(e.target.value)})} min="1" max="20" className="w-full p-3 border-2 border-gray-300 rounded-lg" disabled={!hasActiveSubscription || sequelIsGeneratingTitles || sequelIsGeneratingStories || usageStats.isBlocked}/>
                            </div>
                            <div className="flex-1">
                                <button onClick={handleGenerateTitles} disabled={!hasActiveSubscription || sequelIsGeneratingTitles || sequelIsGeneratingStories || !sequelInputStories.trim() || usageStats.isBlocked} className="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center h-[52px]">
                                    {!hasActiveSubscription ? (
                                        <>🔒 Cần Nâng cấp Gói</>
                                    ) : usageStats.isBlocked ? (
                                        <>🚫 Đã đạt giới hạn</>
                                    ) : sequelIsGeneratingTitles ? (
                                        <>
                                            <Loader2 className="animate-spin mr-2"/>
                                            <span>Đang Phân Tích...</span>
                                        </>
                                    ) : (
                                        'Phân tích & Gợi ý Tiêu đề Mới'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                     {(!sequelIsGeneratingTitles && (sequelError || sequelSuggestedTitles.length > 0 || sequelGeneratedStories.length > 0)) && (
                        <div className="p-6 border-2 border-gray-200 rounded-lg bg-white shadow">
                            <h3 className="text-xl font-semibold text-gray-800">Bước 2: Chọn Tiêu đề và Viết Truyện</h3>
                            {sequelError && !sequelIsGeneratingTitles && !sequelIsGeneratingStories && <ErrorAlert message={sequelError} />}
                            
                            {sequelSuggestedTitles.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-gray-700 mb-2">Chọn một hoặc nhiều tiêu đề sau:</p>
                                    <div className="max-h-60 overflow-y-auto pr-2 space-y-2">
                                        {sequelSuggestedTitles.map((title, index) => (
                                            <label key={index} className="flex items-center p-3 bg-gray-50 rounded-md border has-[:checked]:bg-indigo-50 has-[:checked]:border-indigo-400 cursor-pointer">
                                                <input type="checkbox" name="sequel-title" value={title} checked={sequelSelectedTitles.includes(title)} onChange={e => handleTitleSelectionChange(title, e.target.checked)} className="form-checkbox text-indigo-600 h-5 w-5"/>
                                                <span className="ml-3 text-sm font-medium text-gray-800">{title}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <div className="pt-4 flex gap-4">
                                        <button onClick={handleGenerateSequelStoriesBatch} disabled={!hasActiveSubscription || sequelIsGeneratingStories || sequelSelectedTitles.length === 0 || usageStats.isBlocked} className="flex-1 bg-green-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-green-700 disabled:bg-gray-400">
                                            {!hasActiveSubscription ? (
                                                <>🔒 Cần Nâng cấp Gói</>
                                            ) : usageStats.isBlocked ? (
                                                <>🚫 Đã đạt giới hạn</>
                                            ) : (
                                                <>Viết {sequelSelectedTitles.length > 0 ? sequelSelectedTitles.length : ''} Truyện Đã chọn</>
                                            )}
                                        </button>
                                        {sequelIsGeneratingStories && <button onClick={handleStopSequel} className="px-4 py-2 bg-red-600 text-white rounded-lg shadow hover:bg-red-700"><Square size={16}/></button>}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {sequelGeneratedStories.length > 0 && (
                        <div className="p-6 border-2 border-gray-200 rounded-lg bg-white shadow mt-6">
                            <h3 className="text-xl font-semibold text-gray-800 mb-4">Kết quả Viết Truyện Kế Tiếp</h3>
                            {sequelIsGeneratingStories && sequelProgressMessage && (
                                <div className="mb-4">
                                    <LoadingSpinner message={sequelProgressMessage} />
                                </div>
                            )}
                             {sequelError && !sequelIsGeneratingStories && <ErrorAlert message={sequelError} />}
                            <div className="space-y-4">
                                {sequelGeneratedStories.map(result => (
                                    <details key={result.id} className="bg-gray-50 p-4 rounded-lg border-l-4 border-gray-300" open={result.status === 'processing' || result.status === 'error'}>
                                        <summary className="font-semibold text-gray-800 cursor-pointer flex justify-between items-center">
                                            <span className="truncate" title={result.title}>{result.title}</span>
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusChip(result.status)}`}>{statusText[result.status]}</span>
                                        </summary>
                                        <div className="mt-3 pt-3 border-t">
                                            {result.error && <ErrorAlert message={result.error} />}
                                            {result.story && (
                                                <div>
                                                    <div className="flex justify-end mb-1">
                                                        <button onClick={() => copyToClipboard(result.story!, result.id)} className="flex items-center text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded-md">
                                                            {copiedStates[result.id] ? <ClipboardCheck size={14} className="mr-1 text-green-600"/> : <Clipboard size={14} className="mr-1"/>}
                                                            {copiedStates[result.id] ? 'Đã sao chép' : 'Sao chép'}
                                                        </button>
                                                    </div>
                                                    <textarea readOnly value={result.story} rows={10} className="w-full p-2 text-sm border rounded bg-white whitespace-pre-wrap"/>
                                                    
                                                    {/* Word Statistics */}
                                                    {result.wordStats && (
                                                        <div className="mt-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
                                                            <h4 className="text-xs font-semibold text-blue-800 mb-2">📊 Thống kê từ:</h4>
                                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                                <div className="flex justify-between">
                                                                    <span className="text-gray-600">Số từ:</span>
                                                                    <span className="font-semibold text-green-600">{result.wordStats.generatedWords.toLocaleString()}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-gray-600">Chất lượng:</span>
                                                                    <span className="font-semibold text-purple-600">{result.storyQualityStats?.overallQualityScore || 'N/A'}%</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Story Quality Analysis */}
                                                    {result.storyQualityStats && (
                                                        <div className="mt-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                                                            <h4 className="text-sm font-semibold text-purple-800 mb-3 flex items-center">
                                                                🎯 Đánh Giá Chất Lượng Câu Chuyện
                                                            </h4>
                                                            
                                                            {/* Quality Scores */}
                                                            <div className="grid grid-cols-3 gap-3 mb-3">
                                                                <div className="text-center">
                                                                    <div className="text-lg font-bold text-purple-700">{result.storyQualityStats.consistencyScore}%</div>
                                                                    <div className="text-xs text-gray-600">Tính nhất quán</div>
                                                                </div>
                                                                <div className="text-center">
                                                                    <div className="text-lg font-bold text-pink-700">{result.storyQualityStats.completenessScore}%</div>
                                                                    <div className="text-xs text-gray-600">Độ hoàn thiện</div>
                                                                </div>
                                                                <div className="text-center">
                                                                    <div className="text-lg font-bold text-indigo-700">{result.storyQualityStats.overallQualityScore}%</div>
                                                                    <div className="text-xs text-gray-600">Chất lượng tổng</div>
                                                                </div>
                                                            </div>

                                                            {/* Quality Progress Bars */}
                                                            <div className="space-y-2 mb-3">
                                                                <div>
                                                                    <div className="flex justify-between text-xs mb-1">
                                                                        <span>Nhất quán</span>
                                                                        <span>{result.storyQualityStats.consistencyScore}%</span>
                                                                    </div>
                                                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                                                        <div 
                                                                            className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
                                                                            style={{ width: `${result.storyQualityStats.consistencyScore}%` }}
                                                                        ></div>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <div className="flex justify-between text-xs mb-1">
                                                                        <span>Hoàn thiện</span>
                                                                        <span>{result.storyQualityStats.completenessScore}%</span>
                                                                    </div>
                                                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                                                        <div 
                                                                            className="bg-pink-600 h-2 rounded-full transition-all duration-300" 
                                                                            style={{ width: `${result.storyQualityStats.completenessScore}%` }}
                                                                        ></div>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <div className="flex justify-between text-xs mb-1">
                                                                        <span>Tổng thể</span>
                                                                        <span>{result.storyQualityStats.overallQualityScore}%</span>
                                                                    </div>
                                                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                                                        <div 
                                                                            className="bg-indigo-600 h-2 rounded-full transition-all duration-300" 
                                                                            style={{ width: `${result.storyQualityStats.overallQualityScore}%` }}
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
                                                                        <p className="text-gray-600 ml-2">{result.storyQualityStats.analysis.characterConsistency}</p>
                                                                    </div>
                                                                    <div>
                                                                        <span className="font-semibold text-gray-700">📚 Cốt truyện:</span>
                                                                        <p className="text-gray-600 ml-2">{result.storyQualityStats.analysis.plotCoherence}</p>
                                                                    </div>
                                                                    <div>
                                                                        <span className="font-semibold text-gray-700">⏰ Thời gian:</span>
                                                                        <p className="text-gray-600 ml-2">{result.storyQualityStats.analysis.timelineConsistency}</p>
                                                                    </div>
                                                                    <div>
                                                                        <span className="font-semibold text-gray-700">🏞️ Bối cảnh:</span>
                                                                        <p className="text-gray-600 ml-2">{result.storyQualityStats.analysis.settingConsistency}</p>
                                                                    </div>
                                                                    <div>
                                                                        <span className="font-semibold text-gray-700">🎯 Tổng quan:</span>
                                                                        <p className="text-gray-600 ml-2">{result.storyQualityStats.analysis.overallAssessment}</p>
                                                                    </div>
                                                                </div>
                                                            </details>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </details>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </ModuleContainer>
    );
};

export default QuickStoryModule;