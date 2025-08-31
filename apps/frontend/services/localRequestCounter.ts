// Local Request Counter - No Database Required
// Resets automatically at midnight daily

interface DailyRequestData {
  date: string; // YYYY-MM-DD format
  count: number;
  limit: number;
}

const STORAGE_KEY = 'daily-request-counter';
const DAILY_LIMIT = 200;

// Get today's date string (YYYY-MM-DD)
const getTodayDateString = (): string => {
  return new Date().toISOString().split('T')[0];
};

// Get current request data for today
export const getTodayRequestData = (): DailyRequestData => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const today = getTodayDateString();
    
    if (stored) {
      const data: DailyRequestData = JSON.parse(stored);
      
      // Check if data is from today
      if (data.date === today) {
        return data;
      }
    }
    
    // Return fresh data for today
    const freshData: DailyRequestData = {
      date: today,
      count: 0,
      limit: DAILY_LIMIT
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(freshData));
    return freshData;
    
  } catch (error) {
    console.warn('Error loading request data:', error);
    // Return safe default
    return {
      date: getTodayDateString(),
      count: 0,
      limit: DAILY_LIMIT
    };
  }
};

// Check if user can make a request
export const canMakeRequest = (): boolean => {
  const data = getTodayRequestData();
  return data.count < data.limit;
};

// Increment request count and return updated data
export const incrementRequestCount = (): DailyRequestData => {
  const data = getTodayRequestData();
  
  if (data.count < data.limit) {
    data.count += 1;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      console.log(`📊 Request counted: ${data.count}/${data.limit}`);
    } catch (error) {
      console.warn('Error saving request count:', error);
    }
  }
  
  return data;
};

// Get usage statistics
export const getUsageStats = () => {
  const data = getTodayRequestData();
  const remaining = Math.max(0, data.limit - data.count);
  const percentage = Math.round((data.count / data.limit) * 100);
  
  return {
    current: data.count,
    limit: data.limit,
    remaining,
    percentage,
    canUse: data.count < data.limit,
    isBlocked: data.count >= data.limit
  };
};

// Get time until next reset (midnight)
export const getTimeUntilReset = (): { hours: number; minutes: number; seconds: number } => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const msUntilReset = tomorrow.getTime() - now.getTime();
  
  const hours = Math.floor(msUntilReset / (1000 * 60 * 60));
  const minutes = Math.floor((msUntilReset % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((msUntilReset % (1000 * 60)) / 1000);
  
  return { hours, minutes, seconds };
};

// Reset counter manually (for testing)
export const resetCounter = (): DailyRequestData => {
  const today = getTodayDateString();
  const freshData: DailyRequestData = {
    date: today,
    count: 0,
    limit: DAILY_LIMIT
  };
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(freshData));
    console.log('🔄 Request counter reset');
  } catch (error) {
    console.warn('Error resetting counter:', error);
  }
  
  return freshData;
};