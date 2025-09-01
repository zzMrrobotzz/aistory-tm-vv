import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ApiSettings, QuickStoryModuleState, QuickStoryTask, QuickStoryActiveTab, ActiveModule, SequelStoryResult, UserProfile } from '../../types';
import { STORY_LENGTH_OPTIONS, WRITING_STYLE_OPTIONS, HOOK_LANGUAGE_OPTIONS } from '../../constants';
import { generateText } from '../../services/textGenerationService';
import { delay } from '../../utils';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { Trash2, PlusCircle, Square, Play, Trash, Clipboard, ClipboardCheck, ChevronsRight, BookCopy, Zap, Save, Download, Loader2 } from 'lucide-react';

interface QuickStoryModuleProps {
  apiSettings: ApiSettings;
  moduleState: QuickStoryModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<QuickStoryModuleState>>;
  addHistoryItem: (itemData: any) => void;
}

const QuickStoryModule: React.FC<QuickStoryModuleProps> = ({
    apiSettings, moduleState, setModuleState, addHistoryItem
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

    const updateState = (updates: Partial<QuickStoryModuleState>) => {
        setModuleState(prev => ({ ...prev, ...updates }));
    };

    const updateTask = (taskId: string, updates: Partial<QuickStoryTask>) => {
        setModuleState(prev => ({
            ...prev,
            tasks: prev.tasks.map(task =>
                task.id === taskId ? { ...task, ...updates } : task
            )
        }));
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
    
        // Step 1: Generate Outline
        updateTask(task.id, { progressMessage: 'Bước 1/3: Đang tạo dàn ý...' });
        const outlinePrompt = `Tạo một dàn ý chi tiết cho một câu chuyện có tiêu đề "${title}". Dàn ý phải logic, có mở đầu, phát triển, cao trào và kết thúc. Dàn ý phải được viết bằng ${outputLanguageLabel}.`;
        const outlineResult = await generateText(outlinePrompt, undefined, false, apiSettings);
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
            const chunkResult = await generateText(writePrompt, undefined, false, apiSettings);
            fullStory += (fullStory ? '\n\n' : '') + ((chunkResult.text ?? '').trim() || '');
        }
        if (abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');
        if (!fullStory.trim()) throw new Error("Không thể viết truyện từ dàn ý.");
        await delay(500, abortSignal);
    
        // Step 3: Post-Edit
        updateTask(task.id, { progressMessage: 'Bước 3/3: Đang biên tập...' });
        const minLength = Math.round(currentTargetLengthNum * 0.9);
        const maxLength = Math.round(currentTargetLengthNum * 1.1);
        
        const editPrompt = `Bạn là một biên tập viên truyện chuyên nghiệp. Hãy biên tập lại "Truyện Gốc" để đáp ứng các yêu cầu:
        1.  **ĐỘ DÀI (QUAN TRỌNG NHẤT):** Kết quả cuối cùng PHẢI nằm trong khoảng ${minLength} đến ${maxLength} từ.
        2.  **TÍNH NHẤT QUÁN & LOGIC:** Đảm bảo nhân vật, tình tiết nhất quán và logic từ đầu đến cuối.
        3.  **VĂN PHONG:** Tinh chỉnh cho mượt mà, loại bỏ lặp từ, nhưng vẫn giữ đúng phong cách "${currentStoryStyle}".
        **Truyện Gốc Cần Biên Tập (bằng ${outputLanguageLabel}):**
        ---
        ${fullStory}
        ---
        Hãy trả về TOÀN BỘ câu chuyện đã biên tập bằng ${outputLanguageLabel}. Không thêm lời bình hay giới thiệu.`;

        const finalResult = await generateText(editPrompt, undefined, false, apiSettings);
        return (finalResult.text ?? '').trim();
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
    
    const handleQueueAll = () => {
        let hasQueueableTasks = false;
        const newTasks = tasks.map(t => {
            if (t.status === 'pending' || t.status === 'canceled' || t.status === 'error') {
                hasQueueableTasks = true;
                return { ...t, status: 'queued' as const, progressMessage: 'Đã xếp hàng', error: null };
            }
            return t;
        });
        
        if (hasQueueableTasks) {
            updateState({ tasks: newTasks, isProcessingQueue: true });
        }
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
            const result = await generateText(prompt, undefined, false, apiSettings);
            const titles = (result.text ?? '').trim().split('\n').filter(t => t.trim() !== '');

            if (titles.length === 0) {
                updateState({
                    sequelError: "AI không thể tạo được tiêu đề từ nội dung đã cho. Vui lòng thử lại với nội dung truyện mẫu khác hoặc chi tiết hơn.",
                });
            } else {
                updateState({
                    sequelSuggestedTitles: titles,
                });
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
    ): Promise<string> => {
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
            const chunkResult = await generateText(writePrompt, undefined, false, apiSettings);
            fullStory += (fullStory ? '\n\n' : '') + ((chunkResult.text ?? '').trim() || '');
        }
        if (abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');
        if (!fullStory.trim()) throw new Error("Không thể viết truyện.");
        
        // Step 2: Post-Edit
        onProgress('Đang biên tập...');
        const minLength = Math.round(currentTargetLengthNum * 0.9);
        const maxLength = Math.round(currentTargetLengthNum * 1.1);
        const editPrompt = `Bạn là một biên tập viên. Hãy biên tập lại "Truyện Gốc" dưới đây để đáp ứng các yêu cầu:
        1. **ĐỘ DÀI:** Kết quả cuối cùng PHẢI nằm trong khoảng ${minLength} đến ${maxLength} từ.
        2. **CHẤT LƯỢNG:** Tinh chỉnh cho mượt mà, nhất quán, logic, loại bỏ lặp từ.
        **Truyện Gốc (bằng ${outputLanguageLabel}):**
        ---
        ${fullStory}
        ---
        Hãy trả về TOÀN BỘ câu chuyện đã biên tập bằng ${outputLanguageLabel}.`;

        const finalResult = await generateText(editPrompt, undefined, false, apiSettings);
        return (finalResult.text ?? '').trim();
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
                const finalStory = await processSequelStory(taskToProcess.title, sequelInputStories, { targetLength, writingStyle, customWritingStyle, outputLanguage }, abortSignal, (progressMsg) => {
                    const totalCompleted = sequelGeneratedStories.filter(t => t.status === 'completed').length;
                    const totalTasks = sequelGeneratedStories.length;
                    updateState({ sequelProgressMessage: `[${totalCompleted + 1}/${totalTasks}] "${taskToProcess.title.substring(0, 30)}...": ${progressMsg}` });
                });
                
                if (!abortSignal.aborted) {
                   updateSequelTask({ status: 'completed', story: finalStory });
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
            disabled={isProcessingQueue || sequelIsGeneratingTitles || sequelIsGeneratingStories}
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
                        <input type="range" min={STORY_LENGTH_OPTIONS[0].value} max={STORY_LENGTH_OPTIONS[STORY_LENGTH_OPTIONS.length - 1].value} step="500" value={targetLength} onChange={(e) => updateState({ targetLength: e.target.value })} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" disabled={isAnyTaskQueuedOrProcessing || sequelIsGeneratingTitles || sequelIsGeneratingStories}/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phong cách viết:</label>
                        <select value={writingStyle} onChange={(e) => updateState({ writingStyle: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg" disabled={isAnyTaskQueuedOrProcessing || sequelIsGeneratingTitles || sequelIsGeneratingStories}>
                            {WRITING_STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ truyện:</label>
                        <select value={outputLanguage} onChange={(e) => updateState({ outputLanguage: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg" disabled={isAnyTaskQueuedOrProcessing || sequelIsGeneratingTitles || sequelIsGeneratingStories}>
                            {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                 </div>
                 {writingStyle === 'custom' && (
                     <input type="text" value={customWritingStyle} onChange={(e) => updateState({ customWritingStyle: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg" placeholder="Nhập phong cách viết tùy chỉnh..." disabled={isAnyTaskQueuedOrProcessing || sequelIsGeneratingTitles || sequelIsGeneratingStories}/>
                )}
            </div>

            {activeTab === 'quickBatch' && (
            <div className="animate-fadeIn">
                {/* Input Form Section */}
                <div className="space-y-6 mt-6 p-6 border-2 border-gray-200 rounded-lg bg-white shadow">
                    <h3 className="text-xl font-semibold text-gray-800">Thêm Nhiệm vụ Mới</h3>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề Truyện:</label>
                        <textarea value={title} onChange={(e) => updateState({ title: e.target.value })} placeholder="Nhập tiêu đề cho truyện mới..." rows={2} className="w-full p-3 border-2 border-gray-300 rounded-lg" disabled={isAnyTaskQueuedOrProcessing}/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Văn Phong Viral Tham Khảo (Tùy chọn):</label>
                        <textarea value={referenceViralStoryForStyle} onChange={(e) => updateState({ referenceViralStoryForStyle: e.target.value })} rows={4} className="w-full p-3 border-2 border-gray-300 rounded-lg" placeholder="Dán 1 hoặc nhiều kịch bản/truyện viral vào đây..." disabled={isAnyTaskQueuedOrProcessing}></textarea>
                    </div>
                    <button onClick={handleAddTask} disabled={isAnyTaskQueuedOrProcessing || !title.trim()} className="w-full flex items-center justify-center bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400">
                        <PlusCircle className="mr-2"/> Thêm vào Danh sách
                    </button>
                </div>

                {/* Queue & Results Section */}
                <div className="mt-8">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-gray-800">Hàng chờ & Kết quả ({tasks.length} nhiệm vụ)</h3>
                        <div className="flex gap-2">
                            {!isProcessingQueue ? (
                                <button onClick={handleQueueAll} disabled={tasks.filter(t => t.status === 'pending' || t.status === 'canceled' || t.status === 'error').length === 0} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg shadow hover:bg-green-700 disabled:opacity-50 flex items-center"><ChevronsRight className="mr-1" size={16}/> Xếp hàng Tất cả</button>
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
                                                <button onClick={(e) => { e.preventDefault(); handlePlayTask(task.id); }} className="p-2 bg-green-100 text-green-600 rounded-full hover:bg-green-200" title="Bắt đầu xử lý nhiệm vụ này">
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
                        <textarea id="sequel-input" value={sequelInputStories} onChange={e => updateState({ sequelInputStories: e.target.value })} rows={10} className="w-full p-3 border-2 border-gray-300 rounded-lg" placeholder="Tiêu đề: Truyện mẫu 1&#10;Nội dung truyện 1...&#10;---&#10;Tiêu đề: Truyện mẫu 2&#10;Nội dung truyện 2..." disabled={sequelIsGeneratingTitles || sequelIsGeneratingStories}/>
                        
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
                                <button onClick={handleSaveAdnSet} disabled={!adnSetName.trim() || !sequelInputStories.trim()} className="flex items-center justify-center px-4 py-2 bg-teal-600 text-white font-semibold rounded-md hover:bg-teal-700 disabled:bg-gray-400">
                                    <Save size={16} className="mr-2"/> Lưu Bộ ADN
                                </button>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <select onChange={e => setSelectedAdnSetName(e.target.value)} value={selectedAdnSetName} className="flex-grow p-2 border border-gray-300 rounded-md bg-white">
                                    <option value="">-- Chọn bộ ADN đã lưu --</option>
                                    {savedAdnSets.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                                </select>
                                <button onClick={handleLoadAdnSet} disabled={!selectedAdnSetName} className="flex items-center justify-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400">
                                    <Download size={16} className="mr-2"/> Tải
                                </button>
                                <button onClick={handleDeleteAdnSet} disabled={!selectedAdnSetName} className="flex items-center justify-center px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-gray-400">
                                    <Trash size={16} className="mr-2"/> Xóa
                                </button>
                            </div>
                        </div>

                        <div className="flex items-end gap-4 mt-4 pt-4 border-t border-dashed border-gray-400">
                            <div className="flex-1">
                                <label htmlFor="sequel-num-titles" className="block text-sm font-medium text-gray-700 mb-1">Số lượng Tiêu đề Gợi ý (1-20):</label>
                                <input type="number" id="sequel-num-titles" value={sequelNumTitlesToSuggest} onChange={e => updateState({ sequelNumTitlesToSuggest: parseInt(e.target.value)})} min="1" max="20" className="w-full p-3 border-2 border-gray-300 rounded-lg" disabled={sequelIsGeneratingTitles || sequelIsGeneratingStories}/>
                            </div>
                            <div className="flex-1">
                                <button onClick={handleGenerateTitles} disabled={sequelIsGeneratingTitles || sequelIsGeneratingStories || !sequelInputStories.trim()} className="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center h-[52px]">
                                    {sequelIsGeneratingTitles ? (
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
                                        <button onClick={handleGenerateSequelStoriesBatch} disabled={sequelIsGeneratingStories || sequelSelectedTitles.length === 0} className="flex-1 bg-green-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-green-700 disabled:bg-gray-400">
                                            Viết {sequelSelectedTitles.length > 0 ? sequelSelectedTitles.length : ''} Truyện Đã chọn
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