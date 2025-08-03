import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, Minimize2, Maximize2 } from 'lucide-react';

interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  isTyping?: boolean;
}

interface SupportChatbotProps {
  currentUser?: any;
}

const SupportChatbot: React.FC<SupportChatbotProps> = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      content: 'Xin chào! 👋 Tôi là trợ lý AI chuyên biệt của AI Story Creator!\n\nTôi hiểu rõ tất cả 10 module của tool và có thể:\n\n✨ Giải thích chi tiết cách hoạt động của từng tính năng\n📚 Hướng dẫn workflow tối ưu cho mục đích cụ thể\n🔧 Hỗ trợ troubleshoot các vấn đề kỹ thuật\n💡 Tư vấn chiến lược sử dụng hiệu quả\n🎯 Đưa ra case studies thực tế\n\nBạn muốn tìm hiểu về tính năng nào của AI Story Creator? 🚀',
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setHasNewMessage(false);
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const quickActions = [
    '🚀 Giải thích tất cả 10 tính năng chính',
    '✍️ Workflow viết truyện hoàn chỉnh',
    '🔑 Cài đặt API Key từng bước',
    '🎨 Tạo hình ảnh AI chuyên nghiệp',
    '💰 So sánh gói Free vs Premium',
    '🎯 Bí quyết prompt engineering',
    '📺 Làm YouTube content với AI',
    '🛠️ Troubleshooting & FAQ',
    '🌟 Case study: Viral content strategy',
    '🎵 Tạo audiobook từ text'
  ];

  const getSmartResponse = (userMessage: string): string => {
    const msg = userMessage.toLowerCase();
    
    // Phân tích chức năng cụ thể
    if (msg.includes('siêu trợ lý') || msg.includes('super assistant')) {
      return `🚀 **SIÊU TRỢ LÝ AI** - Module đa năng nhất!\n\n**Chức năng:**\n• Trợ lý AI thông minh, trả lời mọi câu hỏi\n• Brainstorm ý tưởng sáng tạo không giới hạn\n• Tư vấn chiến lược content marketing\n• Phân tích xu hướng và đưa ra insights\n\n**Cách sử dụng:**\n1. Mở module "Siêu Trợ Lý AI"\n2. Nhập câu hỏi hoặc chủ đề cần brainstorm\n3. AI sẽ đưa ra câu trả lời chi tiết và đa chiều\n\n**Ví dụ prompt:**\n• "Gợi ý 10 ý tưởng video YouTube về công nghệ AI"\n• "Phân tích xu hướng truyện ngôn tình 2024"\n• "Tư vấn chiến lược content cho thương hiệu thời trang"\n\n💡 **Pro tip:** Hỏi càng cụ thể, câu trả lời càng chính xác!`;
    }
    
    if (msg.includes('dàn ý') || msg.includes('outline')) {
      return `📝 **XÂY DÀN Ý TRUYỆN** - Từ ý tưởng thành cấu trúc!\n\n**Chức năng:**\n• Tạo outline chi tiết từ ý tưởng cơ bản\n• Phân tích cấu trúc 3 hồi phim kinh điển\n• Gợi ý plot twist và conflict\n• Phát triển nhân vật đa chiều\n\n**Workflow:**\n1. Mô tả ý tưởng truyện cơ bản\n2. Chọn thể loại (romance, thriller, fantasy...)\n3. AI tạo dàn ý có: mở đầu → phát triển → climax → kết thúc\n4. Refine và điều chỉnh theo ý muốn\n\n**Output:**\n• Cấu trúc chương hoặc phần\n• Character development arc\n• Key plot points và turning points\n• Subplot suggestions\n\n🎯 **Best practice:** Cung cấp context về target audience và message chính!`;
    }
    
    if (msg.includes('viết truyện') || msg.includes('write story')) {
      return `✍️ **VIẾT TRUYỆN** - AI author của bạn!\n\n**Khả năng:**\n• Viết truyện hoàn chỉnh theo yêu cầu\n• Hỗ trợ mọi thể loại: Romance, Fantasy, Thriller, Comedy...\n• Tùy chỉnh độ dài: từ flash fiction đến novel\n• Kiểm soát tone: hài hước, nghiêm túc, lãng mạn...\n\n**Cách dùng hiệu quả:**\n1. Cung cấp premise rõ ràng\n2. Mô tả nhân vật chính\n3. Chọn POV (góc nhìn thứ nhất/ba)\n4. Specify word count mong muốn\n\n**Pro prompts:**\n• "Viết chap 1 novel romance 2000 từ về CEO lạnh lùng gặp intern dễ thương"\n• "Tạo short story thriller 1500 từ về thám tử điều tra vụ án bí ẩn"\n\n⚡ **Tip:** Combine với module "Dàn Ý" để có structure hoàn hảo trước khi viết!`;
    }
    
    if (msg.includes('viết lại') || msg.includes('rewrite')) {
      return `🔄 **VIẾT LẠI** - Polish content đến hoàn hảo!\n\n**Tính năng:**\n• Cải thiện văn phong và flow\n• Thay đổi tone: formal ↔ casual, serious ↔ humorous\n• Fix lỗi ngữ pháp và chính tả\n• Optimize readability và engagement\n\n**Use cases:**\n• Paraphrase để tránh duplicate content\n• Adapt nội dung cho different audiences\n• Improve clarity và impact\n• Shorten/expand theo yêu cầu\n\n**Workflow:**\n1. Paste nội dung cần edit\n2. Specify yêu cầu cụ thể (formal hơn, ngắn gọn hơn...)\n3. AI rewrite với style mới\n4. So sánh và chọn version tốt nhất\n\n💎 **Advanced tip:** Sử dụng để A/B test different versions của content quan trọng!`;
    }
    
    if (msg.includes('phân tích') || msg.includes('analysis')) {
      return `📊 **PHÂN TÍCH NỘI DUNG** - Đánh giá chất lượng khoa học!\n\n**Metrics:**\n• Readability score (Flesch-Kincaid)\n• Sentiment analysis (positive/negative/neutral)\n• Keyword density và SEO potential\n• Engagement prediction\n• Target audience fit\n\n**Báo cáo chi tiết:**\n• Điểm số tổng thể /100\n• Breakdown theo từng tiêu chí\n• Suggestions cụ thể để improve\n• Competitor comparison (nếu có)\n\n**Ứng dụng:**\n• Quality check trước khi publish\n• Optimize content cho platform cụ thể\n• A/B testing analysis\n• Brand voice consistency check\n\n🔍 **Pro insight:** Dùng để understand why content works hoặc không work!`;
    }
    
    if (msg.includes('text to speech') || msg.includes('tts') || msg.includes('âm thanh')) {
      return `🎵 **TEXT-TO-SPEECH** - Chuyển text thành audio chất lượng studio!\n\n**Voices available:**\n• OpenAI TTS: Natural, đa cảm xúc\n• ElevenLabs: Premium, ultra realistic\n• Nhiều giọng nam/nữ với accents khác nhau\n\n**Output formats:**\n• MP3 (compressed, web-friendly)\n• WAV (uncompressed, studio quality)\n• Adjustable speed và pitch\n\n**Perfect cho:**\n• Audiobook creation\n• Podcast intros/outros\n• Voice-over cho videos\n• Accessibility features\n\n**Workflow:**\n1. Input text (max 5000 chars/request)\n2. Chọn voice và settings\n3. Preview trước khi generate\n4. Download high-quality audio\n\n🎙️ **Pro tip:** Break long content thành chunks để có control tốt hơn về pacing!`;
    }
    
    if (msg.includes('youtube') || msg.includes('seo')) {
      return `📺 **YOUTUBE SEO** - Viral content optimizer!\n\n**Tối ưu hóa:**\n• Title: Hook + Keywords + Emotion triggers\n• Description: SEO-friendly với timestamps\n• Tags: Mix broad + niche keywords\n• Thumbnail ideas: Click-worthy concepts\n\n**Research tools:**\n• Keyword volume analysis\n• Competitor title analysis\n• Trending topics suggestion\n• Best posting times\n\n**Strategy framework:**\n1. Audience research\n2. Keyword planning\n3. Content optimization\n4. Performance tracking\n\n**Ví dụ output:**\n• 10 title variations A/B test\n• SEO description template\n• 30 relevant tags\n• Thumbnail style suggestions\n\n📈 **Growth hack:** Combine với "Tạo Tiêu Đề Viral" để maximize reach!`;
    }
    
    if (msg.includes('tiêu đề') || msg.includes('title') || msg.includes('viral')) {
      return `💡 **TẠO TIÊU ĐỀ VIRAL** - Click magnet generator!\n\n**Psychology triggers:**\n• Curiosity gaps: "Điều này sẽ làm bạn bất ngờ..."\n• Fear of missing out: "Chỉ 5% người biết bí mật này"\n• Emotional hooks: Numbers, superlatives, urgency\n\n**Formats hiệu quả:**\n• How-to: "Cách làm X trong Y phút"\n• Lists: "7 bí quyết để..."\n• Questions: "Tại sao X lại quan trọng?"\n• Contrarian: "Ngừng làm X ngay lập tức"\n\n**A/B testing:**\n• Generate 10+ variations\n• Test trên platforms khác nhau\n• Track CTR và engagement\n• Optimize based on data\n\n🚀 **Viral formula:** Number + Adjective + Keyword + Benefit + Urgency`;
    }
    
    if (msg.includes('hình ảnh') || msg.includes('image') || msg.includes('ảnh')) {
      return `🎨 **TẠO HÌNH ẢNH AI** - Visual content creator!\n\n**Styles available:**\n• Photorealistic: Như ảnh thật\n• Anime/Manga: Japanese art style\n• Digital art: Modern illustration\n• Oil painting: Classical art\n• Minimalist: Clean, simple design\n\n**Prompt engineering:**\n• Describe chủ thể chính\n• Specify style và mood\n• Add technical details (lighting, camera angle)\n• Include negative prompts (avoid unwanted elements)\n\n**Ví dụ prompts:**\n• "Beautiful woman reading book in cozy cafe, warm lighting, anime style"\n• "Futuristic city skyline at sunset, cyberpunk, neon lights, 4K quality"\n\n**Output options:**\n• Multiple ratios: Square, portrait, landscape\n• High resolution up to 2K\n• Batch generation\n\n🎭 **Creative tip:** Combine multiple styles để tạo unique aesthetic!`;
    }
    
    if (msg.includes('dịch') || msg.includes('translate') || msg.includes('translation')) {
      return `🌍 **DỊCH THUẬT AI** - Breaking language barriers!\n\n**50+ Languages:**\n• Asian: Việt, English, 中文, 日本語, 한국어\n• European: Français, Deutsch, Español, Italiano\n• Và nhiều ngôn ngữ khác...\n\n**Smart features:**\n• Context-aware translation\n• Tone preservation (formal/casual)\n• Cultural adaptation\n• Technical term accuracy\n\n**Specialized translation:**\n• Literary works (giữ nguyên style)\n• Business documents (formal tone)\n• Creative content (adapt cho audience mới)\n• Technical manuals (accuracy-focused)\n\n**Quality assurance:**\n• Native-level fluency\n• Cultural appropriateness\n• Consistency checking\n• Back-translation verification\n\n🌏 **Global strategy:** Translate → Localize → Optimize cho từng market!`;
    }
    
    // API và technical questions
    if (msg.includes('api') || msg.includes('key') || msg.includes('cài đặt')) {
      return `🔑 **HƯỚNG DẪN CÀI ĐẶT API** - Step by step setup!\n\n**Recommended để bắt đầu:**\n🆓 **Gemini AI (Google):**\n1. Vào console.cloud.google.com\n2. Tạo project mới\n3. Enable Gemini API\n4. Generate API key\n5. Copy vào AI Story Creator\n\n**For advanced users:**\n💎 **OpenAI GPT:**\n• Highest quality results\n• Tốt cho creative writing\n• Pay-per-use pricing\n\n🧠 **Claude:**\n• Excellent analysis capabilities\n• Great for complex reasoning\n• Anthropic's latest model\n\n**Troubleshooting:**\n❌ "Invalid API key" → Check key format\n❌ "Rate limit" → Upgrade plan hoặc wait\n❌ "Connection error" → Check internet/firewall\n\n💡 **Pro tip:** Start với Gemini free tier để familiar với workflow!`;
    }
    
    if (msg.includes('gói') || msg.includes('price') || msg.includes('premium') || msg.includes('lifetime')) {
      return `💰 **GÓI CƯỚC AI STORY CREATOR**\n\n🆓 **FREE PLAN:**\n• 10 requests/day per module\n• Basic features\n• Watermark trên exports\n• Community support\n• Perfect để test và familiar\n\n💳 **MONTHLY PREMIUM:**\n• Unlimited requests all modules\n• No watermarks\n• Priority processing\n• Advanced features unlock\n• Email support\n• Export high-quality files\n\n💎 **LIFETIME DEAL:**\n• One-time payment\n• All current + future features\n• Unlimited usage forever\n• VIP support channel\n• Early access to new modules\n• Best value for serious creators\n\n**ROI Calculator:**\n• Thay thế 5+ tools khác\n• Save 20+ hours/week\n• Professional quality output\n• Scalable cho team\n\n🎯 **Recommendation:** Start free → upgrade khi cần more volume!`;
    }
    
    // Workflow và tips
    if (msg.includes('workflow') || msg.includes('quy trình') || msg.includes('cách dùng')) {
      return `🎯 **WORKFLOW TỐI ƯU CHO CÁC MỤC ĐÍCH:**\n\n📚 **Viết Novel:**\n1. Siêu Trợ Lý → Brainstorm premise\n2. Dàn Ý → Create detailed outline\n3. Viết Truyện → Generate chapters\n4. Viết Lại → Polish và refine\n5. Phân Tích → Quality check\n6. TTS → Create audiobook version\n\n📺 **YouTube Content:**\n1. Siêu Trợ Lý → Video ideas\n2. Viết Truyện → Script writing\n3. YouTube SEO → Optimize metadata\n4. Tiêu Đề Viral → Create hooks\n5. Hình Ảnh → Thumbnail design\n6. TTS → Voice-over production\n\n📱 **Social Media:**\n1. Tiêu Đề Viral → Catchy headlines\n2. Viết Truyện → Engaging captions\n3. Hình Ảnh → Visual content\n4. Dịch → Multi-language posts\n5. Phân Tích → Performance optimization\n\n💡 **Golden rule:** Combine modules để maximize impact!`;
    }
    
    // Default comprehensive response
    return `🤖 **AI STORY CREATOR - PLATFORM TOÀN DIỆN**\n\nTôi hiểu sâu về tất cả 10 modules:\n\n🚀 **Siêu Trợ Lý AI** - Brainstorm không giới hạn\n📝 **Xây Dàn Ý** - Structure hoàn hảo\n✍️ **Viết Truyện** - Content chất lượng cao\n🔄 **Viết Lại** - Polish đến hoàn thiện\n📊 **Phân Tích** - Quality insights\n🎵 **Text-to-Speech** - Audio chuyên nghiệp\n📺 **YouTube SEO** - Viral optimization\n💡 **Tiêu Đề Viral** - Click magnets\n🎨 **Tạo Hình Ảnh** - Visual stunning\n🌍 **Dịch Thuật** - Global reach\n\n**Hỏi cụ thể để được hướng dẫn chi tiết:**\n• "Giải thích module [tên module]"\n• "Workflow để làm [mục đích cụ thể]"\n• "Cách optimize [loại content]"\n• "Troubleshoot lỗi [mô tả]"\n\n🎯 **Ready để deep dive vào bất kỳ topic nào!**`;
  };

  const getAIResponse = async (userMessage: string): Promise<string> => {
    try {
      // Thử gọi API trước
      const response = await fetch('https://aistory-backend.onrender.com/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          message: `Bạn là chuyên gia AI Story Creator. Trả lời câu hỏi: ${userMessage}`,
          conversationHistory: [],
          model: 'gemini-pro'
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.response) {
          return data.response;
        }
      }
    } catch (error) {
      console.log('API not available, using smart offline response');
    }

    // Fallback to smart offline response
    return getSmartResponse(userMessage);
  };

  const handleSendMessage = async (content?: string) => {
    const messageContent = content || inputMessage.trim();
    if (!messageContent) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: messageContent,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    try {
      // Add realistic typing delay based on message length
      const typingDelay = Math.min(800 + messageContent.length * 25, 2500);
      
      const response = await getAIResponse(messageContent);
      
      setTimeout(() => {
        const botMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          content: response,
          sender: 'bot',
          timestamp: new Date()
        };

        setMessages(prev => [...prev, botMessage]);
        setIsTyping(false);
        
        if (!isOpen) {
          setHasNewMessage(true);
        }
      }, typingDelay);
    } catch (error) {
      console.error('Error sending message:', error);
      
      setTimeout(() => {
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          content: "Xin lỗi, tôi đang gặp sự cố kỹ thuật. Hãy thử hỏi lại hoặc liên hệ support@aistory.com! 😊",
          sender: 'bot',
          timestamp: new Date()
        };

        setMessages(prev => [...prev, errorMessage]);
        setIsTyping(false);
      }, 1000);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setHasNewMessage(false);
    }
  };

  const formatMessage = (content: string) => {
    return content.split('\n').map((line, index) => (
      <React.Fragment key={index}>
        {line}
        {index < content.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Chat Window */}
      {isOpen && (
        <div 
          className={`mb-4 bg-white rounded-lg shadow-2xl border transition-all duration-300 ${
            isMinimized ? 'h-16' : 'h-96 md:h-[500px]'
          } w-80 md:w-96 flex flex-col`}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bot className="w-5 h-5" />
              <div>
                <h3 className="font-medium text-sm">AI Story Expert</h3>
                <p className="text-xs opacity-90">Chuyên gia tất cả 10 modules</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="hover:bg-white/20 p-1 rounded transition-colors"
              >
                {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-white/20 p-1 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] p-3 rounded-lg ${
                        message.sender === 'user'
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                          : 'bg-white border shadow-sm'
                      }`}
                    >
                      <div className="flex items-start space-x-2">
                        {message.sender === 'bot' && (
                          <Bot className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
                        )}
                        <div className="text-sm leading-relaxed">
                          {formatMessage(message.content)}
                        </div>
                      </div>
                      <div className={`text-xs mt-1 ${
                        message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        {message.timestamp.toLocaleTimeString('vi-VN', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white border shadow-sm p-3 rounded-lg max-w-[80%]">
                      <div className="flex items-center space-x-2">
                        <Bot className="w-4 h-4 text-blue-600" />
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                        <span className="text-xs text-gray-500">Đang phân tích...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Actions */}
              {messages.length === 1 && (
                <div className="p-3 border-t bg-white">
                  <p className="text-xs text-gray-600 mb-2 font-medium">💡 Khám phá ngay:</p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {quickActions.slice(0, 4).map((action, index) => (
                      <button
                        key={index}
                        onClick={() => handleSendMessage(action)}
                        className="text-left p-2.5 text-xs bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 rounded-lg border border-blue-200 transition-all duration-200 hover:shadow-sm"
                      >
                        <span className="font-medium">{action}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        const randomAction = quickActions[Math.floor(Math.random() * quickActions.length)];
                        handleSendMessage(randomAction);
                      }}
                      className="text-left p-2.5 text-xs bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 rounded-lg border border-purple-200 transition-all duration-200 hover:shadow-sm"
                    >
                      <span className="font-medium">🎲 Câu hỏi ngẫu nhiên</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="p-4 border-t bg-white rounded-b-lg">
                <div className="flex space-x-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Hỏi về bất kỳ tính năng nào..."
                    className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    disabled={isTyping}
                  />
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!inputMessage.trim() || isTyping}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-2 rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Chat Bubble */}
      <button
        onClick={toggleChat}
        className={`bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white p-4 rounded-full shadow-xl transition-all duration-300 relative ${
          isOpen ? 'scale-90' : 'scale-100 hover:scale-110'
        }`}
      >
        <MessageCircle className="w-6 h-6" />
        
        {/* Notification Badge */}
        {hasNewMessage && !isOpen && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse"></div>
        )}
        
        {/* Pulse Effect */}
        {!isOpen && (
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full animate-ping opacity-30"></div>
        )}
      </button>
    </div>
  );
};

export default SupportChatbot;
