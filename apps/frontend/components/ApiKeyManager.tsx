import React, { useState, useEffect } from 'react';
import { Plus, Key, Eye, EyeOff, Trash2, CheckCircle, Clock, Settings } from 'lucide-react';
import { ApiKeyStorage, StoredApiKey, PROVIDER_NAMES, PROVIDER_COLORS } from '../utils/apiKeyStorage';
// Feature usage tracking for unified display
import featureUsageTracker from '../services/featureUsageTracker';

interface ApiKeyManagerProps {
  onApiKeysChange?: () => void;
}

const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({ onApiKeysChange }) => {
  const [apiKeys, setApiKeys] = useState<StoredApiKey[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [usageStats, setUsageStats] = useState(featureUsageTracker.getUsageStatsSync());
  const [newKey, setNewKey] = useState({
    provider: 'openai' as StoredApiKey['provider'],
    name: '',
    key: ''
  });

  useEffect(() => {
    // Reset daily usage on component mount (handles day changes)
    ApiKeyStorage.resetDailyUsage();
    loadApiKeys();
    loadUsageStats();

    // Auto-sync usage stats every 10 seconds to keep in sync with other modules
    const interval = setInterval(() => {
      loadUsageStats();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const loadUsageStats = async () => {
    try {
      const stats = await featureUsageTracker.getUsageStats();
      setUsageStats(stats);
    } catch (error) {
      const fallbackStats = featureUsageTracker.getUsageStatsSync();
      setUsageStats(fallbackStats);
    }
  };

  const loadApiKeys = () => {
    const keys = ApiKeyStorage.getAllKeys();
    setApiKeys(keys);
  };

  const handleAddApiKey = () => {
    if (!newKey.key.trim()) {
      alert('Vui lòng nhập API key');
      return;
    }

    try {
      ApiKeyStorage.saveApiKey(newKey.provider, newKey.name, newKey.key);
      loadApiKeys();
      setNewKey({ provider: 'openai', name: '', key: '' });
      setShowAddForm(false);
      onApiKeysChange?.();
      alert('Đã lưu API key thành công!');
    } catch (error) {
      alert('Lỗi khi lưu API key: ' + (error as Error).message);
    }
  };

  const handleDeleteApiKey = (id: string) => {
    if (confirm('Bạn có chắc muốn xóa API key này?')) {
      try {
        ApiKeyStorage.deleteApiKey(id);
        loadApiKeys();
        onApiKeysChange?.();
        alert('Đã xóa API key thành công!');
      } catch (error) {
        alert('Lỗi khi xóa API key: ' + (error as Error).message);
      }
    }
  };

  const handleSetActive = (id: string) => {
    try {
      ApiKeyStorage.setActiveKey(id);
      loadApiKeys();
      onApiKeysChange?.();
    } catch (error) {
      alert('Lỗi khi cập nhật API key: ' + (error as Error).message);
    }
  };

  const toggleKeyVisibility = (id: string) => {
    const newVisibleKeys = new Set(visibleKeys);
    if (newVisibleKeys.has(id)) {
      newVisibleKeys.delete(id);
    } else {
      newVisibleKeys.add(id);
    }
    setVisibleKeys(newVisibleKeys);
  };

  const maskApiKey = (key: string): string => {
    if (key.length <= 8) return '*'.repeat(key.length);
    return key.substring(0, 4) + '*'.repeat(key.length - 8) + key.substring(key.length - 4);
  };

  const getDailyUsageInfo = (apiKey: StoredApiKey) => {
    // Use unified usage tracking system
    return {
      used: usageStats.current,
      limit: usageStats.dailyLimit,
      percentage: usageStats.percentage
    };
  };

  const getUsageBarColor = (percentage: number) => {
    if (percentage < 70) return 'bg-green-500';
    if (percentage < 90) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getProviderStats = () => {
    const stats: Record<string, { total: number; active: number }> = {};
    
    Object.keys(PROVIDER_NAMES).forEach(provider => {
      const providerKeys = apiKeys.filter(key => key.provider === provider);
      stats[provider] = {
        total: providerKeys.length,
        active: providerKeys.filter(key => key.isActive).length
      };
    });
    
    return stats;
  };

  const providerStats = getProviderStats();

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Settings className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Quản Lý API Keys</h2>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm API Key</span>
        </button>
      </div>

      {/* Provider Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {Object.entries(PROVIDER_NAMES).map(([provider, displayName]) => {
          const stats = providerStats[provider];
          const colorClass = PROVIDER_COLORS[provider as keyof typeof PROVIDER_COLORS];
          
          return (
            <div key={provider} className={`p-3 rounded-lg border ${colorClass}`}>
              <div className="text-sm font-medium">{displayName}</div>
              <div className="text-xs mt-1">
                {stats.active > 0 ? (
                  <span className="flex items-center space-x-1">
                    <CheckCircle className="w-3 h-3" />
                    <span>Hoạt động</span>
                  </span>
                ) : (
                  <span className="text-gray-500">Chưa có key</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add API Key Form */}
      {showAddForm && (
        <div className="bg-gray-50 p-4 rounded-lg mb-6 border">
          <h3 className="text-lg font-medium mb-4">Thêm API Key Mới</h3>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nhà cung cấp
                </label>
                <select
                  value={newKey.provider}
                  onChange={(e) => setNewKey({ ...newKey, provider: e.target.value as StoredApiKey['provider'] })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Object.entries(PROVIDER_NAMES).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tên gọi (tùy chọn)
                </label>
                <input
                  type="text"
                  value={newKey.name}
                  onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
                  placeholder={`${PROVIDER_NAMES[newKey.provider]} Key`}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key
              </label>
              <input
                type="password"
                value={newKey.key}
                onChange={(e) => setNewKey({ ...newKey, key: e.target.value })}
                placeholder="Nhập API key..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={handleAddApiKey}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                Lưu API Key
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Keys List */}
      {apiKeys.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Key className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>Chưa có API key nào được lưu</p>
          <p className="text-sm mt-1">Thêm API key đầu tiên để bắt đầu sử dụng</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-gray-900 mb-3">
            Danh Sách API Keys ({apiKeys.length})
          </h3>
          
          {apiKeys.map((apiKey) => {
            const colorClass = PROVIDER_COLORS[apiKey.provider];
            const isVisible = visibleKeys.has(apiKey.id);
            
            return (
              <div key={apiKey.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${colorClass}`}>
                        {PROVIDER_NAMES[apiKey.provider]}
                      </span>
                      
                      {apiKey.isActive && (
                        <span className="flex items-center space-x-1 text-green-600 text-xs">
                          <CheckCircle className="w-3 h-3" />
                          <span>Đang sử dụng</span>
                        </span>
                      )}
                      
                      <span className="text-sm font-medium text-gray-900">
                        {apiKey.name}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2 mb-2">
                      <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                        {isVisible ? apiKey.key : maskApiKey(apiKey.key)}
                      </code>
                      <button
                        onClick={() => toggleKeyVisibility(apiKey.id)}
                        className="text-gray-500 hover:text-gray-700"
                        title={isVisible ? 'Ẩn key' : 'Hiện key'}
                      >
                        {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    
                    {/* Daily Usage Progress Bar */}
                    {(() => {
                      const { used, limit, percentage } = getDailyUsageInfo(apiKey);
                      return (
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-700">
                              Lượt sử dụng hôm nay
                            </span>
                            <span className={`text-xs font-medium ${
                              percentage > 90 ? 'text-red-600' : 
                              percentage > 70 ? 'text-yellow-600' : 'text-green-600'
                            }`}>
                              {used}/{limit} ({percentage}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${getUsageBarColor(percentage)}`}
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                          {percentage > 90 && (
                            <div className="flex items-center mt-1 text-xs text-red-600">
                              <span>⚠️ Sắp hết quota ngày hôm nay</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>Tạo: {formatDate(apiKey.createdAt)}</span>
                      </span>
                      
                      {apiKey.lastUsed && (
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>Dùng: {formatDate(apiKey.lastUsed)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end space-y-2 ml-4">
                    <div className="flex items-center space-x-2">
                      {!apiKey.isActive && (
                        <button
                          onClick={() => handleSetActive(apiKey.id)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Sử dụng
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleDeleteApiKey(apiKey.id)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Xóa API key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="text-sm font-medium text-blue-900 mb-2">💡 Lưu ý quan trọng</h4>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• API keys được lưu trữ an toàn trên máy tính của bạn</li>
          <li>• Chỉ có một API key hoạt động cho mỗi nhà cung cấp</li>
          <li>• Bạn có thể thêm nhiều keys và chuyển đổi khi cần</li>
          <li>• Không chia sẻ API keys với người khác</li>
        </ul>
      </div>
    </div>
  );
};

export default ApiKeyManager;