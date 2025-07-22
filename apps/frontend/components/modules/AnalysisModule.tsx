
import React from 'react'; // Removed useState as it's not used for local loading flags anymore
import { ApiSettings, AnalysisFactor, AnalysisModuleState, UserProfile } from '../../types';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { generateText } from '../../services/textGenerationService'; // Corrected import path
import { isSubscribed } from '../../utils';
import UpgradePrompt from '../UpgradePrompt';


interface AnalysisModuleProps {
  apiSettings: ApiSettings;
  moduleState: AnalysisModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<AnalysisModuleState>>;
  currentUser: UserProfile | null;
}

const AnalysisModule: React.FC<AnalysisModuleProps> = ({ apiSettings, moduleState, setModuleState, currentUser }) => {
  const hasActiveSubscription = isSubscribed(currentUser);
  const {
    sourceText, analysisFactors, suggestions, improvedStory, viralOutlineAnalysisResult,
    loadingMessage, errorAnalysis, errorImprovement, errorViralOutline
  } = moduleState;

  const updateState = (updates: Partial<AnalysisModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };

  const handleAnalyze = async () => {
    if (!sourceText.trim()) {
      updateState({ errorAnalysis: 'Vui lòng nhập nội dung truyện để phân tích.' });
      return;
    }
    updateState({ 
      errorAnalysis: null, 
      analysisFactors: [], 
      suggestions: '', 
      improvedStory: '', 
      viralOutlineAnalysisResult: '',
      loadingMessage: 'Đang phân tích tiêu chuẩn...' 
    });

    const prompt = `Bạn là một chuyên gia phân tích kịch bản viral. Hãy phân tích câu chuyện dưới đây.
    \n**YÊU CẦU 1: Đánh giá theo thang điểm**
    \nHãy chấm điểm các yếu tố sau trên thang 100%:
    \n- Cú Twist Bất Ngờ
    \n- Xung Đột Kịch Tính
    \n- Nhân Vật Dễ Đồng Cảm
    \n- Yếu Tố Cảm Xúc Mạnh
    \n- Tính "Cà Khịa" / Trả Thù
    \n- Sự Tò Mò & Bí Ẩn
    \nHãy trả về kết quả theo đúng định dạng sau, mỗi yếu tố trên một dòng riêng biệt:
    \n[FACTOR]Tên Yếu Tố|XX%|Phân tích ngắn gọn (1-2 câu).[/FACTOR]
    \n**YÊU CẦU 2: Gợi ý cải thiện**
    \nSau khi chấm điểm, hãy đưa ra một danh sách các gợi ý cụ thể, mang tính xây dựng để giúp tác giả nâng cao chất lượng tác phẩm, tập trung vào những điểm yếu nhất. Đặt toàn bộ phần gợi ý này trong cặp thẻ [SUGGESTIONS]...[/SUGGESTIONS].
    \n**VĂN BẢN TRUYỆN:**
    \n---
    \n${sourceText.trim()}
    \n---`;

    try {
      const resultText = (await generateText(prompt, undefined, false, apiSettings)).text;
      const factorRegex = /\[FACTOR\](.*?)\|(.*?)\|(.*?)\[\/FACTOR\]/g;
      const suggestionRegex = /\[SUGGESTIONS\]([\s\S]*?)\[\/SUGGESTIONS\]/;
      let match;
      const factors: AnalysisFactor[] = [];
      while ((match = factorRegex.exec(resultText)) !== null) {
        factors.push({ title: match[1].trim(), percentage: match[2].trim(), analysis: match[3].trim() });
      }
      
      const suggestionMatch = resultText.match(suggestionRegex);
      updateState({ 
        analysisFactors: factors, 
        suggestions: (suggestionMatch && suggestionMatch[1].trim()) ? suggestionMatch[1].trim() : '',
        loadingMessage: "Phân tích tiêu chuẩn hoàn tất!"
      });
    } catch (e) {
      updateState({ errorAnalysis: `Đã xảy ra lỗi khi phân tích: ${(e as Error).message}`, loadingMessage: "Lỗi phân tích tiêu chuẩn." });
    } finally {
      setTimeout(() => {
        setModuleState(prev => 
          (prev.loadingMessage?.includes("Phân tích tiêu chuẩn hoàn tất!") || prev.loadingMessage?.includes("Lỗi phân tích tiêu chuẩn.")) 
          ? {...prev, loadingMessage: null} 
          : prev
        )
      }, 3000);
    }
  };

  const handleGetGeminiSuggestions = async () => {
     if (!sourceText.trim()) {
      updateState({ errorImprovement: 'Vui lòng nhập nội dung truyện để Gemini đưa ra đề xuất.' });
      return;
    }
    updateState({ 
      errorImprovement: null, 
      improvedStory: '', 
      viralOutlineAnalysisResult: '', 
      analysisFactors: [],
      loadingMessage: 'Đang nhận gợi ý từ Gemini...'
    });

    const prompt = `Act as a world-class developmental editor. Read the following story and provide 3-5 concrete, actionable suggestions to improve it. Focus on plot holes, character motivation, pacing, and emotional impact.
    \n**STORY:**
    \n---
    \n${sourceText.trim()}
    \n---
    \nProvide the suggestions in a clear, bulleted list. Return only the suggestions in Vietnamese.`;
    
    try {
        const result = await generateText(prompt, undefined, false, apiSettings);
        updateState({ suggestions: result.text, loadingMessage: "Nhận gợi ý Gemini hoàn tất!" });
    } catch (e) {
        updateState({ errorImprovement: `Lỗi khi nhận gợi ý từ Gemini: ${(e as Error).message}`, loadingMessage: "Lỗi nhận gợi ý Gemini." });
    } finally {
        setTimeout(() => {
        setModuleState(prev => 
          (prev.loadingMessage?.includes("Nhận gợi ý Gemini hoàn tất!") || prev.loadingMessage?.includes("Lỗi nhận gợi ý Gemini.")) 
          ? {...prev, loadingMessage: null} 
          : prev
        )
      }, 3000);
    }
  };

  const handleImproveStory = async () => {
    if (!sourceText.trim() || !suggestions.trim()) {
      updateState({ errorImprovement: 'Không có dữ liệu truyện hoặc gợi ý để cải thiện.' });
      return;
    }
    updateState({ 
      errorImprovement: null, 
      viralOutlineAnalysisResult: '',
      loadingMessage: 'Đang cải thiện truyện...'
    });

    const prompt = `Bạn là một biên kịch chuyên nghiệp. Dưới đây là một kịch bản gốc và một số gợi ý để cải thiện nó.
    Nhiệm vụ của bạn là hãy viết lại toàn bộ kịch bản, áp dụng các gợi ý một cách khéo léo để làm cho câu chuyện hay hơn, logic hơn và hấp dẫn hơn, nhưng phải tuyệt đối đảm bảo tính nhất quán của nhân vật và các tình tiết cốt lõi.
    \n**KỊCH BẢN GỐC:**
    \n---
    \n${sourceText.trim()}
    \n---
    \n**CÁC GỢI Ý CẢI THIỆN CẦN ÁP DỤNG (bằng tiếng Việt):**
    \n---
    \n${suggestions.trim()}
    \n---
    \nHãy trả về toàn bộ kịch bản đã được cải thiện bằng tiếng Việt.`;
    
    try {
      const result = await generateText(prompt, undefined, false, apiSettings);
      updateState({ improvedStory: result.text, loadingMessage: "Cải thiện truyện hoàn tất!" });
    } catch (e) {
      updateState({ errorImprovement: `Lỗi khi cải thiện truyện: ${(e as Error).message}`, loadingMessage: "Lỗi cải thiện truyện." });
    } finally {
      setTimeout(() => {
        setModuleState(prev => 
          (prev.loadingMessage?.includes("Cải thiện truyện hoàn tất!") || prev.loadingMessage?.includes("Lỗi cải thiện truyện.")) 
          ? {...prev, loadingMessage: null} 
          : prev
        )
      }, 3000);
    }
  };

  const handleAnalyzeViralOutline = async () => {
    if (!sourceText.trim()) {
      updateState({ errorViralOutline: 'Vui lòng nhập nội dung kịch bản/dàn ý để phân tích.' });
      return;
    }
    updateState({ 
      errorViralOutline: null, 
      viralOutlineAnalysisResult: '', 
      analysisFactors: [], 
      suggestions: '', 
      improvedStory: '',
      loadingMessage: 'Đang phân tích dàn ý Viral...'
    });

    const prompt = `Bạn là một chuyên gia phân tích kịch bản và cấu trúc truyện viral. Hãy phân tích nội dung dưới đây.

    **NỘI DUNG KỊCH BẢN/DÀN Ý:**
    ---
    ${sourceText.trim()}
    ---

    **YÊU CẦU PHÂN TÍCH:**
    1.  **Xác định Cấu Trúc Viral:** Phân tích và chỉ ra các yếu tố cấu trúc chính trong dàn ý/kịch bản này có khả năng làm cho nó trở nên viral (ví dụ: điểm bất ngờ, vòng lặp cảm xúc, yếu tố gây tò mò cao trào, giải quyết thỏa mãn, nhân vật relatable, v.v.).
    2.  **Giải thích Tính Hiệu Quả:** Giải thích ngắn gọn tại sao mỗi yếu tố cấu trúc bạn xác định lại quan trọng và đóng góp vào tiềm năng lan truyền của câu chuyện.
    3.  **Ứng Dụng Thực Tiễn:** Đưa ra gợi ý về cách người viết có thể áp dụng hoặc học hỏi từ cấu trúc và các yếu tố viral này để xây dựng những câu chuyện hấp dẫn tương tự cho các chủ đề khác.

    Hãy trình bày kết quả phân tích một cách rõ ràng, mạch lạc, bằng tiếng Việt.`;

    try {
      const result = await generateText(prompt, undefined, false, apiSettings);
      updateState({ viralOutlineAnalysisResult: result.text, loadingMessage: "Phân tích Dàn Ý Viral hoàn tất!" });
    } catch (e) {
      updateState({ errorViralOutline: `Lỗi khi phân tích dàn ý viral: ${(e as Error).message}`, loadingMessage: "Lỗi phân tích Dàn Ý Viral." });
    } finally {
      setTimeout(() => {
        setModuleState(prev => 
          (prev.loadingMessage?.includes("Phân tích Dàn Ý Viral hoàn tất!") || prev.loadingMessage?.includes("Lỗi phân tích Dàn Ý Viral.")) 
          ? {...prev, loadingMessage: null} 
          : prev
        )
      }, 3000);
    }
  };
  
  const isProcessing = loadingMessage && loadingMessage.startsWith("Đang");

  return (
    <ModuleContainer title="✨ Module: Phân Tích Truyện & ADN Viral">
      {!hasActiveSubscription && <UpgradePrompt />}
      <InfoBox>
        <ul className="list-disc list-inside space-y-1">
            <li><strong>Phân tích tiêu chuẩn:</strong> Đánh giá các yếu tố văn học và nhận gợi ý cải thiện chung.</li>
            <li><strong>Phân tích Dàn Ý Viral:</strong> Cung cấp một kịch bản viral. AI sẽ cố gắng phân tích và trích xuất cấu trúc dàn ý chính của nó, giúp bạn hiểu cách xây dựng các câu chuyện hấp dẫn tương tự.</li>
            <li><strong>Đề xuất từ Gemini:</strong> Nhận thêm các gợi ý cải tiến cụ thể trực tiếp từ AI.</li>
        </ul>
      </InfoBox>

      <div className="space-y-6">
        <div>
          <label htmlFor="analysisSourceText" className="block text-sm font-medium text-gray-700 mb-1">Nội dung truyện cần phân tích / Kịch bản tham khảo:</label>
          <textarea id="analysisSourceText" value={sourceText} onChange={(e) => updateState({ sourceText: e.target.value })} rows={8} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Dán toàn bộ câu chuyện hoặc kịch bản viral mẫu vào đây..."></textarea>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            <button 
                onClick={handleAnalyze} 
                disabled={!hasActiveSubscription || !!loadingMessage} 
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-500 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
            >
                🔬 Phân tích Tiêu chuẩn
            </button>
            <button 
                onClick={handleAnalyzeViralOutline} 
                disabled={!hasActiveSubscription || !!loadingMessage} 
                className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
            >
                🧬 Phân tích Dàn Ý Viral
            </button>
            <button 
                onClick={handleGetGeminiSuggestions} 
                disabled={!hasActiveSubscription || !!loadingMessage} 
                className="w-full md:col-span-2 lg:col-span-1 bg-gradient-to-r from-blue-500 to-teal-500 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
            >
                ✨ Đề xuất Cải tiến (Gemini)
            </button>
        </div>

        {isProcessing && <LoadingSpinner message={loadingMessage!} />}
        {loadingMessage && !isProcessing && (
             <p className={`text-center font-medium my-2 ${loadingMessage.includes("Lỗi") ? 'text-red-600' : 'text-indigo-600'}`}>
                {loadingMessage}
            </p>
        )}

        {errorAnalysis && <ErrorAlert message={errorAnalysis} />}
        {errorImprovement && <ErrorAlert message={errorImprovement} />}
        {errorViralOutline && <ErrorAlert message={errorViralOutline} />}


        {analysisFactors.length > 0 && !isProcessing && (
          <div className="mt-6 p-4 border rounded-lg bg-gray-50">
            <h3 className="text-lg font-semibold mb-4 text-gray-700">Báo cáo Phân tích Tiêu Chuẩn:</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {analysisFactors.map((factor, index) => (
                <div key={index} className="bg-white p-4 rounded-lg shadow">
                <h4 className="font-semibold text-gray-800 mb-1">{factor.title}</h4>
                <p className="text-xs text-gray-600 mb-2">{factor.analysis}</p>
                <div className="w-full bg-gray-200 rounded-full h-5">
                    <div className="bg-indigo-600 h-5 rounded-full text-xs font-medium text-blue-100 text-center p-0.5 leading-tight" style={{ width: factor.percentage }}>
                    {factor.percentage}
                    </div>
                </div>
                </div>
            ))}
            </div>
          </div>
        )}
            
        {suggestions && !isProcessing && (
            <div className={`mt-6 p-4 border rounded-lg ${improvedStory ? 'bg-yellow-50' : 'bg-indigo-50'}`}>
                <h3 className="text-lg font-semibold mb-2 text-gray-700">Gợi ý Cải thiện (từ Phân tích Tiêu Chuẩn hoặc Gemini):</h3>
                <div className={`p-3 border ${improvedStory ? 'border-yellow-200 text-yellow-800' : 'border-indigo-200 text-indigo-800'} rounded-md text-sm whitespace-pre-wrap leading-relaxed`}>{suggestions}</div>
                {!improvedStory && (
                  <button onClick={handleImproveStory} disabled={!hasActiveSubscription || !!loadingMessage} className="mt-4 px-6 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 disabled:opacity-50">
                      🚀 Bắt đầu Cải thiện dựa trên gợi ý này
                  </button>
                )}
            </div>
        )}
        
        {improvedStory && !isProcessing && ( 
          <div className="mt-6 p-4 border rounded-lg bg-green-50">
            <h3 className="text-lg font-semibold mb-2 text-green-700">Truyện đã được cải thiện (dựa trên gợi ý):</h3>
            <textarea value={improvedStory} readOnly rows={10} className="w-full p-3 border-2 border-green-200 rounded-md bg-white whitespace-pre-wrap leading-relaxed"></textarea>
          </div>
        )}

        {viralOutlineAnalysisResult && !isProcessing && (
          <div className="mt-6 p-4 border rounded-lg bg-rose-50">
            <h3 className="text-lg font-semibold mb-2 text-rose-700">Kết quả Phân tích Dàn Ý Viral:</h3>
            <div className="p-3 border border-rose-200 rounded-md text-sm text-rose-800 whitespace-pre-wrap leading-relaxed">
                {viralOutlineAnalysisResult}
            </div>
          </div>
        )}
      </div>
    </ModuleContainer>
  );
};

export default AnalysisModule;
