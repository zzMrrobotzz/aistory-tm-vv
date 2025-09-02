// Simple Local Usage Tracker - Bypass backend issues
// Fallback solution for persistent 401 authentication problems

interface SimpleUsageData {
  date: string; // YYYY-MM-DD
  count: number;
  limit: number;
  remaining: number;
  percentage: number;
  isBlocked: boolean;
}

const STORAGE_KEY = 'simple-usage-tracker';
const DEFAULT_LIMIT = 999999;

// Get today's date in Vietnam timezone
const getTodayVietnam = (): string => {
  const now = new Date();
  const vietnamTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
  return vietnamTime.toISOString().split('T')[0];
};

// Get current usage data
export const getSimpleUsageStats = (): SimpleUsageData => {
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
    const freshData: SimpleUsageData = {
      date: today,
      count: 0,
      limit: DEFAULT_LIMIT,
      remaining: DEFAULT_LIMIT,
      percentage: 0,
      isBlocked: false
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(freshData));
    return freshData;
    
  } catch (error) {
    console.warn('Error loading simple usage data:', error);
    return {
      date: getTodayVietnam(),
      count: 0,
      limit: DEFAULT_LIMIT,
      remaining: DEFAULT_LIMIT,
      percentage: 0,
      isBlocked: false
    };
  }
};

// Check if user can make request
export const canMakeSimpleRequest = (): boolean => {
  const data = getSimpleUsageStats();
  return data.count < data.limit;
};

// Increment usage count
export const incrementSimpleUsage = (moduleName?: string): SimpleUsageData => {
  const data = getSimpleUsageStats();
  
  if (data.count < data.limit) {
    data.count += 1;
    data.remaining = data.limit - data.count;
    data.percentage = Math.round((data.count / data.limit) * 100);
    data.isBlocked = data.count >= data.limit;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      console.log(`✅ Simple usage tracked: ${data.count}/${data.limit} (${moduleName || 'unknown'})`);
    } catch (error) {
      console.warn('Error saving simple usage data:', error);
    }
  }
  
  return data;
};

// Reset counter (for admin/testing)
export const resetSimpleUsage = (): SimpleUsageData => {
  const today = getTodayVietnam();
  const freshData: SimpleUsageData = {
    date: today,
    count: 0,
    limit: DEFAULT_LIMIT,
    remaining: DEFAULT_LIMIT,
    percentage: 0,
    isBlocked: false
  };
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(freshData));
    console.log('🔄 Simple usage counter reset');
  } catch (error) {
    console.warn('Error resetting simple usage:', error);
  }
  
  return freshData;
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

// Export default interface for easy switching
export default {
  getUsageStats: getSimpleUsageStats,
  canMakeRequest: canMakeSimpleRequest,
  incrementUsage: incrementSimpleUsage,
  resetUsage: resetSimpleUsage,
  getTimeUntilReset
};