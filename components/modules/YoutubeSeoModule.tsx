
import React from 'react'; 
import { 
    ApiSettings, 
    YoutubeSeoModuleState, 
    ActiveSeoTabType,
    TitleAnalysisResponse,
    ThumbnailTextResponse
} from '../../types'; 
import { HOOK_LANGUAGE_OPTIONS } from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { generateText, generateTextWithJsonOutput } from '@/services/textGenerationService';
import { isSubscribed } from '../../utils';
import UpgradePrompt from '../UpgradePrompt';
import { UserProfile } from '../../types';

interface YoutubeSeoModuleProps {
  apiSettings: ApiSettings;
  moduleState: YoutubeSeoModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<YoutubeSeoModuleState>>;
  currentUser: UserProfile | null;
}

const YoutubeSeoModule: React.FC<YoutubeSeoModuleProps> = ({ apiSettings, moduleState, setModuleState, currentUser }) => {
  const hasActiveSubscription = isSubscribed(currentUser);
  const {
    activeSeoTab, videoTitle, youtubeOutline, language, timelineCount, videoDuration,
    videoKeywords, youtubeDescription, youtubeTags, keywordTopic, suggestedKeywordsOutput,
    chapterScript, chapterVideoDuration, desiredChapterCount, generatedChapters,
    currentResult, loadingMessage, error,
    // New fields for Title & Thumbnail Optimizer
    titleForAnalysis, titleAnalysisScore, titleAnalysisFeedback, suggestedTitles,
    shortVideoSummaryForThumbnail, thumbnailTextSuggestions,
    loadingTitleOptimizer, errorTitleOptimizer
  } = moduleState;

  const updateState = (updates: Partial<YoutubeSeoModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };
  
  const getSelectedLanguageLabel = () => HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === language)?.label || language;

  const handleGenerateDescription = async () => {
    if (!videoTitle.trim()) { updateState({ error: 'Vui lòng nhập tiêu đề video!' }); return; }
    if (!youtubeOutline.trim()) { updateState({ error: 'Vui lòng nhập dàn ý để tạo timeline!' }); return; }
    updateState({ error: null, currentResult: '', youtubeDescription: '', youtubeTags: '', loadingMessage: 'Đang tạo mô tả & timeline theo cấu trúc mới...' });

    const selectedLangLabel = getSelectedLanguageLabel();

    const prompt = `
You are a YouTube SEO expert. Your task is to generate a complete YouTube description based on the provided inputs and a strict output structure.
**CRITICAL LANGUAGE REQUIREMENT: Your entire output for the placeholders must be in the target language: ${selectedLangLabel}.** Do not mix in any other languages like Vietnamese or English unless that is the target language.

**INPUTS:**
- Video Title: "${videoTitle}"
- Target Language: "${selectedLangLabel}"
- Main Keywords (for context): "${videoKeywords || 'Not provided'}"
- Video Duration: ${videoDuration} minutes
- Story Outline (for context):
---
${youtubeOutline}
---

**OUTPUT STRUCTURE (Fill placeholders in ${selectedLangLabel}):**

${videoTitle}
[AI: Generate a compelling 1-2 sentence hook/introductory paragraph here.]

[AI: Generate a sentence inviting users to listen and comment here. (For context, a Vietnamese equivalent is "Hãy Cùng Lắng Nghe Câu Truyện Đầy Cảm Xúc Này và đừng quên để lại suy nghĩ của bạn bên dưới bình luận nhé.").]

TIMELINE: ${videoTitle}
[AI: Generate EXACTLY ${timelineCount} timeline entries here. Each on a new line.
Format: Use HH:MM:SS for videos >= 60 mins, MM:SS for videos < 60 mins.
Example: "00:00 - [Short, catchy description]". Distribute timestamps logically based on the video duration.]

[AI: Generate a call-to-action sentence here, asking users to Like, Subscribe to channel "[TÊN KÊNH CỦA BẠN]", and Comment. IMPORTANT: The phrase "[TÊN KÊNH CỦA BẠN]" must be kept exactly as is, it's a placeholder.]

[AI: Generate 5 relevant hashtags here. Each on a new line, starting with #.]

[TAGS][AI: Generate 15-20 relevant SEO tags here, separated by commas.][/TAGS]

**MANDATORY FINAL CHECK:** Ensure all [AI: ...] parts are filled in ${selectedLangLabel} and the [TAGS] block is the very last thing in the output.
`;
    
    try {
      const result = await generateText(prompt, undefined, undefined, apiSettings);
      let descriptionText = result.text;
      const tagMatch = descriptionText.match(/\[TAGS\]([\s\S]*?)\[\/TAGS\]/);
      let tagsResult = '';
      if (tagMatch && tagMatch[1]) {
          tagsResult = tagMatch[1].trim();
          descriptionText = descriptionText.replace(tagMatch[0], '').trim();
      }
      updateState({ youtubeDescription: descriptionText, youtubeTags: tagsResult, currentResult: descriptionText, loadingMessage: "Tạo mô tả & timeline theo cấu trúc mới hoàn tất!" });
    } catch (e) { 
        updateState({ error: `Đã xảy ra lỗi: ${(e as Error).message}`, loadingMessage: "Lỗi tạo mô tả (cấu trúc mới)." }); 
    } finally { 
        setTimeout(() => {
            setModuleState(prev => 
            (prev.loadingMessage?.includes("hoàn tất") || prev.loadingMessage?.includes("Lỗi")) 
            ? {...prev, loadingMessage: null} 
            : prev
            )
        }, 3000);
    }
  };

  const handleSuggestKeywords = async () => {
    if (!keywordTopic.trim()) { updateState({ error: 'Vui lòng nhập Chủ đề chính của Video.' }); return; }
    updateState({ error: null, currentResult: '', suggestedKeywordsOutput: '', loadingMessage: 'Đang tìm từ khóa liên quan...' });

    const selectedLangLabel = getSelectedLanguageLabel();
    const prompt = `You are a YouTube SEO keyword research expert. Based on the video topic: "${keywordTopic}", please suggest a comprehensive list of 15-20 relevant SEO keywords and 5-7 long-tail keywords. 
    Provide the keywords in ${selectedLangLabel}. 
    Format the output clearly with headings for "Từ khóa Ngắn (Short Keywords):" and "Từ khóa Dài (Long-tail Keywords):". Each keyword on a new line.`;

    try {
      const result = await generateText(prompt, undefined, undefined, apiSettings);
      updateState({ suggestedKeywordsOutput: result.text, currentResult: result.text, loadingMessage: "Tìm từ khóa hoàn tất!" });
    } catch (e) { 
        updateState({ error: `Đã xảy ra lỗi: ${(e as Error).message}`, loadingMessage: "Lỗi tìm từ khóa." }); 
    } finally { 
        setTimeout(() => {
            setModuleState(prev => 
            (prev.loadingMessage?.includes("hoàn tất") || prev.loadingMessage?.includes("Lỗi")) 
            ? {...prev, loadingMessage: null} 
            : prev
            )
        }, 3000);
    }
  };

  const handleGenerateChapters = async () => {
    if (!chapterScript.trim()) { updateState({ error: 'Vui lòng nhập Kịch bản Video.' }); return; }
    updateState({ error: null, currentResult: '', generatedChapters: '', loadingMessage: 'Đang tạo chapter markers...' });

    const selectedLangLabel = getSelectedLanguageLabel();
    const prompt = `You are an expert at creating YouTube chapter markers. Based on the following video script and information, generate approximately ${desiredChapterCount} chapter markers in ${selectedLangLabel}.
    Video Script (or main points): "${chapterScript}"
    Total Video Duration: ${chapterVideoDuration} minutes.
    Distribute the chapters logically throughout the video. Each chapter should be in the format 'HH:MM:SS - Chapter Title in ${selectedLangLabel}' or 'MM:SS - Chapter Title in ${selectedLangLabel}'. Ensure the final chapter does not exceed the total video duration. List each chapter on a new line. Only return the list of chapters.`;
    
    try {
      const result = await generateText(prompt, undefined, undefined, apiSettings);
      updateState({ generatedChapters: result.text, currentResult: result.text, loadingMessage: "Tạo chapter hoàn tất!" });
    } catch (e) { 
        updateState({ error: `Đã xảy ra lỗi: ${(e as Error).message}`, loadingMessage: "Lỗi tạo chapter." }); 
    } finally { 
        setTimeout(() => {
            setModuleState(prev => 
            (prev.loadingMessage?.includes("hoàn tất") || prev.loadingMessage?.includes("Lỗi")) 
            ? {...prev, loadingMessage: null} 
            : prev
            )
        }, 3000);
    }
  };

  const handleAnalyzeAndScoreTitle = async () => {
    if (!titleForAnalysis.trim()) {
      updateState({ errorTitleOptimizer: 'Vui lòng nhập tiêu đề cần phân tích.' });
      return;
    }
    updateState({ 
        errorTitleOptimizer: null, 
        loadingTitleOptimizer: true,
        titleAnalysisScore: null,
        titleAnalysisFeedback: null,
        suggestedTitles: []
    });
    const selectedLangLabel = getSelectedLanguageLabel();
    const keywordsContext = videoKeywords.trim() ? `Consider these main keywords for context: "${videoKeywords.trim()}".` : "No specific keywords provided for context, focus on general appeal.";

    const prompt = `You are a YouTube Title Optimization Expert. Analyze the provided Vietnamese video title.
        Video Title to Analyze: "${titleForAnalysis}"
        Output Language for all feedback and suggestions: ${selectedLangLabel}.
        ${keywordsContext}

        **Tasks:**
        1.  **Score the Title:** Provide a score out of 100 based on its potential for virality, CTR, clarity, keyword usage (if context provided), and emotional impact/curiosity.
        2.  **Provide Feedback:** Briefly explain the score, highlighting strengths and weaknesses.
        3.  **Suggest Alternatives:** Generate 3-5 improved title variations in ${selectedLangLabel} that are more optimized for clicks and engagement.

        **Return the entire response as a single JSON object with the following structure:**
        {
          "score": <number_0_to_100>,
          "feedback": "<string_feedback_in_${selectedLangLabel}>",
          "suggested_titles": ["<string_title_1_in_${selectedLangLabel}>", "<string_title_2_in_${selectedLangLabel}>", "..."]
        }
        Ensure the JSON is valid. Do not include any text outside this JSON structure.`;

    try {
        const result = await generateTextWithJsonOutput<TitleAnalysisResponse>(prompt, undefined, apiSettings);
        updateState({
            titleAnalysisScore: result.score,
            titleAnalysisFeedback: result.feedback,
            suggestedTitles: result.suggested_titles,
            loadingTitleOptimizer: false,
            errorTitleOptimizer: null,
        });
    } catch (e) {
        updateState({ 
            errorTitleOptimizer: `Lỗi phân tích tiêu đề: ${(e as Error).message}`, 
            loadingTitleOptimizer: false 
        });
    }
  };

  const handleSuggestThumbnailText = async () => {
    if (!shortVideoSummaryForThumbnail.trim()) {
      updateState({ errorTitleOptimizer: 'Vui lòng nhập tóm tắt video cho gợi ý thumbnail.' });
      return;
    }
    const currentTitle = titleForAnalysis.trim() || videoTitle.trim(); // Use analyzed title or main video title
    if (!currentTitle) {
      updateState({ errorTitleOptimizer: 'Không có tiêu đề video để làm cơ sở gợi ý text thumbnail.' });
      return;
    }

    updateState({ 
        errorTitleOptimizer: null, 
        loadingTitleOptimizer: true,
        thumbnailTextSuggestions: []
    });
    const selectedLangLabel = getSelectedLanguageLabel();

    const prompt = `You are a YouTube Thumbnail Text Expert.
        Video Title: "${currentTitle}"
        Short Video Summary: "${shortVideoSummaryForThumbnail}"
        Output Language for suggestions: ${selectedLangLabel}.

        **Task:**
        Generate 2-4 extremely short, impactful, and click-worthy text phrases in ${selectedLangLabel} to be placed on a YouTube thumbnail for this video. Consider using all caps for some words or suggesting relevant emojis if appropriate to increase attention.

        **Return the entire response as a single JSON object with the following structure:**
        {
          "thumbnail_texts": ["<suggestion_1_in_${selectedLangLabel}>", "<suggestion_2_in_${selectedLangLabel}>", "..."]
        }
        Ensure the JSON is valid. Do not include any text outside this JSON structure.`;
    
    try {
        const result = await generateTextWithJsonOutput<ThumbnailTextResponse>(prompt, undefined, apiSettings);
        updateState({
            thumbnailTextSuggestions: result.thumbnail_texts,
            loadingTitleOptimizer: false,
            errorTitleOptimizer: null,
        });
    } catch (e) {
        updateState({ 
            errorTitleOptimizer: `Lỗi gợi ý text thumbnail: ${(e as Error).message}`, 
            loadingTitleOptimizer: false 
        });
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

  const TabButton: React.FC<{ tabId: ActiveSeoTabType; label: string }> = ({ tabId, label }) => (
    <button
      onClick={() => { 
          updateState({ 
              activeSeoTab: tabId, 
              currentResult: '', // Clear general result
              error: null, // Clear general error
              loadingMessage: null, // Clear general loading
              // Reset specific optimizer fields when switching tabs
              titleAnalysisScore: null,
              titleAnalysisFeedback: null,
              suggestedTitles: [],
              thumbnailTextSuggestions: [],
              errorTitleOptimizer: null,
              loadingTitleOptimizer: false,
          }); 
      }}
      className={`px-4 py-2 font-medium rounded-md text-sm transition-colors
                  ${activeSeoTab === tabId ? 'bg-indigo-600 text-white shadow' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
      disabled={!!loadingMessage || loadingTitleOptimizer} // Disable if any main loading or optimizer loading
    >
      {label}
    </button>
  );

  const isProcessing = (loadingMessage && loadingMessage.startsWith("Đang")) || loadingTitleOptimizer;

  const renderTabContent = () => {
    switch (activeSeoTab) {
      case 'description':
        return (
          <div className="space-y-6 mt-4">
            <div>
              <label htmlFor="videoTitle" className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề Video:</label>
              <input type="text" id="videoTitle" value={videoTitle} onChange={(e) => updateState({ videoTitle: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Ví dụ: Truyện Audio - Cuộc Phiêu Lưu Của Cậu Bé Rồng (Tập 1)" disabled={!!loadingMessage}/>
            </div>
            <div>
              <label htmlFor="youtubeOutline" className="block text-sm font-medium text-gray-700 mb-1">Dàn ý / Tóm tắt Video:</label>
              <textarea id="youtubeOutline" value={youtubeOutline} onChange={(e) => updateState({ youtubeOutline: e.target.value })} rows={4} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Dán dàn ý hoặc các điểm chính của câu chuyện..." disabled={!!loadingMessage}></textarea>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ (cho Mô tả & Timeline):</label>
                <select id="language" value={language} onChange={(e) => updateState({ language: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={!!loadingMessage}>
                  {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="timelineCount" className="block text-sm font-medium text-gray-700 mb-1">Số lượng Timeline (3-50):</label>
                <input type="number" id="timelineCount" value={timelineCount} onChange={(e) => updateState({ timelineCount: parseInt(e.target.value)})} min="3" max="50" className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={!!loadingMessage}/>
              </div>
              <div>
                <label htmlFor="videoDuration" className="block text-sm font-medium text-gray-700 mb-1">Thời lượng Video (phút):</label>
                <input type="number" id="videoDuration" value={videoDuration} onChange={(e) => updateState({ videoDuration: parseInt(e.target.value)})} min="1" className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={!!loadingMessage}/>
              </div>
            </div>
            <div>
              <label htmlFor="videoKeywords" className="block text-sm font-medium text-gray-700 mb-1">Từ khóa Chính (cách nhau bởi dấu phẩy, không bắt buộc):</label>
              <input type="text" id="videoKeywords" value={videoKeywords} onChange={(e) => updateState({ videoKeywords: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="truyện audio, truyện ngắn, cậu bé rồng, phiêu lưu" disabled={!!loadingMessage}/>
            </div>
            <button onClick={handleGenerateDescription} disabled={!hasActiveSubscription || !!loadingMessage} className="w-full bg-indigo-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-indigo-700 disabled:opacity-50">
              Tạo Mô tả & Timeline (Cấu trúc mới)
            </button>
          </div>
        );
      case 'keywords':
        return (
          <div className="space-y-6 mt-4">
            <div>
              <label htmlFor="keywordTopic" className="block text-sm font-medium text-gray-700 mb-1">Chủ đề chính của Video:</label>
              <textarea id="keywordTopic" value={keywordTopic} onChange={(e) => updateState({ keywordTopic: e.target.value })} rows={3} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Ví dụ: review phim kinh dị, hướng dẫn nấu ăn chay, series truyện cổ tích mới" disabled={!!loadingMessage}></textarea>
            </div>
             <div>
                <label htmlFor="keywordLanguage" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ (cho Từ khóa gợi ý):</label>
                <select id="keywordLanguage" value={language} onChange={(e) => updateState({ language: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={!!loadingMessage}>
                  {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
            <button onClick={handleSuggestKeywords} disabled={!hasActiveSubscription || !!loadingMessage} className="w-full bg-indigo-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-indigo-700 disabled:opacity-50">
              Tìm Từ khóa Liên quan
            </button>
          </div>
        );
      case 'chapters':
        return (
          <div className="space-y-6 mt-4">
            <div>
              <label htmlFor="chapterScript" className="block text-sm font-medium text-gray-700 mb-1">Kịch bản Video (Toàn bộ hoặc Phần chính):</label>
              <textarea id="chapterScript" value={chapterScript} onChange={(e) => updateState({ chapterScript: e.target.value })} rows={6} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Dán kịch bản video vào đây. Càng chi tiết, chapter markers càng chính xác." disabled={!!loadingMessage}></textarea>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
               <div>
                <label htmlFor="chapterLanguage" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ (cho Chapter Titles):</label>
                <select id="chapterLanguage" value={language} onChange={(e) => updateState({ language: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={!!loadingMessage}>
                  {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="chapterVideoDuration" className="block text-sm font-medium text-gray-700 mb-1">Tổng Thời lượng Video (phút):</label>
                <input type="number" id="chapterVideoDuration" value={chapterVideoDuration} onChange={(e) => updateState({ chapterVideoDuration: parseInt(e.target.value)})} min="1" className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={!!loadingMessage}/>
              </div>
              <div>
                <label htmlFor="desiredChapterCount" className="block text-sm font-medium text-gray-700 mb-1">Số lượng Chapters (ước tính):</label>
                <input type="number" id="desiredChapterCount" value={desiredChapterCount} onChange={(e) => updateState({ desiredChapterCount: parseInt(e.target.value)})} min="2" max="50" className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={!!loadingMessage}/>
              </div>
            </div>
            <button onClick={handleGenerateChapters} disabled={!hasActiveSubscription || !!loadingMessage} className="w-full bg-indigo-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-indigo-700 disabled:opacity-50">
              Tạo Chapter Markers
            </button>
          </div>
        );
      case 'titleThumbnailOptimizer':
        return (
            <div className="space-y-6 mt-4">
                <div className="p-4 border rounded-lg bg-white shadow-sm">
                    <h4 className="text-lg font-semibold text-gray-700 mb-3">Phân Tích & Tối Ưu Tiêu Đề</h4>
                    <div>
                        <label htmlFor="titleForAnalysis" className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề dự kiến của bạn (ngôn ngữ: {getSelectedLanguageLabel()}):</label>
                        <textarea id="titleForAnalysis" value={titleForAnalysis} onChange={(e) => updateState({ titleForAnalysis: e.target.value })} rows={2} className="w-full p-2 border border-gray-300 rounded-md" placeholder="Nhập tiêu đề bạn muốn AI phân tích..." disabled={loadingTitleOptimizer}></textarea>
                    </div>
                    {/* Consider adding videoKeywords input here if you want it specific for title analysis */}
                    <button onClick={handleAnalyzeAndScoreTitle} disabled={!hasActiveSubscription || loadingTitleOptimizer} className="mt-3 w-full bg-purple-600 text-white font-semibold py-2.5 px-4 rounded-lg shadow hover:bg-purple-700 disabled:opacity-50">
                        Phân Tích & Chấm Điểm Tiêu Đề
                    </button>
                    {loadingTitleOptimizer && <LoadingSpinner message="Đang phân tích tiêu đề..." />}
                    {errorTitleOptimizer && !loadingTitleOptimizer && <ErrorAlert message={errorTitleOptimizer} />}
                    
                    {titleAnalysisScore !== null && !loadingTitleOptimizer && (
                        <div className="mt-4 p-3 bg-purple-50 rounded-md border border-purple-200">
                            <p className="text-sm font-medium text-purple-700">Điểm số Tiêu đề: <span className="text-xl font-bold">{titleAnalysisScore}/100</span></p>
                            {titleAnalysisFeedback && <p className="text-xs text-purple-600 mt-1 italic">Góp ý: {titleAnalysisFeedback}</p>}
                        </div>
                    )}
                    {suggestedTitles.length > 0 && !loadingTitleOptimizer && (
                        <div className="mt-4">
                            <h5 className="text-sm font-semibold text-gray-600 mb-1">Gợi ý Tiêu đề Tối ưu hơn:</h5>
                            <ul className="list-disc list-inside text-sm text-gray-700 bg-gray-50 p-3 rounded-md border">
                                {suggestedTitles.map((title, idx) => <li key={idx} className="mb-1">{title}</li>)}
                            </ul>
                             <button id="copySuggestedTitlesBtn" onClick={() => copyToClipboard(suggestedTitles.join('\n'), "copySuggestedTitlesBtn")} className="mt-2 px-3 py-1 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600">
                                📋 Sao chép Gợi ý Tiêu đề
                            </button>
                        </div>
                    )}
                </div>

                <div className="p-4 border rounded-lg bg-white shadow-sm mt-6">
                    <h4 className="text-lg font-semibold text-gray-700 mb-3">Gợi Ý Text Cho Thumbnail</h4>
                    <div>
                        <label htmlFor="shortVideoSummaryForThumbnail" className="block text-sm font-medium text-gray-700 mb-1">Tóm tắt ngắn gọn nội dung video (cho gợi ý text trên thumbnail, ngôn ngữ: {getSelectedLanguageLabel()}):</label>
                        <textarea id="shortVideoSummaryForThumbnail" value={shortVideoSummaryForThumbnail} onChange={(e) => updateState({ shortVideoSummaryForThumbnail: e.target.value })} rows={3} className="w-full p-2 border border-gray-300 rounded-md" placeholder="Ví dụ: Mẹ chồng cay nghiệt, con dâu hiền lành nhưng bất ngờ phản kháng..." disabled={loadingTitleOptimizer}></textarea>
                    </div>
                    <button onClick={handleSuggestThumbnailText} disabled={loadingTitleOptimizer} className="mt-3 w-full bg-teal-600 text-white font-semibold py-2.5 px-4 rounded-lg shadow hover:bg-teal-700 disabled:opacity-50">
                        Gợi Ý Text Cho Thumbnail
                    </button>
                    {/* Loading/Error for this specific part can reuse loadingTitleOptimizer/errorTitleOptimizer if actions are sequential, or add new state vars */}
                    {thumbnailTextSuggestions.length > 0 && !loadingTitleOptimizer && (
                        <div className="mt-4">
                            <h5 className="text-sm font-semibold text-gray-600 mb-1">Gợi ý Text trên Thumbnail:</h5>
                            <ul className="list-disc list-inside text-sm text-gray-700 bg-gray-50 p-3 rounded-md border">
                                {thumbnailTextSuggestions.map((text, idx) => <li key={idx} className="mb-1">{text}</li>)}
                            </ul>
                            <button id="copyThumbnailTextBtn" onClick={() => copyToClipboard(thumbnailTextSuggestions.join('\n'), "copyThumbnailTextBtn")} className="mt-2 px-3 py-1 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600">
                                📋 Sao chép Gợi ý Text
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
      default: return null;
    }
  };

  return (
    <ModuleContainer title="🎬 YouTube SEO & Từ Khóa">
      {!hasActiveSubscription && <UpgradePrompt />}
      <InfoBox>
        <strong>💡 Hướng dẫn:</strong> Tối ưu hóa video YouTube, nghiên cứu từ khóa liên quan, tạo dấu thời gian (chapter markers), và nhận gợi ý tiêu đề/thumbnail AI để tăng khả năng khám phá và giữ chân người xem.
      </InfoBox>

      <div className="mb-6 flex space-x-1 sm:space-x-2 border-b border-gray-200 pb-3 flex-wrap">
        <TabButton tabId="description" label="1. Mô Tả & Timeline" />
        <TabButton tabId="keywords" label="2. Từ khóa" />
        <TabButton tabId="chapters" label="3. Chapters" />
        <TabButton tabId="titleThumbnailOptimizer" label="4. Tối Ưu Tiêu Đề & Thumbnail" />
      </div>

      {renderTabContent()}

      {isProcessing && activeSeoTab !== 'titleThumbnailOptimizer' && <LoadingSpinner message={loadingMessage!} />}
      {loadingMessage && !isProcessing && activeSeoTab !== 'titleThumbnailOptimizer' && (
            <p className={`text-center font-medium my-2 ${loadingMessage.includes("Lỗi") ? 'text-red-600' : 'text-indigo-600'}`}>
                {loadingMessage}
            </p>
      )}
      {error && activeSeoTab !== 'titleThumbnailOptimizer' && <ErrorAlert message={error} />}

      {currentResult && activeSeoTab !== 'description' && activeSeoTab !== 'titleThumbnailOptimizer' && !isProcessing && (
        <div className="mt-6 p-4 border rounded-lg bg-gray-50">
          <h3 className="text-lg font-semibold mb-2 text-gray-700">Kết quả (bằng {getSelectedLanguageLabel()}):</h3>
          <textarea value={currentResult} readOnly rows={10} className="w-full p-3 border-2 border-gray-200 rounded-md bg-white whitespace-pre-wrap leading-relaxed"></textarea>
          <button id={`copyBtn-${activeSeoTab}`} onClick={() => copyToClipboard(currentResult, `copyBtn-${activeSeoTab}`)} className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
            📋 Sao chép Kết quả
          </button>
        </div>
      )}

      {activeSeoTab === 'description' && youtubeDescription && !isProcessing && (
         <div className="mt-6 p-4 border rounded-lg bg-gray-50">
            <h3 className="text-lg font-semibold mb-2 text-gray-700">📋 Mô tả & Timeline đã tạo (bằng {getSelectedLanguageLabel()}):</h3>
            <textarea value={youtubeDescription} readOnly rows={15} className="w-full p-3 border-2 border-gray-200 rounded-md bg-white whitespace-pre-wrap leading-relaxed"></textarea>
            <button id="copySeoDescBtnMain" onClick={() => copyToClipboard(youtubeDescription, "copySeoDescBtnMain")} className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
              📋 Sao chép Mô tả
            </button>
          </div>
      )}
      {activeSeoTab === 'description' && youtubeTags && !isProcessing && (
            <div className="mt-4 p-4 border rounded-lg bg-gray-50">
                <h3 className="text-lg font-semibold mb-2 text-gray-700">🏷️ Tags gợi ý (bằng {getSelectedLanguageLabel()}):</h3>
                <textarea value={youtubeTags} readOnly rows={3} className="w-full p-3 border-2 border-gray-200 rounded-md bg-white whitespace-pre-wrap"></textarea>
                 <button id="copySeoTagsBtnMain" onClick={() => copyToClipboard(youtubeTags, "copySeoTagsBtnMain")} className="mt-3 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">
                    📋 Sao chép Tags
                </button>
            </div>
      )}
    </ModuleContainer>
  );
};

export default YoutubeSeoModule;
