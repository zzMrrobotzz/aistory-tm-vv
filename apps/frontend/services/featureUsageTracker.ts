// Feature Usage Tracker - Tracks actual feature usage with backend sync
// Each successful feature usage counts as 1 use (e.g., 1 rewrite = 1 use)

const API_URL = 'https://aistory-backend.onrender.com/api';

interface FeatureUsageData {
  date: string; // YYYY-MM-DD
  totalUses: number; // Keep totalUses for internal use
  current?: number; // Backend field name
  dailyLimit: number;
  remaining: number;
  percentage: number;
  isBlocked: boolean;
  featureBreakdown: {
    [featureId: string]: {
      count: number;
      lastUsed: string;
    };
  };
}

const STORAGE_KEY = 'feature-usage-tracker';
const BACKEND_SYNC_KEY = 'feature-usage-last-sync';
const DEFAULT_DAILY_LIMIT = 300; // 300 feature uses per day

// Backend sync functions
const getAuthToken = (): string | null => {
  return localStorage.getItem('userToken');
};

const syncWithBackend = async (): Promise<FeatureUsageData | null> => {
  try {
    const token = getAuthToken();
    if (!token) {
      console.warn('No auth token, skipping backend sync');
      return null;
    }

    const response = await fetch(`${API_URL}/features/usage-status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      console.warn('Backend sync failed:', response.status, response.statusText);
      return null;
    }

    const backendData = await response.json();
    if (backendData.success && backendData.data.usage) {
      const usage = backendData.data.usage;
      const today = getTodayVietnam();
      
      const syncedData: FeatureUsageData = {
        date: today,
        totalUses: usage.current || usage.totalUses || 0, // Handle both field names
        dailyLimit: usage.dailyLimit || DEFAULT_DAILY_LIMIT,
        remaining: usage.remaining || 0,
        percentage: usage.percentage || 0,
        isBlocked: usage.isBlocked || false,
        featureBreakdown: usage.featureBreakdown || {}
      };

      // Save synced data to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(syncedData));
      localStorage.setItem(BACKEND_SYNC_KEY, new Date().toISOString());
      
      console.log(`🔄 Synced with backend: ${syncedData.totalUses}/${syncedData.dailyLimit}`);
      return syncedData;
    }
  } catch (error) {
    console.warn('Backend sync failed, using local data:', error);
  }
  
  return null;
};

const trackWithBackend = async (featureId: string, featureName: string): Promise<boolean> => {
  try {
    const token = getAuthToken();
    if (!token) {
      console.warn('No auth token, skipping backend tracking');
      return false;
    }

    const response = await fetch(`${API_URL}/features/track-usage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        featureId,
        featureName
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.usage) {
        // Update local storage with backend data
        const today = getTodayVietnam();
        const usage = data.usage;
        
        const updatedData: FeatureUsageData = {
          date: today,
          totalUses: usage.current || usage.totalUses || 0, // Handle both field names
          dailyLimit: usage.dailyLimit || DEFAULT_DAILY_LIMIT,
          remaining: usage.remaining || 0,
          percentage: usage.percentage || 0,
          isBlocked: usage.isBlocked || false,
          featureBreakdown: usage.featureBreakdown || {}
        };
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
        console.log(`✅ Backend tracked: ${updatedData.totalUses}/${updatedData.dailyLimit} (${featureId})`);
        return true;
      }
    } else if (response.status === 429) {
      // Rate limit exceeded
      const errorData = await response.json();
      console.warn('⚠️ Backend rate limit exceeded:', errorData.message);
      if (errorData.usage) {
        // Update local data with backend limits
        const today = getTodayVietnam();
        const usage = errorData.usage;
        
        const blockedData: FeatureUsageData = {
          date: today,
          totalUses: usage.current || usage.totalUses || 0, // Handle both field names
          dailyLimit: usage.dailyLimit || DEFAULT_DAILY_LIMIT,
          remaining: usage.remaining || 0,
          percentage: usage.percentage || 100,
          isBlocked: true,
          featureBreakdown: usage.featureBreakdown || {}
        };
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(blockedData));
      }
      return false;
    }
  } catch (error) {
    console.warn('Backend tracking failed:', error);
  }
  
  return false;
};

// Get today's date in Vietnam timezone
const getTodayVietnam = (): string => {
  const now = new Date();
  const vietnamTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
  return vietnamTime.toISOString().split('T')[0];
};

// Get current feature usage data with backend sync
export const getFeatureUsageStats = async (): Promise<FeatureUsageData> => {
  try {
    // Check if we should sync with backend (every 2 minutes or if no recent sync)
    const lastSync = localStorage.getItem(BACKEND_SYNC_KEY);
    const shouldSync = !lastSync || 
      (new Date().getTime() - new Date(lastSync).getTime()) > (2 * 60 * 1000);
    
    if (shouldSync) {
      const syncedData = await syncWithBackend();
      if (syncedData) return syncedData;
    }
    
    // Fallback to local data
    const stored = localStorage.getItem(STORAGE_KEY);
    const today = getTodayVietnam();
    
    if (stored) {
      const data = JSON.parse(stored);
      if (data.date === today) {
        return data;
      }
    }
    
    // Return fresh data for today
    const freshData: FeatureUsageData = {
      date: today,
      totalUses: 0,
      dailyLimit: DEFAULT_DAILY_LIMIT,
      remaining: DEFAULT_DAILY_LIMIT,
      percentage: 0,
      isBlocked: false,
      featureBreakdown: {}
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(freshData));
    return freshData;
    
  } catch (error) {
    console.warn('Error loading feature usage data:', error);
    return {
      date: getTodayVietnam(),
      totalUses: 0,
      dailyLimit: DEFAULT_DAILY_LIMIT,
      remaining: DEFAULT_DAILY_LIMIT,
      percentage: 0,
      isBlocked: false,
      featureBreakdown: {}
    };
  }
};

// Synchronous version for immediate UI updates
export const getFeatureUsageStatsSync = (): FeatureUsageData => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const today = getTodayVietnam();
    
    if (stored) {
      const data = JSON.parse(stored);
      if (data.date === today) {
        return data;
      }
    }
    
    // Return fresh data for today
    const freshData: FeatureUsageData = {
      date: today,
      totalUses: 0,
      dailyLimit: DEFAULT_DAILY_LIMIT,
      remaining: DEFAULT_DAILY_LIMIT,
      percentage: 0,
      isBlocked: false,
      featureBreakdown: {}
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(freshData));
    return freshData;
    
  } catch (error) {
    console.warn('Error loading feature usage data:', error);
    return {
      date: getTodayVietnam(),
      totalUses: 0,
      dailyLimit: DEFAULT_DAILY_LIMIT,
      remaining: DEFAULT_DAILY_LIMIT,
      percentage: 0,
      isBlocked: false,
      featureBreakdown: {}
    };
  }
};

// Check if user can use a feature (sync version for immediate checks)
export const canUseFeature = (featureId?: string): boolean => {
  const data = getFeatureUsageStatsSync();
  return data.totalUses < data.dailyLimit;
};

// Track feature usage - call this when feature is successfully used
export const trackFeatureUsage = async (featureId: string, featureName?: string): Promise<FeatureUsageData> => {
  const effectiveFeatureName = featureName || FEATURE_NAMES[featureId as keyof typeof FEATURE_NAMES] || featureId;
  
  // Try backend tracking first
  const backendTracked = await trackWithBackend(featureId, effectiveFeatureName);
  
  if (backendTracked) {
    // Backend tracking successful, return updated data
    return getFeatureUsageStatsSync();
  }
  
  // Backend failed, fallback to local tracking
  console.warn('Backend tracking failed, using local fallback');
  const data = getFeatureUsageStatsSync();
  
  if (data.totalUses < data.dailyLimit) {
    // Increment total usage
    data.totalUses += 1;
    data.remaining = data.dailyLimit - data.totalUses;
    data.percentage = Math.round((data.totalUses / data.dailyLimit) * 100);
    data.isBlocked = data.totalUses >= data.dailyLimit;
    
    // Track breakdown by feature
    if (!data.featureBreakdown[featureId]) {
      data.featureBreakdown[featureId] = {
        count: 0,
        lastUsed: new Date().toISOString()
      };
    }
    
    data.featureBreakdown[featureId].count += 1;
    data.featureBreakdown[featureId].lastUsed = new Date().toISOString();
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      console.log(`✅ Local feature usage tracked: ${data.totalUses}/${data.dailyLimit} (${featureId})`);
    } catch (error) {
      console.warn('Error saving feature usage data:', error);
    }
  } else {
    console.warn(`⚠️ Feature usage blocked: ${data.totalUses}/${data.dailyLimit} (${featureId})`);
  }
  
  return data;
};

// Get time until midnight Vietnam (reset time)
export const getTimeUntilReset = (): { hours: number; minutes: number; seconds: number } => {
  const now = new Date();
  const vietnamTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
  
  const tomorrow = new Date(vietnamTime);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const msUntilReset = tomorrow.getTime() - vietnamTime.getTime();
  
  const hours = Math.floor(msUntilReset / (1000 * 60 * 60));
  const minutes = Math.floor((msUntilReset % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((msUntilReset % (1000 * 60)) / 1000);
  
  return { hours, minutes, seconds };
};

// Reset counter (for admin/testing)
export const resetFeatureUsage = (): FeatureUsageData => {
  const today = getTodayVietnam();
  const freshData: FeatureUsageData = {
    date: today,
    totalUses: 0,
    dailyLimit: DEFAULT_DAILY_LIMIT,
    remaining: DEFAULT_DAILY_LIMIT,
    percentage: 0,
    isBlocked: false,
    featureBreakdown: {}
  };
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(freshData));
    console.log('🔄 Feature usage counter reset');
  } catch (error) {
    console.warn('Error resetting feature usage:', error);
  }
  
  return freshData;
};

// Get usage warning message based on percentage
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

// Feature IDs constants
export const FEATURE_IDS = {
  REWRITE: 'rewrite',
  WRITE_STORY: 'write-story',
  QUICK_STORY: 'quick-story',
  SHORT_FORM_SCRIPT: 'short-form-script',
  IMAGE_GENERATION: 'image-generation',
  TEXT_TO_SPEECH: 'text-to-speech',
  CREATIVE_LAB: 'creative-lab'
} as const;

// Feature names for display
export const FEATURE_NAMES = {
  [FEATURE_IDS.REWRITE]: 'Viết Lại',
  [FEATURE_IDS.WRITE_STORY]: 'Viết Truyện',
  [FEATURE_IDS.QUICK_STORY]: 'Viết Truyện Nhanh',
  [FEATURE_IDS.SHORT_FORM_SCRIPT]: 'Script Ngắn',
  [FEATURE_IDS.IMAGE_GENERATION]: 'Tạo Hình Ảnh',
  [FEATURE_IDS.TEXT_TO_SPEECH]: 'Chuyển Văn Bản Thành Giọng Nói',
  [FEATURE_IDS.CREATIVE_LAB]: 'Phòng Thí Nghiệm Sáng Tạo'
} as const;

export default {
  getUsageStats: getFeatureUsageStats,
  getUsageStatsSync: getFeatureUsageStatsSync,
  canUse: canUseFeature,
  trackUsage: trackFeatureUsage,
  reset: resetFeatureUsage,
  getTimeUntilReset,
  getWarningMessage: getUsageWarningMessage,
  FEATURE_IDS,
  FEATURE_NAMES
};