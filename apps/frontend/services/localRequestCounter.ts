// Local Request Counter - Enhanced with Backend Sync
// Uses Vietnam timezone and syncs with backend when available

interface DailyRequestData {
  date: string; // YYYY-MM-DD format
  count: number;
  limit: number;
}

const STORAGE_KEY = 'daily-request-counter';
const DAILY_LIMIT = 999999;
const BACKEND_SYNC_KEY = 'request-counter-last-sync';

// Import auth service for backend sync
import { authService } from './authService';

// Get today's date string in Vietnam timezone (YYYY-MM-DD)
const getTodayDateString = (): string => {
  // Use Vietnam timezone instead of UTC
  const now = new Date();
  const vietnamTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
  return vietnamTime.toISOString().split('T')[0];
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

// Get time until next reset (midnight Vietnam time)
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

// Sync with backend request tracking (optional)
const syncWithBackend = async (): Promise<DailyRequestData | null> => {
  try {
    const token = localStorage.getItem('userToken');
    if (!token) return null;

    const response = await fetch('https://aistory-backend.onrender.com/api/requests/status', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) return null;

    const backendData = await response.json();
    if (backendData.success && backendData.usage) {
      const today = getTodayDateString();
      const syncedData: DailyRequestData = {
        date: today,
        count: backendData.usage.current || 0,
        limit: backendData.usage.limit || DAILY_LIMIT
      };

      // Save synced data to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(syncedData));
      localStorage.setItem(BACKEND_SYNC_KEY, new Date().toISOString());
      
      console.log(`🔄 Synced with backend: ${syncedData.count}/${syncedData.limit}`);
      return syncedData;
    }
  } catch (error) {
    console.warn('Backend sync failed, using local data:', error);
  }
  
  return null;
};

// Enhanced getTodayRequestData with optional backend sync
export const getTodayRequestDataWithSync = async (): Promise<DailyRequestData> => {
  const localData = getTodayRequestData();
  
  // Check if we need to sync with backend (every 5 minutes)
  try {
    const lastSync = localStorage.getItem(BACKEND_SYNC_KEY);
    const shouldSync = !lastSync || 
      (new Date().getTime() - new Date(lastSync).getTime()) > (5 * 60 * 1000);
    
    if (shouldSync) {
      const syncedData = await syncWithBackend();
      if (syncedData) return syncedData;
    }
  } catch (error) {
    console.warn('Sync check failed:', error);
  }
  
  return localData;
};

// Force sync and reset if there's a discrepancy
export const forceResetAndSync = async (): Promise<DailyRequestData> => {
  try {
    console.log('🔄 Force resetting and syncing...');
    
    // Clear local storage
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(BACKEND_SYNC_KEY);
    
    // Try to sync with backend first
    const syncedData = await syncWithBackend();
    if (syncedData) {
      console.log('✅ Force reset: Synced with backend');
      return syncedData;
    }
    
    // Fallback to fresh local data
    const freshData = getTodayRequestData();
    console.log('✅ Force reset: Using fresh local data');
    return freshData;
    
  } catch (error) {
    console.error('Error during force reset:', error);
    return getTodayRequestData();
  }
};

// Debug function to check both local and backend data
export const debugRequestCounter = async () => {
  console.log('=== DEBUG REQUEST COUNTER ===');
  
  const localData = getTodayRequestData();
  console.log('Local data:', localData);
  
  const backendData = await syncWithBackend();
  console.log('Backend data:', backendData);
  
  const lastSync = localStorage.getItem(BACKEND_SYNC_KEY);
  console.log('Last sync:', lastSync);
  
  console.log('Vietnam date:', getTodayDateString());
  console.log('UTC date:', new Date().toISOString().split('T')[0]);
  
  const timeUntilReset = getTimeUntilReset();
  console.log('Time until reset:', timeUntilReset);
  
  return {
    local: localData,
    backend: backendData,
    lastSync,
    vietnamDate: getTodayDateString(),
    utcDate: new Date().toISOString().split('T')[0],
    timeUntilReset
  };
};