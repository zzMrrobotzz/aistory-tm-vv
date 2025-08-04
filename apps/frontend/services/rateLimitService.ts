const API_URL = 'https://aistory-backend.onrender.com/api';

export interface UsageStatus {
  current: number;
  limit: number;
  remaining: number;
  percentage: number;
  isBlocked: boolean;
  blockReason?: string;
  moduleUsage: Array<{
    moduleId: string;
    moduleName: string;
    requestCount: number;
    weightedUsage: number;
  }>;
  lastActivity: string;
}

export interface RateLimitConfig {
  isEnabled: boolean;
  dailyLimit: number;
  restrictedModules: Array<{
    id: string;
    name: string;
    weight: number;
  }>;
  resetTime: string;
  timezone: string;
}

export interface RateLimitCheckResult {
  canProceed: boolean;
  usageStatus: UsageStatus;
  config: RateLimitConfig;
  warning?: {
    message: string;
    percentage: number;
  };
  errorMessage?: string;
}

// Map frontend module names to backend module IDs
const MODULE_ID_MAP: Record<string, string> = {
  'write-story': 'write-story',
  'batch-story-writing': 'batch-story-writing', 
  'rewrite': 'rewrite',
  'batch-rewrite': 'batch-rewrite'
};

const MODULE_NAME_MAP: Record<string, string> = {
  'write-story': 'Viết Truyện Đơn',
  'batch-story-writing': 'Viết Truyện Hàng Loạt',
  'rewrite': 'Viết Lại Đơn', 
  'batch-rewrite': 'Viết Lại Hàng Loạt'
};

/**
 * Check if user can make a request for specific module
 */
export const checkRateLimit = async (moduleId: string): Promise<RateLimitCheckResult> => {
  try {
    const token = localStorage.getItem('userToken');
    
    if (!token) {
      return {
        canProceed: false,
        usageStatus: {
          current: 0,
          limit: 0,
          remaining: 0,
          percentage: 0,
          isBlocked: false,
          moduleUsage: [],
          lastActivity: new Date().toISOString()
        },
        config: {
          isEnabled: false,
          dailyLimit: 0,
          restrictedModules: [],
          resetTime: '00:00',
          timezone: 'Asia/Ho_Chi_Minh'
        },
        errorMessage: 'Vui lòng đăng nhập để sử dụng tính năng này'
      };
    }

    const response = await fetch(`${API_URL}/user/usage-status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    if (!data.success) {
      return {
        canProceed: false,
        usageStatus: {
          current: 0,
          limit: 0,
          remaining: 0,
          percentage: 0,
          isBlocked: false,
          moduleUsage: [],
          lastActivity: new Date().toISOString()
        },
        config: {
          isEnabled: false,
          dailyLimit: 0,
          restrictedModules: [],
          resetTime: '00:00',
          timezone: 'Asia/Ho_Chi_Minh'
        },
        errorMessage: data.message
      };
    }

    const { usage, config, warning } = data.data;
    
    // Check if rate limiting is enabled
    if (!config.isEnabled) {
      return {
        canProceed: true,
        usageStatus: usage,
        config: config
      };
    }

    // Check if this module is restricted
    const backendModuleId = MODULE_ID_MAP[moduleId];
    const isModuleRestricted = config.restrictedModules.some(
      (m: any) => m.id === backendModuleId
    );
    
    if (!isModuleRestricted) {
      return {
        canProceed: true,
        usageStatus: usage,
        config: config
      };
    }

    // Check if user is blocked
    if (usage.isBlocked) {
      return {
        canProceed: false,
        usageStatus: usage,
        config: config,
        errorMessage: `Tài khoản đã bị tạm khóa: ${usage.blockReason}`
      };
    }

    // Get module weight
    const moduleWeight = config.restrictedModules.find(
      (m: any) => m.id === backendModuleId
    )?.weight || 1;

    // Check if user would exceed limit
    const wouldExceedLimit = (usage.current + moduleWeight) > usage.limit;
    
    return {
      canProceed: !wouldExceedLimit,
      usageStatus: usage,
      config: config,
      warning: warning,
      errorMessage: wouldExceedLimit ? 
        `Bạn đã vượt quá giới hạn ${usage.limit} requests/ngày cho các module chính. Vui lòng thử lại vào ngày mai hoặc nâng cấp gói.` : 
        undefined
    };

  } catch (error) {
    console.error('Error checking rate limit:', error);
    
    // Return permissive result on error to avoid breaking functionality
    return {
      canProceed: true,
      usageStatus: {
        current: 0,
        limit: 200,
        remaining: 200,
        percentage: 0,
        isBlocked: false,
        moduleUsage: [],
        lastActivity: new Date().toISOString()
      },
      config: {
        isEnabled: false, // Disable on error
        dailyLimit: 200,
        restrictedModules: [],
        resetTime: '00:00',
        timezone: 'Asia/Ho_Chi_Minh'
      },
      warning: {
        message: 'Không thể kiểm tra giới hạn usage. Hệ thống sẽ hoạt động bình thường.',
        percentage: 0
      }
    };
  }
};

/**
 * Record usage after successful API call
 */
export const recordUsage = async (moduleId: string): Promise<boolean> => {
  try {
    const token = localStorage.getItem('userToken');
    
    if (!token) {
      return false;
    }

    const backendModuleId = MODULE_ID_MAP[moduleId];
    const moduleName = MODULE_NAME_MAP[moduleId];
    
    if (!backendModuleId) {
      // Module not tracked, return success
      return true;
    }

    const response = await fetch(`${API_URL}/user/record-usage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token
      },
      body: JSON.stringify({
        moduleId: backendModuleId,
        moduleName: moduleName
      })
    });

    const data = await response.json();
    return data.success || false;
    
  } catch (error) {
    console.error('Error recording usage:', error);
    // Don't fail the request if usage recording fails
    return true;
  }
};

/**
 * Get user's usage history
 */
export const getUserUsageHistory = async (days: number = 7) => {
  try {
    const token = localStorage.getItem('userToken');
    
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_URL}/user/usage-history?days=${days}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return data;
    
  } catch (error) {
    console.error('Error fetching usage history:', error);
    throw error;
  }
};

/**
 * Check if a module is restricted
 */
export const isModuleRestricted = (moduleId: string): boolean => {
  return Object.keys(MODULE_ID_MAP).includes(moduleId);
};

/**
 * Get user-friendly error message based on usage status
 */
export const getUsageErrorMessage = (usageStatus: UsageStatus, moduleId: string): string => {
  if (usageStatus.isBlocked) {
    return `Tài khoản đã bị tạm khóa: ${usageStatus.blockReason}`;
  }
  
  if (usageStatus.remaining <= 0) {
    return `Bạn đã hết quota hôm nay (${usageStatus.current}/${usageStatus.limit}). Vui lòng thử lại vào ngày mai hoặc nâng cấp gói.`;
  }
  
  const moduleName = MODULE_NAME_MAP[moduleId] || moduleId;
  return `Không thể sử dụng ${moduleName} do vượt giới hạn hàng ngày.`;
};

/**
 * Get warning message based on usage percentage
 */
export const getUsageWarningMessage = (percentage: number): string | null => {
  if (percentage >= 90) {
    return '⚠️ Bạn đã sử dụng 90% quota hôm nay. Hãy sử dụng cẩn thận!';
  } else if (percentage >= 75) {
    return '⚠️ Bạn đã sử dụng 75% quota hôm nay. Chỉ còn 25% cho hôm nay.';
  } else if (percentage >= 50) {
    return 'ℹ️ Bạn đã sử dụng 50% quota hôm nay. Hãy cân nhắc việc sử dụng hợp lý.';
  }
  
  return null;
};

/**
 * Get user's current usage status (simplified for UsageQuotaDisplay)
 */
export const getUserUsageStatus = async () => {
  const token = localStorage.getItem('userToken');
  if (!token) {
    throw new Error('No authentication token found');
  }

  const response = await fetch(`${API_URL}/user/usage-status`, {
    headers: {
      'x-auth-token': token,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to get usage status: ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.message || 'Failed to get usage status');
  }

  const { usage, config, warning } = data.data;
  
  return {
    canProceed: !usage.isBlocked && usage.remaining > 0,
    totalUsage: usage.current,
    usageLimit: usage.limit,
    remainingRequests: usage.remaining,
    percentage: usage.percentage,
    subscription: 'free', // You might want to get this from user profile
    moduleBreakdown: usage.moduleUsage.map((m: any) => ({
      moduleId: m.moduleId,
      requestCount: m.requestCount,
      weightedUsage: m.weightedUsage
    })),
    warning: warning,
    resetTime: new Date().setHours(24, 0, 0, 0) // Reset at midnight
  };
};