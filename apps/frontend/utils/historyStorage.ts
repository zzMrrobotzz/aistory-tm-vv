// History storage utility for managing recent articles
export interface HistoryItem {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  module: string;
  metadata?: {
    storyQualityStats?: {
      consistencyScore: number;
      completenessScore: number;
      overallQualityScore: number;
      analysis: {
        characterConsistency: string;
        plotCoherence: string;
        timelineConsistency: string;
        settingConsistency: string;
        overallAssessment: string;
      };
    };
    wordStats?: {
      originalWords: number;
      rewrittenWords: number;
      wordsChanged: number;
      changePercentage: number;
    };
  };
}

const HISTORY_KEY_PREFIX = 'ai_story_history_';
const MAX_HISTORY_ITEMS = 5;

export const HistoryStorage = {
  // Save a new item to history for specific module
  saveToHistory: (moduleKey: string, title: string, content: string, metadata?: any): void => {
    const historyKey = `${HISTORY_KEY_PREFIX}${moduleKey}`;
    const existingHistory = HistoryStorage.getHistory(moduleKey);
    
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      title: title || 'Không có tiêu đề',
      content,
      createdAt: new Date().toISOString(),
      module: moduleKey,
      ...(metadata && { metadata })
    };
    
    // Add to beginning of array and limit to MAX_HISTORY_ITEMS
    const updatedHistory = [newItem, ...existingHistory].slice(0, MAX_HISTORY_ITEMS);
    
    try {
      localStorage.setItem(historyKey, JSON.stringify(updatedHistory));
    } catch (error) {
      console.error('Failed to save to history:', error);
    }
  },

  // Get history items for specific module
  getHistory: (moduleKey: string): HistoryItem[] => {
    const historyKey = `${HISTORY_KEY_PREFIX}${moduleKey}`;
    try {
      const stored = localStorage.getItem(historyKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load history:', error);
      return [];
    }
  },

  // Clear history for specific module
  clearHistory: (moduleKey: string): void => {
    const historyKey = `${HISTORY_KEY_PREFIX}${moduleKey}`;
    try {
      localStorage.removeItem(historyKey);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  },

  // Delete specific item from history
  deleteHistoryItem: (moduleKey: string, itemId: string): void => {
    const existingHistory = HistoryStorage.getHistory(moduleKey);
    const filteredHistory = existingHistory.filter(item => item.id !== itemId);
    
    const historyKey = `${HISTORY_KEY_PREFIX}${moduleKey}`;
    try {
      localStorage.setItem(historyKey, JSON.stringify(filteredHistory));
    } catch (error) {
      console.error('Failed to delete history item:', error);
    }
  }
};

// Module keys for different components
export const MODULE_KEYS = {
  WRITE_STORY: 'write_story',
  BATCH_STORY_WRITING: 'batch_story_writing',
  REWRITE: 'rewrite',
  BATCH_REWRITE: 'batch_rewrite'
} as const;