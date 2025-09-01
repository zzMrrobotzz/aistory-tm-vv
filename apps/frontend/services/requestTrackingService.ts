import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://aistory-tm-backend.onrender.com';

export const REQUEST_ACTIONS = {
  WRITE_STORY: 'write-story',
  BATCH_STORY: 'batch-story-writing', 
  REWRITE: 'rewrite',
  BATCH_REWRITE: 'batch-rewrite',
  IMAGE_GEN: 'image-generation',
  IMAGE_EDIT: 'image-edit',
  ANALYSIS: 'analysis',
  TTS: 'text-to-speech',
  CREATIVE_LAB: 'creative-lab',
  SUPER_AGENT: 'super-agent',
  EDIT_STORY: 'edit-story',
  STORY_OUTLINE: 'story-outline',
  SHORT_FORM_SCRIPT: 'short-form-script'
} as const;

export interface RequestTrackingResponse {
  success: boolean;
  blocked?: boolean;
  message: string;
  usage?: {
    current: number;
    limit: number;
    remaining: number;
    percentage: number;
    isBlocked: boolean;
  };
  status?: number;
}

export interface UsageStatusResponse {
  success: boolean;
  data: {
    usage: {
      current: number;
      limit: number;
      remaining: number;
      percentage: number;
      isBlocked: boolean;
      resetTime: number;
    };
    config: {
      resetTime: number;
    };
  };
}

// Kiểm tra và ghi nhận request
export const checkAndTrackRequest = async (action: string): Promise<RequestTrackingResponse> => {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) {
      return {
        success: false,
        message: 'Không tìm thấy token xác thực'
      };
    }

    console.log(`Checking and tracking request for action: ${action}`);

    const response = await axios.post(
      `${API_URL}/api/requests/check-and-track`,
      { action },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        validateStatus: () => true // Không throw error cho HTTP status codes
      }
    );

    console.log('Request tracking response:', response.data);

    if (response.status >= 400) {
      return {
        success: false,
        blocked: response.status === 429,
        message: response.data?.message || `Error: ${response.status}`,
        usage: response.data?.usage || null,
        status: response.status
      };
    }

    return {
      success: true,
      blocked: false,
      message: response.data.message,
      usage: response.data.usage
    };

  } catch (error) {
    console.error('Error in checkAndTrackRequest:', error);
    return {
      success: false,
      message: 'Lỗi kết nối server',
      status: 500
    };
  }
};

// Lấy trạng thái usage hiện tại
export const getUserUsageStatus = async (): Promise<UsageStatusResponse> => {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Không tìm thấy token xác thực');
    }

    const response = await axios.get(
      `${API_URL}/api/user/usage-status`,
      {
        headers: {
          'x-auth-token': token
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error getting usage status:', error);
    throw error;
  }
};

// Ghi nhận usage (đơn giản hóa)
export const recordUsage = async (moduleId: string, action?: string): Promise<any> => {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Không tìm thấy token xác thực');
    }

    const response = await axios.post(
      `${API_URL}/api/user/record-usage`,
      { moduleId, action: action || 'generate' },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error recording usage:', error);
    throw error;
  }
};