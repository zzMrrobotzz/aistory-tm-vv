// API Key storage utility for managing user's API keys locally
export interface StoredApiKey {
  id: string;
  provider: 'openai' | 'gemini' | 'deepseek' | 'elevenlabs' | 'stability';
  name: string; // User-defined name for the key
  key: string;
  createdAt: string;
  lastUsed?: string;
  isActive: boolean;
}

const API_KEYS_STORAGE_KEY = 'ai_story_api_keys';

export const ApiKeyStorage = {
  // Get all stored API keys
  getAllKeys: (): StoredApiKey[] => {
    try {
      const stored = localStorage.getItem(API_KEYS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load API keys:', error);
      return [];
    }
  },

  // Save a new API key
  saveApiKey: (provider: StoredApiKey['provider'], name: string, key: string): StoredApiKey => {
    const existingKeys = ApiKeyStorage.getAllKeys();
    
    const newApiKey: StoredApiKey = {
      id: Date.now().toString(),
      provider,
      name: name.trim() || `${provider.toUpperCase()} Key`,
      key: key.trim(),
      createdAt: new Date().toISOString(),
      isActive: true
    };

    // Deactivate other keys of the same provider
    const updatedKeys = existingKeys.map(apiKey => 
      apiKey.provider === provider 
        ? { ...apiKey, isActive: false }
        : apiKey
    );

    updatedKeys.push(newApiKey);

    try {
      localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(updatedKeys));
      return newApiKey;
    } catch (error) {
      console.error('Failed to save API key:', error);
      throw new Error('Không thể lưu API key');
    }
  },

  // Update an existing API key
  updateApiKey: (id: string, updates: Partial<StoredApiKey>): void => {
    const keys = ApiKeyStorage.getAllKeys();
    const updatedKeys = keys.map(key => 
      key.id === id ? { ...key, ...updates } : key
    );

    try {
      localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(updatedKeys));
    } catch (error) {
      console.error('Failed to update API key:', error);
      throw new Error('Không thể cập nhật API key');
    }
  },

  // Delete an API key
  deleteApiKey: (id: string): void => {
    const keys = ApiKeyStorage.getAllKeys();
    const filteredKeys = keys.filter(key => key.id !== id);

    try {
      localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(filteredKeys));
    } catch (error) {
      console.error('Failed to delete API key:', error);
      throw new Error('Không thể xóa API key');
    }
  },

  // Set active API key for a provider
  setActiveKey: (id: string): void => {
    const keys = ApiKeyStorage.getAllKeys();
    const targetKey = keys.find(key => key.id === id);
    
    if (!targetKey) {
      throw new Error('Không tìm thấy API key');
    }

    const updatedKeys = keys.map(key => ({
      ...key,
      isActive: key.provider === targetKey.provider ? key.id === id : key.isActive,
      lastUsed: key.id === id ? new Date().toISOString() : key.lastUsed
    }));

    try {
      localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(updatedKeys));
    } catch (error) {
      console.error('Failed to set active API key:', error);
      throw new Error('Không thể cập nhật API key');
    }
  },

  // Get active API key for a provider
  getActiveKey: (provider: StoredApiKey['provider']): StoredApiKey | null => {
    const keys = ApiKeyStorage.getAllKeys();
    return keys.find(key => key.provider === provider && key.isActive) || null;
  },

  // Get active API keys for all providers (for use in API calls)
  getActiveApiSettings: () => {
    const keys = ApiKeyStorage.getAllKeys();
    const activeKeys = keys.filter(key => key.isActive);
    
    return {
      openai: activeKeys.find(key => key.provider === 'openai')?.key || '',
      gemini: activeKeys.find(key => key.provider === 'gemini')?.key || '',
      deepseek: activeKeys.find(key => key.provider === 'deepseek')?.key || '',
      elevenlabs: activeKeys.find(key => key.provider === 'elevenlabs')?.key || '',
      stability: activeKeys.find(key => key.provider === 'stability')?.key || ''
    };
  },

  // Get all active API keys as an object (for backward compatibility)
  getAllActiveApiKeys: () => {
    const keys = ApiKeyStorage.getAllKeys();
    const activeKeys = keys.filter(key => key.isActive);
    
    const result: Record<string, string> = {};
    activeKeys.forEach(key => {
      result[key.provider] = key.key;
    });
    return result;
  },

  // Clear all API keys
  clearAllKeys: (): void => {
    try {
      localStorage.removeItem(API_KEYS_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear API keys:', error);
      throw new Error('Không thể xóa tất cả API keys');
    }
  },

  // Update last used timestamp
  updateLastUsed: (provider: StoredApiKey['provider']): void => {
    const activeKey = ApiKeyStorage.getActiveKey(provider);
    if (activeKey) {
      ApiKeyStorage.updateApiKey(activeKey.id, { 
        lastUsed: new Date().toISOString() 
      });
    }
  }
};

// Provider display names
export const PROVIDER_NAMES = {
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  deepseek: 'DeepSeek',
  elevenlabs: 'ElevenLabs',
  stability: 'Stability AI'
} as const;

// Provider colors for UI
export const PROVIDER_COLORS = {
  openai: 'bg-green-100 text-green-800 border-green-200',
  gemini: 'bg-blue-100 text-blue-800 border-blue-200',
  deepseek: 'bg-purple-100 text-purple-800 border-purple-200',
  elevenlabs: 'bg-orange-100 text-orange-800 border-orange-200',
  stability: 'bg-pink-100 text-pink-800 border-pink-200'
} as const;