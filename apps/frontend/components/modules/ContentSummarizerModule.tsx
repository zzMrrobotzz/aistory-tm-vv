import React, { useState, useRef, useEffect } from 'react';
import { ApiSettings, AiAssistantModuleState, AiAssistantInputType, GroundingChunk, ChatMessage } from '../../types';
import { generateText } from '../../services/textGenerationService';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { Youtube, FileText, Bot, User, Send, ChevronDown, ChevronUp, Copy, CopyCheck } from 'lucide-react';

interface ContentSummarizerModuleProps {
    apiSettings: ApiSettings;
    moduleState: AiAssistantModuleState;
    setModuleState: React.Dispatch<React.SetStateAction<AiAssistantModuleState>>;
}

const ContentSummarizerModule: React.FC<ContentSummarizerModuleProps> = ({
    apiSettings, moduleState, setModuleState
}) => {
    const {
        activeInputTab, youtubeLinkInput, textInput,
        processedSourceText, summary, chatHistory, groundingSources,
        currentQuestion, isLoading, isChatting, error
    } = moduleState;
    
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        // Scroll to the bottom of the chat container when new messages are added
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory]);

    const updateState = (updates: Partial<AiAssistantModuleState>) => {
        setModuleState(prev => ({ ...prev, ...updates }));
    };

    const handleAnalyze = async () => {
        let validationError = '';
        let sourceContent = '';
        let useSearch = false;

        if (activeInputTab === 'youtubeLink') {
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
        } else { // 'text'
            if (!textInput.trim()) {
                validationError = 'Vui lòng nhập văn bản.';
            } else {
                sourceContent = textInput.trim();
            }
        }

        if (validationError) {
            updateState({ error: validationError });
            return;
        }

        updateState({ 
            isLoading: true, 
            error: null, 
            summary: null, 
            chatHistory: [], 
            processedSourceText: null, 
            groundingSources: [] 
        });

        // This marker is a trick to ask the AI for two things in one call.
        const fullTextMarker = "---FULL_TEXT_BELOW---";
        const prompt = useSearch
            ? `Phân tích nội dung video YouTube tại URL sau để hiểu chủ đề và các điểm chính. Nhiệm vụ của bạn là trích xuất nội dung hoặc bản ghi của video.

URL YouTube: ${sourceContent}

Dựa trên thông tin bạn tìm được từ việc tìm kiếm về video này, thực hiện hai bước sau:
1. Viết một bản tóm tắt ngắn gọn về video bằng tiếng Việt.
2. Sau bản tóm tắt, thêm dấu hiệu "${fullTextMarker}" trên một dòng mới.
3. Sau dấu hiệu, cung cấp toàn bộ nội dung chi tiết hoặc bản ghi của video mà bạn có thể tìm được, cũng bằng tiếng Việt.

Nếu bạn không thể tìm thấy bản ghi, hãy nói "Không tìm thấy bản ghi chi tiết (transcript) cho video này." và cố gắng tạo một bản tóm tắt chi tiết về nội dung video dựa trên tiêu đề, mô tả và bất kỳ thông tin nào khác có sẵn từ tìm kiếm của bạn, và đặt bản tóm tắt chi tiết đó sau dấu hiệu thay vì bản ghi.`
            : `Đầu tiên, hãy cung cấp một bản tóm tắt ngắn gọn về văn bản sau. Sau đó, sau bản tóm tắt, thêm dấu hiệu "${fullTextMarker}" trên một dòng mới, theo sau là toàn bộ văn bản gốc.\n\nVăn bản:\n---\n${sourceContent}`;

        try {
            const result = await generateText(prompt, undefined, useSearch, apiSettings);
            let resultSummary = '';
            let fullText = '';
            
            if (result.text.includes(fullTextMarker)) {
                const parts = result.text.split(fullTextMarker);
                resultSummary = parts[0].trim();
                fullText = parts[1].trim();
            } else {
                // Fallback if the marker is not found
                resultSummary = result.text.trim();
                fullText = sourceContent; // Use the original input as the context
            }
            
            updateState({
                summary: resultSummary,
                processedSourceText: fullText,
                groundingSources: result.groundingChunks || [],
                chatHistory: [{
                    role: 'model',
                    message: "Phân tích hoàn tất! Tôi đã đọc và tóm tắt nội dung. Bạn có câu hỏi nào không?"
                }]
            });

        } catch (e) {
            updateState({ error: `Đã xảy ra lỗi khi phân tích: ${(e as Error).message}` });
        } finally {
            updateState({ isLoading: false });
        }
    };

    const handleSendMessage = async () => {
        if (!currentQuestion.trim() || isChatting || !processedSourceText) return;

        const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', message: currentQuestion.trim() }];
        updateState({ isChatting: true, chatHistory: newHistory, currentQuestion: '' });

        try {
            const systemInstruction = `Bạn là một trợ lý AI hữu ích. Bạn đã được cung cấp một văn bản để phân tích. Vai trò chính của bạn là trả lời câu hỏi dựa **hoàn toàn** trên ngữ cảnh văn bản được cung cấp. Nếu người dùng hỏi câu hỏi không thể trả lời từ văn bản, hãy nói rằng bạn không có thông tin đó trong tài liệu được cung cấp. Nếu người dùng hỏi về trợ giúp chung về công cụ, bạn có thể trả lời điều đó. Câu hỏi của người dùng có thể bằng tiếng Việt, hãy trả lời bằng tiếng Việt.`;
            
            const prompt = `NGỮ CẢNH:\n---\n${processedSourceText}\n---\n\nDựa trên ngữ cảnh trên, trả lời câu hỏi sau của người dùng:\n\nCÂU HỎI: ${currentQuestion.trim()}`;

            const result = await generateText(prompt, systemInstruction, false, apiSettings);
            
            updateState({
                chatHistory: [...newHistory, { role: 'model', message: result.text.trim() }]
            });

        } catch (e) {
            const errorMessage = `Lỗi khi trả lời: ${(e as Error).message}`;
            updateState({ 
                chatHistory: [...newHistory, { role: 'model', message: `Xin lỗi, tôi gặp lỗi khi xử lý câu hỏi của bạn. (${errorMessage})` }]
            });
        } finally {
            updateState({ isChatting: false });
        }
    };

    const handleCopy = (text: string | null) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const TabButton: React.FC<{ tabId: AiAssistantInputType; label: string; icon: React.ElementType }> = ({ tabId, label, icon: Icon }) => (
        <button
            onClick={() => updateState({ activeInputTab: tabId })}
            className={`flex-1 flex justify-center items-center space-x-2 px-4 py-3 font-medium text-base transition-colors rounded-t-lg ${
                activeInputTab === tabId ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
            disabled={isLoading}
        >
            <Icon size={18} />
            <span>{label}</span>
        </button>
    );

    return (
        <ModuleContainer title="🤖 Tóm Tắt Nội Dung & Trợ Lý AI">
            <InfoBox>
                <p><strong>Trợ lý AI tóm tắt nội dung thông minh.</strong> Cung cấp link YouTube hoặc văn bản để AI tóm tắt và bắt đầu cuộc trò chuyện để hỏi-đáp chi tiết về nội dung.</p>
            </InfoBox>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
                {/* Left Panel: Input */}
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 flex flex-col">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">1. Cung cấp Nội dung</h3>
                    <div className="flex border-b">
                        <TabButton tabId="youtubeLink" label="Link YouTube" icon={Youtube} />
                        <TabButton tabId="text" label="Văn bản" icon={FileText} />
                    </div>
                    <div className="py-4 flex-grow">
                        {activeInputTab === 'youtubeLink' && (
                            <input 
                                type="url" 
                                value={youtubeLinkInput} 
                                onChange={e => updateState({ youtubeLinkInput: e.target.value })} 
                                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" 
                                placeholder="Dán link video YouTube vào đây..." 
                                disabled={isLoading} 
                            />
                        )}
                        {activeInputTab === 'text' && (
                            <textarea 
                                value={textInput} 
                                onChange={e => updateState({ textInput: e.target.value })} 
                                rows={10} 
                                className="w-full p-3 border-2 border-gray-300 rounded-lg resize-y focus:ring-2 focus:ring-indigo-500 focus:border-transparent" 
                                placeholder="Dán nội dung truyện, kịch bản, bài báo để tóm tắt và phân tích..." 
                                disabled={isLoading}>
                            </textarea>
                        )}
                    </div>
                     <button 
                        onClick={handleAnalyze} 
                        disabled={isLoading} 
                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-auto">
                        {isLoading ? 'Đang Phân Tích...' : 'Phân Tích & Bắt Đầu Chat'}
                    </button>
                </div>

                {/* Right Panel: Output */}
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 flex flex-col min-h-[500px]">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">2. Tóm tắt & Trò chuyện</h3>
                    {isLoading ? (
                        <div className="flex-grow flex items-center justify-center">
                            <LoadingSpinner message="AI đang đọc và phân tích nội dung..." />
                        </div>
                    ) : error ? (
                        <ErrorAlert message={error} />
                    ) : !summary ? (
                        <div className="flex-grow flex items-center justify-center text-center text-gray-500">
                           <p>Kết quả tóm tắt và cửa sổ chat sẽ hiện ở đây sau khi bạn phân tích nội dung.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col flex-grow h-full overflow-hidden">
                             <details open={isSummaryExpanded} onToggle={(e) => setIsSummaryExpanded((e.target as HTMLDetailsElement).open)} className="mb-4">
                                <summary className="font-semibold text-gray-700 cursor-pointer flex justify-between items-center p-2 rounded-md hover:bg-gray-100 transition-colors">
                                    <span>📋 Bản Tóm Tắt Nội Dung</span>
                                    {isSummaryExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </summary>
                                <div className="mt-2 p-3 bg-gray-50 border rounded-md text-sm text-gray-800 relative">
                                    <p className="whitespace-pre-wrap leading-relaxed">{summary}</p>
                                    <button 
                                        onClick={() => handleCopy(summary)} 
                                        className="absolute top-2 right-2 p-1.5 text-gray-500 hover:bg-gray-200 rounded-full transition-colors" 
                                        title="Sao chép tóm tắt">
                                        {isCopied ? <CopyCheck size={14} className="text-green-600"/> : <Copy size={14} />}
                                    </button>
                                </div>
                            </details>
                            
                            {/* Chat Window */}
                            <div ref={chatContainerRef} className="flex-grow overflow-y-auto pr-2 space-y-4 mb-4 border-t pt-4">
                                {chatHistory.map((chat, index) => (
                                    <div key={index} className={`flex items-start gap-3 ${chat.role === 'user' ? 'justify-end' : ''}`}>
                                        {chat.role === 'model' && <div className="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-500 text-white flex items-center justify-center"><Bot size={16}/></div>}
                                        <div className={`max-w-[80%] p-3 rounded-xl ${chat.role === 'user' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-200 text-gray-800 rounded-bl-none'}`}>
                                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{chat.message}</p>
                                        </div>
                                         {chat.role === 'user' && <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-500 text-white flex items-center justify-center"><User size={16}/></div>}
                                    </div>
                                ))}
                                {isChatting && (
                                     <div className="flex items-start gap-3">
                                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-500 text-white flex items-center justify-center"><Bot size={16}/></div>
                                        <div className="max-w-[80%] p-3 rounded-xl bg-gray-200 text-gray-800 rounded-bl-none">
                                            <p className="text-sm animate-pulse">AI đang soạn câu trả lời...</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* Chat Input */}
                            <div className="mt-auto flex items-center space-x-2">
                                <input 
                                    type="text"
                                    value={currentQuestion}
                                    onChange={e => updateState({ currentQuestion: e.target.value })}
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                                    className="flex-grow p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    placeholder="Đặt câu hỏi về nội dung..."
                                    disabled={isChatting}
                                />
                                <button 
                                    onClick={handleSendMessage} 
                                    disabled={isChatting || !currentQuestion.trim()} 
                                    className="p-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </ModuleContainer>
    );
};

export default ContentSummarizerModule;