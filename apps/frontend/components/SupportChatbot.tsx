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
      content: '🎉 Chào mừng bạn đến với AI Story Creator!\n\nTôi là **AI Support Assistant** - trợ lý thông minh sẵn sàng hỗ trợ bạn 24/7. Tôi có thể giúp:\n\n🚀 **Hướng dẫn sử dụng** các tính năng\n📝 **Viết prompt hiệu quả** để có kết quả tốt nhất\n🔧 **Khắc phục sự cố** kỹ thuật\n💡 **Tư vấn workflow** tối ưu\n🎯 **Tips & tricks** nâng cao\n\n💬 Hãy hỏi tôi bất cứ điều gì về AI Story Creator!',
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
    '🚀 Làm sao để bắt đầu sử dụng?',
    '✍️ Hướng dẫn viết truyện hiệu quả',
    '🔑 Cách cài đặt API Key miễn phí',
    '🎨 Tạo hình ảnh từ văn bản',
    '� So sánh các gói cước',
    '🎯 Tips tối ưu hóa kết quả',
    '📚 Xem video hướng dẫn chi tiết',
    '🛠️ Khắc phục lỗi thường gặp'
  ];

  const getAIResponse = async (userMessage: string): Promise<string> => {
    try {
      // Chuẩn bị context về AI Story Creator với thông tin chi tiết hơn
      const systemPrompt = `Bạn là trợ lý AI chuyên nghiệp của AI Story Creator - một công cụ AI toàn diện để viết truyện và tạo nội dung. 

THÔNG TIN CHI TIẾT VỀ AI STORY CREATOR:

🚀 SIÊU TRỢ LÝ AI:
- Brainstorm ý tưởng sáng tạo
- Tư vấn chiến lược nội dung
- Hỗ trợ đa ngôn ngữ
- Trả lời mọi câu hỏi

📝 XÂY DÀN Ý TRUYỆN:
- Tạo outline chi tiết từ ý tưởng
- Phân tích cấu trúc truyện
- Gợi ý plot twist
- Phát triển nhân vật

✍️ VIẾT TRUYỆN:
- AI viết truyện theo yêu cầu
- Nhiều thể loại: romance, fantasy, thriller...
- Tùy chỉnh độ dài và phong cách
- Kiểm soát nội dung

🔄 VIẾT LẠI:
- Cải thiện văn phong
- Thay đổi tone và style
- Tối ưu hóa nội dung
- Sửa lỗi chính tả

🌍 DỊCH THUẬT:
- Hỗ trợ 50+ ngôn ngữ
- Giữ nguyên ý nghĩa và cảm xúc
- Tùy chỉnh phong cách dịch

📊 PHÂN TÍCH:
- Đánh giá chất lượng nội dung
- Phân tích cảm xúc
- Gợi ý cải thiện
- Báo cáo chi tiết

🎵 TEXT-TO-SPEECH:
- Chuyển văn bản thành giọng nói
- Nhiều giọng đọc tự nhiên
- Hỗ trợ OpenAI TTS và ElevenLabs
- Export file âm thanh

📺 YOUTUBE SEO:
- Tối ưu hóa tiêu đề và mô tả
- Tạo tags hiệu quả
- Phân tích từ khóa
- Tăng lượt view

💡 TẠO TIÊU ĐỀ VIRAL:
- Tiêu đề thu hút click
- Phân tích đối thủ
- A/B testing
- Xu hướng viral

🎨 TẠO HÌNH ẢNH:
- AI tạo ảnh từ mô tả
- Nhiều style nghệ thuật
- Tùy chỉnh kích thước
- Chất lượng cao

CÀI ĐẶT & API:
- Gemini AI (Google): Miễn phí và mạnh mẽ
- OpenAI GPT: Chất lượng cao
- Claude: Phân tích sâu
- ElevenLabs: Text-to-Speech chuyên nghiệp

GÓI CƯỚC:
- Free: Giới hạn cơ bản
- Monthly: Không giới hạn, tất cả tính năng
- Lifetime: Mua 1 lần, dùng trọn đời

CÁCH SỬ DỤNG HIỆU QUẢ:
1. Cài đặt API key (bắt đầu với Gemini miễn phí)
2. Chọn module phù hợp với mục đích
3. Nhập prompt chi tiết và rõ ràng
4. Thử nghiệm với các tham số khác nhau
5. Sử dụng kết hợp nhiều module

LỖI THƯỜNG GẶP & KHẮC PHỤC:
- API key không hợp lệ: Kiểm tra và nhập lại
- Kết nối chậm: Chọn server gần hơn
- Kết quả không như ý: Cải thiện prompt
- Hết quota: Nâng cấp gói hoặc đổi API

Hãy trả lời câu hỏi một cách thân thiện, chi tiết và hữu ích. Sử dụng emoji và định dạng để dễ đọc.

Câu hỏi: ${userMessage}`;

      const response = await fetch('https://aistory-backend.onrender.com/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          message: systemPrompt,
          conversationHistory: [],
          model: 'gemini-pro'
        })
      });

      const data = await response.json();
      
      if (data.success) {
        return data.response;
      } else {
        return '🔧 Xin lỗi, tôi gặp sự cố kỹ thuật. Bạn có thể:\n\n• Thử lại sau ít phút\n• Kiểm tra kết nối mạng\n• Liên hệ support qua menu Hỗ Trợ\n• Email: support@aistory.vn\n\nTôi sẽ cố gắng hỗ trợ bạn sớm nhất!';
      }
    } catch (error) {
      console.error('Chatbot error:', error);
      return '❌ Không thể kết nối đến server. Vui lòng:\n\n• Kiểm tra kết nối internet\n• Thử refresh trang\n• Đăng nhập lại nếu cần\n• Liên hệ support nếu vấn đề tiếp tục\n\n📧 Email: support@aistory.vn';
    }
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
      const typingDelay = Math.min(1000 + messageContent.length * 30, 3000);
      
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
          content: "Xin lỗi, tôi đang gặp sự cố kỹ thuật. Vui lòng thử lại sau hoặc liên hệ support@aistory.com để được hỗ trợ trực tiếp! 😊",
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
          <div className="bg-blue-600 text-white p-4 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bot className="w-5 h-5" />
              <div>
                <h3 className="font-medium text-sm">AI Story Support</h3>
                <p className="text-xs opacity-90">Trợ lý AI hỗ trợ 24/7</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="hover:bg-blue-700 p-1 rounded transition-colors"
              >
                {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-blue-700 p-1 rounded transition-colors"
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
                      className={`max-w-[80%] p-3 rounded-lg ${
                        message.sender === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border shadow-sm'
                      }`}
                    >
                      <div className="flex items-start space-x-2">
                        {message.sender === 'bot' && (
                          <Bot className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
                        )}
                        <div className="text-sm">
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
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Actions */}
              {messages.length === 1 && (
                <div className="p-3 border-t bg-white">
                  <p className="text-xs text-gray-600 mb-2 font-medium">💡 Câu hỏi phổ biến:</p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {quickActions.slice(0, 4).map((action, index) => (
                      <button
                        key={index}
                        onClick={() => handleSendMessage(action)}
                        className="text-left p-2.5 text-xs bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 rounded-lg border border-blue-200 transition-all duration-200 hover:shadow-sm"
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
                    placeholder="Nhập câu hỏi của bạn..."
                    className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    disabled={isTyping}
                  />
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!inputMessage.trim() || isTyping}
                    className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
        className={`bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-all duration-300 relative ${
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
          <div className="absolute inset-0 bg-blue-600 rounded-full animate-ping opacity-20"></div>
        )}
      </button>
    </div>
  );
};

export default SupportChatbot;
