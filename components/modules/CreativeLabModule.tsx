
import React, { useState, useEffect, useCallback } from 'react';
import { 
  ApiSettings, 
  CreativeLabModuleState, 
  ActiveModule, 
  UserProfile, 
  CreativeLabActiveTab, 
  GeneratedBatchOutlineItem 
} from '../../types';
import { PLOT_STRUCTURE_OPTIONS, OUTLINE_DETAIL_LEVEL_OPTIONS, HOOK_LANGUAGE_OPTIONS } from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner'; // Re-add
import ErrorAlert from '../ErrorAlert';     // Re-add
import InfoBox from '../InfoBox';
import { generateText } from '../../services/textGenerationService'; // Use the generic text generation service
import { delay, isSubscribed } from '../../utils';
import UpgradePrompt from '../UpgradePrompt';


interface CreativeLabModuleProps {
  apiSettings: ApiSettings;
  moduleState: CreativeLabModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<CreativeLabModuleState>>;
  setActiveModule: (module: ActiveModule) => void;
  setStoryOutlineForWriteModule: (outline: string) => void;
  setOutlineForSuperAgent: (outline: string) => void;
  currentUser: UserProfile | null;
}

const CreativeLabModule: React.FC<CreativeLabModuleProps> = ({
  apiSettings,
  moduleState,
  setModuleState,
  setActiveModule,
  setStoryOutlineForWriteModule,
  setOutlineForSuperAgent,
  currentUser
}) => {
  const hasActiveSubscription = isSubscribed(currentUser);

  const {
    // Common settings
    ideaLanguage, outputLanguage, plotStructure, customPlot, outlineDetailLevel, referenceViralOutline,
    referenceOutlineAnalysisResult, isAnalyzingReferenceOutline, errorAnalyzingReferenceOutline, // Added
    // Tab control
    activeCreativeTab,
    // Quick Outline
    quickOutlineTitle, quickOutlineResult, quickOutlineError, quickOutlineLoading, quickOutlineProgressMessage,
    // Single Outline (In-depth)
    coreIdea, secondaryIdea, emotionalJourney, finalOutline, singleOutlineError, singleOutlineLoading, singleOutlineProgressMessage,
    // Batch Outline
    batchCoreIdeas, generatedBatchOutlines, batchOutlineError, batchOutlineProgressMessage, batchOutlineLoading, batchConcurrencyLimit
  } = moduleState;

  const updateState = (updates: Partial<CreativeLabModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };

  const handleAnalyzeReferenceOutline = async () => {
    if (!referenceViralOutline.trim()) {
      updateState({ errorAnalyzingReferenceOutline: 'Vui lòng nhập "Dàn Ý Viral Tham Khảo" để phân tích.' });
      return;
    }
    updateState({ 
      isAnalyzingReferenceOutline: true, 
      errorAnalyzingReferenceOutline: null, 
      referenceOutlineAnalysisResult: null 
    });

    const selectedOutputLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === outputLanguage)?.label || outputLanguage;

    const prompt = `Bạn là một chuyên gia phân tích cấu trúc truyện. Hãy phân tích kỹ "Dàn Ý Tham Khảo" dưới đây và đưa ra nhận xét chi tiết về cấu trúc, điểm mạnh, và các kỹ thuật kể chuyện được sử dụng.
    Phân tích của bạn nên tập trung vào:
    - Cấu trúc tổng thể (ví dụ: 3 hồi, 5 hồi, phi tuyến tính, v.v.) và cách nó được triển khai.
    - Cách xây dựng và phát triển nhân vật chính (nếu có thông tin).
    - Việc sử dụng xung đột, căng thẳng (tension), và các yếu tố bất ngờ (twists), cliffhangers.
    - Nhịp độ (pacing) của câu chuyện qua các phần của dàn ý.
    - Cách mở đầu và kết thúc gây ấn tượng.
    - Các yếu tố đặc biệt nào làm cho dàn ý này có khả năng viral hoặc thu hút khán giả.

    Toàn bộ phân tích phải được viết bằng ngôn ngữ: ${selectedOutputLangLabel}.

    DÀN Ý THAM KHẢO CẦN PHÂN TÍCH:
    ---
    ${referenceViralOutline.trim()}
    ---
    Chỉ trả về nội dung phân tích, không thêm lời chào hay giới thiệu.`;

    try {
      const result = await generateText(prompt, undefined, undefined, apiSettings);
      updateState({ 
        referenceOutlineAnalysisResult: result.text, 
        isAnalyzingReferenceOutline: false 
      });
    } catch (e) {
      updateState({ 
        errorAnalyzingReferenceOutline: `Lỗi khi phân tích dàn ý tham khảo: ${(e as Error).message}`, 
        isAnalyzingReferenceOutline: false 
      });
    }
  };


  const handleGenerateQuickOutline = async () => {
    if (!quickOutlineTitle.trim()) {
      updateState({ quickOutlineError: 'Vui lòng nhập Tiêu đề truyện.' });
      return;
    }
    updateState({ quickOutlineError: null, quickOutlineResult: '', quickOutlineLoading: true, quickOutlineProgressMessage: 'Đang tạo dàn ý nhanh...' });

    let currentPlotStructureInfo = plotStructure; // This is the 'value' from PLOT_STRUCTURE_OPTIONS
    const selectedPlotStructureObj = PLOT_STRUCTURE_OPTIONS.find(opt => opt.value === plotStructure);

    if (plotStructure === 'custom' && customPlot.trim()) {
      currentPlotStructureInfo = `Tùy chỉnh: ${customPlot.trim()}`;
    } else if (plotStructure === 'custom' && !customPlot.trim()) {
      updateState({ quickOutlineError: 'Vui lòng nhập yêu cầu cốt truyện tùy chỉnh hoặc chọn một khuôn mẫu khác.', quickOutlineLoading: false, quickOutlineProgressMessage: null });
      return;
    } else if (selectedPlotStructureObj) {
        currentPlotStructureInfo = selectedPlotStructureObj.label; // Send the label to AI for non-custom
    }
    
    const selectedOutputLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === outputLanguage)?.label || outputLanguage;

    const prompt = `Bạn là một chuyên gia sáng tạo dàn ý truyện. Hãy tạo ra một dàn ý truyện hấp dẫn và lôi cuốn dựa trên các thông tin sau.
    Dàn ý cuối cùng PHẢI được viết bằng "Ngôn ngữ Hiện thị Kết quả" (${selectedOutputLangLabel}).

    THÔNG TIN ĐẦU VÀO:
    1.  **Tiêu đề Truyện (*):** ${quickOutlineTitle}
    2.  **Khuôn mẫu Cốt truyện (*):** ${currentPlotStructureInfo}
    3.  **Ngôn ngữ Hiện thị Kết quả (cho dàn ý cuối cùng) (*):** ${selectedOutputLangLabel}

    YÊU CẦU VỀ DÀN Ý ĐẦU RA:
    -   Tạo một dàn ý có cấu trúc rõ ràng (ví dụ: Mở đầu, Phát triển, Cao trào, Kết thúc hoặc các phần/chương chính).
    -   Dàn ý cần làm nổi bật được sự hấp dẫn, các yếu tố bất ngờ (nếu có thể), và giữ được sự tò mò của người đọc/xem.
    -   Đảm bảo dàn ý logic và đáp ứng đúng Khuôn mẫu Cốt truyện đã chọn.
    -   Toàn bộ dàn ý cuối cùng phải được viết bằng ngôn ngữ ${selectedOutputLangLabel}. Không thêm bất kỳ lời bình hay giới thiệu nào ngoài dàn ý.`;

    try {
      const result = await generateText(prompt, undefined, undefined, apiSettings);
      updateState({ quickOutlineResult: result.text, quickOutlineLoading: false, quickOutlineProgressMessage: 'Hoàn thành!' });
      setTimeout(() => setModuleState(prev => prev.quickOutlineProgressMessage === 'Hoàn thành!' ? {...prev, quickOutlineProgressMessage: null} : prev ), 3000);
    } catch (e) {
      updateState({ quickOutlineError: `Lỗi khi tạo dàn ý nhanh: ${(e as Error).message}`, quickOutlineLoading: false, quickOutlineProgressMessage: null });
    }
  };

  const handleGenerateSingleOutlineInDepth = async () => {
    if (!coreIdea.trim()) {
      updateState({ singleOutlineError: 'Vui lòng nhập Ý tưởng Cốt lõi.' });
      return;
    }
    updateState({ singleOutlineError: null, finalOutline: '', singleOutlineLoading: true, singleOutlineProgressMessage: 'Đang tạo dàn ý chuyên sâu...' });

    let currentPlotStructureInfo = plotStructure; // This is the 'value'
    const selectedPlotStructureObj = PLOT_STRUCTURE_OPTIONS.find(opt => opt.value === plotStructure);

    if (plotStructure === 'custom' && customPlot.trim()) {
      currentPlotStructureInfo = `Tùy chỉnh: ${customPlot.trim()}`;
    } else if (plotStructure === 'custom' && !customPlot.trim()) {
      updateState({ singleOutlineError: 'Vui lòng nhập yêu cầu cốt truyện tùy chỉnh hoặc chọn một khuôn mẫu khác.', singleOutlineLoading: false, singleOutlineProgressMessage: null });
      return;
    } else if (selectedPlotStructureObj) {
        currentPlotStructureInfo = selectedPlotStructureObj.label; // Send the label
    }
    
    const selectedIdeaLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === ideaLanguage)?.label || ideaLanguage;
    const selectedOutputLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === outputLanguage)?.label || outputLanguage;
    const selectedDetailLabel = OUTLINE_DETAIL_LEVEL_OPTIONS.find(opt => opt.value === outlineDetailLevel)?.label || outlineDetailLevel;

    let referenceOutlinePromptSegment = '';
    if (referenceViralOutline && referenceViralOutline.trim()) {
        referenceOutlinePromptSegment = `
    8.  **Dàn Ý Viral Tham Khảo (CHỈ DÙNG ĐỂ HỌC PHONG CÁCH CẤU TRÚC - TUYỆT ĐỐI KHÔNG SAO CHÉP NỘI DUNG/NHÂN VẬT):**
        \n---
        \n${referenceViralOutline.trim()}
        \n---
        \n**Yêu cầu BẮT BUỘC Về Việc Sử Dụng Dàn Ý Tham Khảo (Khi tạo dàn ý MỚI từ "Ý tưởng Cốt lõi"):**
        \n1.  **Phân Tích CHỈ Phong Cách Cấu Trúc:** Hãy PHÂN TÍCH KỸ "Dàn Ý Viral Tham Khảo" để hiểu rõ về cấu trúc, nhịp độ, cách sắp xếp tình tiết, cách xây dựng yếu tố bất ngờ, và các yếu tố gây tò mò/thu hút đặc trưng của nó.
        \n2.  **Áp Dụng Phong Cách Cấu Trúc (Không Nội Dung):** Khi bạn tạo dàn ý MỚI cho "Ý tưởng Cốt lõi" (mục 2), hãy ÁP DỤNG MỘT CÁCH SÁNG TẠO các yếu tố PHONG CÁCH CẤU TRÚC bạn vừa học được.
        \n3.  **NGHIÊM CẤM Sao Chép Nội Dung/Nhân Vật:** TUYỆT ĐỐI không sử dụng lại tên nhân vật, tình huống cụ thể, chi tiết cốt truyện, hoặc bất kỳ yếu tố nội dung nào từ "Dàn Ý Viral Tham Khảo" vào dàn ý mới. Dàn ý mới PHẢI được phát triển với các nhân vật, tình huống và chi tiết cốt truyện HOÀN TOÀN MỚI MẺ, dựa trên "Ý tưởng Cốt lõi" (mục 2). Mục tiêu là tạo ra một câu chuyện MỚI về nội dung nhưng có cấu trúc hấp dẫn tương tự.
        \n4.  **Kết Hợp Yêu Cầu Chung:** Dàn ý mới vẫn phải tuân thủ "Khuôn mẫu Cốt truyện" (mục 5) và "Mức độ Chi tiết" (mục 6) đã chọn, đồng thời được làm phong phú thêm bởi PHONG CÁCH CẤU TRÚC đã học.
        `;
    }

    const prompt = `Bạn là một chuyên gia xây dựng kịch bản và dàn ý thông minh. Hãy tạo ra một dàn ý chi tiết dựa trên các thông tin sau.
    Hãy xem xét "Ngôn ngữ Văn hóa cho Ý tưởng" (${selectedIdeaLangLabel}) khi phân tích và phát triển các yếu tố văn hóa, tên riêng, bối cảnh nếu các thông tin đầu vào sử dụng ngôn ngữ đó.
    Dàn ý cuối cùng PHẢI được viết bằng "Ngôn ngữ Hiện thị Kết quả" (${selectedOutputLangLabel}).

    THÔNG TIN CHI TIẾT ĐẦU VÀO:
    1.  **Ngôn ngữ Văn hóa cho Ý tưởng (để AI hiểu ngữ cảnh của input):** ${selectedIdeaLangLabel}
    2.  **Ý tưởng Cốt lõi (*):** ${coreIdea}
    3.  **Ý tưởng tường phong phú, AI càng có nhiều chất liệu để phát triển:** ${secondaryIdea || "Không có"}
    4.  **Hành trình Cảm xúc Khán giả Mong muốn:** ${emotionalJourney || "Không có yêu cầu cụ thể"}
    5.  **Khuôn mẫu Cốt truyện (*):** ${currentPlotStructureInfo}
    6.  **Mức độ Chi tiết Dàn Ý Yêu Cầu (*):** ${selectedDetailLabel}
    7.  **Ngôn ngữ Hiện thị Kết quả (cho dàn ý cuối cùng) (*):** ${selectedOutputLangLabel}${referenceOutlinePromptSegment}

    YÊU CẦU VỀ DÀN Ý ĐẦU RA:
    -   Tạo một dàn ý chi tiết, có cấu trúc rõ ràng (ví dụ: Phần 1, Phần 2, Phần 3 hoặc Chương 1, Chương 2,...).
    -   Mỗi phần/chương nên có các cảnh (scenes) hoặc điểm chính (key points) được mô tả.
    -   Đảm bảo dàn ý logic, hấp dẫn và đáp ứng các yêu cầu trên, đặc biệt là Khuôn mẫu Cốt truyện đã chọn.
    -   Nếu có yêu cầu về hành trình cảm xúc, hãy thiết kế các tình tiết để đạt được điều đó.
    -   Toàn bộ dàn ý cuối cùng phải được viết bằng ngôn ngữ ${selectedOutputLangLabel}. Không thêm bất kỳ lời bình hay giới thiệu nào ngoài dàn ý.
    `;

    try {
      const result = await generateText(prompt, undefined, undefined, apiSettings);
      updateState({ finalOutline: result.text, singleOutlineLoading: false, singleOutlineProgressMessage: 'Hoàn thành!' });
      setTimeout(() => setModuleState(prev => prev.singleOutlineProgressMessage === 'Hoàn thành!' ? {...prev, singleOutlineProgressMessage: null} : prev ), 3000);
    } catch (e) {
      updateState({ singleOutlineError: `Lỗi khi tạo dàn ý chuyên sâu: ${(e as Error).message}`, singleOutlineLoading: false, singleOutlineProgressMessage: null });
    }
  };

  const sendOutlineToModule = (outline: string | null, moduleType: ActiveModule.WriteStory | ActiveModule.SuperAgent) => {
    if (outline && outline.trim()) {
      if (moduleType === ActiveModule.WriteStory) {
        setStoryOutlineForWriteModule(outline);
      } else if (moduleType === ActiveModule.SuperAgent) {
         setOutlineForSuperAgent(outline);
      }
      setActiveModule(moduleType);
    } else {
        alert("Chưa có dàn ý nào được tạo để gửi đi.");
    }
  };


  // --- Batch Outline Logic ---
  const handleAddBatchCoreIdea = () => {
    updateState({ batchCoreIdeas: [...batchCoreIdeas, ''] });
  };

  const handleRemoveBatchCoreIdea = (index: number) => {
    if (batchCoreIdeas.length > 1) {
      const newIdeas = batchCoreIdeas.filter((_, i) => i !== index);
      updateState({ batchCoreIdeas: newIdeas });
    }
  };

  const handleBatchCoreIdeaChange = (index: number, value: string) => {
    const newIdeas = batchCoreIdeas.map((idea, i) => (i === index ? value : idea));
    updateState({ batchCoreIdeas: newIdeas });
  };

  const generateSingleOutlineForBatch = async (
    currentCoreIdea: string,
    currentSecondaryIdea: string, 
    currentEmotionalJourney: string 
  ): Promise<string> => {
    let currentPlotStructureInfo = plotStructure; // value
    const selectedPlotStructureObj = PLOT_STRUCTURE_OPTIONS.find(opt => opt.value === plotStructure);

    if (plotStructure === 'custom' && customPlot.trim()) {
      currentPlotStructureInfo = `Tùy chỉnh: ${customPlot.trim()}`;
    } else if (plotStructure === 'custom' && !customPlot.trim()) {
      throw new Error('Cốt truyện tùy chỉnh không được để trống khi chọn tùy chỉnh.');
    } else if (selectedPlotStructureObj) {
        currentPlotStructureInfo = selectedPlotStructureObj.label; // Send label
    }
    
    const selectedIdeaLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === ideaLanguage)?.label || ideaLanguage;
    const selectedOutputLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === outputLanguage)?.label || outputLanguage;
    const selectedDetailLabel = OUTLINE_DETAIL_LEVEL_OPTIONS.find(opt => opt.value === outlineDetailLevel)?.label || outlineDetailLevel;
    
    let referenceOutlinePromptSegment = '';
    if (referenceViralOutline && referenceViralOutline.trim()) {
        referenceOutlinePromptSegment = `
    8.  **Dàn Ý Viral Tham Khảo (CHỈ DÙNG ĐỂ HỌC PHONG CÁCH CẤU TRÚC - TUYỆT ĐỐI KHÔNG SAO CHÉP NỘI DUNG/NHÂN VẬT):**
        \n---
        \n${referenceViralOutline.trim()}
        \n---
        \n**Yêu cầu BẮT BUỘC Về Việc Sử Dụng Dàn Ý Tham Khảo (Khi tạo dàn ý MỚI từ "Ý tưởng Cốt lõi"):**
        \n1.  **Phân Tích CHỈ Phong Cách Cấu Trúc:** Hãy PHÂN TÍCH KỸ "Dàn Ý Viral Tham Khảo" để hiểu rõ về cấu trúc, nhịp độ, cách sắp xếp tình tiết, cách xây dựng yếu tố bất ngờ, và các yếu tố gây tò mò/thu hút đặc trưng của nó.
        \n2.  **Áp Dụng Phong Cách Cấu Trúc (Không Nội Dung):** Khi bạn tạo dàn ý MỚI cho "Ý tưởng Cốt lõi" (mục 2), hãy ÁP DỤNG MỘT CÁCH SÁNG TẠO các yếu tố PHONG CÁCH CẤU TRÚC bạn vừa học được.
        \n3.  **NGHIÊM CẤM Sao Chép Nội Dung/Nhân Vật:** TUYỆT ĐỐI không sử dụng lại tên nhân vật, tình huống cụ thể, chi tiết cốt truyện, hoặc bất kỳ yếu tố nội dung nào từ "Dàn Ý Viral Tham Khảo" vào dàn ý mới. Dàn ý mới PHẢI được phát triển với các nhân vật, tình huống và chi tiết cốt truyện HOÀN TOÀN MỚI MẺ, dựa trên "Ý tưởng Cốt lõi" (mục 2). Mục tiêu là tạo ra một câu chuyện MỚI về nội dung nhưng có cấu trúc hấp dẫn tương tự.
        \n4.  **Kết Hợp Yêu Cầu Chung:** Dàn ý mới vẫn phải tuân thủ "Khuôn mẫu Cốt truyện" (mục 5) và "Mức độ Chi tiết" (mục 6) đã chọn, đồng thời được làm phong phú thêm bởi PHONG CÁCH CẤU TRÚC đã học.
        `;
    }

    const prompt = `Bạn là một chuyên gia xây dựng kịch bản và dàn ý thông minh. Hãy tạo ra một dàn ý chi tiết dựa trên các thông tin sau.
    Hãy xem xét "Ngôn ngữ Văn hóa cho Ý tưởng" (${selectedIdeaLangLabel}) khi phân tích và phát triển các yếu tố văn hóa, tên riêng, bối cảnh nếu các thông tin đầu vào sử dụng ngôn ngữ đó.
    Dàn ý cuối cùng PHẢI được viết bằng "Ngôn ngữ Hiện thị Kết quả" (${selectedOutputLangLabel}).

    THÔNG TIN CHI TIẾT ĐẦU VÀO:
    1.  **Ngôn ngữ Văn hóa cho Ý tưởng:** ${selectedIdeaLangLabel}
    2.  **Ý tưởng Cốt lõi (*):** ${currentCoreIdea}
    3.  **Ý tưởng tường phong phú (nếu có):** ${currentSecondaryIdea || "Không có"}
    4.  **Hành trình Cảm xúc Khán giả Mong muốn (nếu có):** ${currentEmotionalJourney || "Không có yêu cầu cụ thể"}
    5.  **Khuôn mẫu Cốt truyện (*):** ${currentPlotStructureInfo}
    6.  **Mức độ Chi tiết Dàn Ý Yêu Cầu (*):** ${selectedDetailLabel}
    7.  **Ngôn ngữ Hiện thị Kết quả (*):** ${selectedOutputLangLabel}${referenceOutlinePromptSegment}

    YÊU CẦU VỀ DÀN Ý ĐẦU RA:
    -   Tạo một dàn ý chi tiết, có cấu trúc rõ ràng.
    -   Mỗi phần/chương nên có các cảnh hoặc điểm chính.
    -   Đảm bảo dàn ý logic, hấp dẫn.
    -   Toàn bộ dàn ý cuối cùng phải được viết bằng ngôn ngữ ${selectedOutputLangLabel}. Không thêm bất kỳ lời bình hay giới thiệu nào ngoài dàn ý.
    `;
    const result = await generateText(prompt, undefined, undefined, apiSettings);
    return result.text;
  };


  const handleGenerateBatchOutlines = async () => {
    const activeCoreIdeas = batchCoreIdeas.map(idea => idea.trim()).filter(idea => idea);
    if (activeCoreIdeas.length === 0) {
      updateState({ batchOutlineError: 'Vui lòng nhập ít nhất một Ý tưởng Cốt lõi.' });
      return;
    }

    const CONCURRENCY_LIMIT = Math.max(1, Math.min(10, batchConcurrencyLimit));

    updateState({
      batchOutlineError: null,
      generatedBatchOutlines: [],
      batchOutlineLoading: true,
      batchOutlineProgressMessage: `Chuẩn bị tạo ${activeCoreIdeas.length} dàn ý với ${CONCURRENCY_LIMIT} luồng...`
    });

    const taskQueue = [...activeCoreIdeas];

    const worker = async () => {
      while (taskQueue.length > 0) {
        const coreIdea = taskQueue.shift();
        if (!coreIdea) continue;

        let result: GeneratedBatchOutlineItem;
        try {
          const outlineText = await generateSingleOutlineForBatch(coreIdea, "", "");
          result = { coreIdea, outline: outlineText, error: null };
        } catch (e) {
          result = { coreIdea, outline: '', error: `Lỗi khi tạo dàn ý: ${(e as Error).message}` };
        }

        // Use functional update to ensure we're working with the latest state
        setModuleState(prev => {
          const newCompletedCount = prev.generatedBatchOutlines.length + 1;
          return {
            ...prev,
            generatedBatchOutlines: [...prev.generatedBatchOutlines, result],
            batchOutlineProgressMessage: `Đang xử lý... Hoàn thành ${newCompletedCount}/${activeCoreIdeas.length}`
          };
        });
      }
    };

    const workers = Array(CONCURRENCY_LIMIT).fill(null).map(worker);
    await Promise.all(workers);

    updateState({
      batchOutlineLoading: false,
      batchOutlineProgressMessage: `Hoàn thành tạo ${activeCoreIdeas.length} dàn ý.`
    });
    setTimeout(() => setModuleState(prev => prev.batchOutlineProgressMessage && prev.batchOutlineProgressMessage.startsWith('Hoàn thành tạo') ? { ...prev, batchOutlineProgressMessage: null } : prev), 5000);
  };
  
  // Removed handleSendBatchOutlinesToStory as the target functionality is removed

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

  const handleTabChange = (newTab: CreativeLabActiveTab) => {
    updateState({ activeCreativeTab: newTab });
  };

  const TabButton: React.FC<{ tabId: CreativeLabActiveTab; label: string, icon: string }> = ({ tabId, label, icon }) => (
    <button
      onClick={() => handleTabChange(tabId)}
      className={`px-4 py-3 font-medium rounded-t-lg text-base transition-colors flex items-center space-x-2
                  ${activeCreativeTab === tabId 
                      ? 'bg-indigo-600 text-white shadow-md' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
      aria-selected={activeCreativeTab === tabId}
      role="tab"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
  
  const selectedPlotStructureDetails = PLOT_STRUCTURE_OPTIONS.find(opt => opt.value === plotStructure);

  return (
    <ModuleContainer title="📝 Module: Xây Dựng Dàn Ý Thông Minh">
      <InfoBox>
        <p><strong>💡 Hướng dẫn:</strong> Chọn tab để tạo dàn ý. "⚡️ Tạo Dàn Ý Nhanh" cho người mới hoặc cần ý tưởng gấp. "📝 Tạo Dàn Ý Lẻ (Chuyên Sâu)" cho phép tùy chỉnh sâu hơn. "📦 Tạo Dàn Ý Hàng Loạt" để xử lý nhiều ý tưởng cùng lúc.</p>
        <p className="mt-1"><strong>Mới:</strong> Thêm "Dàn Ý Viral Tham Khảo" trong cài đặt chung. AI sẽ học phong cách cấu trúc từ đó để áp dụng vào dàn ý mới của bạn (trong tab "Tạo Dàn Ý Lẻ (Chuyên Sâu)" và "Tạo Dàn Ý Hàng Loạt"). Bạn cũng có thể yêu cầu AI "Chỉ Phân Tích Dàn Ý Tham Khảo Này" để hiểu rõ cấu trúc của nó.</p>
      </InfoBox>

      {/* --- Common Settings --- */}
      <div className="space-y-6 p-6 border-2 border-gray-200 rounded-lg bg-gray-50 shadow mb-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Cài đặt chung cho Dàn Ý</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
            <div>
                <label htmlFor="commonIdeaLanguage" className="block text-sm font-medium text-gray-700 mb-1">Bối cảnh Văn hóa cho Ý tưởng:</label>
                <select id="commonIdeaLanguage" value={ideaLanguage} onChange={(e) => updateState({ ideaLanguage: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm">
                {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
                <p className="text-xs text-gray-500 mt-1">Dùng cho Dàn Ý Chuyên Sâu & Hàng Loạt để AI hiểu ngữ cảnh văn hóa của ý tưởng đầu vào.</p>
            </div>
            <div>
                <label htmlFor="commonOutputLanguage" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ Hiện thị Kết quả Dàn Ý:</label>
                <select id="commonOutputLanguage" value={outputLanguage} onChange={(e) => updateState({ outputLanguage: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm">
                {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            </div>
             <div>
                <label htmlFor="commonPlotStructure" className="block text-sm font-medium text-gray-700 mb-1">Chọn Khuôn mẫu Cốt truyện (*):</label>
                <select id="commonPlotStructure" value={plotStructure} onChange={(e) => updateState({ plotStructure: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm">
                {PLOT_STRUCTURE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            </div>
             <div>
                <label htmlFor="commonConcurrencyLimit" className="block text-sm font-medium text-gray-700 mb-1">Số luồng (Tạo Hàng Loạt):</label>
                <input 
                    type="number" 
                    id="commonConcurrencyLimit" 
                    value={batchConcurrencyLimit} 
                    onChange={(e) => updateState({ batchConcurrencyLimit: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)) })}
                    min="1" max="10"
                    className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm"
                    disabled={batchOutlineLoading}
                />
                <p className="text-xs text-orange-600 mt-1">
                    <strong>Cảnh báo:</strong> Áp dụng cho "Tạo Dàn Ý Hàng Loạt". Mức đề xuất: 3.
                </p>
            </div>
        </div>
        {selectedPlotStructureDetails && plotStructure !== 'custom' && (
            <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-md text-sm">
                <p className="font-semibold text-indigo-700">Mô tả Khuôn mẫu: "{selectedPlotStructureDetails.label}"</p>
                <p className="text-gray-600 mt-1 whitespace-pre-line">{selectedPlotStructureDetails.description}</p>
                <p className="font-semibold text-indigo-700 mt-2">Thể loại phù hợp:</p>
                <p className="text-gray-600 mt-1">{selectedPlotStructureDetails.genres.join(', ')}.</p>
            </div>
        )}
         {plotStructure === 'custom' && (
                <div className="mt-4"> 
                    <label htmlFor="commonCustomPlot" className="block text-sm font-medium text-gray-700 mb-1">Yêu cầu Cốt truyện Tùy chỉnh:</label>
                    <textarea id="commonCustomPlot" value={customPlot} onChange={(e) => updateState({ customPlot: e.target.value })} rows={2} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Ví dụ: Tạo một câu chuyện tình tay ba..."></textarea>
                    {selectedPlotStructureDetails && selectedPlotStructureDetails.value === 'custom' && (
                         <div className="mt-2 p-3 bg-indigo-50 border border-indigo-200 rounded-md text-sm">
                            <p className="text-gray-600">{selectedPlotStructureDetails.description}</p>
                        </div>
                    )}
                </div>
        )}
        <div className="mt-4">
            <label htmlFor="commonOutlineDetailLevel" className="block text-sm font-medium text-gray-700 mb-1">Mức độ Chi tiết Dàn Ý (*):</label>
            <select id="commonOutlineDetailLevel" value={outlineDetailLevel} onChange={(e) => updateState({ outlineDetailLevel: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm">
            {OUTLINE_DETAIL_LEVEL_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <p className="text-xs text-gray-500 mt-1">Chỉ áp dụng cho Dàn Ý Chuyên Sâu & Hàng Loạt.</p>
        </div>
        <div className="mt-4">
            <label htmlFor="referenceViralOutline" className="block text-sm font-medium text-gray-700 mb-1">
                Dàn Ý Viral Tham Khảo (để AI học phong cách cấu trúc và/hoặc phân tích):
            </label>
            <textarea 
                id="referenceViralOutline" 
                value={referenceViralOutline} 
                onChange={(e) => updateState({ referenceViralOutline: e.target.value, referenceOutlineAnalysisResult: null, errorAnalyzingReferenceOutline: null })} 
                rows={4} 
                className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" 
                placeholder="Dán một dàn ý viral mẫu vào đây..."
            />
            <p className="text-xs text-gray-500 mt-1">Lưu ý: AI sẽ dùng dàn ý này để học phong cách cấu trúc cho Dàn Ý Chuyên Sâu & Hàng Loạt. Bạn cũng có thể yêu cầu AI phân tích riêng dàn ý này (trong tab "Tạo Dàn Ý Lẻ (Chuyên Sâu)").</p>
        </div>
      </div>

      {/* --- Tabs --- */}
      <div className="mb-6 flex flex-wrap gap-1 border-b-2 border-gray-300" role="tablist" aria-label="Chế độ tạo dàn ý">
        <TabButton tabId="quickOutline" label="Tạo Dàn Ý Nhanh" icon="⚡️" />
        <TabButton tabId="singleOutline" label="Tạo Dàn Ý Lẻ (Chuyên Sâu)" icon="📝" />
        <TabButton tabId="batchOutline" label="Tạo Dàn Ý Hàng Loạt" icon="📦" />
      </div>

      {/* --- Tab Content --- */}
      {activeCreativeTab === 'quickOutline' && (
         <div role="tabpanel" id="quick-outline-panel" aria-labelledby="quick-outline-tab" className="animate-fadeIn space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">⚡️ Tạo Dàn Ý Nhanh Từ Tiêu Đề</h3>
             <InfoBox variant="info">
                <p>Nhập tiêu đề truyện và chọn khuôn mẫu cốt truyện từ "Cài đặt chung". AI sẽ nhanh chóng tạo ra một dàn ý hấp dẫn cho bạn. Lý tưởng cho người mới bắt đầu hoặc khi cần ý tưởng nhanh!</p>
            </InfoBox>
            <fieldset className="p-4 border rounded-lg bg-white space-y-4 shadow">
                <legend className="text-md font-semibold px-2 text-gray-700">Thông tin cho Dàn Ý Nhanh</legend>
                <div>
                    <label htmlFor="quickOutlineTitle" className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề Truyện (*):</label>
                    <textarea id="quickOutlineTitle" value={quickOutlineTitle} onChange={(e) => updateState({ quickOutlineTitle: e.target.value })} rows={2} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Ví dụ: Nàng công chúa và con rồng lửa"></textarea>
                </div>
            </fieldset>
            <button 
                onClick={handleGenerateQuickOutline} 
                disabled={!hasActiveSubscription || quickOutlineLoading} 
                className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              🚀 Tạo Dàn Ý Nhanh
            </button>
            {quickOutlineLoading && <LoadingSpinner message={quickOutlineProgressMessage || 'Đang xử lý...'} />}
            {quickOutlineError && <ErrorAlert message={quickOutlineError} />}
            {quickOutlineResult && !quickOutlineLoading && (
              <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                <h3 className="text-lg font-semibold mb-2 text-gray-700">Dàn Ý Nhanh Đã Tạo:</h3>
                <textarea value={quickOutlineResult} readOnly rows={15} className="w-full p-3 border-2 border-gray-200 rounded-md bg-white whitespace-pre-wrap leading-relaxed"></textarea>
                <div className="mt-4 space-x-3">
                  <button onClick={() => sendOutlineToModule(quickOutlineResult, ActiveModule.WriteStory)} disabled={!hasActiveSubscription} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">Gửi đến Module Viết Truyện</button>
                  <button onClick={() => sendOutlineToModule(quickOutlineResult, ActiveModule.SuperAgent)} disabled={!hasActiveSubscription} className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50">Gửi đến Siêu Trợ Lý AI</button>
                  <button id="copyQuickOutlineBtn" onClick={() => copyToClipboard(quickOutlineResult, "copyQuickOutlineBtn")} className="mt-2 px-3 py-1 bg-teal-500 text-white text-xs rounded-lg hover:bg-teal-600">
                    📋 Sao chép Dàn Ý Nhanh
                  </button>
                </div>
              </div>
            )}
         </div>
      )}

      {activeCreativeTab === 'singleOutline' && (
         <div role="tabpanel" id="single-outline-panel" aria-labelledby="single-outline-tab" className="animate-fadeIn space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">📝 Tạo Dàn Ý Lẻ (Chuyên Sâu)</h3>
            {referenceViralOutline.trim() && (
                <div className="p-4 border rounded-lg bg-yellow-50 border-yellow-300">
                    <h4 className="text-md font-semibold text-yellow-800 mb-2">Phân Tích Dàn Ý Tham Khảo</h4>
                    <button
                        onClick={handleAnalyzeReferenceOutline}
                        disabled={!hasActiveSubscription || !moduleState.referenceViralOutline || moduleState.isAnalyzingReferenceOutline}
                        className="w-full mb-3 bg-yellow-500 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md hover:bg-yellow-600 transition-opacity disabled:opacity-50"
                    >
                       🔬 Chỉ Phân Tích Dàn Ý Tham Khảo Này
                    </button>
                    {moduleState.isAnalyzingReferenceOutline && <LoadingSpinner message="Đang phân tích dàn ý tham khảo..." />}
                    {moduleState.errorAnalyzingReferenceOutline && <ErrorAlert message={moduleState.errorAnalyzingReferenceOutline} />}
                    {moduleState.referenceOutlineAnalysisResult && !moduleState.isAnalyzingReferenceOutline && (
                        <div className="mt-3">
                            <h5 className="text-sm font-semibold text-gray-700 mb-1">Kết Quả Phân Tích Dàn Ý Tham Khảo:</h5>
                            <textarea value={moduleState.referenceOutlineAnalysisResult} readOnly rows={8} className="w-full p-2 border-2 border-gray-200 rounded-md bg-white whitespace-pre-wrap leading-relaxed"></textarea>
                        </div>
                    )}
                </div>
            )}
            <fieldset className="p-4 border rounded-lg bg-white space-y-4 shadow">
                <legend className="text-md font-semibold px-2 text-gray-700">Thông tin cho Dàn Ý Chuyên Sâu Mới</legend>
                <div>
                    <label htmlFor="singleCoreIdea" className="block text-sm font-medium text-gray-700 mb-1">Ý tưởng Cốt lõi (*):</label>
                    <textarea id="singleCoreIdea" value={coreIdea} onChange={(e) => updateState({ coreIdea: e.target.value })} rows={3} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Ví dụ: Cô Dâu Vừa Bước Vào Nhà Chồng..."></textarea>
                </div>
                <div>
                    <label htmlFor="singleSecondaryIdea" className="block text-sm font-medium text-gray-700 mb-1">Ý tưởng tường phong phú:</label>
                    <textarea id="singleSecondaryIdea" value={secondaryIdea} onChange={(e) => updateState({ secondaryIdea: e.target.value })} rows={3} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Ví dụ: Âm mưu lớn hơn..."></textarea>
                </div>
                <div>
                    <label htmlFor="singleEmotionalJourney" className="block text-sm font-medium text-gray-700 mb-1">Hành trình Cảm xúc Khán giả Mong muốn:</label>
                    <textarea id="singleEmotionalJourney" value={emotionalJourney} onChange={(e) => updateState({ emotionalJourney: e.target.value })} rows={2} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Ví dụ: Tò mò -> Căng thẳng..."></textarea>
                </div>
            </fieldset>
            <button 
                onClick={handleGenerateSingleOutlineInDepth} 
                disabled={!hasActiveSubscription || singleOutlineLoading || moduleState.isAnalyzingReferenceOutline} 
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              💡 Tạo Dàn Ý Lẻ (Chuyên Sâu) Mới
            </button>
            {singleOutlineLoading && <LoadingSpinner message={singleOutlineProgressMessage || 'Đang xử lý...'} />}
            {singleOutlineError && <ErrorAlert message={singleOutlineError} />}
            {finalOutline && !singleOutlineLoading && (
              <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                <h3 className="text-lg font-semibold mb-2 text-gray-700">Dàn Ý Chuyên Sâu Mới Đã Tạo:</h3>
                <textarea value={finalOutline} readOnly rows={15} className="w-full p-3 border-2 border-gray-200 rounded-md bg-white whitespace-pre-wrap leading-relaxed"></textarea>
                <div className="mt-4 space-x-3">
                  <button onClick={() => sendOutlineToModule(finalOutline, ActiveModule.WriteStory)} disabled={!hasActiveSubscription} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">Gửi đến Module Viết Truyện</button>
                  <button onClick={() => sendOutlineToModule(finalOutline, ActiveModule.SuperAgent)} disabled={!hasActiveSubscription} className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50">Gửi đến Siêu Trợ Lý AI</button>
                   <button id="copySingleOutlineBtn" onClick={() => copyToClipboard(finalOutline, "copySingleOutlineBtn")} className="mt-2 px-3 py-1 bg-teal-500 text-white text-xs rounded-lg hover:bg-teal-600">
                    📋 Sao chép Dàn Ý Chuyên Sâu
                  </button>
                </div>
              </div>
            )}
         </div>
      )}

      {activeCreativeTab === 'batchOutline' && (
        <div role="tabpanel" id="batch-outline-panel" aria-labelledby="batch-outline-tab" className="animate-fadeIn space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">📦 Tạo Dàn Ý Hàng Loạt</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Danh sách Ý tưởng Cốt lõi (để tạo dàn ý hàng loạt):</label>
              {batchCoreIdeas.map((idea, index) => (
                <div key={index} className="flex items-start space-x-2 mb-3 p-3 border border-gray-200 rounded-lg bg-white shadow-sm">
                  <textarea
                    value={idea}
                    onChange={(e) => handleBatchCoreIdeaChange(index, e.target.value)}
                    rows={2}
                    className="flex-grow p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder={`Ý tưởng cốt lõi ${index + 1}...`}
                    aria-label={`Ý tưởng cốt lõi ${index + 1}`}
                  />
                  {batchCoreIdeas.length > 1 && (
                    <button
                      onClick={() => handleRemoveBatchCoreIdea(index)}
                      className="p-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-50 transition-colors"
                      aria-label={`Xóa ý tưởng ${index + 1}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={handleAddBatchCoreIdea}
                className="mt-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
              >
                + Thêm Ý Tưởng Cốt Lõi
              </button>
            </div>
            <button 
                onClick={handleGenerateBatchOutlines} 
                disabled={!hasActiveSubscription || batchOutlineLoading || batchCoreIdeas.every(idea => !idea.trim())} 
                className="w-full bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              💡 Bắt đầu Tạo Dàn Ý Hàng Loạt
            </button>
            {batchOutlineLoading && <LoadingSpinner message={batchOutlineProgressMessage || 'Đang xử lý...'} />}
            {!batchOutlineLoading && batchOutlineProgressMessage && <p className="text-center text-teal-600 font-medium my-2">{batchOutlineProgressMessage}</p>}
            {batchOutlineError && <ErrorAlert message={batchOutlineError} />}

            {generatedBatchOutlines.length > 0 && (
                <div className="mt-8 space-y-4">
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">Kết quả Tạo Dàn Ý Hàng Loạt:</h3>
                    <p className="text-sm text-gray-600 mb-4">
                        Tổng số: {generatedBatchOutlines.length} dàn ý. 
                        Thành công: {generatedBatchOutlines.filter(item => !item.error).length}. 
                        Lỗi: {generatedBatchOutlines.filter(item => item.error).length}.
                    </p>
                    {generatedBatchOutlines.map((item, index) => (
                        <details 
                            key={index} 
                            className={`p-4 border rounded-lg shadow-sm bg-white group ${item.error ? 'border-l-4 border-red-500' : 'border-l-4 border-green-500'}`}
                        >
                            <summary className="font-semibold text-gray-700 cursor-pointer flex justify-between items-center group-hover:text-indigo-600">
                                <span className="truncate w-10/12">Dàn ý {index + 1} (Từ: {item.coreIdea.substring(0, 50)}...)</span>
                                {item.error ? <span className="text-red-500 text-2xl" role="img" aria-label="Lỗi">❌</span> : <span className="text-green-500 text-2xl" role="img" aria-label="Thành công">✅</span>}
                            </summary>
                            <div className="mt-3 space-y-3">
                                <div>
                                    <h4 className="text-xs font-semibold text-gray-500 mb-1">Ý TƯỞNG GỐC:</h4>
                                    <p className="text-sm text-gray-600 bg-gray-50 p-2 border rounded whitespace-pre-wrap">{item.coreIdea}</p>
                                </div>
                                {item.error && (
                                    <div>
                                        <h4 className="text-xs font-semibold text-red-600 mb-1">LỖI:</h4>
                                        <ErrorAlert message={item.error}/>
                                    </div>
                                )}
                                {item.outline && !item.error && (
                                    <div>
                                        <h4 className="text-xs font-semibold text-gray-500 mb-1">DÀN Ý ĐÃ TẠO:</h4>
                                        <textarea 
                                            value={item.outline} 
                                            readOnly 
                                            rows={8} 
                                            className="w-full p-3 border-2 border-gray-200 rounded-md bg-gray-50 whitespace-pre-wrap leading-relaxed"
                                            aria-label={`Dàn ý đã tạo cho ý tưởng ${index + 1}`}
                                        />
                                        <button 
                                            id={`copyBatchOutlineBtn-${index}`} 
                                            onClick={() => copyToClipboard(item.outline, `copyBatchOutlineBtn-${index}`)} 
                                            className="mt-2 px-3 py-1 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600"
                                        >
                                            📋 Sao chép Dàn Ý {index + 1}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </details>
                    ))}
                    {/* Removed the button "Gửi Tất Cả Dàn Ý Hàng Loạt sang Module Viết Truyện" */}
                </div>
            )}
        </div>
      )}
    </ModuleContainer>
  );
};

export default CreativeLabModule;
