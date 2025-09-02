import React, { useState, useEffect } from 'react';
import { ApiSettings, ShortFormScriptModuleState, ShortFormScriptInputType, GroundingChunk, HistoryItem, ActiveModule } from '../../types';
import {
    HOOK_LANGUAGE_OPTIONS,
    SCRIPT_PLATFORM_OPTIONS,
    SCRIPT_VIDEO_STYLE_OPTIONS,
    SCRIPT_TARGET_DURATION_OPTIONS,
    SCRIPT_STRUCTURE_OPTIONS
} from '../../constants';
import { generateText } from '../../services/textGenerationService';
import { checkAndTrackRequest, REQUEST_ACTIONS } from '../../services/requestTrackingService';
import { isSubscribed } from '../../utils';
import UpgradePrompt from '../UpgradePrompt';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { Lightbulb, Youtube, BookOpen, Clipboard, ClipboardCheck } from 'lucide-react';

interface ShortFormScriptModuleProps {
    apiSettings: ApiSettings;
    moduleState: ShortFormScriptModuleState;
    setModuleState: React.Dispatch<React.SetStateAction<ShortFormScriptModuleState>>;
    addHistoryItem: (itemData: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
    currentUser?: any;
}

const ShortFormScriptModule: React.FC<ShortFormScriptModuleProps> = ({
    apiSettings, moduleState, setModuleState, addHistoryItem, currentUser
}) => {
    const {
        activeInputTab, ideaInput, youtubeLinkInput, storyInput,
        platform, videoStyle, customVideoStyle, targetDuration, structure, outputLanguage,
        generatedScript, groundingSources, isLoading, progressMessage, error
    } = moduleState;

    const [isCopied, setIsCopied] = useState(false);
    
    // Subscription check
    const hasActiveSubscription = isSubscribed(currentUser);
    
    // Usage tracking state
    const [usageStats, setUsageStats] = useState({ current: 0, limit: 1000, remaining: 1000, percentage: 0, isBlocked: false } as any);
    
    useEffect(() => {
        const fetchUsage = async () => {
            try {
                const result = await checkAndTrackRequest('module-access');
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
            } catch (error) {
                console.warn('Error loading usage stats:', error);
            }
        };
        fetchUsage();
    }, []);

    const updateState = (updates: Partial<ShortFormScriptModuleState>) => {
        setModuleState(prev => ({ ...prev, ...updates }));
    };

    const handleGenerateScript = async () => {
        let validationError = '';
        let sourceContent = '';
        let useSearch = false;

        if (activeInputTab === 'idea' && !ideaInput.trim()) {
            validationError = 'Vui lòng nhập ý tưởng hoặc tóm tắt.';
        } else if (activeInputTab === 'youtubeLink') {
            if (!youtubeLinkInput.trim()) {
                validationError = 'Vui lòng nhập link video YouTube.';
            } else {
                try {
                    new URL(youtubeLinkInput);
                    sourceContent = youtubeLinkInput.trim();
                    useSearch = true;
                } catch (_) {
                    validationError = 'Link YouTube không hợp lệ.';
                }
            }
        } else if (activeInputTab === 'story' && !storyInput.trim()) {
            validationError = 'Vui lòng nhập nội dung truyện để chuyển thể.';
        }

        if (videoStyle === 'custom' && !customVideoStyle.trim()) {
            validationError = 'Vui lòng nhập phong cách video tùy chỉnh.';
        }

        if (validationError) {
            updateState({ error: validationError });
            return;
        }

        // Check subscription
        if (!hasActiveSubscription) {
            updateState({ error: 'Cần nâng cấp gói đăng ký để sử dụng tính năng này.' });
            return;
        }
        
        // Check and track request with backend
        const rateLimitCheck = await checkAndTrackRequest(REQUEST_ACTIONS.SHORT_FORM_SCRIPT);
        if (!rateLimitCheck.success) {
            updateState({ 
                error: rateLimitCheck.message || 'Đã vượt quá giới hạn sử dụng hôm nay. Vui lòng nâng cấp gói hoặc thử lại vào ngày mai.'
            });
            return;
        }
        
        // Update UI with latest usage stats from backend
        if (rateLimitCheck?.usage) {
            setUsageStats({
                current: rateLimitCheck.usage.current,
                limit: rateLimitCheck.usage.limit,
                remaining: rateLimitCheck.usage.remaining,
                percentage: rateLimitCheck.usage.percentage,
                canUse: rateLimitCheck.usage.current < rateLimitCheck.usage.limit,
                isBlocked: !!rateLimitCheck.blocked
            });
        }

        updateState({ isLoading: true, error: null, progressMessage: 'Đang chuẩn bị...', generatedScript: '', groundingSources: [] });

        const platformLabel = SCRIPT_PLATFORM_OPTIONS.find(p => p.value === platform)?.label || platform;
        const durationLabel = SCRIPT_TARGET_DURATION_OPTIONS.find(d => d.value === targetDuration)?.label || targetDuration;
        const styleLabel = videoStyle === 'custom' ? customVideoStyle : SCRIPT_VIDEO_STYLE_OPTIONS.find(s => s.value === videoStyle)?.label || videoStyle;
        const structureLabel = SCRIPT_STRUCTURE_OPTIONS.find(s => s.value === structure)?.label || structure;
        const languageLabel = HOOK_LANGUAGE_OPTIONS.find(l => l.value === outputLanguage)?.label || outputLanguage;
        
        let inputSection = '';
        let titleForHistory = '';
        let restoreContextForHistory: any = {};
        
        switch (activeInputTab) {
            case 'idea':
                inputSection = `**INPUT SOURCE (User's Core Idea):**\n---\n${ideaInput.trim()}\n---`;
                titleForHistory = `Kịch bản từ ý tưởng: ${ideaInput.substring(0, 40)}...`;
                restoreContextForHistory = { ideaInput: ideaInput };
                updateState({ progressMessage: 'Đang biến ý tưởng thành kịch bản...' });
                break;
            case 'story':
                inputSection = `**INPUT SOURCE (Long-form Story to Adapt):**\n---\n${storyInput.trim()}\n---\n**Adaptation Task:** Adapt this story into a concise, high-impact short video script. Do not try to include every detail; instead, find the most compelling hook, conflict, and resolution to feature.`;
                titleForHistory = `Kịch bản từ truyện: ${storyInput.substring(0, 40)}...`;
                restoreContextForHistory = { storyInput: storyInput };
                updateState({ progressMessage: 'Đang chuyển thể truyện thành kịch bản...' });
                break;
            case 'youtubeLink':
                inputSection = `**INPUT SOURCE (YouTube Video for Inspiration):**\nYouTube URL: ${youtubeLinkInput.trim()}\n\n**Inspiration Task:**\n1. Analyze the content, key points, and storytelling style of the video at the provided URL using your search capabilities.\n2. DO NOT simply summarize the video.\n3. Your mission is to create a BRAND NEW, ORIGINAL short video script that is INSPIRED BY the theme, topic, or a key message from the source video.\n4. The new script should be fresh, engaging, and structured according to the other requirements (platform, style, duration, etc.). It should tell its own short story or present the information in a new, creative way.`;
                titleForHistory = `Kịch bản từ Link YT: ${youtubeLinkInput.substring(0, 40)}...`;
                restoreContextForHistory = { youtubeLinkInput: youtubeLinkInput };
                updateState({ progressMessage: 'Đang phân tích video YouTube và sáng tạo kịch bản mới...' });
                break;
        }

        const prompt = `
You are a world-class viral video scriptwriter and director for short-form video platforms. Your task is to create a complete, production-ready script based on the user's input.

The script must be structured with clear scenes (PHÂN CẢNH). Each scene must detail the following elements in ${languageLabel}:
- **VISUAL (Hình ảnh):** Describe camera shots (e.g., Cận cảnh, Toàn cảnh), character actions, and setting.
- **TEXT OVERLAY (Chữ trên màn hình):** Suggest on-screen text to grab attention and provide context.
- **VOICEOVER / DIALOGUE (Lời thoại / Lời đọc):** The spoken words.
- **SFX (Hiệu ứng âm thanh):** Suggest sound effects (e.g., *whoosh*, *ding*).
- **MUSIC (Nhạc nền):** Suggest the type of background music (e.g., Nhạc nền kịch tính, Nhạc lofi buồn).

**SCRIPT REQUIREMENTS:**
- **Target Platform:** Optimize the pacing and style for ${platformLabel}.
- **Target Duration:** Aim for a script that fits a ${durationLabel} video.
- **Video Style:** The tone must be "${styleLabel}".
- **Structure:** Follow the "${structureLabel}" model.
- **Language:** The entire script (all elements) MUST be written in ${languageLabel}.

${inputSection}

Now, generate the complete script.
`;

        try {
            const result = await generateText(prompt, undefined, useSearch, apiSettings, 'short-form-script');
            const finalScript = result.text;

            updateState({
                generatedScript: finalScript,
                groundingSources: result.groundingChunks || [],
                isLoading: false,
                progressMessage: 'Tạo kịch bản thành công!',
            });

            // Add to history
            addHistoryItem({
                module: ActiveModule.ShortFormScript,
                moduleLabel: 'Kịch Bản Video Ngắn',
                title: titleForHistory,
                content: finalScript,
                contentType: 'text',
                restoreContext: {
                    ...restoreContextForHistory, 
                    activeInputTab: activeInputTab // Save the tab context
                }
            });

        } catch (e) {
            updateState({
                error: `Đã xảy ra lỗi: ${(e as Error).message}`,
                isLoading: false,
                progressMessage: 'Tạo kịch bản thất bại.'
            });
        } finally {
            setTimeout(() => {
                setModuleState(prev => ({...prev, progressMessage: null}));
            }, 3000);
        }
    };
    
    const handleCopy = () => {
        if (!generatedScript) return;
        navigator.clipboard.writeText(generatedScript);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const TabButton: React.FC<{ tabId: ShortFormScriptInputType; label: string; icon: React.ElementType }> = ({ tabId, label, icon: Icon }) => (
        <button
            onClick={() => updateState({ activeInputTab: tabId })}
            className={`flex items-center space-x-2 px-4 py-3 font-medium rounded-t-lg text-base transition-colors ${
                activeInputTab === tabId ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            disabled={isLoading}
        >
            <Icon size={18} />
            <span>{label}</span>
        </button>
    );

    return (
        <ModuleContainer title="🎬 Xưởng Kịch Bản Video Ngắn">
            <InfoBox>
                <p><strong>💡 Hướng dẫn:</strong></p>
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1 text-sm">
                    <li><strong>Bước 1:</strong> Thiết lập các tùy chọn cho kịch bản của bạn trong phần "Cài đặt Chung".</li>
                    <li><strong>Bước 2:</strong> Chọn một nguồn ý tưởng từ các tab bên dưới (Ý tưởng, Link YouTube, hoặc Chuyển thể Truyện).</li>
                    <li><strong>Bước 3:</strong> Nhấn nút "Tạo Kịch Bản Viral" và xem AI biến ý tưởng của bạn thành một kịch bản video ngắn chuyên nghiệp, sẵn sàng để sản xuất!</li>
                </ul>
            </InfoBox>

            {/* Subscription Check */}
            {!hasActiveSubscription && (
                <UpgradePrompt 
                    message="🔒 Tính năng Xưởng Kịch Bản Video Ngắn dành riêng cho thành viên có gói đăng ký. Nâng cấp để truy cập tính năng này và tạo ra những kịch bản video viral chuyên nghiệp!" 
                />
            )}

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

            {/* Settings */}
            <div className="space-y-6 p-6 border-2 border-gray-200 rounded-lg bg-gray-50 shadow my-8">
                <h3 className="text-xl font-semibold text-gray-800">Cài đặt Chung cho Kịch bản</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nền tảng mục tiêu:</label>
                        <select value={platform} onChange={e => updateState({ platform: e.target.value as any })} className="w-full p-2 border border-gray-300 rounded-md" disabled={!hasActiveSubscription || isLoading || usageStats.isBlocked}>
                            {SCRIPT_PLATFORM_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phong cách Video:</label>
                        <select value={videoStyle} onChange={e => updateState({ videoStyle: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" disabled={!hasActiveSubscription || isLoading || usageStats.isBlocked}>
                            {SCRIPT_VIDEO_STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                    {videoStyle === 'custom' && (
                        <div>
                             <label className="block text-sm font-medium text-gray-700 mb-1">Phong cách tùy chỉnh:</label>
                             <input type="text" value={customVideoStyle} onChange={e => updateState({ customVideoStyle: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" placeholder="Ví dụ: Kể chuyện kiểu phim tài liệu" disabled={!hasActiveSubscription || isLoading || usageStats.isBlocked}/>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Thời lượng mục tiêu:</label>
                        <select value={targetDuration} onChange={e => updateState({ targetDuration: e.target.value as any })} className="w-full p-2 border border-gray-300 rounded-md" disabled={!hasActiveSubscription || isLoading || usageStats.isBlocked}>
                            {SCRIPT_TARGET_DURATION_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cấu trúc Kịch bản:</label>
                        <select value={structure} onChange={e => updateState({ structure: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" disabled={!hasActiveSubscription || isLoading || usageStats.isBlocked}>
                            {SCRIPT_STRUCTURE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ Kịch bản:</label>
                        <select value={outputLanguage} onChange={e => updateState({ outputLanguage: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" disabled={!hasActiveSubscription || isLoading || usageStats.isBlocked}>
                            {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                </div>
            </div>
            
            {/* Input Tabs */}
            <div className="mb-4 flex flex-wrap gap-1 border-b-2 border-gray-300">
                <TabButton tabId="idea" label="Ý tưởng / Tóm tắt" icon={Lightbulb} />
                <TabButton tabId="youtubeLink" label="Link YouTube" icon={Youtube} />
                <TabButton tabId="story" label="Chuyển thể Truyện" icon={BookOpen} />
            </div>

            <div className="p-4 border rounded-lg bg-white shadow-sm">
                {activeInputTab === 'idea' && (
                    <textarea value={ideaInput} onChange={e => updateState({ ideaInput: e.target.value })} rows={5} className="w-full p-2 border border-gray-300 rounded-md" placeholder="Nhập ý tưởng cốt lõi, chủ đề, hoặc tóm tắt ngắn gọn..." disabled={!hasActiveSubscription || isLoading || usageStats.isBlocked} />
                )}
                {activeInputTab === 'youtubeLink' && (
                    <input type="url" value={youtubeLinkInput} onChange={e => updateState({ youtubeLinkInput: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" placeholder="Dán link video YouTube vào đây, ví dụ: https://www.youtube.com/watch?v=..." disabled={!hasActiveSubscription || isLoading || usageStats.isBlocked} />
                )}
                {activeInputTab === 'story' && (
                    <textarea value={storyInput} onChange={e => updateState({ storyInput: e.target.value })} rows={10} className="w-full p-2 border border-gray-300 rounded-md" placeholder="Dán toàn bộ câu chuyện dài của bạn vào đây. AI sẽ chắt lọc những phần hay nhất để tạo kịch bản." disabled={!hasActiveSubscription || isLoading || usageStats.isBlocked} />
                )}
            </div>
            
            <button onClick={handleGenerateScript} disabled={!hasActiveSubscription || isLoading || usageStats.isBlocked} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50">
                {!hasActiveSubscription ? '🔒 Cần Nâng cấp Gói' : usageStats.isBlocked ? '🚫 Đã đạt giới hạn' : (isLoading ? 'Đang Sáng Tạo...' : '🚀 Tạo Kịch Bản Viral')}
            </button>

            {isLoading && <LoadingSpinner message={progressMessage || "Đang xử lý..."} />}
            {error && <ErrorAlert message={error} />}

            {generatedScript && (
                <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold text-gray-700">Kịch Bản Đã Tạo:</h3>
                        <button onClick={handleCopy} className="flex items-center space-x-1 px-3 py-1 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600">
                            {isCopied ? <ClipboardCheck size={14} /> : <Clipboard size={14} />}
                            <span>{isCopied ? 'Đã sao chép!' : 'Sao chép'}</span>
                        </button>
                    </div>
                    <textarea value={generatedScript} readOnly rows={20} className="w-full p-3 border-2 border-gray-200 rounded-md bg-white whitespace-pre-wrap leading-relaxed font-mono text-sm"></textarea>
                </div>
            )}
             {groundingSources.length > 0 && !isLoading && (
                <div className="mt-4 p-3 bg-gray-100 border rounded-md">
                    <h4 className="text-sm font-semibold text-gray-600 mb-1">Nguồn Tham Khảo (AI đã dùng Google Search để phân tích link YouTube):</h4>
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
        </ModuleContainer>
    );
};

export default ShortFormScriptModule;
