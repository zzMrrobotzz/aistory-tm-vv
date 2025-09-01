import { ActiveModule } from './types';

export const APP_TITLE = "AI Story Creator Studio";
export const APP_SUBTITLE = "Powered by Gemini AI";

export const NAVIGATION_GROUPS = [
  {
    title: "Dashboard",
    icon: "📊",
    subItems: [
      { id: ActiveModule.Dashboard, label: "Tổng Quan Dashboard", icon: "📊" },
    ]
  },
  {
    title: "Viết Truyện",
    icon: "✍️",
    subItems: [
      { id: ActiveModule.CreativeLab, label: "Xây Dàn Ý Truyện", icon: "📝" },
      { id: ActiveModule.WriteStory, label: "Viết Truyện & Hook", icon: "✍️" },
      { id: ActiveModule.QuickStory, label: "Tạo Truyện Nhanh", icon: "⚡️" },
      { id: ActiveModule.BatchStoryWriting, label: "Viết Truyện Hàng Loạt", icon: "📚" },
      { id: ActiveModule.EditStory, label: "Biên Tập Truyện", icon: "✂️" },
      { id: ActiveModule.Rewrite, label: "Viết Lại", icon: "🔄" },
      { id: ActiveModule.BatchRewrite, label: "Viết Lại Hàng Loạt", icon: "🔀" },
      { id: ActiveModule.Translate, label: "Dịch Thuật AI", icon: "🌐" },
    ]
  },
  {
    title: "Phân Tích & Ý Tưởng",
    icon: "✨",
    subItems: [
      { id: ActiveModule.Analysis, label: "Phân Tích Truyện", icon: "✨" },
      { id: ActiveModule.ContentSummarizer, label: "Tóm Tắt Nội Dung", icon: "📋" },
      { id: ActiveModule.ViralTitleGenerator, label: "Phân tích & Mở rộng Chủ đề", icon: "💡" },
      { id: ActiveModule.Dream100CompetitorAnalysis, label: "Dream 100 (Đối Thủ)", icon: "🎯" },
      { id: ActiveModule.YouTubeSEO, label: "YouTube SEO & Từ Khóa", icon: "📊" },
    ]
  },
  {
    title: "Xưởng AI",
    icon: "🤖",
    subItems: [
      { id: ActiveModule.ImageGenerationSuite, label: "Xưởng Tạo Ảnh AI", icon: "🎨" },
      { id: ActiveModule.ImageEditor, label: "Chỉnh Sửa Ảnh AI", icon: "🖼️" },
      { id: ActiveModule.CharacterStudio, label: "Xưởng Nhân Vật AI", icon: "👤" },
      { id: ActiveModule.TTS, label: "Đọc Truyện AI", icon: "🎙️" },
    ]
  },
  {
    title: "Hỗ Trợ & Hướng Dẫn",
    icon: "🆘",
    subItems: [
       { id: ActiveModule.Support, label: "Hỗ Trợ & Liên Hệ", icon: "📞" },
       { id: ActiveModule.Tutorials, label: "Hướng Dẫn Sử Dụng", icon: "📚" },
       { id: ActiveModule.Pricing, label: "Gói Cước & Giá", icon: "💸" },
    ]
  },
  {
    title: "Cài Đặt",
    icon: "⚙️",
    subItems: [
       { id: ActiveModule.Settings, label: "Quản Lý API Keys", icon: "🔑" },
    ]
  }
];

export const DEFAULT_API_PROVIDER = "gemini";

export const ELEVENLABS_API_URL = 'https://api.elevenlabs.io';

export const STORY_LENGTH_OPTIONS = [
    { value: "500", label: "Truyện rất ngắn (~500 từ)" },
    { value: "1000", label: "Truyện ngắn (~1,000 từ)" },
    { value: "2000", label: "Truyện vừa (~2,000 từ)" },
    { value: "5000", label: "Tiểu thuyết ngắn (~5,000 từ)" },
    { value: "10000", label: "Tiểu thuyết (~10,000 từ)" },
    { value: "20000", label: "Tiểu thuyết dài (~20,000 từ)" },
    { value: "30000", label: "Tiểu thuyết rất dài (~30,000 từ)" },
];

export const WRITING_STYLE_OPTIONS = [
    { value: "descriptive", label: "Miêu tả chi tiết" },
    { value: "concise", label: "Súc tích" },
    { value: "emotional", label: "Giàu cảm xúc" },
    { value: "humorous", label: "Hài hước" },
    { value: "custom", label: "Tùy chỉnh..." },
];

export const HOOK_LANGUAGE_OPTIONS = [
    { value: "Vietnamese", label: "Tiếng Việt" },
    { value: "English", label: "Tiếng Anh" },
    { value: "Spanish", label: "Tiếng Tây Ban Nha" },
    { value: "French", label: "Tiếng Pháp" },
    { value: "German", label: "Tiếng Đức" },
    { value: "Portuguese", label: "Tiếng Bồ Đào Nha" },
    { value: "Russian", label: "Tiếng Nga" },
    { value: "Arabic", label: "Tiếng Ả Rập" },
    { value: "Hindi", label: "Tiếng Hindi" },
    { value: "Korean", label: "Tiếng Hàn" },
    { value: "Japanese", label: "Tiếng Nhật" },
    { value: "Chinese", label: "Tiếng Trung" },
];

export const TRANSLATE_LANGUAGE_OPTIONS = [
    { value: "Vietnamese", label: "Tiếng Việt" },
    { value: "English", label: "English (Tiếng Anh)" },
    { value: "Arabic", label: "Arabic (Tiếng Ả Rập)" },
    { value: "Bengali", label: "Bengali (Tiếng Bengal)" },
    { value: "Chinese (Simplified)", label: "Chinese (Tiếng Trung)" },
    { value: "Filipino", label: "Filipino (Tiếng Filipino)" },
    { value: "French", label: "French (Tiếng Pháp)" },
    { value: "German", label: "German (Tiếng Đức)" },
    { value: "Hindi", label: "Hindi (Tiếng Hindi)" },
    { value: "Indonesian", label: "Indonesian (Tiếng Indonesia)" },
    { value: "Japanese", label: "Japanese (Tiếng Nhật)" },
    { value: "Korean", label: "Korean (Tiếng Hàn)" },
    { value: "Portuguese", label: "Portuguese (Tiếng Bồ Đào Nha)" },
    { value: "Russian", label: "Russian (Tiếng Nga)" },
    { value: "Spanish", label: "Spanish (Tiếng Tây Ban Nha)" },
    { value: "Thai", label: "Thai (Tiếng Thái)" },
    { value: "Urdu", label: "Urdu (Tiếng Urdu)" },
];

export const TRANSLATE_STYLE_OPTIONS = [
    { value: "Default", label: "Phong cách Mặc định" },
    { value: "Informal", label: "Thân mật / Gần gũi" },
    { value: "Formal", label: "Trang trọng / Lịch sự" },
    { value: "Technical", label: "Kỹ thuật / Chuyên ngành" },
    { value: "Creative", label: "Sáng tạo / Văn học" },
];

export const HOOK_STYLE_OPTIONS = [
    { value: "Gây tò mò, bí ẩn", label: "Gây tò mò, bí ẩn" },
    { value: "Hành động, kịch tính", label: "Hành động, kịch tính" },
    { value: "Cảm xúc, nội tâm", label: "Cảm xúc, nội tâm" },
    { value: "Gây sốc, bất ngờ", label: "Gây sốc, bất ngờ" },
    { value: "Hài hước, châm biếm", label: "Hài hước, châm biếm" },
    { value: "custom", label: "Tùy chỉnh..." },
];

export const HOOK_LENGTH_OPTIONS = [
    { value: "30", label: "Rất ngắn (~30 từ)" },
    { value: "50", label: "Ngắn (~50 từ)" },
    { value: "100", label: "Vừa (~100 từ)" },
    { value: "150", label: "Dài (~150 từ)" },
];

export const HOOK_STRUCTURE_OPTIONS = [
    { value: "default", label: "AI tự quyết (Mặc định)" },
    { value: "aida", label: "AIDA (Chú ý, Thích thú, Mong muốn, Hành động)" },
    { value: "pas", label: "PAS (Vấn đề, Kích động, Giải pháp)" },
    { value: "open_loop", label: "Open Loop (Vòng lặp Mở/Bỏ lửng)" },
    { value: "bab", label: "Before-After-Bridge (Trước-Sau-Cầu nối)" },
    { value: "heros_journey", label: "Hero's Journey (Lát cắt Hành trình Anh hùng)" },
    { value: "rhetorical_promise", label: "Câu hỏi Tu từ + Hứa hẹn" },
    { value: "shock_stat", label: "Thống kê/Sự thật Gây sốc" },
];

export const LESSON_LENGTH_OPTIONS = [
    { value: "50", label: "Rất ngắn (~50 từ)" },
    { value: "100", label: "Ngắn (~100 từ)" },
    { value: "150", label: "Vừa (~150 từ)" },
    { value: "200", label: "Dài (~200 từ)" },
];

export const LESSON_WRITING_STYLE_OPTIONS = [
    { value: "profound", label: "Sâu sắc, triết lý" },
    { value: "inspirational", label: "Truyền cảm hứng" },
    { value: "practical", label: "Thực tế, ứng dụng" },
    { value: "simple", label: "Đơn giản, dễ hiểu (cho trẻ em)" },
    { value: "custom", label: "Tùy chỉnh..." },
];

export const OPENAI_TTS_MODELS = [
    { id: 'tts-1', name: 'TTS-1 (Standard, Tối ưu Tốc độ)' },
    { id: 'tts-1-hd', name: 'TTS-1-HD (Chất lượng cao)' },
];

export const OPENAI_TTS_VOICES = [
    { id: 'alloy', name: 'Alloy' },
    { id: 'echo', name: 'Echo' },
    { id: 'fable', name: 'Fable' },
    { id: 'onyx', name: 'Onyx' },
    { id: 'nova', name: 'Nova' },
    { id: 'shimmer', name: 'Shimmer' },
];

export const ELEVENLABS_MODELS = [
    { id: 'eleven_multilingual_v2', name: 'Eleven Multilingual v2' },
    { id: 'eleven_multilingual_v1', name: 'Eleven Multilingual v1' },
    { id: 'eleven_mono_v1', name: 'Eleven Mono v1' },
];

export const STABILITY_STYLE_PRESETS = [
    { value: "cinematic", label: "Cinematic" },
    { value: "photographic", label: "Photographic" },
    { value: "anime", label: "Anime" },
    { value: "digital-art", label: "Digital Art" },
    { value: "comic-book", label: "Comic Book" },
    { value: "fantasy-art", label: "Fantasy Art" },
    { value: "low-poly", label: "Low Poly" },
    { value: "isometric", label: "Isometric" },
];

export const PLOT_STRUCTURE_OPTIONS = [
    { 
        value: "Three-Act Structure", 
        label: "Cấu trúc 3 Hồi (Phổ biến)",
        description: "Chia câu chuyện thành ba phần chính: Hồi 1 - Thiết lập (Setup), Hồi 2 - Đối đầu (Confrontation), và Hồi 3 - Giải quyết (Resolution). Đây là cấu trúc nền tảng và linh hoạt cho nhiều loại truyện.",
        genres: ["Phim điện ảnh", "Tiểu thuyết", "Kịch", "Truyện ngắn nói chung", "Drama gia đình", "Đời sống"]
    },
    { 
        value: "The Hero's Journey", 
        label: "Hành trình của Người hùng",
        description: "Theo chân một người hùng rời bỏ thế giới quen thuộc, đối mặt thử thách, học hỏi, trưởng thành và quay trở về với sự thay đổi. Thường bao gồm các giai đoạn như Lời Kêu Gọi Phiêu Lưu, Từ Chối Lời Kêu Gọi, Gặp Gỡ Người Thầy, Thử Thách Đầu Tiên, Tiếp Cận Hang Sâu, Vượt Qua Thử Thách Lớn Nhất, Phần Thưởng, Con Đường Trở Về, Sự Phục Sinh, và Mang Linh Dược Trở Về.",
        genres: ["Phiêu lưu", "Kỳ ảo (Fantasy)", "Khoa học viễn tưởng", "Thần thoại", "Hành động có chiều sâu nhân vật", "Truyện cổ tích"]
    },
    { 
        value: "Fichtean Curve", 
        label: "Đường cong Fichte (Bắt đầu bằng hành động)",
        description: "Bắt đầu câu chuyện ngay giữa một phân cảnh hành động hoặc khủng hoảng cao độ (in medias res), sau đó mới từ từ tiết lộ bối cảnh và các sự kiện dẫn đến tình huống đó thông qua hồi tưởng hoặc lời kể, rồi tiếp tục đẩy căng thẳng lên đến đỉnh điểm và giải quyết.",
        genres: ["Hành động", "Kinh dị", "Trinh thám", "Giật gân (Thriller)", "Truyện ngắn cần tạo ấn tượng mạnh ngay từ đầu"]
    },
    { 
        value: "Tragedy", 
        label: "Bi kịch",
        description: "Nhân vật chính, thường có phẩm chất tốt đẹp hoặc vị thế cao, phải đối mặt với sự sụp đổ không thể tránh khỏi do một lỗi lầm bi kịch (tragic flaw), định mệnh, hoặc các thế lực vượt quá tầm kiểm soát. Kết thúc thường buồn thảm, mang tính thanh lọc cảm xúc (catharsis).",
        genres: ["Kịch cổ điển", "Drama bi kịch", "Tiểu thuyết tâm lý xã hội", "Câu chuyện lịch sử có yếu tố bi thương"]
    },
    {
        value: "Save the Cat! Beat Sheet",
        label: "Save the Cat! (15 bước)",
        description: "Một cấu trúc chi tiết gồm 15 'beat' (điểm nhấn/bước ngoặt) chính, được phát triển bởi Blake Snyder. Cung cấp một lộ trình rõ ràng cho việc phát triển kịch bản phim, từ Hình ảnh Mở đầu, Chủ đề, Thiết lập, Chất xúc tác, Tranh luận, Bước ngoặt Hồi 2, Câu chuyện B, Trò vui và Trò chơi, Điểm giữa, Kẻ xấu Bủa vây, Tất cả Đều Mất, Đêm Tối của Linh hồn, Bước ngoặt Hồi 3, Chung kết, đến Hình ảnh Kết thúc.",
        genres: ["Kịch bản phim (đặc biệt là Hollywood)", "Tiểu thuyết thương mại", "Phim truyền hình nhiều tập"]
    },
    {
        value: "Dan Harmon's Story Circle",
        label: "Vòng tròn Kể chuyện Dan Harmon (8 bước)",
        description: "Một biến thể 8 bước của 'Hành trình Người hùng', tập trung vào sự thay đổi và phát triển của nhân vật qua một chu trình: 1. Nhân vật ở vùng thoải mái, 2. Muốn điều gì đó, 3. Bước vào một tình huống xa lạ, 4. Thích nghi với nó, 5. Có được thứ họ muốn, 6. Trả một cái giá đắt, 7. Quay trở lại tình huống quen thuộc, 8. Đã thay đổi.",
        genres: ["Phim sitcom", "Phim hoạt hình (ví dụ: Rick and Morty)", "Kể chuyện theo từng tập", "Web series", "Truyện ngắn tập trung vào nhân vật"]
    },
    {
        value: "Seven-Point Story Structure",
        label: "Cấu trúc 7 Điểm",
        description: "Tập trung vào 7 điểm mấu chốt định hình câu chuyện: 1. Hook (Móc câu), 2. Plot Turn 1 (Bước ngoặt cốt truyện 1 - đẩy nhân vật vào cuộc phiêu lưu), 3. Pinch Point 1 (Điểm kẹp 1 - áp lực từ phe đối đầu), 4. Midpoint (Điểm giữa - nhân vật chuyển từ phản ứng sang hành động), 5. Pinch Point 2 (Điểm kẹp 2 - áp lực mạnh hơn), 6. Plot Turn 2 (Bước ngoặt cốt truyện 2 - nhân vật tìm ra giải pháp cuối cùng), 7. Resolution (Giải quyết).",
        genres: ["Tiểu thuyết (đặc biệt là thể loại kỳ ảo, phiêu lưu)", "Kịch bản phim", "Truyện dài tập cần nhiều nút thắt"]
    },
    {
        value: "Freytag's Pyramid",
        label: "Kim tự tháp Freytag (Cấu trúc kịch cổ điển)",
        description: "Mô hình cấu trúc kịch 5 phần cổ điển: 1. Exposition (Giới thiệu - bối cảnh, nhân vật), 2. Rising Action (Phát triển - các sự kiện làm tăng căng thẳng), 3. Climax (Cao trào - đỉnh điểm của xung đột), 4. Falling Action (Suy thoái - hậu quả của cao trào, căng thẳng giảm dần), 5. Denouement/Catastrophe (Kết thúc/Thảm họa - giải quyết cuối cùng, có thể là kết thúc tốt đẹp hoặc bi thảm).",
        genres: ["Kịch cổ điển (Shakespeare)", "Opera", "Tiểu thuyết truyền thống", "Một số phim điện ảnh có cấu trúc rõ ràng"]
    },
    { 
        value: "custom", 
        label: "Tùy chỉnh...",
        description: "Cho phép bạn tự định nghĩa cấu trúc hoặc yêu cầu AI tạo một cấu trúc độc đáo dựa trên các mô tả cụ thể của bạn trong ô 'Yêu cầu Cốt truyện Tùy chỉnh'.",
        genres: ["Mọi thể loại (tùy theo yêu cầu của bạn)"]
    },
];


export const ASPECT_RATIO_OPTIONS = [
    { value: "16:9", label: "Ngang (16:9)" },
    { value: "1:1", label: "Vuông (1:1)" },
    { value: "9:16", label: "Dọc (9:16)" },
];

export const REWRITE_STYLE_OPTIONS = [
    { value: "like the original style", label: "Giữ nguyên phong cách" },
    { value: "more formal and academic", label: "Trang trọng hơn" },
    { value: "friendlier and more approachable", label: "Thân thiện hơn" },
    { value: "more creative and imaginative", label: "Sáng tạo hơn" },
    { value: "simpler and easier to understand", label: "Đơn giản hơn" },
    { value: "custom", label: "Tùy chỉnh..." },
];

export const OUTLINE_DETAIL_LEVEL_OPTIONS = [
    { value: "standard", label: "Tiêu chuẩn (Cảnh theo cảnh)" },
    { value: "detailed", label: "Chi tiết (Mô tả hành động, lời thoại gợi ý)" },
    { value: "in-depth", label: "Chuyên sâu (Phân tích tâm lý, subtext)" },
];

// Options for Image Generation Modules
export const IMAGE_GENERATION_ENGINE_OPTIONS = [ 
    { value: "google", label: "Google Imagen (Đề xuất)" },
    { value: "stability", label: "Stability AI (SD3)" },
    { value: "chatgpt", label: "ChatGPT (DALL-E)" },
    { value: "deepseek", label: "DeepSeek Image" },
];

export const PREDEFINED_ART_STYLES = [
  { value: "default", label: "Mặc định (AI tự quyết)" },
  { value: "photorealistic", label: "Ảnh thực (Photorealistic)" },
  { value: "cinematic_detailed", label: "Điện ảnh, chi tiết cao (Cinematic, highly detailed)" },
  { value: "anime_style", label: "Phong cách Anime" },
  { value: "cartoon_style", label: "Phong cách Hoạt hình (Cartoon)" },
  { value: "fantasy_art", label: "Nghệ thuật Kỳ ảo (Fantasy Art)" },
  { value: "sci_fi_concept", label: "Concept Khoa học Viễn tưởng (Sci-fi Concept)" },
  { value: "watercolor_painting", label: "Tranh màu nước (Watercolor)" },
  { value: "oil_painting_style", label: "Phong cách Tranh sơn dầu (Oil Painting)" },
  { value: "pixel_art_8bit", label: "Nghệ thuật Pixel (8-bit Pixel Art)" },
  { value: "3d_render_octane", label: "Kết xuất 3D (Octane Render style)" },
  { value: "line_art_detailed", label: "Nét vẽ chi tiết (Detailed Line Art)" },
  { value: "impressionistic", label: "Phong cách Ấn tượng (Impressionistic)" },
  { value: "cyberpunk_neon", label: "Cyberpunk Neon" },
  { value: "vintage_photo", label: "Ảnh Cổ điển (Vintage Photo)" },
];

// For ViralTitleGeneratorModule
export const VARIATION_GOAL_OPTIONS = [
    { value: "default", label: "Mặc định (AI tự do sáng tạo)" },
    { value: "increase_curiosity", label: "Tăng tính Tò mò & Bí ẩn" },
    { value: "add_strong_emotion", label: "Thêm Yếu tố Cảm xúc Mạnh (sốc, vui, buồn)" },
    { value: "shorten_and_focus", label: "Rút gọn & Tập trung vào Điểm Chính" },
    { value: "add_numbers_specifics", label: "Thêm Con số/Dữ liệu Cụ thể (nếu hợp lý)" },
    { value: "target_different_audience", label: "Hướng đến Đối tượng Khác (chung chung)" },
    { value: "create_warning_urgent", label: "Tạo phiên bản 'Cảnh báo/Tin Khẩn'" },
    { value: "question_format", label: "Chuyển thành dạng Câu hỏi Gợi mở" },
    { value: "before_after_transformation", label: "Nhấn mạnh Yếu tố 'Trước & Sau' / 'Biến đổi'" },
];
