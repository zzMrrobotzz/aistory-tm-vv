import { getCurrentUserToken } from './authService';

const API_BASE_URL = 'https://aistory-backend.onrender.com/api';

export interface UsageLogData {
  module: string;
  action: string;
  count?: number;
}

// Module names mapping
export const MODULE_NAMES = {
  'creative-lab': 'Xây Dàn Ý',
  'write-story': 'Viết Truyện',
  'batch-story-writing': 'Viết Truyện Hàng Loạt',
  'edit-story': 'Biên Tập Truyện',
  'rewrite': 'Viết Lại',
  'batch-rewrite': 'Viết Lại Hàng Loạt',
  'translate': 'Dịch Thuật',
  'analysis': 'Phân Tích',
  'image-generation-suite': 'Tạo Ảnh AI',
  'character-studio': 'Nhân Vật AI',
  'tts': 'Đọc Truyện AI',
  'youtube-seo': 'YouTube SEO',
  'viral-title-generator': 'Viral Title',
  'dream-100': 'Dream 100',
  'super-agent': 'Siêu Trợ Lý'
};

// Action types
export const ACTIONS = {
  STORY_GENERATED: 'story_generated',
  IMAGE_GENERATED: 'image_generated',
  TEXT_REWRITTEN: 'text_rewritten',
  VIDEO_CREATED: 'video_created',
  API_CALL: 'api_call',
  MODULE_ACCESSED: 'module_accessed'
};

class UsageService {
  private static instance: UsageService;
  private isLogging = false;

  static getInstance(): UsageService {
    if (!UsageService.instance) {
      UsageService.instance = new UsageService();
    }
    return UsageService.instance;
  }

  /**
   * Log user activity to backend
   */
  async logUsage(data: UsageLogData): Promise<boolean> {
    // Prevent multiple simultaneous logging
    if (this.isLogging) return false;
    
    try {
      this.isLogging = true;
      const token = getCurrentUserToken();
      
      if (!token) {
        console.warn('No auth token found, skipping usage logging');
        return false;
      }

      const response = await fetch(`${API_BASE_URL}/user/log-usage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result.success;

    } catch (error) {
      console.error('Error logging usage:', error);
      return false;
    } finally {
      this.isLogging = false;
    }
  }

  /**
   * Log API call usage
   */
  async logApiCall(module: string, count: number = 1): Promise<boolean> {
    return this.logUsage({
      module: MODULE_NAMES[module as keyof typeof MODULE_NAMES] || module,
      action: ACTIONS.API_CALL,
      count
    });
  }

  /**
   * Log story generation
   */
  async logStoryGenerated(module: string, count: number = 1): Promise<boolean> {
    return this.logUsage({
      module: MODULE_NAMES[module as keyof typeof MODULE_NAMES] || module,
      action: ACTIONS.STORY_GENERATED,
      count
    });
  }

  /**
   * Log image generation
   */
  async logImageGenerated(module: string, count: number = 1): Promise<boolean> {
    return this.logUsage({
      module: MODULE_NAMES[module as keyof typeof MODULE_NAMES] || module,
      action: ACTIONS.IMAGE_GENERATED,
      count
    });
  }

  /**
   * Log text rewriting
   */
  async logTextRewritten(module: string, count: number = 1): Promise<boolean> {
    return this.logUsage({
      module: MODULE_NAMES[module as keyof typeof MODULE_NAMES] || module,
      action: ACTIONS.TEXT_REWRITTEN,
      count
    });
  }

  /**
   * Log video creation
   */
  async logVideoCreated(module: string, count: number = 1): Promise<boolean> {
    return this.logUsage({
      module: MODULE_NAMES[module as keyof typeof MODULE_NAMES] || module,
      action: ACTIONS.VIDEO_CREATED,
      count
    });
  }

  /**
   * Log module access (when user opens a module)
   */
  async logModuleAccess(module: string): Promise<boolean> {
    return this.logUsage({
      module: MODULE_NAMES[module as keyof typeof MODULE_NAMES] || module,
      action: ACTIONS.MODULE_ACCESSED,
      count: 1
    });
  }

  /**
   * Batch log multiple activities
   */
  async logMultipleUsage(activities: UsageLogData[]): Promise<boolean> {
    const promises = activities.map(activity => this.logUsage(activity));
    const results = await Promise.allSettled(promises);
    
    // Return true if at least one succeeded
    return results.some(result => result.status === 'fulfilled' && result.value === true);
  }
}

// Export singleton instance
export const usageService = UsageService.getInstance();

// Convenience functions
export const logApiCall = (module: string, count?: number) => usageService.logApiCall(module, count);
export const logStoryGenerated = (module: string, count?: number) => usageService.logStoryGenerated(module, count);
export const logImageGenerated = (module: string, count?: number) => usageService.logImageGenerated(module, count);
export const logTextRewritten = (module: string, count?: number) => usageService.logTextRewritten(module, count);
export const logVideoCreated = (module: string, count?: number) => usageService.logVideoCreated(module, count);
export const logModuleAccess = (module: string) => usageService.logModuleAccess(module);

export default usageService;