// Feature Usage Tracker - Tracks actual feature usage (not requests)
// Each successful feature usage counts as 1 use (e.g., 1 rewrite = 1 use)

interface FeatureUsageData {
  date: string; // YYYY-MM-DD
  totalUses: number;
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
const DEFAULT_DAILY_LIMIT = 300; // 300 feature uses per day

// Get today's date in Vietnam timezone
const getTodayVietnam = (): string => {
  const now = new Date();
  const vietnamTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
  return vietnamTime.toISOString().split('T')[0];
};

// Get current feature usage data
export const getFeatureUsageStats = (): FeatureUsageData => {
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

// Check if user can use a feature
export const canUseFeature = (featureId?: string): boolean => {
  const data = getFeatureUsageStats();
  return data.totalUses < data.dailyLimit;
};

// Track feature usage - call this when feature is successfully used
export const trackFeatureUsage = (featureId: string, featureName?: string): FeatureUsageData => {
  const data = getFeatureUsageStats();
  
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
      console.log(`✅ Feature usage tracked: ${data.totalUses}/${data.dailyLimit} (${featureId})`);
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
  canUse: canUseFeature,
  trackUsage: trackFeatureUsage,
  reset: resetFeatureUsage,
  getTimeUntilReset,
  getWarningMessage: getUsageWarningMessage,
  FEATURE_IDS,
  FEATURE_NAMES
};