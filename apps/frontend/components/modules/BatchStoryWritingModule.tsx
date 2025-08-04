

import React, { useState } from 'react';
import { 
    ApiSettings, 
    BatchStoryWritingModuleState, 
    BatchStoryInputItem, 
    GeneratedBatchStoryOutputItem, 
    EditStoryAnalysisReport,
    UserProfile
} from '../../types';
import { 
    STORY_LENGTH_OPTIONS, 
    WRITING_STYLE_OPTIONS, 
    HOOK_LANGUAGE_OPTIONS 
} from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import HistoryPanel from '../HistoryPanel';
import { generateText, generateTextWithJsonOutput } from '../../services/textGenerationService';
import { delay, isSubscribed } from '../../utils';
import { HistoryStorage, MODULE_KEYS } from '../../utils/historyStorage';
import { StopCircle } from 'lucide-react';
import UpgradePrompt from '../UpgradePrompt';

interface BatchStoryWritingModuleProps {
  apiSettings: ApiSettings;
  moduleState: BatchStoryWritingModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<BatchStoryWritingModuleState>>;
  currentUser: UserProfile | null;
}

const BatchStoryWritingModule: React.FC<BatchStoryWritingModuleProps> = ({ 
    apiSettings, moduleState, setModuleState, currentUser
}) => {
  const {
    inputItems, results, globalTargetLength, globalWritingStyle, globalCustomWritingStyle,
    outputLanguage, referenceViralStoryForStyle, isProcessingBatch,
    batchProgressMessage, batchError, concurrencyLimit
  } = moduleState;
  
  const [currentAbortController, setCurrentAbortController] = useState<AbortController | null>(null);

  const updateState = (updates: Partial<BatchStoryWritingModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };

  const geminiApiKeyForService = apiSettings.provider === 'gemini' ? apiSettings.apiKey : undefined;
  const deepseekApiKeyForService = apiSettings.provider === 'deepseek' ? apiSettings.apiKey : undefined;

  const handleAddItem = () => {
    const newItem: BatchStoryInputItem = {
      id: Date.now().toString(),
      outline: '',
      specificTargetLength: null,
      specificWritingStyle: null,
      specificCustomWritingStyle: null,
    };
    updateState({ inputItems: [...inputItems, newItem] });
  };

  const handleRemoveItem = (id: string) => {
    updateState({ 
        inputItems: inputItems.filter(item => item.id !== id),
        results: results.filter(result => result.id !== id), // Also remove corresponding result
    });
  };

  const handleInputChange = (id: string, field: keyof BatchStoryInputItem, value: string | null) => {
    updateState({
      inputItems: inputItems.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    });
  };

  const generateSingleStoryForBatch = async (
    item: BatchStoryInputItem,
    updateItemProgress: (updates: Partial<GeneratedBatchStoryOutputItem>) => void
  ): Promise<Omit<GeneratedBatchStoryOutputItem, 'id' | 'originalOutline'>> => {
    
    // --- Define service functions based on provider ---
    const textGenerator = (prompt: string) => generateText(prompt, undefined, false, apiSettings, 'batch-story-writing').then(res => res.text);
    
    const jsonGenerator = <T,>(prompt: string): Promise<T> => {
        return generateTextWithJsonOutput<T>(prompt, undefined, apiSettings, 'batch-story-writing');
    };


    const currentTargetLength = item.specificTargetLength || globalTargetLength;
    let currentWritingStyle = item.specificWritingStyle || globalWritingStyle;
    let currentCustomWritingStyle = item.specificCustomWritingStyle || globalCustomWritingStyle;

    if (currentWritingStyle === 'custom' && !currentCustomWritingStyle.trim()) {
        throw new Error('Phong cách viết tùy chỉnh không được để trống.');
    }
    if (currentWritingStyle !== 'custom') {
        currentCustomWritingStyle = ''; // Ensure custom is empty if not selected
    } else {
        currentWritingStyle = WRITING_STYLE_OPTIONS.find(opt => opt.value === 'custom')?.label || 'Tùy chỉnh'; 
    }
    
    const outputLanguageLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === outputLanguage)?.label || outputLanguage;

    // --- Part 1: Story Generation ---
    updateItemProgress({ status: 'writing', progressMessage: 'Đang viết truyện...' });
    let fullStory = '';
    let keyElementsFromOutline: string | null = null;

    const CHUNK_WORD_COUNT = 1000;
    const currentTargetLengthNum = parseInt(currentTargetLength);
    const numChunks = Math.ceil(currentTargetLengthNum / CHUNK_WORD_COUNT);

    if (item.outline.length > 50) {
        try {
            const keyElementPrompt = `Based on the following story outline, identify the key character names (main and important secondary) and primary locations.
            Return ONLY these names and locations, separated by semicolons. Example: CharacterA; CharacterB; LocationX; LocationY
            Outline:
            ---
            ${item.outline.substring(0,2000)} 
            ---`;
            await delay(500);
            const keyElementResultText = await textGenerator(keyElementPrompt);
            if (keyElementResultText.trim()) {
                keyElementsFromOutline = keyElementResultText.trim();
            }
        } catch (e) {
            console.warn("Could not extract key elements from outline:", e);
        }
    }
    await delay(500);

    for (let i = 0; i < numChunks; i++) {
        updateItemProgress({ status: 'writing', progressMessage: `Đang viết phần ${i + 1}/${numChunks}...` });
        const context = fullStory.length > 2000 ? '...\n' + fullStory.slice(-2000) : fullStory;
        
        let styleToUse = currentWritingStyle === 'custom' ? currentCustomWritingStyle : (WRITING_STYLE_OPTIONS.find(opt => opt.value === currentWritingStyle)?.label || currentWritingStyle);

        let storyPrompt = `Bạn là một nhà văn AI. Hãy viết tiếp câu chuyện BẰNG NGÔN NGỮ ${outputLanguageLabel}, dựa HOÀN TOÀN vào "Dàn ý tổng thể" được cung cấp.
        Ước tính độ dài cho PHẦN NÀY: khoảng ${CHUNK_WORD_COUNT} từ. Tổng độ dài mục tiêu của TOÀN BỘ truyện là ${currentTargetLengthNum} từ.
        Phong cách viết: "${styleToUse}".
        ${referenceViralStoryForStyle.trim() ? `\nTham khảo văn phong từ truyện sau (CHỈ HỌC VĂN PHONG, KHÔNG SAO CHÉP NỘI DUNG/NHÂN VẬT):\n---\n${referenceViralStoryForStyle.trim()}\n---` : ''}
        **Dàn ý tổng thể (NGUỒN DUY NHẤT CHO NỘI DUNG TRUYỆN):**\n${item.outline}`;
        
        if (keyElementsFromOutline) {
            storyPrompt += `\n**YẾU TỐ CỐT LÕI (Từ Dàn Ý - BẮT BUỘC TUÂN THỦ):** ${keyElementsFromOutline}. Hãy đảm bảo sử dụng nhất quán các tên này.`;
        }
        
        storyPrompt += `\n**Nội dung đã viết (ngữ cảnh${i === 0 ? " - trống cho phần 1" : ""}):**\n${context}
        \n**Yêu cầu hiện tại (Phần ${i + 1}/${numChunks}):** Viết phần tiếp theo, liền mạch, TRUNG THÀNH với "Dàn ý tổng thể" và các yếu tố cốt lõi (nếu có). Chỉ viết nội dung, không tiêu đề.`;
        
        if (i > 0) await delay(1000);
        const resultText = await textGenerator(storyPrompt);
        fullStory += (fullStory ? '\n\n' : '') + resultText.trim();
    }
     if (!fullStory.trim()) {
        throw new Error("Không thể tạo nội dung truyện ban đầu.");
    }

    // --- Part 2: Automated Post-Editing ---
    updateItemProgress({ status: 'editing', progressMessage: 'Đang biên tập truyện...' });
    await delay(1500);
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
    
    const editPrompt = `Bạn là một biên tập viên AI chuyên nghiệp. Hãy biên tập lại "Truyện Gốc" dưới đây.
    Mục tiêu chính: Đảm bảo độ dài cuối cùng từ ${minLength} đến ${maxLength} từ (lý tưởng là ~${currentTargetLengthNum} từ).
    ${actionVerb ? `Truyện hiện có ~${estimatedCurrentWordCount} từ, bạn cần ${actionVerb} ${diffDescription}.` : "Độ dài hiện tại ổn, tập trung vào chất lượng."}
    Hướng dẫn điều chỉnh độ dài (nếu cần):
    - Nếu quá dài: Cô đọng văn phong, tóm lược mô tả, gộp/cắt tình tiết phụ. KHÔNG CẮT QUÁ NGẮN.
    - Nếu quá ngắn: Thêm chi tiết mô tả, kéo dài hội thoại, mở rộng cảnh. KHÔNG KÉO DÀI QUÁ NHIỀU.
    Yêu cầu chất lượng:
    1.  TÍNH NHẤT QUÁN VÀ LOGIC: Dựa vào "Dàn Ý Gốc" và các yếu tố cốt lõi đã được cung cấp (nếu có: "${keyElementsFromOutline || 'AI tự xác định từ dàn ý'}"). Đảm bảo tên nhân vật, địa điểm, đặc điểm, sự kiện phải nhất quán trong TOÀN BỘ truyện đã biên tập.
    2.  NÂNG CAO CHẤT LƯỢNG VĂN PHONG: Loại bỏ trùng lặp, từ thừa. Cải thiện luồng chảy, đa dạng cấu trúc câu, tinh chỉnh từ ngữ.
    3.  BÁM SÁT DÀN Ý: Việc biên tập không được làm thay đổi các NÚT THẮT, CAO TRÀO QUAN TRỌNG, hoặc Ý NGHĨA CHÍNH của câu chuyện được mô tả trong "Dàn Ý Gốc".
    **Dàn Ý Gốc (Để đối chiếu khi biên tập):**
    ---
    ${item.outline}
    ---
    **Truyện Gốc Cần Biên Tập (bằng ${outputLanguageLabel}):**
    ---
    ${fullStory}
    ---
    Hãy trả về TOÀN BỘ câu chuyện đã biên tập bằng ${outputLanguageLabel}. Không giới thiệu, không tiêu đề.`;

    const editedStory = await textGenerator(editPrompt);
    if (!editedStory.trim()) {
        throw new Error("Không thể biên tập truyện.");
    }

    // --- Part 3: Post-Edit Analysis ---
    updateItemProgress({ status: 'analyzing', progressMessage: 'Đang phân tích kết quả...' });
    await delay(1500);
    const analysisPrompt = `Bạn là chuyên gia phân tích truyện AI. Hãy phân tích phiên bản truyện "ĐÃ BIÊN TẬP" dựa trên "TRUYỆN GỐC BAN ĐẦU" (là phiên bản trước khi biên tập ở bước 2) và "DÀN Ý GỐC" của nó.
    TRUYỆN GỐC BAN ĐẦU (Trước biên tập):
    ---
    ${fullStory} 
    ---
    TRUYỆN ĐÃ BIÊN TẬP:
    ---
    ${editedStory}
    ---
    DÀN Ý GỐC:
    ---
    ${item.outline}
    ---
    MỤC TIÊU ĐỘ DÀI: ~${currentTargetLengthNum} từ. NGÔN NGỮ: ${outputLanguageLabel}.
    YÊU CẦU PHÂN TÍCH (TRẢ VỀ JSON):
    {
      "consistencyScore": "string (ví dụ: 85%) - Đánh giá tính nhất quán của TRUYỆN ĐÃ BIÊN TẬP với DÀN Ý GỐC và các yếu tố logic nội tại (nhân vật, tình tiết).",
      "scoreExplanation": "string (2-3 câu giải thích score).",
      "keyImprovements": ["string (3-5 điểm cải thiện chính của TRUYỆN ĐÃ BIÊN TẬP so với TRUYỆN GỐC BAN ĐẦU, ví dụ: 'Cải thiện dòng chảy', 'Đạt mục tiêu độ dài tốt hơn')."],
      "remainingIssues": ["string (1-3 vấn đề nhỏ còn lại trong TRUYỆN ĐÃ BIÊN TẬP mà người dùng có thể muốn xem xét, hoặc mảng rỗng [] nếu không có)."]
    }
    CHỈ TRẢ VỀ JSON.`;
    
    const analysisResult = await jsonGenerator<EditStoryAnalysisReport>(analysisPrompt);

    return { 
        generatedStory: editedStory, 
        postEditAnalysis: analysisResult, 
        status: 'completed', 
        progressMessage: 'Hoàn thành!', 
        error: null 
    };
  };

  const handleStartBatchWriting = async () => {
    const validItems = inputItems.filter(item => item.outline.trim() !== '');
    if (validItems.length === 0) {
      updateState({ batchError: 'Vui lòng thêm ít nhất một dàn ý hợp lệ.' });
      return;
    }

    const CONCURRENCY_LIMIT = Math.max(1, Math.min(10, concurrencyLimit));
    const abortCtrl = new AbortController();
    setCurrentAbortController(abortCtrl);

    updateState({
      isProcessingBatch: true,
      batchProgressMessage: `Chuẩn bị xử lý ${validItems.length} truyện với ${CONCURRENCY_LIMIT} luồng...`,
      batchError: null,
      results: validItems.map(item => ({
        id: item.id,
        originalOutline: item.outline,
        generatedStory: null,
        postEditAnalysis: null,
        status: 'pending',
        progressMessage: 'Đang chờ trong hàng đợi',
        error: null,
      })),
    });
    
    const updateResultCallback = (id: string, updates: Partial<GeneratedBatchStoryOutputItem>) => {
      setModuleState(prev => ({
        ...prev,
        results: prev.results.map(r => (r.id === id ? { ...r, ...updates } : r)),
      }));
    };

    const taskQueue = [...validItems];

    const worker = async () => {
      while (taskQueue.length > 0) {
        const item = taskQueue.shift();
        if (!item) continue;

        try {
          if (abortCtrl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
          
          updateResultCallback(item.id, { status: 'writing', progressMessage: 'Bắt đầu xử lý...' });
          
          const singleStoryResult = await generateSingleStoryForBatch(
            item,
            (updates) => updateResultCallback(item.id, updates)
          );
          
          if (abortCtrl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
          
          updateResultCallback(item.id, { ...singleStoryResult });
          
          // Save to history when story completed
          if (singleStoryResult.generatedStory?.trim()) {
            const storyTitle = item.outline.split('\n')[0]?.trim().substring(0, 50) || 'Truyện hàng loạt';
            HistoryStorage.saveToHistory(MODULE_KEYS.BATCH_STORY_WRITING, storyTitle, singleStoryResult.generatedStory);
          }

        } catch (e: any) {
          if (e.name === 'AbortError') {
            updateResultCallback(item.id, {
              status: 'error',
              error: 'Đã bị hủy',
              progressMessage: 'Đã dừng xử lý.'
            });
            break; // Exit the worker loop
          } else {
            updateResultCallback(item.id, {
              status: 'error',
              error: e.message,
              progressMessage: 'Lỗi xử lý mục này.'
            });
          }
        } finally {
            setModuleState(prev => {
                const newCompletedCount = prev.results.filter(r => r.status === 'completed' || r.status === 'error').length;
                return {
                    ...prev,
                    batchProgressMessage: `Đang xử lý... Hoàn thành ${newCompletedCount}/${validItems.length}`
                }
            });
        }
      }
    };

    try {
      const workers = Array(CONCURRENCY_LIMIT).fill(null).map(worker);
      await Promise.all(workers);

      updateState({ 
          isProcessingBatch: false, 
          batchProgressMessage: `Hoàn thành xử lý toàn bộ ${validItems.length} truyện.` 
      });
      setTimeout(() => updateState({ batchProgressMessage: null }), 5000);
    } catch (error) {
      updateState({
        isProcessingBatch: false,
        batchProgressMessage: 'Đã dừng xử lý hàng loạt.',
        batchError: 'Xử lý đã bị dừng.'
      });
      setTimeout(() => updateState({ batchProgressMessage: null }), 5000);
    } finally {
      setCurrentAbortController(null);
    }
  };

  const handleCancelBatch = () => {
    if (currentAbortController) {
      currentAbortController.abort();
      updateState({
        batchProgressMessage: 'Đang dừng xử lý...'
      });
    }
  };
  
  const copyToClipboard = (text: string, buttonId: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    const btn = document.getElementById(buttonId);
    if (btn) {
        const originalText = btn.textContent;
        btn.textContent = 'Đã sao chép!';
        setTimeout(() => { btn.textContent = originalText; }, 2000);
    }
  };

  const hasActiveSubscription = isSubscribed(currentUser);

  return (
    <ModuleContainer title="📚 Viết Truyện Hàng Loạt" badge="PRO">
      {!hasActiveSubscription && <UpgradePrompt />}
      <InfoBox>
        <p><strong>💡 Hướng dẫn:</strong></p>
        <ul className="list-disc list-inside ml-4 mt-1 space-y-1 text-sm">
          <li>Thiết lập các tùy chọn chung như độ dài, phong cách viết, ngôn ngữ và truyện viral tham khảo (nếu có).</li>
          <li><strong>(Mới)</strong> Tùy chỉnh "Số luồng xử lý đồng thời" để tăng tốc độ. Mức khuyến nghị là 3 để đảm bảo ổn định.</li>
          <li>Thêm từng dàn ý truyện vào danh sách. Bạn có thể tùy chỉnh độ dài và phong cách riêng cho mỗi dàn ý nếu muốn.</li>
          <li>Nhấn "Bắt Đầu Viết Hàng Loạt". AI sẽ tự động viết, biên tập và phân tích từng truyện theo số luồng bạn đã chọn.</li>
          <li>Sau khi hoàn tất, bạn có thể xem lại, sao chép từng truyện và báo cáo phân tích của nó.</li>
        </ul>
      </InfoBox>

      {/* Global Settings */}
      <div className="space-y-6 p-6 border-2 border-gray-200 rounded-lg bg-gray-50 shadow mb-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Cài đặt chung cho Hàng Loạt</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label htmlFor="bsGlobalTargetLength" className="block text-sm font-medium text-gray-700 mb-1">Độ dài truyện (chung): <span className="font-semibold text-indigo-600">{parseInt(globalTargetLength).toLocaleString()} từ</span></label>
            <input type="range" id="bsGlobalTargetLength" min={STORY_LENGTH_OPTIONS[0].value} max={STORY_LENGTH_OPTIONS[STORY_LENGTH_OPTIONS.length - 1].value} step="500" value={globalTargetLength} onChange={(e) => updateState({ globalTargetLength: e.target.value })} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" disabled={isProcessingBatch}/>
          </div>
          <div>
            <label htmlFor="bsGlobalWritingStyle" className="block text-sm font-medium text-gray-700 mb-1">Phong cách viết (chung):</label>
            <select id="bsGlobalWritingStyle" value={globalWritingStyle} onChange={(e) => updateState({ globalWritingStyle: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={isProcessingBatch}>
              {WRITING_STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          {globalWritingStyle === 'custom' && (
            <div>
              <label htmlFor="bsGlobalCustomWritingStyle" className="block text-sm font-medium text-gray-700 mb-1">Phong cách tùy chỉnh (chung):</label>
              <input type="text" id="bsGlobalCustomWritingStyle" value={globalCustomWritingStyle} onChange={(e) => updateState({ globalCustomWritingStyle: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Ví dụ: Kịch tính, hài hước..." disabled={isProcessingBatch}/>
            </div>
          )}
          <div>
            <label htmlFor="bsOutputLanguage" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ Truyện:</label>
            <select id="bsOutputLanguage" value={outputLanguage} onChange={(e) => updateState({ outputLanguage: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={isProcessingBatch}>
              {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
           <div>
            <label htmlFor="bsConcurrencyLimit" className="block text-sm font-medium text-gray-700 mb-1">Số luồng xử lý đồng thời (1-10):</label>
            <input 
                type="number" 
                id="bsConcurrencyLimit" 
                value={concurrencyLimit} 
                onChange={(e) => updateState({ concurrencyLimit: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)) })}
                min="1" max="10"
                className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm"
                disabled={isProcessingBatch}
            />
             <p className="text-xs text-orange-600 mt-1">
                <strong>Cảnh báo:</strong> Đặt số luồng quá cao (trên 3-5) có thể gây lỗi do giới hạn của API. Mức đề xuất: 3.
            </p>
          </div>
        </div>
         <div className="mt-4">
            <label htmlFor="bsRefViralStory" className="block text-sm font-medium text-gray-700 mb-1">Truyện Viral Tham Khảo (học văn phong - Không bắt buộc):</label>
            <textarea id="bsRefViralStory" value={referenceViralStoryForStyle} onChange={(e) => updateState({ referenceViralStoryForStyle: e.target.value })} rows={4} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Dán một câu chuyện viral mẫu vào đây. AI sẽ cố gắng học văn phong viết từ nó và áp dụng vào các truyện mới của bạn." disabled={isProcessingBatch}></textarea>
        </div>
      </div>

      {/* Input Items */}
      <div className="space-y-4 mb-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Danh sách Dàn Ý Cần Viết</h3>
        {inputItems.map((item, index) => (
          <div key={item.id} className="p-4 border-2 border-gray-200 rounded-lg bg-white shadow-sm space-y-3">
            <div className="flex justify-between items-center">
                <h4 className="text-md font-semibold text-gray-700">Dàn ý #{index + 1}</h4>
                <button onClick={() => handleRemoveItem(item.id)} className="text-red-500 hover:text-red-700 font-medium text-sm p-2 rounded-md hover:bg-red-50" disabled={isProcessingBatch} aria-label={`Xóa dàn ý ${index + 1}`}>
                    🗑️ Xóa
                </button>
            </div>
            <div>
              <label htmlFor={`outline-${item.id}`} className="block text-sm font-medium text-gray-700 mb-1">Nội dung dàn ý (*):</label>
              <textarea id={`outline-${item.id}`} value={item.outline} onChange={(e) => handleInputChange(item.id, 'outline', e.target.value)} rows={5} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="Dán dàn ý vào đây..." disabled={isProcessingBatch}></textarea>
            </div>
            <details className="text-sm">
                <summary className="cursor-pointer text-indigo-600 hover:text-indigo-800 font-medium">Tùy chỉnh riêng cho dàn ý này (không bắt buộc)</summary>
                <div className="mt-2 grid md:grid-cols-2 gap-x-4 gap-y-3 p-3 bg-gray-50 rounded-md border">
                    <div>
                        <label htmlFor={`specificLength-${item.id}`} className="block text-xs font-medium text-gray-600 mb-0.5">Mục tiêu độ dài riêng:</label>
                        <select id={`specificLength-${item.id}`} value={item.specificTargetLength || ""} onChange={(e) => handleInputChange(item.id, 'specificTargetLength', e.target.value || null)} className="w-full p-2 border border-gray-300 rounded-md text-xs" disabled={isProcessingBatch}>
                            <option value="">-- Dùng cài đặt chung ({parseInt(globalTargetLength).toLocaleString()} từ) --</option>
                            {STORY_LENGTH_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor={`specificStyle-${item.id}`} className="block text-xs font-medium text-gray-600 mb-0.5">Phong cách viết riêng:</label>
                        <select id={`specificStyle-${item.id}`} value={item.specificWritingStyle || ""} onChange={(e) => handleInputChange(item.id, 'specificWritingStyle', e.target.value || null)} className="w-full p-2 border border-gray-300 rounded-md text-xs" disabled={isProcessingBatch}>
                            <option value="">-- Dùng cài đặt chung --</option>
                            {WRITING_STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                     {(item.specificWritingStyle ?? globalWritingStyle) === 'custom' && (
                        <div className="md:col-span-2">
                            <label htmlFor={`specificCustomStyle-${item.id}`} className="block text-xs font-medium text-gray-600 mb-0.5">Phong cách tùy chỉnh riêng:</label>
                            <textarea id={`specificCustomStyle-${item.id}`} value={item.specificCustomWritingStyle || ""} onChange={(e) => handleInputChange(item.id, 'specificCustomWritingStyle', e.target.value)} rows={2} className="w-full p-2 border border-gray-300 rounded-md text-xs" placeholder="Mô tả phong cách tùy chỉnh riêng..." disabled={isProcessingBatch}></textarea>
                        </div>
                    )}
                </div>
            </details>
          </div>
        ))}
        <button onClick={handleAddItem} className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 shadow disabled:opacity-50" disabled={isProcessingBatch}>
          ➕ Thêm Dàn Ý
        </button>
      </div>

      {/* Action Button & Progress */}
      {isProcessingBatch ? (
        <div className="flex space-x-3">
          <button
            disabled
            className="flex-1 bg-gray-400 text-white font-bold py-3 px-6 rounded-lg shadow-xl cursor-not-allowed text-lg"
          >
            Đang xử lý...
          </button>
          <button
            onClick={handleCancelBatch}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg shadow-xl flex items-center"
          >
            <StopCircle className="w-5 h-5 mr-2" />
            Dừng
          </button>
        </div>
      ) : (
        <button 
          onClick={handleStartBatchWriting} 
          disabled={!hasActiveSubscription || inputItems.length === 0 || inputItems.every(it => !it.outline.trim())} 
          className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-bold py-3 px-6 rounded-lg shadow-xl hover:opacity-90 transition-opacity disabled:opacity-60 text-lg"
        >
          🚀 Bắt Đầu Viết Hàng Loạt ({inputItems.filter(it => it.outline.trim()).length} truyện)
        </button>
      )}

      {isProcessingBatch && batchProgressMessage && <LoadingSpinner message={batchProgressMessage} />}
      {!isProcessingBatch && batchProgressMessage && <p className={`text-center font-semibold my-3 ${batchProgressMessage.includes("Hoàn thành") ? 'text-green-600' : 'text-indigo-600'}`}>{batchProgressMessage}</p>}
      {batchError && <ErrorAlert message={batchError} />}

      {/* Results */}
      {results.length > 0 && (
        <div className="mt-8 space-y-6">
          <h3 className="text-2xl font-semibold text-gray-800 border-b pb-2">Kết Quả Viết Truyện Hàng Loạt</h3>
          {results.map((result, index) => (
            <details key={result.id} className={`p-4 border-l-4 rounded-lg shadow-md bg-white 
                ${result.status === 'completed' ? 'border-green-500' : 
                  result.status === 'error' ? 'border-red-500' : 
                  (result.status === 'pending' ? 'border-gray-300' : 'border-blue-500')
                }`} open={results.length === 1 || result.status !== 'pending'}>
              <summary className="font-semibold text-lg text-gray-700 cursor-pointer flex justify-between items-center">
                <span>Truyện #{inputItems.findIndex(i => i.id === result.id) + 1}: {result.originalOutline.substring(0, 60)}...</span>
                <span className={`text-sm px-2 py-0.5 rounded-full
                    ${result.status === 'completed' ? 'bg-green-100 text-green-700' : 
                      result.status === 'error' ? 'bg-red-100 text-red-700' :
                      (result.status === 'pending' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700 animate-pulse')
                    }`}>
                    {result.status === 'pending' ? 'Sẵn sàng' : 
                     result.status === 'writing' ? 'Đang viết...' :
                     result.status === 'editing' ? 'Đang biên tập...' :
                     result.status === 'analyzing' ? 'Đang phân tích...' :
                     result.status === 'completed' ? '✅ Hoàn thành' : '⚠️ Lỗi'}
                </span>
              </summary>
              <div className="mt-4 space-y-4">
                {(result.status === 'writing' || result.status === 'editing' || result.status === 'analyzing') && result.progressMessage && <LoadingSpinner message={result.progressMessage} noMargins={true}/>}
                {result.error && <ErrorAlert message={result.error} />}
                
                {result.generatedStory && (
                    <div>
                        <h5 className="text-md font-semibold text-gray-600 mb-1">Truyện Đã Viết & Biên Tập:</h5>
                        <textarea value={result.generatedStory} readOnly rows={10} className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 whitespace-pre-wrap leading-relaxed"></textarea>
                        <button id={`copyBatchStory-${result.id}`} onClick={() => copyToClipboard(result.generatedStory!, `copyBatchStory-${result.id}`)} className="mt-2 px-3 py-1 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600">
                            📋 Sao chép Truyện
                        </button>
                    </div>
                )}

                {result.postEditAnalysis && (
                    <div className="mt-4 p-3 border border-teal-300 rounded-md bg-teal-50">
                        <h5 className="text-md font-semibold text-teal-700 mb-2">Báo Cáo Phân Tích:</h5>
                        <p className="text-sm text-teal-600"><strong>Mức độ nhất quán:</strong> {result.postEditAnalysis.consistencyScore} ({result.postEditAnalysis.scoreExplanation})</p>
                        <p className="text-sm text-teal-600 mt-1"><strong>Cải thiện chính:</strong></p>
                        <ul className="list-disc list-inside ml-4 text-xs text-gray-700">{result.postEditAnalysis.keyImprovements.map((imp, i) => <li key={i}>{imp}</li>)}</ul>
                        <p className="text-sm text-teal-600 mt-1"><strong>Vấn đề còn lại:</strong></p>
                        {result.postEditAnalysis.remainingIssues.length > 0 ? <ul className="list-disc list-inside ml-4 text-xs text-gray-700">{result.postEditAnalysis.remainingIssues.map((iss, i) => <li key={i}>{iss}</li>)}</ul> : <p className="text-xs text-gray-600 italic">Không có.</p>}
                    </div>
                )}
                 <details className="text-xs">
                    <summary className="cursor-pointer text-gray-500 hover:text-gray-700">Xem dàn ý gốc của mục này</summary>
                    <textarea value={result.originalOutline} readOnly rows={3} className="mt-1 w-full p-1 border border-gray-200 rounded-md bg-gray-100 whitespace-pre-wrap" disabled></textarea>
                </details>
              </div>
            </details>
          ))}
        </div>
      )}
      
      {/* History Panel for Batch Story Writing */}
      <div className="mt-8">
        <HistoryPanel 
          moduleKey={MODULE_KEYS.BATCH_STORY_WRITING}
          onSelectHistory={(content) => {
            // For batch, we could add to results or show in a modal
            // For now, just show notification
            alert('Lịch sử đã được chọn! Nội dung: ' + content.substring(0, 100) + '...');
          }}
        />
      </div>
    </ModuleContainer>
  );
};

export default BatchStoryWritingModule;
