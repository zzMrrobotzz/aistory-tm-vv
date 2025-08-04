// YouTube Transcript Extraction Utilities
// Multiple approaches to extract transcripts from YouTube videos - NO API KEY REQUIRED

interface TranscriptSegment {
    text: string;
    start: number;
    duration: number;
}

interface TranscriptResult {
    success: boolean;
    transcript: string;
    segments?: TranscriptSegment[];
    error?: string;
    source: 'api' | 'scraping' | 'fallback';
}

// Extract YouTube video ID from various URL formats
export function extractYouTubeVideoId(url: string): string | null {
    const regexPatterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|m\.youtube\.com\/watch\?v=|youtube\.com\/watch\?.*&v=)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
    ];
    
    for (const pattern of regexPatterns) {
        const match = url.match(pattern);
        if (match) {
            return match[1];
        }
    }
    
    return null;
}

// Approach 1: Try backend API first (if available)
async function tryBackendTranscript(videoId: string): Promise<TranscriptResult> {
    try {
        const token = localStorage.getItem('userToken');
        const response = await fetch('https://aistory-backend.onrender.com/api/youtube/transcript', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token || ''
            },
            body: JSON.stringify({ videoId })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.transcript) {
                return {
                    success: true,
                    transcript: data.transcript,
                    segments: data.segments,
                    source: 'api'
                };
            }
        }
    } catch (error) {
        console.log('Backend transcript API not available:', error);
    }

    return { success: false, transcript: '', error: 'Backend API not available', source: 'api' };
}

// Approach 2: YouTube Transcript API (third-party service) - FREE
async function tryThirdPartyTranscript(videoId: string): Promise<TranscriptResult> {
    const services = [
        // Free transcript services
        `https://youtube-transcript-api.vercel.app/api/transcript?videoId=${videoId}`,
        `https://youtubetranscript.com/?server_vid2=${videoId}`,
    ];

    for (const serviceUrl of services) {
        try {
            const response = await fetch(serviceUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data && Array.isArray(data)) {
                    const transcript = data.map((segment: any) => segment.text || segment.content).join(' ');
                    return {
                        success: true,
                        transcript: transcript.trim(),
                        segments: data.map((segment: any) => ({
                            text: segment.text || segment.content,
                            start: segment.offset || segment.start || 0,
                            duration: segment.duration || 0
                        })),
                        source: 'api'
                    };
                } else if (data && data.transcript) {
                    return {
                        success: true,
                        transcript: data.transcript,
                        source: 'api'
                    };
                }
            }
        } catch (error) {
            console.log(`Service ${serviceUrl} failed:`, error);
            continue;
        }
    }

    return { success: false, transcript: '', error: 'Third-party API failed', source: 'api' };
}

// Approach 3: Alternative transcript services - FREE
async function tryAlternativeServices(videoId: string): Promise<TranscriptResult> {
    try {
        // Try CORS-friendly approach with a transcript service
        const proxyUrl = 'https://api.allorigins.win/raw?url=';
        const targetUrl = `https://www.youtube.com/watch?v=${videoId}`;
        
        const response = await fetch(proxyUrl + encodeURIComponent(targetUrl));
        
        if (response.ok) {
            const html = await response.text();
            
            // Try to extract captions from page source
            const captionMatches = html.match(/"captions":\s*({[^}]+})/);
            if (captionMatches) {
                // Found captions data in page source
                return {
                    success: true,
                    transcript: `Đã tìm thấy dữ liệu phụ đề trong video này, nhưng cần xử lý thêm để trích xuất. Video ID: ${videoId}`,
                    source: 'scraping'
                };
            }
        }
    } catch (error) {
        console.log('Alternative services failed:', error);
    }

    return { success: false, transcript: '', error: 'Alternative services failed', source: 'scraping' };
}

// Approach 4: Extract video metadata as fallback - ALWAYS WORKS
async function tryVideoMetadata(videoId: string): Promise<TranscriptResult> {
    try {
        // YouTube oEmbed API - FREE, no key required
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        
        const response = await fetch(oembedUrl);
        if (response.ok) {
            const data = await response.json();
            
            let fallbackContent = '';
            if (data.title) {
                fallbackContent += `Tiêu đề video: ${data.title}\n\n`;
            }
            if (data.author_name) {
                fallbackContent += `Kênh YouTube: ${data.author_name}\n\n`;
            }
            
            // Add video description and metadata
            fallbackContent += `Video URL: https://www.youtube.com/watch?v=${videoId}\n\n`;
            
            if (data.title) {
                fallbackContent += `Mô tả sơ bộ:\n`;
                fallbackContent += `Đây là video có tiêu đề "${data.title}" từ kênh ${data.author_name || 'YouTube'}. `;
                fallbackContent += `Video này có thể chứa các thông tin, hướng dẫn, giải trí hoặc giáo dục liên quan đến chủ đề được đề cập trong tiêu đề. `;
                fallbackContent += `Để có thông tin chi tiết hơn, bạn có thể xem trực tiếp video hoặc cung cấp nội dung transcript thủ công.\n\n`;
            }
            
            fallbackContent += `Lưu ý: Không thể tự động trích xuất phụ đề/transcript từ video này. Có thể do:\n`;
            fallbackContent += `- Video không có phụ đề tự động\n`;
            fallbackContent += `- Phủ đề bị khóa bởi người tạo\n`;
            fallbackContent += `- Cài đặt riêng tư của video\n\n`;
            fallbackContent += `Bạn có thể thử:\n`;
            fallbackContent += `1. Bật phụ đề trên YouTube và copy thủ công\n`;
            fallbackContent += `2. Sử dụng tab "Văn bản" để dán nội dung\n`;
            fallbackContent += `3. Mô tả nội dung video để AI phân tích`;

            return {
                success: true,
                transcript: fallbackContent,
                source: 'fallback'
            };
        }
    } catch (error) {
        console.log('Video metadata extraction failed:', error);
    }

    // Final fallback if even oEmbed fails
    return { 
        success: true, 
        transcript: `Video YouTube được phát hiện: ${videoId}\n\nURL: https://www.youtube.com/watch?v=${videoId}\n\nKhông thể trích xuất thông tin video tự động. Vui lòng:\n1. Xem video trực tiếp trên YouTube\n2. Copy nội dung/transcript thủ công\n3. Sử dụng tab "Văn bản" để phân tích nội dung`,
        source: 'fallback'
    };
}

// Main function to extract transcript using multiple approaches
export async function extractYouTubeTranscript(url: string): Promise<TranscriptResult> {
    const videoId = extractYouTubeVideoId(url);
    
    if (!videoId) {
        return {
            success: false,
            transcript: '',
            error: 'URL YouTube không hợp lệ hoặc không thể trích xuất video ID',
            source: 'fallback'
        };
    }

    console.log(`🎬 Đang trích xuất transcript cho video: ${videoId}`);

    // Try approaches in order of preference
    const approaches = [
        { name: 'Backend API', fn: () => tryBackendTranscript(videoId) },
        { name: 'Third-party Services', fn: () => tryThirdPartyTranscript(videoId) },
        { name: 'Alternative Methods', fn: () => tryAlternativeServices(videoId) },
        { name: 'Video Metadata', fn: () => tryVideoMetadata(videoId) }
    ];

    for (let i = 0; i < approaches.length; i++) {
        try {
            console.log(`🔄 Thử phương pháp ${i + 1}: ${approaches[i].name}...`);
            const result = await approaches[i].fn();
            
            if (result.success && result.transcript.trim()) {
                console.log(`✅ Thành công với phương pháp: ${approaches[i].name} (${result.source})`);
                return result;
            }
        } catch (error) {
            console.log(`❌ Phương pháp ${i + 1} thất bại:`, error);
            continue;
        }
    }

    // This should never happen because tryVideoMetadata always returns success
    return {
        success: false,
        transcript: `Lỗi không mong đợi khi xử lý video: ${url}`,
        error: 'Tất cả phương pháp đều thất bại',
        source: 'fallback'
    };
}

// Helper function to format transcript for better readability
export function formatTranscript(transcript: string, segments?: TranscriptSegment[]): string {
    if (!transcript.trim()) return transcript;

    // If we have segments with timestamps, format them nicely
    if (segments && segments.length > 0) {
        return segments.map(segment => {
            const minutes = Math.floor(segment.start / 60);
            const seconds = Math.floor(segment.start % 60);
            const timestamp = `[${minutes}:${seconds.toString().padStart(2, '0')}]`;
            return `${timestamp} ${segment.text}`;
        }).join('\n');
    }

    // Basic formatting for plain transcript
    return transcript
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/([.!?])\s*/g, '$1\n') // Add line breaks after sentences
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');
}

// Validate YouTube URL format
export function isValidYouTubeUrl(url: string): boolean {
    return extractYouTubeVideoId(url) !== null;
}