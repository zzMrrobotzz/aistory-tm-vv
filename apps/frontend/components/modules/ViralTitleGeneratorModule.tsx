

import React from 'react'; 
import { ApiSettings, ContentStrategyModuleState, ContentStrategyActiveTabType, GroundingChunk, NicheThemeAnalysisResult, CreationSourceType, UserProfile } from '../../types';
import { HOOK_LANGUAGE_OPTIONS, VARIATION_GOAL_OPTIONS } from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { generateText, generateTextWithJsonOutput } from '@/services/textGenerationService';

interface ContentStrategyModuleProps {
  apiSettings: ApiSettings;
  moduleState: ContentStrategyModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<ContentStrategyModuleState>>;
  currentUser: UserProfile | null;
}

const ContentStrategyModule: React.FC<ContentStrategyModuleProps> = ({ apiSettings, moduleState, setModuleState, currentUser }) => {
  const {
    activeTab, resultText, outputLanguage, loadingMessage, error,
    // Creation Studio
    creationSourceType, creationViralContext,
    // -- Old fields reused in Creation Studio
    baseTitle, fixedPrefix, numVariations, viralKeywords, variationGoal, newContextTheme, generateVariationsExplanation,
    existingViralTitles, numNewSeriesTitles,
    scriptContent, channelViralTitles, numSuggestions,
    // Analyze Trend Tab
    analyzeInputType, analyzeUrls, analyzeTitles, analyzeChannelTheme,
    analysisReport, viralFormulas, applicationSuggestions,
    analyzeLoadingMessage, analyzeError, groundingSourcesAnalysis,
    // Niche Explorer Tab
    inputTitlesForNiche, nicheInputLanguage, nicheOutputLanguage, numNichesToSuggest,
    nicheAnalysisResults, nicheIsLoading, nicheError, nicheProgressMessage
  } = moduleState;

  const updateState = (updates: Partial<ContentStrategyModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };

  const getSelectedLanguageLabel = (langValue: string) => HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === langValue)?.label || langValue;

  const handleCreationStudioSubmit = async () => {
    let currentLoadingMessageGeneral = "Đang xử lý yêu cầu...";
    if (creationSourceType === 'baseTitle') currentLoadingMessageGeneral = "Đang tạo biến thể tiêu đề...";
    else if (creationSourceType === 'seriesList') currentLoadingMessageGeneral = "Đang phân tích & tạo tiêu đề series...";
    else if (creationSourceType === 'script') currentLoadingMessageGeneral = "Đang gợi ý tiêu đề từ kịch bản...";

    updateState({ error: null, resultText: '', loadingMessage: currentLoadingMessageGeneral, generateVariationsExplanation: null });
    
    let prompt = '';
    const langLabel = getSelectedLanguageLabel(outputLanguage);
    let actionCompletedMessage = "Hoàn thành!";
    let actionErrorMessage = "Lỗi!";

    const viralContextPrompt = creationViralContext.trim()
        ? `\n\n**HỌC PHONG CÁCH VIRAL (QUAN TRỌNG):**
Dưới đây là một số ngữ cảnh/phong cách/từ khóa viral. Hãy phân tích kỹ và áp dụng tinh thần/văn phong của nó vào các tiêu đề bạn tạo ra.
---
${creationViralContext.trim()}
---`
        : '';

    try {
      if (creationSourceType === 'baseTitle') {
        if (!baseTitle.trim()) {
            updateState({ error: 'Vui lòng nhập Tiêu đề Cơ sở.', loadingMessage: null });
            return;
        }
        const selectedVariationGoalLabel = VARIATION_GOAL_OPTIONS.find(opt => opt.value === variationGoal)?.label || "Mặc định";
        
        prompt = `Bạn là chuyên gia tạo tiêu đề video viral. Hãy tạo ${numVariations} biến thể tiêu đề hấp dẫn dựa trên thông tin sau. Các tiêu đề phải được viết bằng ngôn ngữ ${langLabel}.
        - Tiêu đề Cơ sở: "${baseTitle}"
        - Tiền tố Cố định (nếu có, thêm vào đầu mỗi biến thể): "${fixedPrefix || 'Không có'}"
        - Từ khóa/Chủ đề Viral cần nhấn mạnh (nếu có): "${viralKeywords || 'Không có'}"
        - Mục tiêu Biến tấu: "${selectedVariationGoalLabel}". Hãy ưu tiên mục tiêu này.
        - Ngữ cảnh/Chủ đề Mới (nếu có, AI sẽ cố gắng "xoáy" tiêu đề gốc sang chủ đề này nhưng giữ "gen" viral): "${newContextTheme || 'Không có'}"
        ${viralContextPrompt}
        
        Yêu cầu: 
        1. Trả về danh sách các biến thể, mỗi biến thể trên một dòng, có đánh số.
        2. Sau danh sách, thêm một dòng giải thích ngắn gọn về cách bạn đã áp dụng "Mục tiêu Biến tấu" và các yếu tố khác trong quá trình tạo các biến thể. Đặt phần giải thích này trong cặp thẻ [EXPLANATION]...[/EXPLANATION]. Ví dụ: [EXPLANATION]Tôi đã tập trung vào việc tăng tính tò mò và áp dụng phong cách từ "Bối cảnh viral" để tạo ra các tiêu đề giật gân hơn.[/EXPLANATION]`;
        actionCompletedMessage = "Tạo biến thể hoàn tất!";
        actionErrorMessage = "Lỗi tạo biến thể.";

      } else if (creationSourceType === 'seriesList') {
        if (!existingViralTitles.trim()) {
            updateState({ error: 'Vui lòng nhập Danh sách Tiêu đề Viral Hiện có.', loadingMessage: null });
            return;
        }
        prompt = `Bạn là chuyên gia phân tích và sáng tạo tiêu đề series. 
        Đầu tiên, hãy phân tích các tiêu đề viral hiện có sau đây để nắm bắt phong cách, giọng điệu, và các yếu tố thu hút của chúng:\n"${existingViralTitles}"
        ${viralContextPrompt}
        Sau đó, dựa trên phân tích đó (và "Phong cách Viral" nếu có), hãy tạo ra ${numNewSeriesTitles} tiêu đề mới cho một series tiếp theo, duy trì phong cách và sự hấp dẫn tương tự. Các tiêu đề mới phải được viết bằng ngôn ngữ ${langLabel}.
        Yêu cầu: Trả về danh sách các tiêu đề mới, mỗi tiêu đề trên một dòng, có đánh số.`;
        actionCompletedMessage = "Phân tích & tạo series hoàn tất!";
        actionErrorMessage = "Lỗi tạo series.";
      } else if (creationSourceType === 'script') {
        if (!scriptContent.trim()) {
            updateState({ error: 'Vui lòng nhập Kịch bản hoặc Tóm tắt truyện.', loadingMessage: null });
            return;
        }
        prompt = `Bạn là một nhà biên kịch và chuyên gia đặt tiêu đề. Hãy đọc kỹ kịch bản/tóm tắt truyện dưới đây.
        Kịch bản/Tóm tắt: "${scriptContent}"
        ${channelViralTitles.trim() ? `Tham khảo thêm các tiêu đề viral của kênh này để học phong cách (nếu có):\n"${channelViralTitles}"` : ''}
        ${viralContextPrompt}
        Dựa vào nội dung và phong cách đã học, hãy gợi ý ${numSuggestions} tiêu đề video hấp dẫn, có khả năng viral cao. Các tiêu đề gợi ý phải được viết bằng ngôn ngữ ${langLabel}.
        Yêu cầu: Trả về danh sách các tiêu đề gợi ý, mỗi tiêu đề trên một dòng, có đánh số.`;
        actionCompletedMessage = "Gợi ý tiêu đề hoàn tất!";
        actionErrorMessage = "Lỗi gợi ý tiêu đề.";
      }

      if (prompt) {
        const result = await generateText(prompt, undefined, false, apiSettings);
        let mainResultText = result.text;
        let explanationText = null;

        if (creationSourceType === 'baseTitle') {
            const explanationMatch = result.text.match(/\[EXPLANATION\]([\s\S]*?)\[\/EXPLANATION\]/);
            if (explanationMatch && explanationMatch[1]) {
                explanationText = explanationMatch[1].trim();
                mainResultText = result.text.replace(explanationMatch[0], '').trim();
            }
        }
        updateState({ resultText: mainResultText, generateVariationsExplanation: explanationText, loadingMessage: actionCompletedMessage });
      } else {
        updateState({ error: 'Không thể xác định hành động cho tab hiện tại.', loadingMessage: null });
      }
    } catch (e) {
      updateState({ error: `Đã xảy ra lỗi: ${(e as Error).message}`, loadingMessage: actionErrorMessage });
    } finally {
      setTimeout(() => {
        setModuleState(prev => 
          (prev.loadingMessage === actionCompletedMessage || prev.loadingMessage === actionErrorMessage) 
          ? {...prev, loadingMessage: null} 
          : prev
        )
      }, 3000);
    }
  };
  
  const handleAnalyzeTrend = async () => {
    if (analyzeInputType === 'urls' && !analyzeUrls.trim()) {
        updateState({ analyzeError: 'Vui lòng nhập ít nhất một URL video YouTube.', analyzeLoadingMessage: null });
        return;
    }
    if (analyzeInputType === 'titles' && !analyzeTitles.trim()) {
        updateState({ analyzeError: 'Vui lòng nhập ít nhất một tiêu đề viral.', analyzeLoadingMessage: null });
        return;
    }

    updateState({
        analyzeError: null,
        analysisReport: '',
        viralFormulas: '',
        applicationSuggestions: '',
        groundingSourcesAnalysis: [],
        analyzeLoadingMessage: 'Đang phân tích trend và đối thủ...'
    });

    const langLabel = getSelectedLanguageLabel(outputLanguage);
    const inputData = analyzeInputType === 'urls' ? `URLs:\n${analyzeUrls}` : `Titles:\n${analyzeTitles}`;
    const channelThemeInfo = analyzeChannelTheme.trim() ? `\nChủ đề kênh người dùng (để tham khảo khi đưa ra gợi ý áp dụng): "${analyzeChannelTheme.trim()}"` : '';

    const prompt = `Bạn là một chuyên gia phân tích chiến lược nội dung YouTube và tiêu đề viral. 
Nhiệm vụ của bạn là phân tích sâu sắc các ${analyzeInputType === 'urls' ? 'video YouTube từ các URL được cung cấp' : 'tiêu đề video được cung cấp'} để xác định các yếu tố và công thức tạo nên sự viral. 
Sử dụng Google Search nếu đầu vào là URL để thu thập thông tin.
Ngôn ngữ đầu ra cho toàn bộ phân tích, công thức, và gợi ý phải là ${langLabel}.

Đầu vào:
---
${inputData}
---
${channelThemeInfo}

Yêu cầu phân tích và đầu ra (toàn bộ bằng ${langLabel}):
1.  **Báo cáo Phân tích Chi tiết (Đặt trong thẻ [ANALYSIS_REPORT_START]...[ANALYSIS_REPORT_END]):**
    *   Loại hình tiêu đề phổ biến (Câu hỏi, So sánh, Cảnh báo, Hướng dẫn, Kể chuyện, Top list, Thử thách, v.v.)
    *   Các yếu tố Cảm xúc chính được khai thác (Tò mò, Sợ hãi, Ngạc nhiên, Vui vẻ, Đồng cảm, Phẫn nộ, v.v.)
    *   Từ khóa Chính & Phụ nổi bật.
    *   Cấu trúc Ngữ pháp & Độ dài trung bình/hiệu quả.
    *   Việc sử dụng Con số, Ký tự đặc biệt, Emoji (nếu có và hiệu quả).
    *   Yếu tố Call to Action (ngầm hoặc rõ ràng).
    *   Nếu có nhiều tiêu đề/URL, so sánh điểm chung và điểm khác biệt nổi bật.
2.  **"Công thức Viral" Suy luận (Đặt trong thẻ [VIRAL_FORMULAS_START]...[VIRAL_FORMULAS_END]):**
    *   Dựa trên phân tích, hãy suy luận và đưa ra 1-3 "công thức" hoặc "khuôn mẫu" tiêu đề mà bạn nhận thấy từ các ví dụ thành công.
    *   Ví dụ công thức: "[Con số] + [Tính từ Gây Sốc] + [Hành động] + [Kết quả Bất ngờ]" hoặc "Làm thế nào để [Đạt được điều gì đó] mà không cần [Khó khăn thường gặp]?".
3.  **Gợi ý Áp dụng (Đặt trong thẻ [APPLICATION_SUGGESTIONS_START]...[APPLICATION_SUGGESTIONS_END]):**
    *   Gợi ý 2-3 cách cụ thể mà người dùng có thể áp dụng những "công thức viral" này cho kênh của họ (dựa trên ${analyzeChannelTheme.trim() ? `chủ đề kênh đã cung cấp: "${analyzeChannelTheme.trim()}"` : 'một chủ đề kể chuyện chung chung'}).

CHỈ TRẢ VỀ NỘI DUNG BÊN TRONG CÁC THẺ ĐÃ ĐỊNH NGHĨA. Ví dụ:
[ANALYSIS_REPORT_START]
Nội dung báo cáo...
[ANALYSIS_REPORT_END]
[VIRAL_FORMULAS_START]
Công thức 1: ...
Công thức 2: ...
[VIRAL_FORMULAS_END]
[APPLICATION_SUGGESTIONS_START]
Gợi ý 1: ...
Gợi ý 2: ...
[APPLICATION_SUGGESTIONS_END]
`;

    try {
        const result = await generateText(prompt, undefined, analyzeInputType === 'urls', apiSettings);
        const text = result.text;
        const groundingChunks = result.groundingChunks || [];

        const reportMatch = text.match(/\[ANALYSIS_REPORT_START\]([\s\S]*?)\[\/ANALYSIS_REPORT_END\]/);
        const formulasMatch = text.match(/\[VIRAL_FORMULAS_START\]([\s\S]*?)\[\/VIRAL_FORMULAS_END\]/);
        const suggestionsMatch = text.match(/\[APPLICATION_SUGGESTIONS_START\]([\s\S]*?)\[\/APPLICATION_SUGGESTIONS_END\]/);

        updateState({
            analysisReport: reportMatch ? reportMatch[1].trim() : "Không thể trích xuất báo cáo phân tích.",
            viralFormulas: formulasMatch ? formulasMatch[1].trim() : "Không thể trích xuất công thức viral.",
            applicationSuggestions: suggestionsMatch ? suggestionsMatch[1].trim() : "Không thể trích xuất gợi ý áp dụng.",
            groundingSourcesAnalysis: groundingChunks,
            analyzeLoadingMessage: "Phân tích trend hoàn tất!",
            analyzeError: null,
        });
    } catch (e) {
      updateState({ analyzeError: `Đã xảy ra lỗi khi phân tích trend: ${(e as Error).message}`, analyzeLoadingMessage: "Lỗi phân tích." });
    } finally {
        setTimeout(() => {
            setModuleState(prev => 
                (prev.analyzeLoadingMessage?.includes("hoàn tất") || prev.analyzeLoadingMessage?.includes("Lỗi")) 
                ? {...prev, analyzeLoadingMessage: null} 
                : prev
            )
        }, 5000);
    }
  };

  const handleAnalyzeAndExploreNiches = async () => {
    if (!inputTitlesForNiche.trim()) {
      updateState({ nicheError: 'Vui lòng nhập danh sách các tiêu đề video.' });
      return;
    }
    updateState({ 
        nicheIsLoading: true, 
        nicheError: null, 
        nicheProgressMessage: 'Đang phân tích tiêu đề và khám phá ngách chủ đề...', 
        nicheAnalysisResults: [] 
    });

    const selectedInputLangLabel = getSelectedLanguageLabel(nicheInputLanguage);
    const selectedOutputLangLabel = getSelectedLanguageLabel(nicheOutputLanguage);

    const prompt = `
You are an AI expert in content strategy and niche theme identification.
Based on the list of video titles provided in ${selectedInputLangLabel}, your task is to analyze them and suggest ${numNichesToSuggest} distinct niche story themes.
All your output, including niche names, descriptions, reasoning, content suggestions, and keywords, MUST be in ${selectedOutputLangLabel}.

Input Video Titles (in ${selectedInputLangLabel}):
---
${inputTitlesForNiche.trim()}
---

For each suggested niche, provide the following information in a JSON object:
- "nicheName": A concise name for the niche theme (in ${selectedOutputLangLabel}).
- "nicheDescription": A detailed description of the niche, including its core essence, potential target audience, and key emotional or dramatic elements (in ${selectedOutputLangLabel}).
- "reasoning": An explanation of why this niche was identified from the input titles, highlighting common patterns, keywords, or sentiments observed (in ${selectedOutputLangLabel}).
- "contentSuggestions": An array of 2-3 example video/story ideas that fit this niche (strings, in ${selectedOutputLangLabel}).
- "relatedKeywords": An array of 3-5 relevant keywords for this niche (strings, in ${selectedOutputLangLabel}).

Return your entire response as a single JSON array, where each element of the array is an object structured as described above.
Example of one element in the array (ensure all text content within is in ${selectedOutputLangLabel}):
{
  "nicheName": "Tên Ngách Mẫu bằng ${selectedOutputLangLabel}",
  "nicheDescription": "Mô tả chi tiết bằng ${selectedOutputLangLabel}...",
  "reasoning": "Lý do dựa trên tiêu đề bằng ${selectedOutputLangLabel}...",
  "contentSuggestions": ["Gợi ý 1 bằng ${selectedOutputLangLabel}", "Gợi ý 2 bằng ${selectedOutputLangLabel}"],
  "relatedKeywords": ["Từ khóa A bằng ${selectedOutputLangLabel}", "Từ khóa B bằng ${selectedOutputLangLabel}"]
}

Ensure the output is ONLY the JSON array. Do not include any introductory text, explanations, or markdown backticks around the JSON itself.
    `;

    try {
      const resultsArray = await generateTextWithJsonOutput<NicheThemeAnalysisResult[]>(prompt, undefined, apiSettings);
      if (Array.isArray(resultsArray)) {
        updateState({ 
            nicheAnalysisResults: resultsArray, 
            nicheIsLoading: false, 
            nicheProgressMessage: `Phân tích hoàn tất! Đã tìm thấy ${resultsArray.length} ngách chủ đề.`, 
            nicheError: null 
        });
      } else {
        throw new Error("Kết quả trả về không phải là một mảng các ngách chủ đề.");
      }
    } catch (e) {
      updateState({ 
          nicheError: `Lỗi khi phân tích: ${(e as Error).message}`, 
          nicheIsLoading: false, 
          nicheProgressMessage: 'Đã xảy ra lỗi.' 
      });
    } finally {
        setTimeout(() => {
            setModuleState(prev => 
                (prev.nicheProgressMessage?.includes("hoàn tất") || prev.nicheProgressMessage?.includes("lỗi")) 
                ? {...prev, nicheProgressMessage: null} 
                : prev
            )
        }, 5000);
    }
  };


  const copyToClipboard = (textToCopy: string, buttonId: string) => {
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    const btn = document.getElementById(buttonId);
    if (btn) {
        const originalText = btn.textContent;
        btn.textContent = 'Đã sao chép!';
        setTimeout(() => { btn.textContent = originalText; }, 2000);
    }
  };

  const TabButton: React.FC<{ tabId: ContentStrategyActiveTabType; label: string }> = ({ tabId, label }) => (
    <button
      onClick={() => { updateState({ 
          activeTab: tabId, 
          error: null, loadingMessage: null,
          analyzeError: null, analyzeLoadingMessage: null,
          nicheError: null, nicheProgressMessage: null,
          resultText: '', analysisReport: '', viralFormulas: '',
          applicationSuggestions: '', groundingSourcesAnalysis: [],
          generateVariationsExplanation: null, nicheAnalysisResults: []
      }); }}
      className={`px-4 py-2 font-medium rounded-md text-sm transition-colors
                  ${activeTab === tabId ? 'bg-indigo-600 text-white shadow' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
    >
      {label}
    </button>
  );
  
  const isAnyLoading = loadingMessage !== null || analyzeLoadingMessage !== null || nicheIsLoading;

  return (
    <ModuleContainer title="💡 Phân tích & Mở rộng Chủ đề">
      <InfoBox>
        <p><strong>💡 Hướng dẫn:</strong> Công cụ toàn diện giúp bạn phân tích trend, khám phá ngách mới và tạo các tiêu đề viral.</p>
        <ul className="list-disc list-inside ml-4 mt-1">
            <li><strong>Phân tích Trend & Công thức:</strong> Nhập URL video hoặc danh sách tiêu đề của đối thủ, AI sẽ phân tích và đưa ra "công thức viral".</li>
            <li><strong>Khám phá Ngách mới:</strong> Nhập danh sách tiêu đề, AI sẽ đề xuất các ngách chủ đề tiềm năng để bạn mở rộng nội dung.</li>
            <li><strong>Xưởng Sáng Tạo Tiêu Đề:</strong> Nơi hợp nhất các công cụ tạo tiêu đề. Chọn "nguyên liệu" và cung cấp "Bối cảnh & Phong cách" để AI học hỏi và sáng tạo.</li>
        </ul>
      </InfoBox>
      
      <div className="mb-6 flex space-x-1 sm:space-x-2 border-b border-gray-200 pb-3 flex-wrap">
        <TabButton tabId="analyzeTrend" label="1. Phân tích Trend & Công thức" />
        <TabButton tabId="nicheExplorer" label="2. Khám phá Ngách mới" />
        <TabButton tabId="creationStudio" label="🚀 Xưởng Sáng Tạo Tiêu Đề" />
      </div>

      {activeTab === 'creationStudio' && (
        <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">🚀 Xưởng Sáng Tạo Tiêu Đề</h3>
            <div className="p-4 border rounded-lg bg-white shadow-sm">
                <label className="block text-sm font-medium text-gray-700 mb-2">1. Chọn "Nguyên Liệu" Đầu Vào:</label>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                    <label className="flex items-center">
                        <input type="radio" name="creationSourceType" value="baseTitle" checked={creationSourceType === 'baseTitle'} onChange={(e) => updateState({ creationSourceType: e.target.value as CreationSourceType })} className="form-radio h-4 w-4 text-sky-600"/>
                        <span className="ml-2 text-sm font-medium text-gray-700">Từ Tiêu đề Gốc</span>
                    </label>
                    <label className="flex items-center">
                        <input type="radio" name="creationSourceType" value="seriesList" checked={creationSourceType === 'seriesList'} onChange={(e) => updateState({ creationSourceType: e.target.value as CreationSourceType })} className="form-radio h-4 w-4 text-sky-600"/>
                        <span className="ml-2 text-sm font-medium text-gray-700">Từ Danh sách Series</span>
                    </label>
                    <label className="flex items-center">
                        <input type="radio" name="creationSourceType" value="script" checked={creationSourceType === 'script'} onChange={(e) => updateState({ creationSourceType: e.target.value as CreationSourceType })} className="form-radio h-4 w-4 text-sky-600"/>
                        <span className="ml-2 text-sm font-medium text-gray-700">Từ Kịch bản / Tóm tắt</span>
                    </label>
                </div>
            </div>

            {/* Render inputs based on creationSourceType */}
            {creationSourceType === 'baseTitle' && (
                <div className="space-y-4 p-4 border rounded-lg bg-gray-50 animate-fadeIn">
                    <h4 className="text-md font-semibold text-gray-700">Tạo Biến Thể</h4>
                    <div><label htmlFor="baseTitle" className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề Cơ sở:</label><input type="text" id="baseTitle" value={baseTitle} onChange={(e) => updateState({ baseTitle: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" placeholder="Ví dụ: Tôi đã kiếm 100 triệu từ việc bán hàng online" disabled={isAnyLoading}/></div>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div><label htmlFor="fixedPrefix" className="block text-sm font-medium text-gray-700 mb-1">Tiền tố Cố định:</label><input type="text" id="fixedPrefix" value={fixedPrefix} onChange={(e) => updateState({ fixedPrefix: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" placeholder="Ví dụ: [Tập 1]" disabled={isAnyLoading}/></div>
                        <div><label htmlFor="numVariations" className="block text-sm font-medium text-gray-700 mb-1">Số lượng Biến thể (1-10):</label><input type="number" id="numVariations" value={numVariations} onChange={(e) => updateState({ numVariations: parseInt(e.target.value)})} min="1" max="10" className="w-full p-2 border border-gray-300 rounded-md" disabled={isAnyLoading}/></div>
                    </div>
                    <div><label htmlFor="variationGoal" className="block text-sm font-medium text-gray-700 mb-1">Mục tiêu Biến tấu:</label><select id="variationGoal" value={variationGoal} onChange={(e) => updateState({ variationGoal: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" disabled={isAnyLoading}>{VARIATION_GOAL_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
                    <div><label htmlFor="newContextTheme" className="block text-sm font-medium text-gray-700 mb-1">"Xoáy" sang Ngữ cảnh/Chủ đề Mới:</label><input type="text" id="newContextTheme" value={newContextTheme} onChange={(e) => updateState({ newContextTheme: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" placeholder="Ví dụ: Chủ đề du lịch vũ trụ, chủ đề làm vườn..." disabled={isAnyLoading}/></div>
                    <div><label htmlFor="viralKeywords" className="block text-sm font-medium text-gray-700 mb-1">Từ khóa Viral cần Nhấn mạnh:</label><input type="text" id="viralKeywords" value={viralKeywords} onChange={(e) => updateState({ viralKeywords: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" placeholder="Ví dụ: drama, bất ngờ, người thứ ba" disabled={isAnyLoading}/></div>
                </div>
            )}
            {creationSourceType === 'seriesList' && (
                <div className="space-y-4 p-4 border rounded-lg bg-gray-50 animate-fadeIn">
                    <h4 className="text-md font-semibold text-gray-700">Tạo Tiêu đề Series</h4>
                    <div><label htmlFor="existingViralTitles" className="block text-sm font-medium text-gray-700 mb-1">Danh sách Tiêu đề Viral Hiện có (mỗi tiêu đề một dòng):</label><textarea id="existingViralTitles" value={existingViralTitles} onChange={(e) => updateState({ existingViralTitles: e.target.value })} rows={5} className="w-full p-2 border border-gray-300 rounded-md" disabled={isAnyLoading}></textarea></div>
                    <div><label htmlFor="numNewSeriesTitles" className="block text-sm font-medium text-gray-700 mb-1">Số lượng Tiêu đề Mới cần tạo (1-10):</label><input type="number" id="numNewSeriesTitles" value={numNewSeriesTitles} onChange={(e) => updateState({ numNewSeriesTitles: parseInt(e.target.value)})} min="1" max="10" className="w-full p-2 border border-gray-300 rounded-md" disabled={isAnyLoading}/></div>
                </div>
            )}
            {creationSourceType === 'script' && (
                <div className="space-y-4 p-4 border rounded-lg bg-gray-50 animate-fadeIn">
                    <h4 className="text-md font-semibold text-gray-700">Tạo Tiêu đề từ Kịch bản</h4>
                    <div><label htmlFor="scriptContent" className="block text-sm font-medium text-gray-700 mb-1">Kịch bản hoặc Tóm tắt truyện:</label><textarea id="scriptContent" value={scriptContent} onChange={(e) => updateState({ scriptContent: e.target.value })} rows={8} className="w-full p-2 border border-gray-300 rounded-md" disabled={isAnyLoading}></textarea></div>
                    <div><label htmlFor="channelViralTitles" className="block text-sm font-medium text-gray-700 mb-1">Các tiêu đề viral của kênh (để AI học phong cách):</label><textarea id="channelViralTitles" value={channelViralTitles} onChange={(e) => updateState({ channelViralTitles: e.target.value })} rows={3} className="w-full p-2 border border-gray-300 rounded-md" disabled={isAnyLoading}></textarea></div>
                    <div><label htmlFor="numSuggestions" className="block text-sm font-medium text-gray-700 mb-1">Số lượng Gợi ý Tiêu đề (1-10):</label><input type="number" id="numSuggestions" value={numSuggestions} onChange={(e) => updateState({ numSuggestions: parseInt(e.target.value)})} min="1" max="10" className="w-full p-2 border border-gray-300 rounded-md" disabled={isAnyLoading}/></div>
                </div>
            )}
            
            {/* New Viral Context Input */}
            <div className="p-4 border rounded-lg bg-yellow-50 border-yellow-300">
                <label htmlFor="creationViralContext" className="block text-sm font-medium text-gray-700 mb-1">2. Bối Cảnh & Phong Cách Viral (Không bắt buộc):</label>
                <textarea 
                    id="creationViralContext" 
                    value={creationViralContext} 
                    onChange={(e) => updateState({ creationViralContext: e.target.value })} 
                    rows={4} 
                    className="w-full p-2 border border-gray-300 rounded-md" 
                    placeholder="Dán các tiêu đề mẫu, từ khóa, hoặc mô tả phong cách bạn muốn AI học hỏi vào đây..."
                    disabled={isAnyLoading}
                />
                 <p className="text-xs text-gray-600 mt-1">AI sẽ phân tích văn bản này để "học" phong cách và áp dụng vào các tiêu đề mới được tạo ra.</p>
            </div>
            
            <button onClick={handleCreationStudioSubmit} disabled={isAnyLoading} className="w-full bg-indigo-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-indigo-700 disabled:opacity-50">
                Sáng tạo Tiêu đề
            </button>
        </div>
      )}
      
      {activeTab === 'analyzeTrend' && (
        <div className="space-y-6">
            <div className="p-4 border rounded-lg bg-white shadow-sm">
                <h4 className="text-md font-semibold text-gray-700 mb-3">Phân tích Trend từ Đối thủ hoặc Chủ đề</h4>
                <div className="flex items-center space-x-4 mb-3">
                    <label className="flex items-center">
                        <input type="radio" name="analyzeInputType" value="urls" checked={analyzeInputType === 'urls'} onChange={(e) => updateState({ analyzeInputType: e.target.value as 'urls' | 'titles' })} className="form-radio h-4 w-4 text-sky-600"/>
                        <span className="ml-2 text-sm font-medium text-gray-700">Phân tích từ URL Video</span>
                    </label>
                     <label className="flex items-center">
                        <input type="radio" name="analyzeInputType" value="titles" checked={analyzeInputType === 'titles'} onChange={(e) => updateState({ analyzeInputType: e.target.value as 'urls' | 'titles' })} className="form-radio h-4 w-4 text-sky-600"/>
                        <span className="ml-2 text-sm font-medium text-gray-700">Phân tích từ Danh sách Tiêu đề</span>
                    </label>
                </div>
                
                {analyzeInputType === 'urls' && (
                    <div>
                        <label htmlFor="analyzeUrls" className="block text-sm font-medium text-gray-700 mb-1">Danh sách URL video YouTube (mỗi URL một dòng):</label>
                        <textarea id="analyzeUrls" value={analyzeUrls} onChange={(e) => updateState({ analyzeUrls: e.target.value })} rows={4} className="w-full p-2 border border-gray-300 rounded-md" placeholder="https://www.youtube.com/watch?v=..." disabled={isAnyLoading}></textarea>
                    </div>
                )}
                 {analyzeInputType === 'titles' && (
                    <div>
                        <label htmlFor="analyzeTitles" className="block text-sm font-medium text-gray-700 mb-1">Danh sách Tiêu đề (mỗi tiêu đề một dòng):</label>
                        <textarea id="analyzeTitles" value={analyzeTitles} onChange={(e) => updateState({ analyzeTitles: e.target.value })} rows={4} className="w-full p-2 border border-gray-300 rounded-md" placeholder="Vợ giả vờ ngoại tình và cái kết..." disabled={isAnyLoading}></textarea>
                    </div>
                )}
                <div className="mt-4">
                    <label htmlFor="analyzeChannelTheme" className="block text-sm font-medium text-gray-700 mb-1">Chủ đề Kênh của bạn (để AI gợi ý áp dụng, không bắt buộc):</label>
                    <input type="text" id="analyzeChannelTheme" value={analyzeChannelTheme} onChange={(e) => updateState({ analyzeChannelTheme: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" placeholder="Ví dụ: Kênh kể chuyện gia đình, kênh phim ngắn..." disabled={isAnyLoading}/>
                </div>
            </div>
            <button onClick={handleAnalyzeTrend} disabled={isAnyLoading || (analyzeInputType === 'urls' && !analyzeUrls.trim()) || (analyzeInputType === 'titles' && !analyzeTitles.trim())} className="w-full bg-purple-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-purple-700 disabled:opacity-50">
              Phân Tích Trend
            </button>
        </div>
      )}

       {activeTab === 'nicheExplorer' && (
        <div className="space-y-6">
          <div>
            <label htmlFor="nteInputTitles" className="block text-sm font-medium text-gray-700 mb-1">
              Danh sách Tiêu đề Video (mỗi tiêu đề một dòng):
            </label>
            <textarea
              id="nteInputTitles"
              value={inputTitlesForNiche}
              onChange={(e) => updateState({ inputTitlesForNiche: e.target.value })}
              rows={8}
              className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Ví dụ:\nChồng Giấu Quỹ Đen Nuôi Bồ Nhí Và Cái Kết\nMẹ Chồng Độc Ác Hãm Hại Con Dâu\nBí Mật Động Trời Của Gia Đình Bị Phanh Phui"
              disabled={isAnyLoading}
            />
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <label htmlFor="nteInputLanguage" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ của Tiêu đề Đầu vào:</label>
              <select id="nteInputLanguage" value={nicheInputLanguage} onChange={(e) => updateState({ nicheInputLanguage: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={isAnyLoading}>
                {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="nteOutputLanguage" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ Kết quả Phân tích:</label>
              <select id="nteOutputLanguage" value={nicheOutputLanguage} onChange={(e) => updateState({ nicheOutputLanguage: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={isAnyLoading}>
                {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="nteNumNiches" className="block text-sm font-medium text-gray-700 mb-1">Số lượng Ngách Gợi ý (1-5):</label>
              <input type="number" id="nteNumNiches" value={numNichesToSuggest} onChange={(e) => updateState({ numNichesToSuggest: Math.max(1, Math.min(5, parseInt(e.target.value))) })} min="1" max="5" className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={isAnyLoading}/>
            </div>
          </div>
          <button onClick={handleAnalyzeAndExploreNiches} disabled={isAnyLoading || !inputTitlesForNiche.trim()} className="w-full bg-indigo-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50">
            Phân Tích & Khám Phá Ngách
          </button>
        </div>
      )}

      {isAnyLoading && <LoadingSpinner message={loadingMessage || analyzeLoadingMessage || nicheProgressMessage!} />}
      {error && <ErrorAlert message={error} />}
      {analyzeError && <ErrorAlert message={analyzeError} />}
      {nicheError && <ErrorAlert message={nicheError} />}

      {/* Results Display Area */}
      {resultText && (
        <div className="mt-6 p-4 border rounded-lg bg-gray-50">
          <h3 className="text-lg font-semibold mb-2 text-gray-700">Kết quả (Tiêu đề):</h3>
          <textarea value={resultText} readOnly rows={10} className="w-full p-3 border-2 border-gray-200 rounded-md bg-white whitespace-pre-wrap leading-relaxed"></textarea>
           {generateVariationsExplanation && (
              <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-md text-sm">
                  <h4 className="font-semibold text-indigo-700">Giải thích của AI:</h4>
                  <p className="text-gray-600 mt-1">{generateVariationsExplanation}</p>
              </div>
          )}
          <button id="copyGenTitleBtn" onClick={() => copyToClipboard(resultText, "copyGenTitleBtn")} className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
            📋 Sao chép Kết quả
          </button>
        </div>
      )}
      
      {analysisReport && (
         <div className="mt-6 p-4 border rounded-lg bg-gray-50 space-y-4">
            <div>
                <h3 className="text-lg font-semibold mb-2 text-gray-700">🔬 Báo cáo Phân tích Trend:</h3>
                <div className="p-3 bg-white border rounded-md whitespace-pre-wrap">{analysisReport}</div>
            </div>
             <div>
                <h3 className="text-lg font-semibold mb-2 text-gray-700">🧬 Công thức Viral đã Suy luận:</h3>
                <div className="p-3 bg-white border rounded-md whitespace-pre-wrap">{viralFormulas}</div>
            </div>
             <div>
                <h3 className="text-lg font-semibold mb-2 text-gray-700">💡 Gợi ý Áp dụng:</h3>
                <div className="p-3 bg-white border rounded-md whitespace-pre-wrap">{applicationSuggestions}</div>
            </div>
             {groundingSourcesAnalysis.length > 0 && (
                <div className="mt-4 p-3 bg-gray-100 border rounded-md">
                    <h4 className="text-sm font-semibold text-gray-600 mb-1">Nguồn Tham Khảo (AI đã dùng Google Search):</h4>
                     <ul className="list-disc list-inside space-y-1 text-xs">
                        {groundingSourcesAnalysis.map((source, index) => (
                            source.web && (
                                <li key={index}>
                                    <a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline" title={source.web.title}>
                                        {source.web.title || source.web.uri}
                                    </a>
                                </li>
                            )
                        ))}
                    </ul>
                </div>
            )}
         </div>
      )}

       {nicheAnalysisResults.length > 0 && (
          <div className="mt-8 space-y-6">
            <h3 className="text-2xl font-semibold text-gray-800 border-b pb-3 mb-4">
              Kết Quả Khám Phá Ngách Chủ Đề ({nicheAnalysisResults.length} ngách)
            </h3>
            {nicheAnalysisResults.map((result, index) => (
              <details key={index} className="p-6 border-2 border-indigo-200 rounded-xl bg-indigo-50 shadow-lg group" open={nicheAnalysisResults.length === 1 || index === 0}>
                <summary className="font-bold text-xl text-indigo-700 cursor-pointer group-hover:text-indigo-900 transition-colors">
                  Ngách #{index + 1}: {result.nicheName}
                </summary>
                <div className="mt-4 space-y-3 text-gray-700">
                  <div>
                    <h4 className="font-semibold text-md text-indigo-600 mb-1">📜 Mô tả Ngách:</h4>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap bg-white p-3 rounded-md border border-indigo-100">{result.nicheDescription}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-md text-indigo-600 mb-1">🔍 Lý do Đề xuất (Dựa trên phân tích tiêu đề):</h4>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap bg-white p-3 rounded-md border border-indigo-100">{result.reasoning}</p>
                  </div>
                  {result.contentSuggestions && result.contentSuggestions.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-md text-indigo-600 mb-1">💡 Gợi ý Phát triển Nội dung:</h4>
                      <ul className="list-disc list-inside ml-4 space-y-1 text-sm bg-white p-3 rounded-md border border-indigo-100">
                        {result.contentSuggestions.map((suggestion, sIdx) => (
                          <li key={sIdx}>{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.relatedKeywords && result.relatedKeywords.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-md text-indigo-600 mb-1">🔑 Từ khóa Liên quan:</h4>
                      <div className="flex flex-wrap gap-2 text-sm bg-white p-3 rounded-md border border-indigo-100">
                        {result.relatedKeywords.map((keyword, kIdx) => (
                          <span key={kIdx} className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">{keyword}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}

    </ModuleContainer>
  );
};

export default ContentStrategyModule;