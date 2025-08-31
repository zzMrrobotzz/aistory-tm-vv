import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://aistory-backend.onrender.com/api';

export interface RequestUsage {
  current: number;
  limit: number;
  remaining: number;
  percentage: number;
  lastRequestAt?: string;
}

export interface RequestCheckResult {
  success: boolean;
  blocked?: boolean;
  message: string;
  usage: RequestUsage;
  warning?: string;
}

/**
 * Check if user can make a request and track it immediately
 * Call this BEFORE starting any AI operation
 */
export const checkAndTrackRequest = async (action: string): Promise<RequestCheckResult> => {
  try {
    console.log('🔍 RequestTrackingService: Checking request for action:', action);
    const token = localStorage.getItem('userToken');
    console.log('🔑 RequestTrackingService: Token exists:', !!token);
    
    if (!token) {
      return {
        success: false,
        blocked: true,
        message: 'Vui lòng đăng nhập để sử dụng tính năng này',
        usage: {
          current: 0,
          limit: 200,
          remaining: 200,
          percentage: 0
        }
      };
    }

    console.log('📡 RequestTrackingService: Making API call to:', `${API_URL}/requests/check-and-track`);
    const response = await axios.post(`${API_URL}/requests/check-and-track`, 
      { action }, 
      {
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        }
      }
    );
    console.log('📊 RequestTrackingService: API response:', response.data);

    return {
      success: true,
      blocked: false,
      message: response.data.message,
      usage: response.data.usage,
      warning: response.data.warning
    };
    
  } catch (error: any) {
    console.error('Error checking request limit:', error);
    
    if (error.response?.status === 429) {
      // Rate limited
      return {
        success: false,
        blocked: true,
        message: error.response.data.message || 'Đã đạt giới hạn requests hôm nay',
        usage: error.response.data.usage || {
          current: 200,
          limit: 200,
          remaining: 0,
          percentage: 100
        }
      };
    }
    
    // On error, allow request but show warning
    return {
      success: true,
      blocked: false,
      message: 'Không thể kiểm tra giới hạn request. Hệ thống sẽ hoạt động bình thường.',
      usage: {
        current: 0,
        limit: 200,
        remaining: 200,
        percentage: 0
      },
      warning: 'Lỗi kết nối. Không thể kiểm tra giới hạn requests.'
    };
  }
};

/**
 * Get current user's request status
 */
export const getRequestStatus = async (): Promise<RequestUsage> => {
  try {
    const token = localStorage.getItem('userToken');
    
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await axios.get(`${API_URL}/requests/status`, {
      headers: {
        'x-auth-token': token,
        'Content-Type': 'application/json'
      }
    });

    return response.data.usage;
    
  } catch (error) {
    console.error('Error getting request status:', error);
    throw error;
  }
};

/**
 * Get user's request history
 */
export const getRequestHistory = async (days: number = 7) => {
  try {
    const token = localStorage.getItem('userToken');
    
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await axios.get(`${API_URL}/requests/history?days=${days}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token
      }
    });

    return response.data;
    
  } catch (error) {
    console.error('Error fetching request history:', error);
    throw error;
  }
};

/**
 * Reset daily request count (for testing)
 */
export const resetDailyRequests = async () => {
  try {
    const token = localStorage.getItem('userToken');
    
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await axios.post(`${API_URL}/requests/reset-daily`, {}, {
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token
      }
    });

    return response.data;
    
  } catch (error) {
    console.error('Error resetting daily requests:', error);
    throw error;
  }
};

/**
 * Show user-friendly error message
 */
export const showRequestLimitError = (result: RequestCheckResult) => {
  if (result.blocked) {
    alert(`❌ ${result.message}\n\nUsage: ${result.usage.current}/${result.usage.limit} requests`);
  } else if (result.warning) {
    alert(`⚠️ ${result.warning}`);
  }
};

/**
 * Action names mapping for different features
 */
export const REQUEST_ACTIONS = {
  WRITE_STORY: 'write-story',
  BATCH_STORY: 'batch-story-writing', 
  REWRITE: 'rewrite',
  BATCH_REWRITE: 'batch-rewrite',
  IMAGE_GEN: 'image-generation',
  ANALYSIS: 'analysis',
  TTS: 'text-to-speech',
  CREATIVE_LAB: 'creative-lab',
  SUPER_AGENT: 'super-agent',
  EDIT_STORY: 'edit-story',
  STORY_OUTLINE: 'story-outline'
} as const;

export type RequestAction = typeof REQUEST_ACTIONS[keyof typeof REQUEST_ACTIONS];