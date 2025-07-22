
import React, { useState, useEffect } from 'react';
import { ApiSettings, ApiProvider } from '../types';

interface ApiSettingsProps {
  apiSettings: ApiSettings;
  setApiSettings: (settings: ApiSettings) => void;
}

const ApiSettingsComponent: React.FC<ApiSettingsProps> = ({ apiSettings, setApiSettings }) => {
  // Local state to manage form inputs without affecting global state immediately
  const [localSettings, setLocalSettings] = useState<ApiSettings>(apiSettings);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  // Sync local state if global state changes from an external source
  useEffect(() => {
    setLocalSettings(apiSettings);
  }, [apiSettings]);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value as ApiProvider;
    // When changing provider, reset the API key to avoid sending a key to the wrong service
    setLocalSettings({ ...localSettings, provider: newProvider, apiKey: '' });
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSettings({ ...localSettings, apiKey: e.target.value });
  };
  
  const handleUpdateClick = () => {
    setApiSettings(localSettings);
    setUpdateMessage("Cập nhật API thành công!");
    setTimeout(() => {
        setUpdateMessage(null);
    }, 3000);
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
      if (apiSettings.provider === 'gemini') {
          return apiSettings.apiKey ? 'Đang dùng Gemini (Key của bạn)' : 'Đang dùng Gemini (Mặc định)';
      }
      if (apiSettings.provider === 'deepseek') {
          return apiSettings.apiKey ? 'Đang dùng DeepSeek (Key của bạn)' : 'Không thể dùng DeepSeek (chưa có key)';
      }
      return 'Không xác định';
  };

  const isChanged = localSettings.provider !== apiSettings.provider || localSettings.apiKey !== apiSettings.apiKey;
  const isValid = localSettings.provider === 'gemini' || (localSettings.provider === 'deepseek' && localSettings.apiKey.trim() !== '');

  return (
    <div className="bg-gray-50 p-6 rounded-lg mb-8 border-2 border-gray-200">
      <h3 className="text-xl font-semibold text-gray-800 mb-2">⚙️ Cài Đặt AI</h3>
      <div className="mb-4 p-3 bg-indigo-100 border border-indigo-200 rounded-md">
          <p className="text-sm font-semibold text-indigo-800">
              Trạng thái hiện tại: <span className="text-indigo-600 font-bold">{getStatusText()}</span>
          </p>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div>
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
      </div>
      <div className="mt-4 flex items-center gap-4">
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
  );
};

export default ApiSettingsComponent;
