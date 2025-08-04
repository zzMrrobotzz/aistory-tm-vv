const API_URL = 'https://aistory-backend.onrender.com/api';

export interface FAQ {
  _id: string;
  question: string;
  answer: string;
  category: 'general' | 'technical' | 'billing' | 'features' | 'troubleshooting';
  priority: number;
  isActive: boolean;
}

export interface QuickLink {
  _id: string;
  title: string;
  url: string;
  description?: string;
  icon: string;
  isActive: boolean;
}

export interface ContactInfo {
  primaryContact: string;
  contactValue: string;
  contactName: string;
  secondaryContacts: Array<{
    type: string;
    label: string;
    value: string;
    isActive: boolean;
  }>;
}

export interface SupportContent {
  supportTitle: string;
  supportDescription: string;
  contactInfo: ContactInfo;
  faqSection?: {
    title: string;
    faqs: FAQ[];
  };
  contactGuidelines?: {
    title: string;
    guidelines: Array<{
      text: string;
      isActive: boolean;
    }>;
  };
  supportHours?: {
    timezone: string;
    schedule: Array<{
      dayOfWeek: string;
      startTime: string;
      endTime: string;
      isActive: boolean;
    }>;
  };
  quickLinks?: {
    title: string;
    links: QuickLink[];
  };
  announcement?: {
    type: 'info' | 'warning' | 'success' | 'error';
    title?: string;
    message?: string;
  };
  styling: {
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
  };
}

export interface SupportServiceResponse {
  success: boolean;
  data?: SupportContent;
  message?: string;
  error?: string;
}

// Get support content for frontend display
export const getSupportContent = async (): Promise<SupportServiceResponse> => {
  try {
    const response = await fetch(`${API_URL}/support-content`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('Error fetching support content:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Lỗi không xác định khi tải nội dung hỗ trợ'
    };
  }
};

// Get FAQs by category
export const getFAQsByCategory = async (category: string): Promise<SupportServiceResponse> => {
  try {
    const response = await fetch(`${API_URL}/support-content/faq/${category}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('Error fetching FAQs by category:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Lỗi không xác định khi tải FAQ'
    };
  }
};

// Helper function to get FAQ category colors
export const getFAQCategoryColor = (category: string): string => {
  const colors = {
    general: '#3B82F6', // Blue
    technical: '#F59E0B', // Orange  
    billing: '#10B981', // Green
    features: '#8B5CF6', // Purple
    troubleshooting: '#EF4444', // Red
  };
  return colors[category as keyof typeof colors] || '#6B7280'; // Gray fallback
};

// Helper function to get FAQ category names in Vietnamese
export const getFAQCategoryName = (category: string): string => {
  const names = {
    general: 'Chung',
    technical: 'Kỹ thuật',
    billing: 'Thanh toán',
    features: 'Tính năng',
    troubleshooting: 'Khắc phục sự cố',
  };
  return names[category as keyof typeof names] || category;
};

// Helper function to get announcement type color
export const getAnnouncementTypeColor = (type: string): string => {
  const colors = {
    info: '#3B82F6', // Blue
    warning: '#F59E0B', // Orange
    success: '#10B981', // Green
    error: '#EF4444', // Red
  };
  return colors[type as keyof typeof colors] || '#6B7280'; // Gray fallback
};

// Fallback support content (used when API fails)
export const getFallbackSupportContent = (): SupportContent => ({
  supportTitle: '📞 Trung Tâm Hỗ Trợ & Liên Hệ',
  supportDescription: 'Nếu bạn cần hỗ trợ, giải đáp thắc mắc hoặc có bất kỳ yêu cầu nào liên quan đến Tool Viết Truyện AI Story - ALL IN ONE, vui lòng liên hệ với chúng tôi qua Zalo:',
  contactInfo: {
    primaryContact: 'Zalo',
    contactValue: '0339933882',
    contactName: 'Đức Đại MMO',
    secondaryContacts: []
  },
  contactGuidelines: {
    title: 'Lưu ý khi liên hệ:',
    guidelines: [
      { text: 'Vui lòng cung cấp thông tin chi tiết về vấn đề bạn gặp phải.', isActive: true },
      { text: 'Nếu có thể, hãy kèm theo ảnh chụp màn hình hoặc video mô tả lỗi.', isActive: true },
      { text: 'Thời gian phản hồi có thể từ vài phút đến vài giờ tùy thuộc vào số lượng yêu cầu.', isActive: true }
    ]
  },
  styling: {
    primaryColor: '#3B82F6',
    accentColor: '#10B981',
    backgroundColor: '#FFFFFF'
  }
});