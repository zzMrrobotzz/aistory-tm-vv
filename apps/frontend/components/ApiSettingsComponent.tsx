
import React, { useState, useEffect } from 'react';
import { ApiSettings, ApiProvider } from '../types';
import { ApiKeyStorage } from '../utils/apiKeyStorage';
import ApiKeyManager from './ApiKeyManager';

interface ApiSettingsProps {
  apiSettings: ApiSettings;
  setApiSettings: (settings: ApiSettings) => void;
}

const ApiSettingsComponent: React.FC<ApiSettingsProps> = ({ apiSettings, setApiSettings }) => {
  // Local state to manage form inputs without affecting global state immediately
  const [localSettings, setLocalSettings] = useState<ApiSettings>(apiSettings);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Load API keys from storage on component mount
  useEffect(() => {
    loadApiKeysFromStorage();
  }, []);

  // Sync local state if global state changes from an external source
  useEffect(() => {
    setLocalSettings(apiSettings);
  }, [apiSettings]);

  const loadApiKeysFromStorage = () => {
    try {
      const activeApiSettings = ApiKeyStorage.getActiveApiSettings();
      
      // Update apiSettings with stored keys if available
      const updatedSettings: ApiSettings = {
        ...apiSettings,
        apiKey: activeApiSettings.gemini || activeApiSettings.deepseek || apiSettings.apiKey
      };

      // Determine provider based on available keys
      if (activeApiSettings.deepseek && !activeApiSettings.gemini) {
        updatedSettings.provider = 'deepseek';
      } else if (activeApiSettings.gemini) {
        updatedSettings.provider = 'gemini';
      }

      setApiSettings(updatedSettings);
      setLocalSettings(updatedSettings);
    } catch (error) {
      console.error('Error loading API keys from storage:', error);
      // Fallback to current settings if there's an error
    }
  };

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectSelect>) => {
    try {
      const newProvider = e.target.value as ApiProvider;
      const activeApiSettings = ApiKeyStorage.getActiveApiSettings();
      
      // Auto-load API key for the selected provider if available
      let newApiKey = '';
      if (newProvider === 'gemini' && activeApiSettings.gemini) {
        newApiKey = activeApiSettings.gemini;
      } else if (newProvider === 'deepseek' && activeApiSettings.deepseek) {
        newApiKey = activeApiSettings.deepseek;
      }
      
      setLocalSettings({ ...localSettings, provider: newProvider, apiKey: newApiKey });
    } catch (error) {
      console.error('Error changing provider:', error);
    }
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSettings({ ...localSettings, apiKey: e.target.value });
  };
  
  const handleUpdateClick = () => {
    setApiSettings(localSettings);
    
    // Update last used timestamp for the provider
    if (localSettings.apiKey) {
      const providerMap: Record<ApiProvider, 'gemini' | 'deepseek'> = {
        'gemini': 'gemini',
        'deepseek': 'deepseek'
      };
      ApiKeyStorage.updateLastUsed(providerMap[localSettings.provider]);
    }
    
    setUpdateMessage("Cập nhật API thành công!");
    setTimeout(() => {
        setUpdateMessage(null);
    }, 3000);
  };

  const handleApiKeysChange = () => {
    loadApiKeysFromStorage();
  };
  
  const getApiKeyLabel = () => {
    return 'API Key (Văn bản):';
  };
  
  const getApiKeyPlaceholder = () => {
    if (localSettings.provider === 'gemini') {
      return "Để trống nếu dùng key mặc định của tool";
    }
    return "Bắt buộc nhập API Key của bạn";
  }

  const getStatusText = () => {
      const activeKeys = ApiKeyStorage.getActiveApiSettings();
      if (apiSettings.provider === 'gemini') {
          return activeKeys.gemini ? 'Đang dùng Gemini (Key đã lưu)' : 'Đang dùng Gemini (Mặc định)';
      }
      if (apiSettings.provider === 'deepseek') {
          return activeKeys.deepseek ? 'Đang dùng DeepSeek (Key đã lưu)' : 'Không thể dùng DeepSeek (chưa có key)';
      }
      return 'Không xác định';
  };

  const isChanged = localSettings.provider !== apiSettings.provider || localSettings.apiKey !== apiSettings.apiKey;
  const isValid = localSettings.provider === 'gemini' || (localSettings.provider === 'deepseek' && localSettings.apiKey.trim() !== '');
  const activeKeys = ApiKeyStorage.getActiveApiSettings();
  const hasStoredKeys = Object.values(activeKeys).some(key => key !== '');

  return (
    <div className="space-y-6">
      {/* API Key Manager */}
      <ApiKeyManager onApiKeysChange={handleApiKeysChange} />
      
      {/* Quick Settings Panel */}
      <div className="bg-gray-50 p-6 rounded-lg border-2 border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-800">⚙️ Cài Đặt Nhanh</h3>
          <button
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showAdvancedSettings ? 'Ẩn cài đặt' : 'Cài đặt thủ công'}
          </button>
        </div>
        <div className="mb-4 p-3 bg-indigo-100 border border-indigo-200 rounded-md">
          <p className="text-sm font-semibold text-indigo-800">
              Trạng thái hiện tại: <span className="text-indigo-600 font-bold">{getStatusText()}</span>
          </p>
        </div>

        {!hasStoredKeys && (
          <div className="mb-4 p-3 bg-yellow-100 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              💡 <strong>Mẹo:</strong> Sử dụng "Quản Lý API Keys" ở trên để lưu API keys và không cần nhập lại.
            </p>
          </div>
        )}

        {/* Provider Selection - Always show */}
        <div className="mb-4">
          <label htmlFor="apiProvider" className="block text-sm font-medium text-gray-700 mb-1">
            Chọn nhà cung cấp AI (Văn bản):
          </label>
          <select
            id="apiProvider"
            value={localSettings.provider}
            onChange={handleProviderChange}
            className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          >
            <option value="gemini">Google Gemini</option>
            <option value="deepseek">DeepSeek</option>
          </select>
        </div>

        {/* Advanced Settings - Conditional */}
        {(showAdvancedSettings || !hasStoredKeys) && (
          <div className="space-y-4">
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-1">
                {getApiKeyLabel()}
              </label>
              <input
                type="password"
                id="apiKey"
                value={localSettings.apiKey}
                onChange={handleApiKeyChange}
                placeholder={getApiKeyPlaceholder()}
                className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
               {localSettings.provider === 'deepseek' && !localSettings.apiKey.trim() && (
                <p className="text-xs text-red-500 mt-1">
                  DeepSeek yêu cầu phải nhập API Key.
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              <button
                  onClick={handleUpdateClick}
                  disabled={!isChanged || !isValid}
                  className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                  Cập nhật API
              </button>
              {updateMessage && (
                  <div className="text-green-600 font-medium text-sm animate-fadeIn flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                      {updateMessage}
                  </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiSettingsComponent;
