import React from 'react';
import { Settings as SettingsIcon, Info } from 'lucide-react';
import ApiKeyManager from '../ApiKeyManager';

const Settings: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center space-x-3 mb-4">
          <SettingsIcon className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Cài Đặt Hệ Thống</h1>
        </div>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Quản lý API keys và cấu hình hệ thống AI Story Tool của bạn
        </p>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Thông Tin Quan Trọng
            </h3>
            <div className="text-sm text-blue-800 space-y-2">
              <p>• <strong>API Keys:</strong> Được lưu trữ an toàn trên máy tính của bạn (localStorage)</p>
              <p>• <strong>Tự động:</strong> Hệ thống sẽ tự động sử dụng API key phù hợp cho mỗi tính năng</p>
              <p>• <strong>Bảo mật:</strong> Không ai khác có thể truy cập API keys của bạn</p>
              <p>• <strong>Dễ dàng:</strong> Thêm một lần, sử dụng mọi lúc không cần nhập lại</p>
            </div>
          </div>
        </div>
      </div>

      {/* API Key Management */}
      <ApiKeyManager />

      {/* Footer Info */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg border">
        <h4 className="font-semibold text-gray-800 mb-2">📋 Hướng Dẫn Sử Dụng</h4>
        <div className="text-sm text-gray-600 space-y-1">
          <p><strong>1.</strong> Thêm API keys từ các nhà cung cấp AI (OpenAI, Gemini, DeepSeek, v.v.)</p>
          <p><strong>2.</strong> Hệ thống tự động chọn API key phù hợp khi bạn sử dụng các tính năng</p>
          <p><strong>3.</strong> Theo dõi thống kê sử dụng và quản lý keys dễ dàng</p>
          <p><strong>4.</strong> Chuyển đổi giữa các providers mà không cần cấu hình lại</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;