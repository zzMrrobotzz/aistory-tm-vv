


import React, { useState, useEffect } from 'react';
import { 
    ApiSettings, 
    EditStoryModuleState, 
    EditStoryAnalysisReport,
    EditStoryActiveTab,
    BatchEditStoryInputItem,
    GeneratedBatchEditStoryOutputItem,
    UserProfile
} from '../../types';
import { HOOK_LANGUAGE_OPTIONS, STORY_LENGTH_OPTIONS } from '../../constants'; 
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import HistoryPanel from '../HistoryPanel';
import { generateText, generateTextWithJsonOutput } from '../../services/geminiService';
import { delay } from '../../utils';
import { HistoryStorage, MODULE_KEYS } from '../../utils/historyStorage';

interface EditStoryModuleProps {
  apiSettings: ApiSettings;
  moduleState: EditStoryModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<EditStoryModuleState>>;
  currentUser: UserProfile | null;
}

const EditStoryModule: React.FC<EditStoryModuleProps> = ({ apiSettings, moduleState, setModuleState, currentUser }) => {
  const {
    activeTab,
    // Single Edit
    originalStoryToEdit,
    outlineForEditing,
    targetLengthForEditing, // Global default for batch
    languageForEditing,   // Global default for batch
    editedStoryOutput,
    isLoadingEditing,
    loadingMessageEditing,
    errorEditing,
    postEditAnalysis,
    // New refinement fields
    refinementInstruction,
    isRefiningFurther,
    furtherRefinementError,
    // Batch Edit
    batchInputItems,
    batchResults,
    isProcessingBatchEdit,
    batchEditProgressMessage,
    batchEditError,
    batchConcurrencyLimit
  } = moduleState;

  const [isSingleOutlineExpanded, setIsSingleOutlineExpanded] = useState(false);
  const [batchItemExpansionState, setBatchItemExpansionState] = useState<{[key: string]: boolean}>({});

  const updateState = (updates: Partial<EditStoryModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };
  
  const geminiApiKeyForService = apiSettings.provider === 'gemini' ? apiSettings.apiKey : undefined;

  const processSingleStoryEdit = async (
    currentOriginalStory: string,
    currentOutline: string,
    currentTargetLength: string,
    currentLanguage: string,
    updateProgressCallback: (message: string, isError?: boolean, analysis?: EditStoryAnalysisReport) => void,
    isBatchItem: boolean = false // To differentiate logging or minor behavior if needed
  ): Promise<{editedText: string, analysisReport: EditStoryAnalysisReport | null}> => {
    
    updateProgressCallback('Bước 1/2: Đang chuẩn bị biên tập truyện...');

    const currentTargetLengthNum = parseInt(currentTargetLength);
    const minLength = Math.round(currentTargetLengthNum * 0.9);
    const maxLength = Math.round(currentTargetLengthNum * 1.1);
    const estimatedCurrentWordCount = currentOriginalStory.split(/\s+/).filter(Boolean).length;
    
    let actionVerb = "";
    let diffDescription = "";
    if (estimatedCurrentWordCount > maxLength) {
        actionVerb = "RÚT NGẮN";
        diffDescription = `khoảng ${estimatedCurrentWordCount - currentTargetLengthNum} từ`;
    } else if (estimatedCurrentWordCount < minLength) {
        actionVerb = "MỞ RỘNG";
        diffDescription = `khoảng ${currentTargetLengthNum - estimatedCurrentWordCount} từ`;
    }

    const editingLoadingMessageInitial = `Bước 1/2: AI đang biên tập truyện (hiện tại ~${estimatedCurrentWordCount} từ, mục tiêu ${minLength}-${maxLength} từ)...`;
    updateProgressCallback(editingLoadingMessageInitial);
    
    const outputLanguageLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === currentLanguage)?.label || currentLanguage;
    
    const editPrompt = `Bạn là một biên tập viên truyện chuyên nghiệp và một nhà văn AI bậc thầy, cực kỳ tỉ mỉ và có khả năng tinh chỉnh văn phong xuất sắc. Nhiệm vụ của bạn là biên tập lại toàn bộ "Truyện Gốc" dưới đây để đáp ứng các yêu cầu sau:

    **YÊU CẦU QUAN TRỌNG NHẤT VÀ ĐẦU TIÊN: ĐỘ DÀI CUỐI CÙNG CỦA TRUYỆN SAU KHI BIÊN TẬP PHẢI nằm trong khoảng từ ${minLength} đến ${maxLength} từ. MỤC TIÊU LÝ TƯỞNG là khoảng ${currentTargetLengthNum} từ.**
    Truyện gốc bạn nhận được hiện có khoảng ${estimatedCurrentWordCount} từ.
    ${actionVerb ? `Yêu cầu Điều chỉnh Rõ ràng: Bạn cần ${actionVerb} ${diffDescription} cho truyện này.` : "Truyện đang trong khoảng độ dài chấp nhận được, hãy tập trung vào chất lượng."}
    
    **CÁCH THỨC ĐIỀU CHỈNH ĐỘ DÀI (Nếu cần):**
    - Nếu truyện quá dài: BẠN BẮT BUỘC PHẢI RÚT NGẮN NÓ. Cô đọng văn phong, tóm lược mô tả, gộp/cắt tình tiết phụ. KHÔNG CẮT QUÁ TAY.
    - Nếu truyện quá ngắn: BẠN BẮT BUỘC PHẢI MỞ RỘNG NÓ. Thêm chi tiết mô tả, kéo dài hội thoại, mở rộng cảnh. KHÔNG KÉO DÀI QUÁ NHIỀU.
    - Nếu truyện đã trong khoảng độ dài: Tập trung vào việc tinh chỉnh văn phong.
    
    **YÊU CẦU VỀ CHẤT LƯỢNG BIÊN TẬP (SAU KHI ĐẢM BẢO ĐỘ DÀI):**
    
    1.  **TÍNH NHẤT QUÁN VÀ LOGIC (QUAN TRỌNG HÀNG ĐẦU):**
        *   PHÂN TÍCH VÀ XÁC ĐỊNH YẾU TỐ CỐT LÕI TỪ TRUYỆN GỐC (BƯỚC NỘI BỘ CỦA BẠN): Xác định tên nhân vật, đặc điểm, vai trò, địa điểm, sự kiện cốt lõi.
        *   DUY TRÌ NGHIÊM NGẶT CÁC YẾU TỐ CỐT LÕI: Sử dụng chính xác và nhất quán các yếu tố này. TUYỆT ĐỐI không thay đổi tên nhân vật đã thiết lập. Nếu truyện gốc không nhất quán tên, chọn tên hợp lý nhất và dùng DUY NHẤT.
        *   Logic Cốt Truyện và Sự Kiện: Đảm bảo hợp lý, tuần tự, không "plot hole".
    
    2.  **NÂNG CAO CHẤT LƯỢỢNG VĂN PHONG VÀ LOẠI BỎ TRÙNG LẶP:**
        *   Loại bỏ Trùng Lặp và Từ Ngữ Thừa.
        *   Cải thiện Luồng Chảy và Mạch Lạc.
        *   Đa dạng hóa Cấu trúc Câu.
        *   Tinh chỉnh Lựa chọn Từ ngữ.
    
    3.  **BÁM SÁT DÀN Ý (NẾU CÓ):**
        ${currentOutline.trim() ? `Việc biên tập không được làm thay đổi các NÚT THẮT, CAO TRÀO QUAN TRỌNG, hoặc Ý NGHĨA CHÍNH của câu chuyện được mô tả trong "Dàn Ý Gốc" do người dùng cung cấp.\n**DÀN Ý GỐC (Từ Người Dùng):**\n---\n${currentOutline.trim()}\n---` : 'Không có dàn ý riêng. Tập trung vào "Truyện Gốc".'}
    
    **TRUYỆN GỐC CẦN BIÊN TẬP (Output phải là ${outputLanguageLabel}):**
    ---
    ${currentOriginalStory.trim()}
    ---
    
    **ĐẦU RA YÊU CẦU:**
    - TOÀN BỘ câu chuyện đã biên tập bằng ngôn ngữ ${outputLanguageLabel}.
    - ĐỘ DÀI CUỐI CÙNG từ ${minLength} đến ${maxLength} từ.
    - Không thêm lời bình, giới thiệu, hay tiêu đề.`;
        
    await delay(isBatchItem ? 500 : 1000); // Shorter delay for batch items if needed
    const editResult = await generateText(editPrompt, undefined, undefined, geminiApiKeyForService);
    const newlyEditedStory = editResult.text;
    if (!newlyEditedStory.trim()) {
        throw new Error("Không thể tạo nội dung truyện đã biên tập.");
    }
    updateProgressCallback('Bước 1/2: Biên tập truyện hoàn tất! Chuẩn bị phân tích...');

    // --- Start of AI Call 2: Analysis ---
    updateProgressCallback('Bước 2/2: AI đang phân tích kết quả biên tập...');
    
    const analysisPrompt = `Bạn là một chuyên gia phân tích truyện và biên tập viên AI.
Nhiệm vụ của bạn là PHÂN TÍCH phiên bản truyện "ĐÃ BIÊN TẬP" dựa trên "TRUYỆN GỐC" và "DÀN Ý" (nếu có).

TRUYỆN GỐC (Trước biên tập):
---
${currentOriginalStory.trim()}
---
TRUYỆN ĐÃ BIÊN TẬP:
---
${newlyEditedStory}
---
${currentOutline.trim() ? `DÀN Ý GỐC (Người dùng cung cấp):\n---\n${currentOutline.trim()}\n---` : ''}
MỤC TIÊU ĐỘ DÀI: Khoảng ${currentTargetLengthNum} từ. NGÔN NGỮ: ${outputLanguageLabel}

YÊU CẦU PHÂN TÍCH (TRẢ VỀ JSON):
{
  "consistencyScore": "string (ví dụ: '85%') - Đánh giá tính nhất quán của TRUYỆN ĐÃ BIÊN TẬP (nhân vật, logic) so với TRUYỆN GỐC và DÀN Ý.",
  "scoreExplanation": "string (2-3 câu giải thích score).",
  "keyImprovements": ["string (3-5 điểm cải thiện chính của TRUYỆN ĐÃ BIÊN TẬP so với TRUYỆN GỐC)."],
  "remainingIssues": ["string (1-3 vấn đề nhỏ còn lại trong TRUYỆN ĐÃ BIÊN TẬP, hoặc mảng rỗng [])."]
}
CHỈ TRẢ VỀ JSON.`;
    
    await delay(isBatchItem ? 500 : 1000);
    const analysisResultData = await generateTextWithJsonOutput<EditStoryAnalysisReport>(analysisPrompt, undefined, geminiApiKeyForService);
    
    updateProgressCallback('✅ Biên tập & Phân tích hoàn tất!', false, analysisResultData);
    return { editedText: newlyEditedStory, analysisReport: analysisResultData };
  };

  // Handler for Single Edit Tab
  const handlePerformSingleEditing = async () => {
    if (!originalStoryToEdit.trim()) {
      updateState({ errorEditing: 'Vui lòng nhập nội dung truyện cần biên tập.' });
      return;
    }
    updateState({ 
        isLoadingEditing: true, 
        errorEditing: null, 
        editedStoryOutput: '', 
        postEditAnalysis: null,
        loadingMessageEditing: 'Đang xử lý...',
        refinementInstruction: '', // Clear previous refinement instruction
        furtherRefinementError: null, // Clear previous refinement error
    });

    try {
        const { editedText, analysisReport } = await processSingleStoryEdit(
            originalStoryToEdit,
            outlineForEditing,
            targetLengthForEditing,
            languageForEditing,
            (message, isError, analysis) => {
                updateState({ 
                    loadingMessageEditing: message, 
                    ...(isError && { errorEditing: message }),
                    ...(analysis && { postEditAnalysis: analysis })
                });
            }
        );
        updateState({ editedStoryOutput: editedText, isLoadingEditing: false });

        // Save single edit to history
        if (editedText?.trim()) {
          const title = `Biên tập đơn - ${new Date().toLocaleString('vi-VN')}`;
          const historyContent = `Truyện gốc: ${originalStoryToEdit.substring(0, 100)}...\n\n` +
            `=== TRUYỆN ĐÃ BIÊN TẬP ===\n${editedText.trim()}`;
          
          const metadata = {
            editType: 'single',
            originalStory: originalStoryToEdit.trim(),
            editedStory: editedText.trim(),
            outline: outlineForEditing?.trim() || null,
            targetLength: targetLengthForEditing,
            language: languageForEditing,
            postEditAnalysis: analysisReport
          };
          
          HistoryStorage.saveToHistory(MODULE_KEYS.EDIT_STORY, title, historyContent, metadata);
        }
    } catch (e) {
        updateState({ 
            errorEditing: `Lỗi trong quá trình biên tập hoặc phân tích: ${(e as Error).message}`, 
            isLoadingEditing: false, 
            loadingMessageEditing: 'Lỗi xử lý.' 
        });
    } finally {
        setTimeout(() => setModuleState(prev => (prev.loadingMessageEditing?.includes("hoàn tất") || prev.loadingMessageEditing?.includes("Lỗi")) ? {...prev, loadingMessageEditing: null} : prev), 5000);
    }
  };

  const handleFurtherRefinement = async () => {
    if (!editedStoryOutput.trim()) {
      updateState({ furtherRefinementError: "Không có truyện đã biên tập để tinh chỉnh thêm." });
      return;
    }
    if (!refinementInstruction.trim()) {
      updateState({ furtherRefinementError: "Vui lòng nhập yêu cầu tinh chỉnh thêm." });
      return;
    }
    updateState({ isRefiningFurther: true, furtherRefinementError: null });
    const outputLanguageLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === languageForEditing)?.label || languageForEditing;

    const prompt = `Bạn là một biên tập viên AI chuyên nghiệp. Dưới đây là một câu chuyện đã được biên tập.
    **Câu chuyện hiện tại (bằng ${outputLanguageLabel}):**
    ---
    ${editedStoryOutput}
    ---
    **Yêu cầu tinh chỉnh thêm từ người dùng (bằng ngôn ngữ bất kỳ, AI tự hiểu):**
    ---
    ${refinementInstruction}
    ---
    Nhiệm vụ của bạn là áp dụng "Yêu cầu tinh chỉnh thêm" vào "Câu chuyện hiện tại".
    Hãy cố gắng giữ nguyên ý nghĩa cốt lõi, nhân vật và bối cảnh chính của câu chuyện, trừ khi yêu cầu tinh chỉnh chỉ rõ sự thay đổi.
    Đảm bảo truyện sau khi tinh chỉnh vẫn mạch lạc, logic và hấp dẫn.
    Trả về TOÀN BỘ câu chuyện đã được tinh chỉnh lại bằng ngôn ngữ ${outputLanguageLabel}. Không thêm lời bình hay giới thiệu.`;

    try {
      const result = await generateText(prompt, undefined, undefined, geminiApiKeyForService);
      updateState({ editedStoryOutput: result.text, isRefiningFurther: false, postEditAnalysis: null, refinementInstruction: '' }); // Clear instruction after use, optionally clear analysis

      // Save refinement to history
      if (result.text?.trim()) {
        const title = `Tinh chỉnh biên tập - ${new Date().toLocaleString('vi-VN')}`;
        const historyContent = `Yêu cầu tinh chỉnh: ${refinementInstruction.substring(0, 100)}...\n\n` +
          `=== TRUYỆN SAU TINH CHỈNH ===\n${result.text.trim()}`;
        
        const metadata = {
          editType: 'refinement',
          originalStory: originalStoryToEdit.trim(),
          refinementInstruction: refinementInstruction.trim(),
          refinedStory: result.text.trim(),
          targetLength: targetLengthForEditing,
          language: languageForEditing
        };
        
        HistoryStorage.saveToHistory(MODULE_KEYS.EDIT_STORY, title, historyContent, metadata);
      }
    } catch (e) {
      updateState({ furtherRefinementError: `Lỗi khi tinh chỉnh thêm: ${(e as Error).message}`, isRefiningFurther: false });
    }
  };

  // Handle selecting item from history
  const handleSelectHistory = (historyItem: any) => {
    const metadata = historyItem.metadata || {};
    
    // Load the story and settings from history
    if (metadata.originalStory) {
      updateState({ 
        originalStoryToEdit: metadata.originalStory,
        outlineForEditing: metadata.outline || '',
        targetLengthForEditing: metadata.targetLength || targetLengthForEditing,
        languageForEditing: metadata.language || languageForEditing,
        // Clear current results  
        editedStoryOutput: '',
        postEditAnalysis: null,
        errorEditing: null,
        furtherRefinementError: null,
        refinementInstruction: '',
        isLoadingEditing: false,
        isRefiningFurther: false,
        loadingMessageEditing: null
      });
    }
    
    // Load the edited result based on edit type
    if (metadata.editType === 'single' && metadata.editedStory) {
      updateState({
        editedStoryOutput: metadata.editedStory,
        postEditAnalysis: metadata.postEditAnalysis || null
      });
    } else if (metadata.editType === 'refinement' && metadata.refinedStory) {
      updateState({
        editedStoryOutput: metadata.refinedStory
      });
    } else if (metadata.editType === 'batch_item' && metadata.editedStory) {
      updateState({
        editedStoryOutput: metadata.editedStory,
        postEditAnalysis: metadata.postEditAnalysis || null
      });
    }
  };

  // --- Batch Edit Functions ---
  const handleAddBatchItem = () => {
    const newItem: BatchEditStoryInputItem = {
      id: Date.now().toString(),
      originalStory: '',
      outline: null,
      specificTargetLength: null,
      specificLanguage: null,
    };
    updateState({ batchInputItems: [...batchInputItems, newItem] });
  };

  const handleRemoveBatchItem = (id: string) => {
    updateState({ 
        batchInputItems: batchInputItems.filter(item => item.id !== id),
        batchResults: batchResults.filter(result => result.id !== id)
    });
  };

  const handleBatchItemInputChange = (id: string, field: keyof BatchEditStoryInputItem, value: string | null) => {
    updateState({
      batchInputItems: batchInputItems.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    });
  };
  
  const toggleBatchItemExpansion = (id: string) => {
    setBatchItemExpansionState(prev => ({...prev, [id]: !prev[id]}));
  };

  const handleStartBatchEditing = async () => {
    const validItems = batchInputItems.filter(item => item.originalStory.trim() !== '');
    if (validItems.length === 0) {
      updateState({ batchEditError: 'Vui lòng thêm ít nhất một truyện hợp lệ để biên tập hàng loạt.' });
      return;
    }
    
    const CONCURRENCY_LIMIT = Math.max(1, Math.min(10, batchConcurrencyLimit));

    updateState({
      isProcessingBatchEdit: true,
      batchEditProgressMessage: `Chuẩn bị xử lý ${validItems.length} truyện với ${CONCURRENCY_LIMIT} luồng...`,
      batchEditError: null,
      batchResults: validItems.map(item => ({
        id: item.id,
        originalStory: item.originalStory,
        editedStory: null,
        postEditAnalysis: null,
        status: 'pending',
        progressMessage: 'Đang chờ xử lý',
        error: null,
      })),
    });
    
    const taskQueue = [...validItems];

    const worker = async () => {
      while (taskQueue.length > 0) {
        const item = taskQueue.shift();
        if (!item) continue;

        const updateItemProgressForThisItem = (message: string, isError?: boolean, analysis?: EditStoryAnalysisReport) => {
            setModuleState(prev => ({
                ...prev,
                batchResults: prev.batchResults.map(r => 
                    r.id === item.id 
                    ? { 
                        ...r, 
                        progressMessage: message, 
                        status: isError 
                            ? 'error' 
                            : (message.includes("✅") ? 'completed' : (message.includes("phân tích") ? 'analyzing' : 'editing')),
                        ...(isError && { error: message }),
                        ...(analysis && { postEditAnalysis: analysis })
                    } 
                    : r
                )
            }));
        };
        
        try {
            setModuleState(prev => ({
                ...prev,
                batchResults: prev.batchResults.map(r => r.id === item.id ? { ...r, status: 'editing', progressMessage: `Bắt đầu...` } : r)
            }));

            const { editedText, analysisReport } = await processSingleStoryEdit(
                item.originalStory,
                item.outline || '',
                item.specificTargetLength || targetLengthForEditing,
                item.specificLanguage || languageForEditing,
                updateItemProgressForThisItem,
                true // isBatchItem
            );

            setModuleState(prev => ({
                ...prev,
                batchResults: prev.batchResults.map(r => 
                    r.id === item.id 
                    ? { ...r, editedStory: editedText, postEditAnalysis: analysisReport, status: 'completed', progressMessage: 'Hoàn thành!' } 
                    : r
                )
            }));

            // Save batch item to history
            if (editedText?.trim()) {
              const title = `Biên tập hàng loạt - ${new Date().toLocaleString('vi-VN')}`;
              const historyContent = `Truyện gốc: ${item.originalStory.substring(0, 100)}...\n\n` +
                `=== TRUYỆN ĐÃ BIÊN TẬP ===\n${editedText.trim()}`;
              
              const metadata = {
                editType: 'batch_item',
                originalStory: item.originalStory.trim(),
                editedStory: editedText.trim(),
                outline: item.outline?.trim() || null,
                targetLength: item.specificTargetLength || targetLengthForEditing,
                language: item.specificLanguage || languageForEditing,
                postEditAnalysis: analysisReport
              };
              
              HistoryStorage.saveToHistory(MODULE_KEYS.EDIT_STORY, title, historyContent, metadata);
            }

        } catch (e) {
            setModuleState(prev => ({
                ...prev,
                batchResults: prev.batchResults.map(r => 
                    r.id === item.id 
                    ? { ...r, status: 'error', error: (e as Error).message, progressMessage: 'Lỗi xử lý mục này.' } 
                    : r
                )
            }));
        } finally {
            setModuleState(prev => {
                const newCompletedCount = prev.batchResults.filter(r => r.status === 'completed' || r.status === 'error').length;
                return {
                    ...prev,
                    batchEditProgressMessage: `Đang xử lý... Hoàn thành ${newCompletedCount}/${validItems.length}`
                }
            });
        }
      }
    };

    const workers = Array(CONCURRENCY_LIMIT).fill(null).map(worker);
    await Promise.all(workers);

    updateState({ 
        isProcessingBatchEdit: false, 
        batchEditProgressMessage: `Hoàn thành xử lý ${validItems.length} truyện.` 
    });
    setTimeout(() => updateState({ batchEditProgressMessage: null }), 5000);
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

  const TabButton: React.FC<{ tabId: EditStoryActiveTab; label: string }> = ({ tabId, label }) => (
    <button
      onClick={() => updateState({ activeTab: tabId, errorEditing: null, batchEditError: null, loadingMessageEditing: null, batchEditProgressMessage: null, furtherRefinementError: null, isRefiningFurther: false })}
      className={`px-6 py-3 font-medium rounded-t-lg text-base transition-colors
                  ${activeTab === tabId 
                      ? 'bg-indigo-600 text-white shadow-md' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
      aria-selected={activeTab === tabId}
      role="tab"
      disabled={isLoadingEditing || isProcessingBatchEdit || isRefiningFurther}
    >
      {label}
    </button>
  );


  return (
    <ModuleContainer title="✂️ Module Biên Tập Truyện">
        <div className="mb-6 flex border-b-2 border-gray-300" role="tablist" aria-label="Chế độ biên tập">
            <TabButton tabId="single" label="Biên Tập Đơn" />
            <TabButton tabId="batch" label="Biên Tập Hàng Loạt" />
        </div>

      {activeTab === 'single' && (
        <div role="tabpanel" id="single-edit-panel" className="animate-fadeIn">
            <InfoBox>
                <p><strong>💡 Hướng dẫn (Biên Tập Đơn):</strong> Dán truyện của bạn, tùy chọn cung cấp dàn ý, chọn mục tiêu độ dài và ngôn ngữ. AI sẽ biên tập và phân tích truyện. Sau đó, bạn có thể sử dụng tính năng "Tinh Chỉnh Sâu Với AI" để đưa ra các yêu cầu tùy chỉnh cho toàn bộ truyện đã biên tập.</p>
            </InfoBox>
            <div className="space-y-6 mt-6">
                <div>
                <label htmlFor="originalStoryToEdit" className="block text-sm font-medium text-gray-700 mb-1">
                    Nội dung truyện gốc (*):
                </label>
                <textarea
                    id="originalStoryToEdit"
                    value={originalStoryToEdit}
                    onChange={(e) => updateState({ originalStoryToEdit: e.target.value, editedStoryOutput: '', errorEditing: null, postEditAnalysis: null, furtherRefinementError: null, refinementInstruction: '' })}
                    rows={12}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-150"
                    placeholder="Dán toàn bộ truyện bạn muốn biên tập vào đây..."
                    disabled={isLoadingEditing || isRefiningFurther}
                />
                </div>

                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label htmlFor="outlineForEditing" className="text-sm font-medium text-gray-700">
                            Dàn ý (Tùy chọn - Giúp AI bám sát cốt truyện):
                        </label>
                        <button 
                            onClick={() => setIsSingleOutlineExpanded(!isSingleOutlineExpanded)} 
                            className="text-xs text-indigo-600 hover:text-indigo-800"
                            disabled={isLoadingEditing || isRefiningFurther}
                            aria-expanded={isSingleOutlineExpanded}
                            aria-controls="outlineForEditing"
                        >
                            {isSingleOutlineExpanded ? 'Thu gọn Dàn Ý' : 'Mở rộng Dàn Ý'}
                        </button>
                    </div>
                {isSingleOutlineExpanded && (
                    <textarea
                    id="outlineForEditing"
                    value={outlineForEditing}
                    onChange={(e) => updateState({ outlineForEditing: e.target.value })}
                    rows={5}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-150"
                    placeholder="Nếu có, dán dàn ý của truyện vào đây..."
                    disabled={isLoadingEditing || isRefiningFurther}
                    />
                )}
                </div>
                
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="targetLengthForEditing" className="block text-sm font-medium text-gray-700 mb-1">
                            Mục tiêu độ dài truyện sau biên tập: <span className="font-semibold text-indigo-600">{parseInt(targetLengthForEditing).toLocaleString()} từ</span>
                        </label>
                        <input
                            type="range"
                            id="targetLengthForEditing"
                            min="1000"
                            max="30000"
                            step="1000"
                            value={targetLengthForEditing}
                            onChange={(e) => updateState({ targetLengthForEditing: e.target.value })}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            disabled={isLoadingEditing || isRefiningFurther}
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>1,000 từ</span>
                            <span>30,000 từ</span>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="languageForEditing" className="block text-sm font-medium text-gray-700 mb-1">
                            Ngôn ngữ truyện (Input & Output):
                        </label>
                        <select 
                            id="languageForEditing" 
                            value={languageForEditing} 
                            onChange={(e) => updateState({ languageForEditing: e.target.value })} 
                            className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-150"
                            disabled={isLoadingEditing || isRefiningFurther}
                        >
                            {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                </div>

                <button
                onClick={handlePerformSingleEditing}
                disabled={isLoadingEditing || isRefiningFurther || !originalStoryToEdit.trim()}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:from-indigo-700 hover:to-purple-700 transition-all duration-150 disabled:opacity-50"
                >
                ✂️ Bắt đầu Biên Tập & Phân Tích (Đơn)
                </button>

                {isLoadingEditing && loadingMessageEditing && <LoadingSpinner message={loadingMessageEditing} />}
                {!isLoadingEditing && loadingMessageEditing && (
                    <p className={`text-center font-medium my-2 ${loadingMessageEditing.includes("Lỗi") ? 'text-red-600' : (loadingMessageEditing.includes("✅") ? 'text-green-600' : 'text-indigo-600')}`}>
                        {loadingMessageEditing}
                    </p>
                )}
                {errorEditing && <ErrorAlert message={errorEditing} />}

                {editedStoryOutput && !isLoadingEditing && (
                <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                    <h3 className="text-lg font-semibold mb-2 text-green-700">
                    ✅ Truyện đã được Biên Tập (bằng {HOOK_LANGUAGE_OPTIONS.find(l => l.value === languageForEditing)?.label || languageForEditing}):
                    </h3>
                    <textarea
                    value={editedStoryOutput}
                    readOnly
                    rows={15}
                    className="w-full p-3 border-2 border-gray-200 rounded-md bg-white whitespace-pre-wrap leading-relaxed"
                    aria-label="Truyện đã biên tập"
                    />
                    <div className="flex flex-wrap gap-2 mt-3">
                        <button
                        id="copyEditedStoryBtnSingle"
                        onClick={() => copyToClipboard(editedStoryOutput, "copyEditedStoryBtnSingle")}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-150"
                        >
                        📋 Sao chép Truyện đã Biên Tập
                        </button>
                    </div>
                    
                    {/* Further Refinement Section */}
                    <div className="mt-6 p-4 border-t-2 border-dashed border-indigo-300 pt-6">
                        <h4 className="text-md font-semibold text-indigo-700 mb-2">Tinh Chỉnh Sâu Với AI (Tương tác):</h4>
                        <label htmlFor="refinementInstruction" className="block text-sm font-medium text-gray-700 mb-1">
                           Yêu cầu Tinh Chỉnh Thêm (cho toàn bộ truyện đã biên tập ở trên):
                        </label>
                        <textarea
                            id="refinementInstruction"
                            value={refinementInstruction}
                            onChange={(e) => updateState({ refinementInstruction: e.target.value, furtherRefinementError: null })}
                            rows={3}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-150"
                            placeholder="Ví dụ: Làm cho đoạn kết kịch tính hơn. Thêm mô tả về cảm xúc của nhân vật A ở chương 2. Thay đổi ngôi kể sang ngôi thứ nhất..."
                            disabled={isRefiningFurther}
                        />
                        <button
                            onClick={handleFurtherRefinement}
                            disabled={isRefiningFurther || !editedStoryOutput.trim() || !refinementInstruction.trim()}
                            className="mt-3 w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md hover:from-pink-600 hover:to-rose-600 transition-all duration-150 disabled:opacity-50"
                        >
                            ✨ Tinh Chỉnh Sâu Với AI
                        </button>
                        {isRefiningFurther && <LoadingSpinner message="Đang tinh chỉnh sâu..." />}
                        {furtherRefinementError && <ErrorAlert message={furtherRefinementError} />}
                    </div>

                </div>
                )}

                {postEditAnalysis && !isLoadingEditing && !isRefiningFurther && ( // Hide analysis if refining
                    <div className="mt-8 p-6 border-2 border-teal-500 rounded-xl bg-teal-50 shadow-lg">
                        <h3 className="text-xl font-bold text-teal-700 mb-4">📊 Báo Cáo Phân Tích Sau Biên Tập</h3>
                        <div className="mb-5">
                            <label className="block text-sm font-medium text-teal-600 mb-1">Mức Độ Nhất Quán & Logic Đạt Được:</label>
                            <div className="w-full bg-gray-200 rounded-full h-6"><div className="bg-teal-500 h-6 rounded-full text-xs font-medium text-white text-center p-1 leading-none flex items-center justify-center" style={{ width: postEditAnalysis.consistencyScore || '0%' }}>{postEditAnalysis.consistencyScore}</div></div>
                            <p className="text-xs text-teal-600 mt-1 italic">{postEditAnalysis.scoreExplanation}</p>
                        </div>
                        <div className="mb-5">
                            <h4 className="text-md font-semibold text-teal-700 mb-2">💡 Các Yếu Tố Chính Đã Được Cải Thiện:</h4>
                            {postEditAnalysis.keyImprovements.length > 0 ? <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 bg-white p-3 rounded-md border border-teal-200">{postEditAnalysis.keyImprovements.map((item, index) => <li key={`improvement-${index}`}>{item}</li>)}</ul> : <p className="text-sm text-gray-600 italic">Không có cải thiện nổi bật.</p>}
                        </div>
                        <div>
                            <h4 className="text-md font-semibold text-teal-700 mb-2">⚠️ Các Vấn Đề (nếu có) Có Thể Cần Lưu Ý Thêm:</h4>
                            {postEditAnalysis.remainingIssues.length > 0 ? <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 bg-white p-3 rounded-md border border-teal-200">{postEditAnalysis.remainingIssues.map((item, index) => <li key={`issue-${index}`}>{item}</li>)}</ul> : <p className="text-sm text-gray-600 italic">Không có vấn đề đáng kể.</p>}
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}

      {activeTab === 'batch' && (
        <div role="tabpanel" id="batch-edit-panel" className="animate-fadeIn">
            <InfoBox>
                <p><strong>💡 Hướng dẫn (Biên Tập Hàng Loạt):</strong></p>
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1 text-sm">
                <li>Các cài đặt chung (Mục tiêu độ dài, Ngôn ngữ) từ tab "Biên Tập Đơn" sẽ được dùng làm mặc định.</li>
                <li>Thêm từng truyện bạn muốn biên tập. Bạn có thể tùy chỉnh dàn ý, độ dài, và ngôn ngữ riêng cho mỗi truyện nếu muốn ghi đè cài đặt chung.</li>
                <li>Nhấn "Bắt Đầu Biên Tập Hàng Loạt". AI sẽ xử lý từng truyện, bao gồm cả biên tập và phân tích.</li>
                </ul>
            </InfoBox>
            
            <div className="my-6 p-4 border rounded-lg bg-gray-50">
                <label htmlFor="editConcurrencyLimit" className="block text-sm font-medium text-gray-700 mb-1">Số luồng xử lý đồng thời (1-10):</label>
                <input 
                    type="number" 
                    id="editConcurrencyLimit" 
                    value={batchConcurrencyLimit} 
                    onChange={(e) => updateState({ batchConcurrencyLimit: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)) })}
                    min="1" max="10"
                    className="w-full md:w-1/4 p-2 border border-gray-300 rounded-md shadow-sm"
                    disabled={isProcessingBatchEdit || isLoadingEditing || isRefiningFurther}
                />
                <p className="text-xs text-orange-600 mt-1">
                    <strong>Cảnh báo:</strong> Đặt số luồng quá cao (trên 3-5) có thể gây lỗi do giới hạn của API. Mức đề xuất: 3.
                </p>
            </div>


            <div className="space-y-4 my-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Danh sách Truyện Cần Biên Tập Hàng Loạt</h3>
                {batchInputItems.map((item, index) => (
                <div key={item.id} className="p-4 border-2 border-gray-200 rounded-lg bg-white shadow-sm space-y-3">
                    <div className="flex justify-between items-center">
                        <h4 className="text-md font-semibold text-gray-700">Truyện #{index + 1}</h4>
                        <button onClick={() => handleRemoveBatchItem(item.id)} className="text-red-500 hover:text-red-700 font-medium text-sm p-2 rounded-md hover:bg-red-50" disabled={isProcessingBatchEdit || isLoadingEditing || isRefiningFurther} aria-label={`Xóa truyện ${index + 1}`}>
                            🗑️ Xóa
                        </button>
                    </div>
                    <div>
                    <label htmlFor={`batchOriginalStory-${item.id}`} className="block text-sm font-medium text-gray-700 mb-1">Nội dung truyện gốc (*):</label>
                    <textarea id={`batchOriginalStory-${item.id}`} value={item.originalStory} onChange={(e) => handleBatchItemInputChange(item.id, 'originalStory', e.target.value)} rows={5} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="Dán truyện gốc..." disabled={isProcessingBatchEdit || isLoadingEditing || isRefiningFurther}></textarea>
                    </div>
                    <details className="text-sm">
                        <summary className="cursor-pointer text-indigo-600 hover:text-indigo-800 font-medium">Tùy chỉnh riêng cho truyện này (không bắt buộc)</summary>
                        <div className="mt-2 space-y-3 p-3 bg-gray-50 rounded-md border">
                            <div>
                                <label htmlFor={`batchOutline-${item.id}`} className="block text-xs font-medium text-gray-600 mb-0.5">Dàn ý riêng:</label>
                                <textarea id={`batchOutline-${item.id}`} value={item.outline || ''} onChange={(e) => handleBatchItemInputChange(item.id, 'outline', e.target.value || null)} rows={3} className="w-full p-2 border border-gray-300 rounded-md text-xs" placeholder="Để trống nếu không có dàn ý riêng" disabled={isProcessingBatchEdit || isLoadingEditing || isRefiningFurther}></textarea>
                            </div>
                            <div className="grid md:grid-cols-2 gap-3">
                                <div>
                                    <label htmlFor={`batchSpecificLength-${item.id}`} className="block text-xs font-medium text-gray-600 mb-0.5">Mục tiêu độ dài riêng:</label>
                                    <select id={`batchSpecificLength-${item.id}`} value={item.specificTargetLength || ""} onChange={(e) => handleBatchItemInputChange(item.id, 'specificTargetLength', e.target.value || null)} className="w-full p-2 border border-gray-300 rounded-md text-xs" disabled={isProcessingBatchEdit || isLoadingEditing || isRefiningFurther}>
                                        <option value="">-- Dùng cài đặt chung ({parseInt(targetLengthForEditing).toLocaleString()} từ) --</option>
                                        {STORY_LENGTH_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor={`batchSpecificLang-${item.id}`} className="block text-xs font-medium text-gray-600 mb-0.5">Ngôn ngữ riêng:</label>
                                    <select id={`batchSpecificLang-${item.id}`} value={item.specificLanguage || ""} onChange={(e) => handleBatchItemInputChange(item.id, 'specificLanguage', e.target.value || null)} className="w-full p-2 border border-gray-300 rounded-md text-xs" disabled={isProcessingBatchEdit || isLoadingEditing || isRefiningFurther}>
                                        <option value="">-- Dùng cài đặt chung ({HOOK_LANGUAGE_OPTIONS.find(l=>l.value === languageForEditing)?.label}) --</option>
                                        {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </details>
                </div>
                ))}
                <button onClick={handleAddBatchItem} className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 shadow disabled:opacity-50" disabled={isProcessingBatchEdit || isLoadingEditing || isRefiningFurther}>
                ➕ Thêm Truyện
                </button>
            </div>

            <button onClick={handleStartBatchEditing} disabled={isProcessingBatchEdit || isLoadingEditing || isRefiningFurther || batchInputItems.length === 0 || batchInputItems.every(it => !it.originalStory.trim())} className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-bold py-3 px-6 rounded-lg shadow-xl hover:opacity-90 transition-opacity disabled:opacity-60 text-lg">
                🚀 Bắt Đầu Biên Tập Hàng Loạt ({batchInputItems.filter(it => it.originalStory.trim()).length} truyện)
            </button>

            {isProcessingBatchEdit && batchEditProgressMessage && <LoadingSpinner message={batchEditProgressMessage} />}
            {!isProcessingBatchEdit && batchEditProgressMessage && <p className={`text-center font-semibold my-3 ${batchEditProgressMessage.includes("Hoàn thành") ? 'text-green-600' : 'text-indigo-600'}`}>{batchEditProgressMessage}</p>}
            {batchEditError && <ErrorAlert message={batchEditError} />}

            {batchResults.length > 0 && (
                <div className="mt-8 space-y-6">
                <h3 className="text-2xl font-semibold text-gray-800 border-b pb-2">Kết Quả Biên Tập Hàng Loạt</h3>
                {batchResults.map((result, index) => (
                    <details key={result.id} className={`p-4 border-l-4 rounded-lg shadow-md bg-white 
                        ${result.status === 'completed' ? 'border-green-500' : 
                        result.status === 'error' ? 'border-red-500' : 
                        (result.status === 'pending' ? 'border-gray-300' : 'border-blue-500')
                        }`} open={batchResults.length === 1 || result.status !== 'pending' || batchItemExpansionState[result.id]}>
                    <summary className="font-semibold text-lg text-gray-700 cursor-pointer flex justify-between items-center" onClick={(e) => { e.preventDefault(); toggleBatchItemExpansion(result.id);}}>
                        <span>Truyện #{batchInputItems.findIndex(i => i.id === result.id) + 1}: {result.originalStory.substring(0, 60)}...</span>
                        <span className={`text-sm px-2 py-0.5 rounded-full
                            ${result.status === 'completed' ? 'bg-green-100 text-green-700' : 
                            result.status === 'error' ? 'bg-red-100 text-red-700' :
                            (result.status === 'pending' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700 animate-pulse')
                            }`}>
                            {result.status === 'pending' ? 'Sẵn sàng' : 
                            result.status === 'editing' || result.status === 'analyzing' ? 'Đang xử lý...' :
                            result.status === 'completed' ? '✅ Hoàn thành' : '⚠️ Lỗi'}
                        </span>
                    </summary>
                    <div className="mt-4 space-y-4">
                        {(result.status === 'editing' || result.status === 'analyzing') && result.progressMessage && <LoadingSpinner message={result.progressMessage} noMargins={true}/>}
                        {result.error && <ErrorAlert message={result.error} />}
                        
                        {result.editedStory && (
                            <div>
                                <h5 className="text-md font-semibold text-gray-600 mb-1">Truyện Đã Biên Tập:</h5>
                                <textarea value={result.editedStory} readOnly rows={10} className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 whitespace-pre-wrap leading-relaxed"></textarea>
                                <button id={`copyBatchEditedStory-${result.id}`} onClick={() => copyToClipboard(result.editedStory!, `copyBatchEditedStory-${result.id}`)} className="mt-2 px-3 py-1 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600">
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
                            <summary className="cursor-pointer text-gray-500 hover:text-gray-700">Xem truyện gốc của mục này</summary>
                            <textarea value={result.originalStory} readOnly rows={3} className="mt-1 w-full p-1 border border-gray-200 rounded-md bg-gray-100 whitespace-pre-wrap" disabled></textarea>
                        </details>
                    </div>
                    </details>
                ))}
                </div>
            )}
        </div>
      )}

      {/* History Panel */}
      <div className="mt-8">
        <HistoryPanel 
          moduleKey={MODULE_KEYS.EDIT_STORY}
          onSelectHistory={handleSelectHistory}
        />
      </div>
    </ModuleContainer>
  );
};

export default EditStoryModule;