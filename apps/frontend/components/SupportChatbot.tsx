import React, { useState, useRef, useEffect } from 'react';
import { ApiSettings, ChatbotWidgetState, ChatMessage } from '../types';
import { generateText } from '../services/textGenerationService';
import { MessageSquare, X, Send, Bot, User, Minimize2, Maximize2, HelpCircle, Zap, Star } from 'lucide-react';
import ErrorAlert from './ErrorAlert';

interface ChatbotWidgetProps {
    apiSettings?: ApiSettings;
}

// Comprehensive documentation about the AI Story Creator Studio
const COMPREHENSIVE_TOOL_DOCUMENTATION = `
Bạn là "Trợ lý AI Hỗ trợ Chuyên Nghiệp" của "AI Story Creator Studio" - phát triển bởi Đức Đại MMO.
Bạn là chuyên gia tuyệt đối về tất cả các tính năng của công cụ và có khả năng thay thế hoàn toàn nhân viên support.

**NHIỆM VỤ CHÍNH:**
1. Trả lời MỌI câu hỏi về AI Story Creator Studio với độ chính xác 100%
2. Hướng dẫn người dùng sử dụng từng tính năng một cách chi tiết nhất
3. Troubleshoot và giải quyết mọi vấn đề kỹ thuật
4. Tư vấn workflow tối ưu cho từng mục đích sử dụng cụ thể
5. Cung cấp tips, tricks, và best practices từ chuyên gia

**QUY TẮC ỨNG XỬ:**
- Luôn chuyên nghiệp, thân thiện, và hữu ích như nhân viên support giỏi nhất
- Trả lời bằng tiếng Việt, rõ ràng và dễ hiểu
- Cung cấp thông tin chi tiết, có ví dụ cụ thể
- Nếu cần, hỏi thêm để hiểu rõ nhu cầu người dùng
- Luôn suggest best practices và pro tips

**KIẾN THỨC CHI TIẾT VỀ AI STORY CREATOR STUDIO:**

## A. TỔNG QUAN HỆ THỐNG

**Mục đích:** Platform All-in-One sử dụng AI (Gemini, OpenAI, Claude...) để tự động hóa toàn bộ quy trình sáng tạo nội dung từ A-Z.

**Đối tượng target:** 
- Content creators (YouTuber, TikToker, Blogger)
- Writers (tiểu thuyết, truyện ngắn, copywriter)
- Marketers (social media, content marketing)
- Educators (giáo viên, trainer)
- Businesses (SME cần content scale)

**Unique Value Proposition:**
- 10+ modules tích hợp seamless
- Workflow automation thông minh
- Multi-language support
- Professional-grade outputs
- Cost-effective thay thế team

## B. CHI TIẾT 10 MODULES CHÍNH

### 1. 📊 **DASHBOARD - Trung tâm điều khiển**
**Chức năng:**
- Overview toàn bộ hoạt động và thống kê sử dụng
- Subscription status và usage tracking
- Quick access đến modules phổ biến
- Performance analytics

**Cách sử dụng:**
- Login vào hệ thống → tự động redirect đến Dashboard
- Monitor daily/weekly/monthly usage
- Check subscription expiry và upgrade options

### 2. 🚀 **SIÊU TRỢ LÝ AI - Universal AI Assistant**
**Chức năng:**
- Brainstorm ý tưởng không giới hạn
- Research và analysis chuyên sâu  
- Strategy consulting cho content marketing
- Problem-solving và creative thinking
- Multi-domain expertise

**Input examples:**
- "Tạo 20 ý tưởng video YouTube về AI marketing cho SME"
- "Phân tích xu hướng truyện romance Việt Nam 2024"
- "Strategy content 30 ngày cho brand thời trang"
- "Giải thích blockchain cho người mới bắt đầu"

**Pro tips:**
- Prompt càng specific, output càng valuable
- Follow-up questions để deep dive
- Combine với modules khác để execute ý tưởng

### 3. 📝 **XÂY DÀN Ý TRUYỆN - Creative Lab**
**3 chế độ hoạt động:**

**a) Tạo Dàn Ý Nhanh (Quick Outline):**
- Input: Chỉ cần tiêu đề/ý tưởng cơ bản
- Output: Cấu trúc story arc trong 2-3 phút
- Ideal for: Brainstorming nhanh, test concepts

**b) Tạo Dàn Ý Chuyên Sâu (In-depth Outline):**
- Input: Core idea + secondary ideas + emotional journey
- Features: Chọn plot structure (Hero's Journey, 3-Act, etc.)
- Reference viral outlines để AI học pattern
- Output: Detailed outline với character arcs, subplots
- Ideal for: Novels, series, complex narratives

**c) Tạo Dàn Ý Hàng Loạt (Batch Outline):**
- Input: Multiple core ideas (up to 20+)
- Parallel processing với concurrency control
- Output: Individual outlines cho từng ý tưởng
- Ideal for: Content creators cần volume

**Best practices:**
- Start với Quick → refine với In-depth
- Use reference materials để maintain consistency
- Combine emotional journey với plot structure

### 4. ✍️ **VIẾT TRUYỆN & HOOK - Write Story**
**3 sub-modules:**

**a) Viết Truyện Đơn (Single Story):**
- Input: Outline từ Creative Lab hoặc manual input
- Customizable: Length (500-30,000 words), style, language
- Auto-editing: AI tự polish logic và flow
- DNA Analysis: Learn từ viral stories reference
- Output: Complete, professionally edited story

**b) Tạo Hooks (Hook Generator):**
- Input: Completed story
- Generates: Multiple hook variations (opening paragraphs)
- Styles: Mysterious, action-packed, emotional, shocking
- Structures: AIDA, PAS, Open Loop, etc.
- Perfect for: Social media teasers, video intros

**c) Đúc Kết Bài Học (Lesson Generator):**
- Input: Any story/content
- Extract: Key messages, moral lessons, actionable insights
- Format: Educational, inspirational, practical
- Ideal for: Educational content, motivational posts

**Workflow optimization:**
Creative Lab → Write Story → Hook Generator → Lesson Generator

### 5. ✍️ **VIẾT TRUYỆN HÀNG LOẠT - Batch Story Writing**
**Tính năng nâng cao:**
- Process multiple outlines simultaneously
- Individual customization per story (length, style, etc.)
- Global settings override
- Progress tracking và error handling
- Automatic post-editing analysis
- Batch export options

**Use cases:**
- Content calendar execution (30 stories/month)
- A/B testing different angles
- Multi-platform content adaptation

### 6. ✂️ **BIÊN TẬP TRUYỆN - Edit Story**
**2 modes:**

**a) Single Edit:**
- Input: Original story + optional outline
- Customizable target length và style
- Interactive refinement với follow-up instructions
- Post-edit quality analysis
- Before/after comparison

**b) Batch Edit:**
- Multiple stories editing với individual settings
- Consistency maintenance across batch
- Quality scoring và reporting

**Edit types:**
- Grammar & style correction
- Length adjustment (expand/condense)
- Tone modification (formal/casual, serious/humorous)
- Structure improvement
- Character consistency

### 7. 🔄 **VIẾT LẠI & VIẾT LẠI HÀNG LOẠT - Rewrite Modules**
**Rewrite levels (1-100%):**
- 1-25%: Grammar fix, minor improvements
- 26-50%: Style enhancement, better flow
- 51-75%: Significant restructuring + character mapping
- 76-100%: Complete recreation, new perspective

**Advanced features:**
- Source/target language translation
- Context adaptation (audience, platform, purpose)
- Style transfer (formal ↔ casual, academic ↔ creative)
- Queue system với priority management

### 8. 🌐 **DỊCH THUẬT AI - Translation Module**
**50+ languages supported:**
- Major languages: EN, ES, FR, DE, JA, KO, ZH, etc.
- Southeast Asian: TH, ID, MY, etc.
- Specialized: Technical, literary, business translation

**Smart features:**
- Context-aware translation
- Cultural adaptation
- Tone preservation
- Term consistency
- Back-translation verification

### 9. ✨ **PHÂN TÍCH TRUYỆN - Analysis Module**
**Scoring system (0-100 points):**
- Plot coherence & structure
- Character development
- Emotional impact
- Readability score
- SEO potential
- Viral potential factors

**Detailed reporting:**
- Strengths & weaknesses breakdown
- Specific improvement suggestions
- Comparison với industry benchmarks
- Action items prioritization

### 10. 📋 **TÓM TẮT NỘI DUNG - Content Summarizer**
**Dual input modes:**
- YouTube link analysis (với transcript extraction)
- Text content processing (articles, books, documents)

**Smart features:**
- Intelligent summarization với key points
- Interactive Q&A about content
- Context-aware responses
- Multi-language support

## C. NHÓM PHÂN TÍCH & Ý TƯỞNG

### **💡 PHÂN TÍCH & MỞ RỘNG CHỦ ĐỀ - Content Strategy**
**3 powerful tools:**

**a) Analyze Trend & Formula:**
- Input: Competitor URLs hoặc viral titles
- AI research và extract viral patterns
- Output: Actionable formulas và strategies
- Grounding sources với citation

**b) Niche Explorer:**
- Input: Sample titles từ domain
- AI identify potential niches
- Market analysis và opportunity scoring
- Content suggestions cho mỗi niche

**c) Creation Studio:**
- Title variation generation (từ base title)
- Series expansion (từ existing titles)
- Script-to-title optimization
- Viral context learning

### **🎯 DREAM 100 COMPETITOR ANALYSIS**
**Competitive intelligence:**
- Input: Single competitor URL
- AI research similar channels/creators
- Analysis: Content themes, audience, growth patterns
- Filtering: New channels, view count ranges, timeframes
- Strategic recommendations

### **📺 YOUTUBE SEO & TỪ KHÓA**
**4 optimization tools:**

**a) Description & Timeline:**
- SEO-optimized descriptions
- Video timeline generation
- Tag suggestions
- Metadata optimization

**b) Keywords Research:**
- Topic-based keyword discovery
- Search volume analysis
- Competition assessment
- Long-tail opportunities

**c) Chapters Generation:**
- Script-to-chapters conversion
- Optimal chapter timing
- Engagement-focused structure

**d) Title & Thumbnail Optimizer:**
- Title analysis với scoring
- Multiple title variations
- Thumbnail text suggestions
- A/B testing recommendations

## D. XƯỞNG AI (AI WORKSHOP)

### **🎨 XƯỞNG TẠO ẢNH AI - Image Generation Suite**
**4 specialized tools:**

**a) Ảnh từ Hook/Story:**
- Input: Story content hoặc hooks
- AI analyzes context và generates relevant images
- Multiple art styles: Photorealistic, Anime, Digital Art, etc.
- Aspect ratio options: Square, Portrait, Landscape

**b) Ảnh Ngữ Cảnh Thông Minh:**
- Cultural context integration (Vietnamese, Korean, etc.)
- Scene-appropriate compositions
- Character consistency maintenance

**c) Tạo Prompt Thông Minh:**
- Generate optimized prompts cho external tools
- Professional prompt engineering
- Multiple variations cho A/B testing

**d) Ảnh Hàng Loạt:**
- Batch processing với English prompts
- Consistent style maintenance
- Quality control và filtering

**Engine options:**
- Google Imagen (recommended)
- Stability AI (SD3)
- OpenAI DALL-E
- DeepSeek Image

### **👤 XƯỞNG NHÂN VẬT AI - Character Studio**
**Character consistency workflow:**
1. Input basic character details (name, age, features, profession)
2. AI generates detailed base character prompt
3. Refinement với specific adjustments
4. Character action integration (sitting, running, etc.)
5. Complete image prompt output
6. Use across multiple image generations

**Advanced features:**
- Iterative refinement system
- Character sheet generation
- Multiple pose/action variations
- Style transfer maintenance

### **🎙️ ĐỌC TRUYỆN AI - TTS Module**
**Multi-provider support:**
- ElevenLabs (premium, ultra-realistic)
- OpenAI TTS (natural, cost-effective)
- Google Cloud TTS (multilingual)
- Browser TTS (free fallback)

**Advanced features:**
- Multi-API key load balancing
- Concurrent processing
- SRT subtitle generation
- Voice cloning options (ElevenLabs)
- Custom pronunciation dictionary

**Professional workflow:**
- Text preprocessing & chunking
- Voice selection optimization
- Quality control & review
- Audio merging & export
- Metadata embedding

## E. TECHNICAL SETUP & TROUBLESHOOTING

### **🔑 API KEYS MANAGEMENT**
**Recommended setup progression:**

**Free tier start:**
1. Google Gemini API (free quota)
2. Create Google Cloud project
3. Enable Gemini API
4. Generate và configure API key

**Production scaling:**
1. OpenAI API (higher quality)
2. ElevenLabs (premium TTS)
3. Stability AI (advanced image generation)
4. Multiple keys load balancing

**Common issues & solutions:**
- "Invalid API key" → Check format, regenerate
- "Rate limit exceeded" → Upgrade plan, implement delays
- "Connection timeout" → Check network, firewall settings
- "Insufficient credits" → Monitor usage, set alerts

### **💰 SUBSCRIPTION PLANS**

**Free Plan:**
- 10 requests/day per module
- Basic features only
- Watermarks on exports
- Community support
- Perfect for testing

**Monthly Premium ($29.99):**
- Unlimited requests all modules
- All advanced features
- No watermarks
- Priority processing
- Email support
- HD exports

**Lifetime Deal ($299):**
- One-time payment
- All current + future features
- Unlimited usage forever
- VIP support channel
- Early access to new modules
- Best ROI for serious creators

### **🚀 OPTIMIZATION BEST PRACTICES**

**Workflow Optimization:**
1. Plan content strategy với Siêu Trợ Lý
2. Generate outlines với Creative Lab
3. Write content với Write Story modules
4. Create visuals với Image Generation Suite
5. Optimize cho platforms với YouTube SEO
6. Analyze performance với Analysis Module

**Prompt Engineering Tips:**
- Be specific về requirements
- Provide context và examples
- Use step-by-step instructions
- Iterate và refine prompts
- Combine multiple modules cho complex tasks

**Quality Control:**
- Always review AI outputs
- Use Analysis module để scoring
- A/B test different approaches
- Maintain brand consistency
- Monitor performance metrics

### **🛠️ ADVANCED FEATURES**

**Automation & Integration:**
- Cross-module data transfer
- Workflow templates
- Batch processing optimization
- Queue management systems
- Export format customization

**Collaboration Features:**
- Team workspace management
- Permission controls
- Shared prompt libraries
- Version control
- Review và approve workflows

**Performance Optimization:**
- Concurrent processing limits
- Memory management
- Caching strategies  
- Load balancing
- Error recovery systems

## F. SUPPORT & TROUBLESHOOTING

**Common Scenarios & Solutions:**

**Scenario 1: "Tôi mới bắt đầu, nên dùng module nào trước?"**
→ Workflow: Dashboard → Siêu Trợ Lý (brainstorm) → Creative Lab (outline) → Write Story → Analysis

**Scenario 2: "Làm sao để tạo content cho YouTube?"**
→ Workflow: Siêu Trợ Lý (ideas) → Write Story (script) → YouTube SEO (optimize) → Image Generation (thumbnail) → TTS (voice-over)

**Scenario 3: "API key không hoạt động?"**
→ Check: Valid format → Quota remaining → Network connection → Regenerate if needed

**Scenario 4: "Chất lượng output không đạt yêu cầu?"**
→ Optimize: More specific prompts → Reference materials → Iterate và refine → Use Analysis module

**Scenario 5: "Muốn scale content production?"**
→ Strategy: Batch modules → Template workflows → Quality control processes → Team collaboration

**Emergency Contacts:**
- Technical issues: support@aistory.com
- Billing questions: billing@aistory.com  
- Feature requests: feedback@aistory.com
- Zalo support: 0339933882

Bạn có thể trả lời MỌI câu hỏi dựa trên knowledge base này với độ chính xác và chi tiết tuyệt đối!
`;

const SupportChatbot: React.FC<ChatbotWidgetProps> = ({ apiSettings }) => {
    const [moduleState, setModuleState] = useState<ChatbotWidgetState>({
        isOpen: false,
        chatHistory: [],
        isLoading: false,
        error: null
    });

    const [currentInput, setCurrentInput] = useState('');
    const [isMinimized, setIsMinimized] = useState(false);
    const [hasNewMessage, setHasNewMessage] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const { isOpen, chatHistory, isLoading, error } = moduleState;

    // Quick action suggestions
    const quickActions = [
        '🚀 Giải thích tất cả 10 modules chính',
        '✍️ Workflow viết truyện hoàn chỉnh từ A-Z',
        '🔑 Hướng dẫn cài đặt API Key chi tiết',
        '🎨 Cách tạo hình ảnh AI chuyên nghiệp',
        '💰 So sánh các gói Free vs Premium vs Lifetime',
        '🎯 Bí quyết prompt engineering hiệu quả',
        '📺 Làm content YouTube với AI tools',
        '🛠️ Troubleshooting & FAQ thường gặp',
        '🌟 Case study: Chiến lược viral content',
        '⚡ Tips tối ưu hóa performance'
    ];

    const faqSuggestions = [
        '❓ Tool này có miễn phí không?',
        '🔧 Khắc phục lỗi API key',
        '📖 Cách viết prompt hiệu quả',
        '🎵 Setup Text-to-Speech',
        '🖼️ Tạo ảnh viral cho social media',
        '📊 Phân tích competitor với AI'
    ];

    // Scroll to bottom when new messages appear
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && !isMinimized) {
            setTimeout(() => inputRef.current?.focus(), 100);
            setHasNewMessage(false);
        }
    }, [isOpen, isMinimized]);

    const updateState = (updates: Partial<ChatbotWidgetState>) => {
        setModuleState(prev => ({ ...prev, ...updates }));
    };

    const getAIResponse = async (userMessage: string): Promise<string> => {
        try {
            // Try using the generateText service if available
            if (apiSettings?.apiKey) {
                const response = await generateText(
                    `${COMPREHENSIVE_TOOL_DOCUMENTATION}\n\nUser question: ${userMessage}`,
                    undefined,
                    false,
                    apiSettings
                );
                return response.text;
            }
        } catch (error) {
            console.log('API service not available, using smart fallback response');
        }

        // Smart fallback responses
        return getSmartFallbackResponse(userMessage);
    };

    const getSmartFallbackResponse = (userMessage: string): string => {
        const msg = userMessage.toLowerCase();
        
        // Greeting responses
        if (msg.includes('xin chào') || msg.includes('hello') || msg.includes('hi') || msg.length < 10) {
            return `👋 **Xin chào! Tôi là AI Expert của AI Story Creator Studio!**

Tôi có thể giúp bạn:
✨ Hiểu rõ tất cả 10 modules và cách sử dụng
🔧 Troubleshoot mọi vấn đề kỹ thuật  
💡 Tư vấn workflow tối ưu cho mục đích cụ thể
🚀 Tips & tricks từ chuyên gia
📊 Hướng dẫn setup và best practices

**Hãy hỏi tôi bất cứ điều gì về tool!** 
Ví dụ: "Cách cài đặt API key" hoặc "Workflow tạo content YouTube"`;
        }

        // API & Setup questions
        if (msg.includes('api') || msg.includes('cài đặt') || msg.includes('setup')) {
            return `🔑 **HƯỚNG DẪN SETUP API CHI TIẾT**

**BƯỚC 1: Gemini API (Khuyến nghị cho newbie)**
1. Truy cập: https://console.cloud.google.com
2. Tạo project mới hoặc chọn existing project
3. Enable "Gemini API" trong API Library
4. Tạo API Key: Credentials → Create → API Key
5. Copy key và paste vào AI Story Creator → Settings

**BƯỚC 2: Verify Setup**
- Vào module bất kỳ và test thử
- Nếu thành công → Bạn đã sẵn sàng! 🎉
- Nếu lỗi → Check key format và quota

**TROUBLESHOOTING:**
❌ "Invalid API key" → Re-generate key mới
❌ "Quota exceeded" → Upgrade Google Cloud plan
❌ "Connection failed" → Check firewall/internet

**PRO TIP:** Start với Gemini free tier (50 requests/day) để familiar, sau đó scale lên OpenAI khi cần chất lượng cao hơn!

Cần hỗ trợ setup? Hỏi tôi chi tiết hơn! 🚀`;
        }

        // Modules overview
        if (msg.includes('module') || msg.includes('tính năng') || msg.includes('chức năng')) {
            return `🚀 **10 MODULES CHÍNH CỦA AI STORY CREATOR**

**📊 DASHBOARD** - Trung tâm điều khiển & thống kê

**✍️ WRITING GROUP:**
• **Xây Dàn Ý** - Từ ý tưởng thành cấu trúc hoàn chỉnh
• **Viết Truyện & Hook** - AI author với 3 chế độ
• **Viết Truyện Hàng Loạt** - Scale content production  
• **Biên Tập** - Polish stories đến professional
• **Viết Lại** - Paraphrase & style transfer
• **Dịch Thuật** - 50+ ngôn ngữ, context-aware

**✨ ANALYSIS & IDEAS:**
• **Phân Tích Truyện** - Quality scoring & insights
• **Tóm Tắt Nội Dung** - YouTube + text summarization
• **Mở Rộng Chủ Đề** - Viral formulas & niche discovery
• **Dream 100** - Competitor intelligence
• **YouTube SEO** - Complete optimization suite

**🤖 AI WORKSHOP:**
• **Tạo Ảnh AI** - 4 specialized image tools
• **Character Studio** - Consistent character creation
• **Text-to-Speech** - Multi-provider premium voices

**🚀 SUPER ASSISTANT:**
• **Siêu Trợ Lý** - Universal AI consultant
• **Support & Contact** - Human backup

**Muốn hiểu sâu module nào? Hãy hỏi cụ thể!** 
VD: "Giải thích module Viết Truyện" 📝`;
        }

        // Workflow questions
        if (msg.includes('workflow') || msg.includes('quy trình') || msg.includes('cách làm')) {
            return `🎯 **WORKFLOW TỐI ƯU CHO CÁC MỤC ĐÍCH**

**📚 VIẾT NOVEL/TRUYỆN DÀI:**
1. **Siêu Trợ Lý** → Brainstorm premise & themes
2. **Xây Dàn Ý** → Create detailed story structure  
3. **Viết Truyện** → Generate chapters với consistency
4. **Biên Tập** → Polish & professional editing
5. **Phân Tích** → Quality assurance scoring
6. **TTS** → Audiobook creation (optional)

**📺 YOUTUBE CONTENT:**
1. **Siêu Trợ Lý** → Video concepts & angles
2. **Viết Truyện** → Script writing
3. **YouTube SEO** → Title, description, tags optimization
4. **Tạo Ảnh** → Thumbnail design
5. **TTS** → Voice-over generation
6. **Phân Tích** → Content quality check

**📱 SOCIAL MEDIA SCALING:**
1. **Mở Rộng Chủ Đề** → Trend analysis & viral formulas
2. **Xây Dàn Ý Hàng Loạt** → Multiple content ideas
3. **Viết Truyện Hàng Loạt** → Scale production
4. **Tạo Ảnh Hàng Loạt** → Visual content
5. **Dịch Thuật** → Multi-language adaptation

**💼 BUSINESS CONTENT:**
1. **Dream 100** → Competitor research
2. **Phân Tích Chủ Đề** → Market opportunities  
3. **Viết Truyện** → Case studies & stories
4. **Viết Lại** → Multiple versions A/B testing
5. **YouTube SEO** → SEO optimization

**Cần workflow cụ thể cho mục đích khác? Hỏi tôi!** 🚀`;
        }

        // Pricing questions
        if (msg.includes('giá') || msg.includes('gói') || msg.includes('phí') || msg.includes('price')) {
            return `💰 **GÓI CƯỚC AI STORY CREATOR - CHI TIẾT ĐẦY ĐỦ**

**🆓 FREE PLAN:**
• 10 requests/ngày mỗi module
• Tất cả basic features
• Watermark trên exports
• Community support
• **Perfect để:** Test & familiar với tool

**💳 MONTHLY PREMIUM ($29.99/tháng):**
• ✅ Unlimited requests TẤT CẢ modules
• ✅ Advanced features unlock
• ✅ No watermarks
• ✅ Priority processing (faster)
• ✅ Email support
• ✅ HD exports & downloads
• **Perfect cho:** Professional creators

**💎 LIFETIME DEAL ($299 một lần):**
• ✅ Tất cả tính năng hiện tại + tương lai
• ✅ Unlimited usage mãi mãi
• ✅ VIP support channel
• ✅ Early access modules mới
• ✅ Team collaboration features
• **Perfect cho:** Serious creators & businesses

**💡 ROI CALCULATOR:**
• Thay thế 5+ tools khác ($200+/month)
• Save 20+ giờ/tuần (=$800+ value)  
• Professional outputs eliminate outsourcing
• Scale content 10x without team

**🎯 KHUYẾN NGHỊ:**
- **Newbie:** Start Free → hiểu tool → upgrade Monthly
- **Creator:** Monthly nếu test market → Lifetime khi confirmed
- **Business:** Lifetime ngay (ROI < 1 month)

**Có câu hỏi về billing hoặc upgrade? Hỏi tôi!** 💳`;
        }

        // Technical troubleshooting
        if (msg.includes('lỗi') || msg.includes('error') || msg.includes('sửa') || msg.includes('fix')) {
            return `🛠️ **TROUBLESHOOTING - GIẢI QUYẾT PROBLEMS**

**❌ LỖI THƯỜNG GẶP & SOLUTIONS:**

**1. "Invalid API Key"**
- ✅ Check format: Key đúng định dạng Google/OpenAI
- ✅ Regenerate key mới từ console
- ✅ Copy/paste cẩn thận (không space thừa)
- ✅ Verify key active trong cloud console

**2. "Rate Limit Exceeded"**  
- ✅ Upgrade API plan (Google/OpenAI)
- ✅ Wait cho quota reset (hàng ngày)
- ✅ Switch sang API provider khác
- ✅ Batch requests thay vì spam

**3. "Connection Failed"**
- ✅ Check internet connection
- ✅ Disable VPN/proxy tạm thời
- ✅ Firewall settings allow API calls
- ✅ Try different browser/device

**4. "Low Quality Outputs"**
- ✅ More specific prompts với context
- ✅ Add reference materials
- ✅ Use multiple iterations
- ✅ Try different AI models

**5. "Slow Performance"**
- ✅ Clear browser cache
- ✅ Close unused tabs
- ✅ Use latest browser version  
- ✅ Check system resources

**🆘 STILL STUCK?**
- Screenshot lỗi + send tới support@aistory.com
- Zalo: 0339933882 (emergency)
- Live chat: Tôi ở đây 24/7! 

**Mô tả cụ thể lỗi bạn gặp để tôi help targeted hơn!** 🎯`;
        }

        // Default comprehensive response
        return `🤖 **AI STORY CREATOR EXPERT TẠI ĐÂY!**

Tôi là chuyên gia về **TẤT CẢ 10 MODULES** và có thể hỗ trợ:

**🎯 CONSULTATION & STRATEGY:**
• Workflow design cho mục đích cụ thể
• Best practices từ thousands users
• ROI optimization strategies
• Scaling content production

**🔧 TECHNICAL SUPPORT:**
• API setup & troubleshooting step-by-step
• Performance optimization
• Integration với external tools  
• Advanced features utilization

**💡 CREATIVE GUIDANCE:**
• Prompt engineering mastery
• Quality improvement techniques
• Multi-platform adaptation
• Viral content formulas

**📊 BUSINESS INTELLIGENCE:**
• Competitor analysis strategies
• Market opportunity identification
• Content performance optimization
• Team collaboration workflows

**HOW I CAN HELP RIGHT NOW:**
- "Giải thích module [tên]" → Deep dive explanation
- "Workflow cho [mục đích]" → Custom process design  
- "Fix lỗi [mô tả]" → Targeted troubleshooting
- "Optimize [loại content]" → Performance tips
- "Setup [tính năng]" → Step-by-step guide

**🚀 READY TO MAXIMIZE YOUR AI STORY CREATOR EXPERIENCE!**

Hỏi tôi bất cứ gì - tôi ở đây để make you successful! 💪`;
    };

    const handleSendMessage = async (content?: string) => {
        const messageContent = content || currentInput.trim();
        if (!messageContent || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', message: messageContent };
        updateState({ 
            chatHistory: [...chatHistory, userMessage], 
            isLoading: true, 
            error: null 
        });
        setCurrentInput('');

        try {
            // Add realistic typing delay
            const typingDelay = Math.min(1000 + messageContent.length * 20, 3000);
            
            const response = await getAIResponse(messageContent);
            
            setTimeout(() => {
                const botMessage: ChatMessage = { role: 'model', message: response };
                updateState({ 
                    chatHistory: [...chatHistory, userMessage, botMessage], 
                    isLoading: false 
                });
                
                if (!isOpen) {
                    setHasNewMessage(true);
                }
            }, typingDelay);
        } catch (e) {
            setTimeout(() => {
                const errorMessage: ChatMessage = {
                    role: 'model',
                    message: `Xin lỗi, tôi gặp sự cố kỹ thuật nhẹ! 😅\n\nNhưng đừng lo - tôi vẫn có thể giúp bạn với:\n• Hướng dẫn sử dụng modules\n• Troubleshooting thường gặp\n• Best practices & tips\n• Workflow recommendations\n\nHãy thử hỏi lại hoặc liên hệ support@aistory.com nếu cần! 🚀`
                };
                updateState({ 
                    chatHistory: [...chatHistory, userMessage, errorMessage], 
                    isLoading: false,
                    error: `Lỗi: ${(e as Error).message}`
                });
            }, 1000);
        }
    };

    const toggleOpen = () => {
        if (!isOpen && chatHistory.length === 0) {
            updateState({ 
                isOpen: true, 
                chatHistory: [{
                    role: 'model',
                    message: `👋 **Chào mừng đến với AI Story Creator Studio!**

Tôi là **AI Expert** chuyên biệt - biết rõ tất cả 10 modules và sẵn sàng thay thế nhân viên support! 🚀

**Tôi có thể giúp bạn:**
✨ Giải thích chi tiết mọi tính năng
🔧 Troubleshoot mọi vấn đề kỹ thuật
💡 Tư vấn workflow tối ưu
🎯 Tips & tricks từ chuyên gia
📊 Best practices cho results tốt nhất

**Bắt đầu bằng cách hỏi tôi bất cứ gì!**
Hoặc chọn suggestion bên dưới để khám phá ngay 👇`
                }]
            });
        } else {
            updateState({ isOpen: !isOpen });
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
        <div className="fixed bottom-5 right-5 z-50">
            {/* Chat Window */}
            <div className={`
                ${isOpen ? (isMinimized ? 'w-80 h-16' : 'w-96 h-[70vh]') : 'w-0 h-0'} 
                transition-all duration-300 ease-in-out
                bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden border
                ${isOpen ? 'opacity-100 mb-4' : 'opacity-0'}
            `}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white flex-shrink-0">
                    <div className="flex items-center space-x-3">
                        <div className="relative">
                            <Bot size={24} className="text-white" />
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
                        </div>
                        <div>
                            <h3 className="font-bold text-sm">AI Expert Support</h3>
                            <p className="text-xs opacity-90">Chuyên gia 10 modules • Online 24/7</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => setIsMinimized(!isMinimized)}
                            className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                            title={isMinimized ? 'Mở rộng' : 'Thu nhỏ'}
                        >
                            {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                        </button>
                        <button
                            onClick={toggleOpen}
                            className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                            title="Đóng chat"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {!isMinimized && (
                    <>
                        {/* Messages Container */}
                        <div ref={chatContainerRef} className="flex-grow overflow-y-auto p-4 space-y-4 bg-gray-50">
                            {chatHistory.map((chat, index) => (
                                <div key={index} className={`flex items-start gap-3 ${chat.role === 'user' ? 'justify-end' : ''}`}>
                                    {chat.role === 'model' && (
                                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white flex items-center justify-center">
                                            <Bot size={16}/>
                                        </div>
                                    )}
                                    <div className={`max-w-[85%] p-3 rounded-xl text-sm leading-relaxed ${
                                        chat.role === 'user' 
                                            ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-br-none' 
                                            : 'bg-white border shadow-sm rounded-bl-none'
                                    }`}>
                                        {formatMessage(chat.message)}
                                    </div>
                                    {chat.role === 'user' && (
                                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-500 text-white flex items-center justify-center">
                                            <User size={16}/>
                                        </div>
                                    )}
                                </div>
                            ))}
                            
                            {isLoading && (
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white flex items-center justify-center">
                                        <Bot size={16}/>
                                    </div>
                                    <div className="max-w-[85%] p-3 rounded-xl bg-white border shadow-sm rounded-bl-none">
                                        <div className="flex items-center space-x-2">
                                            <div className="flex space-x-1">
                                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                                                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                                                <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                                            </div>
                                            <span className="text-xs text-gray-500">Đang phân tích và soạn phản hồi...</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {error && <ErrorAlert message={error} />}
                        </div>

                        {/* Quick Actions - Show only on first message */}
                        {chatHistory.length === 1 && (
                            <div className="p-3 border-t bg-white">
                                <div className="flex items-center gap-2 mb-2">
                                    <Zap size={14} className="text-yellow-500" />
                                    <p className="text-xs text-gray-600 font-medium">Khám phá nhanh:</p>
                                </div>
                                <div className="grid grid-cols-1 gap-1.5 mb-2">
                                    {quickActions.slice(0, 3).map((action, index) => (
                                        <button
                                            key={index}
                                            onClick={() => handleSendMessage(action)}
                                            className="text-left p-2 text-xs bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 rounded-lg border border-indigo-200 transition-all duration-200 hover:shadow-sm font-medium"
                                        >
                                            {action}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2 mb-1">
                                    <HelpCircle size={14} className="text-blue-500" />
                                    <p className="text-xs text-gray-600 font-medium">FAQ nhanh:</p>
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                    {faqSuggestions.slice(0, 4).map((faq, index) => (
                                        <button
                                            key={index}
                                            onClick={() => handleSendMessage(faq)}
                                            className="text-left p-1.5 text-xs bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 rounded border border-blue-200 transition-all duration-200 hover:shadow-sm font-medium"
                                        >
                                            {faq}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Input */}
                        <div className="p-4 border-t bg-white flex-shrink-0">
                            <div className="flex items-center space-x-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={currentInput}
                                    onChange={(e) => setCurrentInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                    }}
                                    placeholder="Hỏi về bất kỳ tính năng nào của AI Story Creator..."
                                    className="flex-grow p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                    disabled={isLoading}
                                />
                                <button
                                    onClick={() => handleSendMessage()}
                                    disabled={isLoading || !currentInput.trim()}
                                    className="p-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Floating Action Button */}
            <button
                onClick={toggleOpen}
                className={`
                    ${isOpen ? 'scale-90 opacity-75' : 'scale-100 opacity-100 hover:scale-110'}
                    transition-all duration-300 ease-in-out
                    w-16 h-16 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white rounded-full shadow-xl flex items-center justify-center relative overflow-hidden group
                `}
                aria-label="Mở AI Expert Support"
            >
                <MessageSquare size={28} className="relative z-10" />
                
                {/* Notification Badge */}
                {hasNewMessage && !isOpen && (
                    <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                        <Star size={12} className="text-white" />
                    </div>
                )}
                
                {/* Animated background */}
                {!isOpen && (
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-full opacity-75 group-hover:animate-pulse"></div>
                )}
                
                {/* Ripple effect */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-400 to-purple-400 animate-ping opacity-20"></div>
            </button>
        </div>
    );
};

export default SupportChatbot;