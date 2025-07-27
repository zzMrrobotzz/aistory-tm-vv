import React, { useState, useCallback } from 'react';
import { ApiSettings, SuperAgentModuleState, UserProfile } from '../../types';
import { ASPECT_RATIO_OPTIONS, SUPER_AGENT_WORD_COUNT_OPTIONS } from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { generateImage } from '../../services/geminiService';
import { generateText } from '@/services/textGenerationService';
import { delay } from '../../utils'; // Added delay import

interface SuperAgentModuleProps {
  apiSettings: ApiSettings;
  moduleState: SuperAgentModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<SuperAgentModuleState>>;
  currentUser: UserProfile | null; // Add currentUser prop
}

const SuperAgentModule: React.FC<SuperAgentModuleProps> = ({ 
  apiSettings, moduleState, setModuleState, currentUser 
}) => {
  const {
    sourceText, wordCount, imageCount, aspectRatio,
    generatedStory, generatedImages, error
  } = moduleState;

  const updateState = (updates: Partial<SuperAgentModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };
  
  const [isLoadingProcess, setIsLoadingProcess] = useState(false); 
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [currentAbortController, setCurrentAbortController] = useState<AbortController | null>(null);


  const geminiApiKeyForService = apiSettings.provider === 'gemini' ? apiSettings.apiKey : undefined;

  const handleCancel = () => {
    if (currentAbortController) {
      currentAbortController.abort();
      setLoadingMessage("Đang hủy...");
      // setIsLoadingProcess will be set to false in the finally block of handleSubmit
    }
  };

  const handleSubmit = async () => {
    if (!sourceText) {
      updateState({ error: 'Vui lòng nhập Tiêu Đề hoặc Dàn Ý.' });
      return;
    }
    
    const abortController = new AbortController();
    setCurrentAbortController(abortController);
    
    updateState({ error: null, generatedStory: '', generatedImages: [] });
    setIsLoadingProcess(true);
    setLoadingMessage(null); // Clear previous messages

    try {
      setLoadingMessage('Bước 1/3: Đang viết truyện...');
      let storyPrompt: string;
      const isLikelyOutline = sourceText.length > 150 || sourceText.includes('\n') || sourceText.toLowerCase().includes("dàn ý:") || sourceText.toLowerCase().includes("outline:");

      if (isLikelyOutline) {
        storyPrompt = `Dựa vào dàn ý sau, hãy viết một câu chuyện hoàn chỉnh khoảng ${wordCount} từ. Chỉ trả về câu chuyện hoàn chỉnh:\n\n${sourceText}`;
      } else {
        setLoadingMessage('Bước 1/3 (P1): Đang tạo dàn ý từ tiêu đề...');
        const outlineResult = await generateText(`Hãy viết một dàn ý chi tiết cho truyện ngắn với tiêu đề: "${sourceText}".`, undefined, undefined, apiSettings);
        if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        await delay(1000, abortController.signal); 
        setLoadingMessage('Bước 1/3 (P2): Đang viết truyện từ dàn ý...');
        storyPrompt = `Dựa vào dàn ý sau, hãy viết một câu chuyện hoàn chỉnh khoảng ${wordCount} từ. Chỉ trả về câu chuyện hoàn chỉnh:\n\n${outlineResult.text}`;
      }
      
      const storyResult = await generateText(storyPrompt, undefined, undefined, apiSettings);
      if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      updateState({ generatedStory: storyResult.text });
      await delay(1000, abortController.signal); 

      setLoadingMessage(`Bước 2/3: Đang tạo ${imageCount} prompt ảnh...`);
      
      const imagePromptsQuery = `Dựa trên câu chuyện sau, hãy tạo ra ${imageCount} prompt ảnh bằng tiếng Anh để minh họa cho các cảnh quan trọng. Mỗi prompt phải chi tiết, sống động, thích hợp cho model text-to-image Imagen3. Mỗi prompt trên một dòng riêng biệt, không có đầu mục "Prompt X:".\n\nTRUYỆN (chỉ dùng phần đầu để tham khảo nếu truyện quá dài):\n${storyResult.text.substring(0, 3000)}`;
      const imagePromptsResult = await generateText(imagePromptsQuery, undefined, undefined, apiSettings);
      if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const prompts = imagePromptsResult.text.split('\n').filter(p => p.trim() !== '').slice(0, imageCount);
      await delay(1000, abortController.signal); 

      const images: string[] = [];
      for (let i = 0; i < prompts.length; i++) {
        if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        setLoadingMessage(`Bước 3/3: Đang tạo ảnh ${i + 1}/${prompts.length}...`);
        if (i > 0) await delay(1500, abortController.signal); 
        const imageB64 = await generateImage(prompts[i], aspectRatio, geminiApiKeyForService);
        if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        images.push(imageB64);
        updateState({ generatedImages: [...images] }); 
      }
      
      setLoadingMessage("Hoàn thành!");
    } catch (e: any) {
      if (e.name === 'AbortError') {
        updateState({ error: `Quy trình đã bị hủy.`, generatedStory: generatedStory || '', generatedImages: generatedImages || [] }); // Keep partial results
        setLoadingMessage("Đã hủy.");
      } else {
        updateState({ error: `Quy trình đã dừng do lỗi: ${e.message}` });
        setLoadingMessage("Lỗi.");
      }
    } finally {
      setIsLoadingProcess(false);
      setCurrentAbortController(null);
      // Keep "Đã hủy" or "Lỗi" message for a bit before clearing
      if(loadingMessage === "Đã hủy." || loadingMessage === "Lỗi." || loadingMessage === "Hoàn thành!") {
        setTimeout(() => {
            if (!isLoadingProcess) setLoadingMessage(null); // Only clear if not immediately restarted
        }, 3000);
      }
    }
  };
  

  return (
    <ModuleContainer title="🚀 Siêu Trợ Lý AI: Từ Ý Tưởng Đến Sản Phẩm">
      <InfoBox>
        <strong>💡 Hướng dẫn:</strong> Nhập ý tưởng, thiết lập các tùy chọn và để Siêu Trợ Lý tự động thực hiện toàn bộ quy trình. Dàn ý từ "Xây Dựng Truyện" sẽ được tự động điền vào đây.
      </InfoBox>

      <div className="space-y-6">
        <div>
          <label htmlFor="superAgentSource" className="block text-sm font-medium text-gray-700 mb-1">1. Nhập Tiêu Đề hoặc Dàn Ý:</label>
          <textarea
            id="superAgentSource"
            value={sourceText}
            onChange={(e) => updateState({ sourceText: e.target.value })}
            placeholder="Dán dàn ý từ module 'Xây Dựng Truyện' hoặc nhập ý tưởng của bạn..."
            rows={4}
            className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            disabled={isLoadingProcess}
          />
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <label htmlFor="superAgentWordCount" className="block text-sm font-medium text-gray-700 mb-1">2. Mục tiêu số từ:</label>
            <select id="superAgentWordCount" value={wordCount} onChange={(e) => updateState({ wordCount: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={isLoadingProcess}>
              {SUPER_AGENT_WORD_COUNT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="superAgentImageCount" className="block text-sm font-medium text-gray-700 mb-1">3. Số lượng ảnh (1-5):</label>
            <input type="number" id="superAgentImageCount" value={imageCount} onChange={(e) => updateState({ imageCount: Math.max(1, Math.min(5, parseInt(e.target.value)))})} min="1" max="5" className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={isLoadingProcess}/>
          </div>
          <div>
            <label htmlFor="superAgentAspectRatio" className="block text-sm font-medium text-gray-700 mb-1">4. Tỷ lệ ảnh:</label>
            <select id="superAgentAspectRatio" value={aspectRatio} onChange={(e) => updateState({ aspectRatio: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={isLoadingProcess}>
              {ASPECT_RATIO_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>
        
        {isLoadingProcess ? (
          <div className="flex space-x-3">
            <button
              disabled 
              className="w-2/3 bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg shadow-md cursor-not-allowed"
            >
              {loadingMessage || "Đang xử lý..."}
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
          <button
            onClick={handleSubmit}
            disabled={ !sourceText}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 transition-opacity"
          >
            🚀 Bắt Đầu Quy Trình
          </button>
        )}


        {(!isLoadingProcess && loadingMessage && (loadingMessage.includes("Hoàn thành") || loadingMessage.includes("Đã hủy") || loadingMessage.includes("Lỗi"))) && 
            <p className={`text-center font-medium my-2 ${loadingMessage.includes("Lỗi") ? 'text-red-600' : (loadingMessage.includes("Đã hủy") ? 'text-yellow-600' : 'text-green-600')}`}>
                {loadingMessage}
            </p>
        }
        {error && <ErrorAlert message={error} />}

        {(generatedStory || generatedImages.length > 0) && (
          <div className="mt-8 space-y-6">
            {generatedStory && (
              <div className="p-4 border rounded-lg bg-gray-50">
                <h3 className="text-lg font-semibold mb-2 text-gray-700">✍️ Truyện Hoàn Chỉnh:</h3>
                <textarea
                  value={generatedStory}
                  readOnly
                  rows={15}
                  className="w-full p-3 border-2 border-gray-200 rounded-md bg-white whitespace-pre-wrap leading-relaxed"
                />
              </div>
            )}
            {generatedImages.length > 0 && (
              <div className="p-4 border rounded-lg bg-gray-50">
                <h3 className="text-lg font-semibold mb-2 text-gray-700">🖼️ Ảnh Minh Họa Đã Tạo:</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {generatedImages.map((imgB64, index) => (
                    <img key={index} src={`data:image/png;base64,${imgB64}`} alt={`Generated Illustration ${index + 1}`} className="w-full h-auto rounded-md shadow-sm object-contain"/>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ModuleContainer>
  );
};

export default SuperAgentModule;
