
import React from 'react';
import {
    ApiSettings,
    Dream100CompetitorAnalysisModuleState,
    Dream100ChannelResult,
    GroundingChunk,
    UserProfile
} from '../../types';
import { HOOK_LANGUAGE_OPTIONS } from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { generateText } from '../../services/geminiService';
import featureUsageTracker, { FEATURE_IDS } from '../../services/featureUsageTracker';

interface Dream100CompetitorAnalysisModuleProps {
  apiSettings: ApiSettings;
  moduleState: Dream100CompetitorAnalysisModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<Dream100CompetitorAnalysisModuleState>>;
  currentUser: UserProfile | null;
}

const Dream100CompetitorAnalysisModule: React.FC<Dream100CompetitorAnalysisModuleProps> = ({
    apiSettings, moduleState, setModuleState, currentUser
}) => {
  const {
    inputChannelUrl, numberOfSuggestions, outputLanguage,
    analysisResults, isLoading, error, progressMessage, groundingSources,
    // New fields for filtering
    searchForNewChannels, newChannelTimeframe, viewProfile
  } = moduleState;

  const updateState = (updates: Partial<Dream100CompetitorAnalysisModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };

  const geminiApiKeyForService = apiSettings.provider === 'gemini' ? apiSettings.apiKey : undefined;

  const handleAnalyzeCompetitors = async () => {
    if (!inputChannelUrl.trim()) {
      updateState({ error: 'Vui lòng nhập URL kênh YouTube cần phân tích.' });
      return;
    }
    try {
      new URL(inputChannelUrl); // Validate URL format
    } catch (e) {
      updateState({ error: 'URL kênh YouTube không hợp lệ.' });
      return;
    }

    updateState({
      isLoading: true,
      error: null,
      progressMessage: 'Đang phân tích kênh và tìm kiếm đối thủ...',
      analysisResults: [],
      groundingSources: []
    });

    const selectedOutputLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === outputLanguage)?.label || outputLanguage;

    let advancedSearchInstructions = "";
    if (searchForNewChannels) {
        advancedSearchInstructions += "\n\n**Advanced Search Preferences (Prioritize these):**";
        if (newChannelTimeframe !== 'any') {
            const timeframeText = newChannelTimeframe === 'last_year' ? "trong khoảng 1 năm trở lại đây" : "trong khoảng 6 tháng trở lại đây";
            advancedSearchInstructions += `\n- Attempt to find channels that appear to have been created or gained significant prominence ${timeframeText}.`;
        }
        if (viewProfile !== 'any') {
            const viewProfileText = viewProfile === 'high_views' ? "có lượng view cao (tương đối)" : "có lượng view vừa phải (tương đối)";
            advancedSearchInstructions += `\n- Among these (potentially newer) channels, try to identify those that seem to have ${viewProfileText}.`;
        }
        advancedSearchInstructions += `\n- If you identify channels fitting these 'new' or 'high view' criteria, please mention this likelihood and your reasoning (based on search results like video upload dates, news articles, etc.) in the 'similarityReasoning' or 'description' field for that channel.`;
    }

    const prompt = `
You are an AI assistant specializing in YouTube channel analysis and competitor research.
Your task is to analyze the provided YouTube channel URL and find ${numberOfSuggestions} similar channels.
Use Google Search to gather information. All textual output in your JSON response (descriptions, themes, reasoning) MUST be in ${selectedOutputLangLabel}.

Input YouTube Channel URL: ${inputChannelUrl}
${advancedSearchInstructions}

For each similar channel found, provide the following details. Structure your entire response as a single JSON array of objects. Each object in the array should represent a competitor channel and have the following fields:
- "channelName": string (Name of the similar channel)
- "channelUrl": string (Direct URL to the similar channel if found. If not, provide a Google search query string that would likely find it, e.g., "YouTube search for [Channel Name]")
- "description": string (A brief description of what the similar channel is about, in ${selectedOutputLangLabel}. If it seems to meet 'new' or 'high view' criteria, mention it here or in reasoning.)
- "estimatedSubscribers": string (Estimated subscriber count, e.g., "100K+", "1M+", "Unknown", in ${selectedOutputLangLabel})
- "contentThemes": string[] (An array of 3-5 main content themes or topics of the similar channel, in ${selectedOutputLangLabel})
- "similarityReasoning": string (Explain why this channel is considered similar to the input channel, in ${selectedOutputLangLabel}. Include reasoning for 'new' or 'high view' if applicable.)

Example of one object in the JSON array:
{
  "channelName": "Kênh Đối Thủ Mẫu",
  "channelUrl": "https://www.youtube.com/channel/UCxyz123",
  "description": "Mô tả kênh bằng ${selectedOutputLangLabel}...",
  "estimatedSubscribers": "Khoảng 500N+",
  "contentThemes": ["Chủ đề 1 bằng ${selectedOutputLangLabel}", "Chủ đề 2 bằng ${selectedOutputLangLabel}"],
  "similarityReasoning": "Lý do tương đồng bằng ${selectedOutputLangLabel}..."
}

Ensure the output is ONLY the JSON array. Do not include any introductory text, explanations, or markdown backticks around the JSON itself.
If you cannot find enough distinct similar channels, return as many as you can up to ${numberOfSuggestions}.
    `;

    try {
      const result = await generateText(prompt, undefined, true, geminiApiKeyForService);
      let jsonStr = result.text.trim();
      const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
      const match = jsonStr.match(fenceRegex);
      if (match && match[2]) {
        jsonStr = match[2].trim();
      }

      const parsedResults = JSON.parse(jsonStr) as Dream100ChannelResult[];
      updateState({
        analysisResults: parsedResults,
        isLoading: false,
        progressMessage: `Phân tích hoàn tất! Đã tìm thấy ${parsedResults.length} kênh tương tự.`,
        groundingSources: result.groundingChunks || []
      });
      
      // Track feature usage
      featureUsageTracker.trackFeatureUsage(FEATURE_IDS.DREAM100_ANALYSIS, 'Phân Tích Dream100');
    } catch (e) {
      updateState({
        error: `Lỗi khi phân tích: ${(e as Error).message}. Có thể kết quả trả về không phải là JSON hợp lệ.`,
        isLoading: false,
        progressMessage: 'Đã xảy ra lỗi phân tích.'
      });
      console.error("Raw AI response that failed to parse or during API call:", error);
    } finally {
        setTimeout(() => {
            setModuleState(prev =>
                (prev.progressMessage?.includes("hoàn tất") || prev.progressMessage?.includes("lỗi"))
                ? {...prev, progressMessage: null}
                : prev
            )
        }, 5000);
    }
  };
  
  const isValidUrl = (urlString: string): boolean => {
    try {
      new URL(urlString);
      return urlString.startsWith('http://') || urlString.startsWith('https://');
    } catch (e) {
      return false;
    }
  };

  return (
    <ModuleContainer title="🎯 Dream 100 (Đối Thủ YouTube)" badge="FREE">
      <InfoBox>
        <p><strong>💡 Hướng dẫn:</strong></p>
        <ul className="list-disc list-inside ml-4 mt-1 space-y-1 text-sm">
          <li>Nhập URL của một kênh YouTube bạn muốn phân tích.</li>
          <li>Chọn số lượng kênh tương tự bạn muốn AI gợi ý.</li>
          <li>Chọn ngôn ngữ cho các mô tả và phân tích từ AI.</li>
          <li><strong>(Mới) Ưu tiên kênh mới, nhiều view:</strong> Chọn tùy chọn này để AI cố gắng ưu tiên tìm các kênh mới nổi (trong 6 tháng hoặc 1 năm qua) và có vẻ nhiều lượt xem. Lưu ý: AI sẽ *suy luận* điều này từ kết quả Google Search, không phải là bộ lọc chính xác từ dữ liệu YouTube.</li>
          <li>Nhấn "Phân Tích Đối Thủ". AI sẽ sử dụng Google Search để tìm và liệt kê các kênh tương tự.</li>
          <li>URL kênh đối thủ có thể là link tìm kiếm Google nếu AI không tìm thấy URL trực tiếp.</li>
        </ul>
      </InfoBox>

      <div className="space-y-6 mt-6">
        <div>
          <label htmlFor="d100InputChannelUrl" className="block text-sm font-medium text-gray-700 mb-1">
            URL Kênh YouTube Cần Phân Tích:
          </label>
          <input
            type="url"
            id="d100InputChannelUrl"
            value={inputChannelUrl}
            onChange={(e) => updateState({ inputChannelUrl: e.target.value })}
            className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="https://www.youtube.com/@YourChannel"
            disabled={isLoading}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="d100NumberOfSuggestions" className="block text-sm font-medium text-gray-700 mb-1">
              Số lượng Kênh Gợi ý (1-10):
            </label>
            <input
              type="number"
              id="d100NumberOfSuggestions"
              value={numberOfSuggestions}
              onChange={(e) => updateState({ numberOfSuggestions: Math.max(1, Math.min(10, parseInt(e.target.value))) })}
              min="1"
              max="10"
              className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              disabled={isLoading}
            />
          </div>
          <div>
            <label htmlFor="d100OutputLanguage" className="block text-sm font-medium text-gray-700 mb-1">
              Ngôn ngữ cho Mô tả/Phân tích:
            </label>
            <select
              id="d100OutputLanguage"
              value={outputLanguage}
              onChange={(e) => updateState({ outputLanguage: e.target.value })}
              className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              disabled={isLoading}
            >
              {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>

        {/* New Search Preferences */}
        <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
            <div className="flex items-center">
                <input
                    type="checkbox"
                    id="d100SearchForNewChannels"
                    checked={searchForNewChannels}
                    onChange={(e) => updateState({ searchForNewChannels: e.target.checked })}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    disabled={isLoading}
                />
                <label htmlFor="d100SearchForNewChannels" className="ml-2 block text-sm font-medium text-gray-700">
                    Ưu tiên tìm kênh mới, có nhiều lượt xem
                </label>
            </div>

            {searchForNewChannels && (
                <div className="grid md:grid-cols-2 gap-4 pl-6 pt-2 border-l-2 border-indigo-200 ml-2">
                    <div>
                        <label htmlFor="d100NewChannelTimeframe" className="block text-xs font-medium text-gray-600 mb-1">
                            Khung thời gian tạo kênh (ước tính):
                        </label>
                        <select
                            id="d100NewChannelTimeframe"
                            value={newChannelTimeframe}
                            onChange={(e) => updateState({ newChannelTimeframe: e.target.value as 'last_year' | 'last_6_months' | 'any' })}
                            className="w-full p-2 border border-gray-300 rounded-md text-xs shadow-sm"
                            disabled={isLoading}
                        >
                            <option value="any">Bất kỳ</option>
                            <option value="last_year">Trong 1 năm qua</option>
                            <option value="last_6_months">Trong 6 tháng qua</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="d100ViewProfile" className="block text-xs font-medium text-gray-600 mb-1">
                            Mức độ lượt xem mong muốn (tương đối):
                        </label>
                        <select
                            id="d100ViewProfile"
                            value={viewProfile}
                            onChange={(e) => updateState({ viewProfile: e.target.value as 'high_views' | 'moderate_views' | 'any' })}
                            className="w-full p-2 border border-gray-300 rounded-md text-xs shadow-sm"
                            disabled={isLoading}
                        >
                            <option value="any">Bất kỳ</option>
                            <option value="high_views">Nhiều view</option>
                            <option value="moderate_views">Lượng view vừa phải</option>
                        </select>
                    </div>
                </div>
            )}
        </div>


        <button
          onClick={handleAnalyzeCompetitors}
          disabled={ isLoading || !inputChannelUrl.trim()}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Phân Tích Đối Thủ
        </button>

        {isLoading && progressMessage && <LoadingSpinner message={progressMessage} />}
        {!isLoading && progressMessage && <p className={`text-center font-medium my-3 ${progressMessage.includes("Lỗi") ? 'text-red-600' : 'text-green-600'}`}>{progressMessage}</p>}
        {error && <ErrorAlert message={error} />}

        {analysisResults.length > 0 && !isLoading && (
          <div className="mt-8 space-y-6">
            <h3 className="text-2xl font-semibold text-gray-800 border-b pb-3 mb-4">
              Kết Quả Phân Tích Đối Thủ ({analysisResults.length} kênh)
            </h3>
            {analysisResults.map((channel, index) => (
              <div key={index} className="p-6 border-2 border-indigo-200 rounded-xl bg-indigo-50 shadow-lg">
                <h4 className="font-bold text-xl text-indigo-700 mb-2">
                  {channel.channelName || "Không có tên"}
                </h4>
                <div className="space-y-2 text-sm text-gray-700">
                  <p>
                    <strong>URL/Tìm kiếm: </strong>
                    {isValidUrl(channel.channelUrl) ? (
                      <a href={channel.channelUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{channel.channelUrl}</a>
                    ) : (
                      <span className="text-gray-600 italic">{channel.channelUrl || "Không có URL/Query"} (Thử tìm trên Google/YouTube)</span>
                    )}
                  </p>
                  <p><strong>Mô tả:</strong> {channel.description || "Không có mô tả"}</p>
                  <p><strong>Lượng Sub ước tính:</strong> {channel.estimatedSubscribers || "Không rõ"}</p>
                  <div>
                    <strong>Chủ đề nội dung chính:</strong>
                    {channel.contentThemes && channel.contentThemes.length > 0 ? (
                      <ul className="list-disc list-inside ml-4 mt-1">
                        {channel.contentThemes.map((theme, tIdx) => <li key={tIdx}>{theme}</li>)}
                      </ul>
                    ) : " Không có"}
                  </div>
                  <p><strong>Lý do tương đồng:</strong> {channel.similarityReasoning || "Không có giải thích"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {groundingSources.length > 0 && !isLoading && (
            <div className="mt-8 p-4 border rounded-lg bg-gray-100">
                <h4 className="text-md font-semibold text-gray-700 mb-2">Nguồn Tham Khảo (AI đã sử dụng Google Search):</h4>
                <ul className="list-disc list-inside space-y-1 text-xs">
                    {groundingSources.map((source, index) => (
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
    </ModuleContainer>
  );
};

export default Dream100CompetitorAnalysisModule;
