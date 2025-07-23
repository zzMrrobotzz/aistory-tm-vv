import React from 'react';
import { ShieldAlert } from 'lucide-react';

const UpgradePrompt: React.FC = () => {
  return (
    <div className="p-6 my-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded-lg">
      <div className="flex">
        <div className="py-1">
          <ShieldAlert className="h-6 w-6 text-yellow-500 mr-4" />
        </div>
        <div>
          <p className="font-bold">Tính năng này yêu cầu subscription</p>
          <p className="text-sm">
            Để sử dụng tất cả 15 AI Tools, bạn cần đăng ký gói Monthly hoặc Lifetime. Với subscription, bạn sẽ có quyền truy cập không giới hạn + sử dụng API key riêng.
          </p>
          <button 
            onClick={() => window.open('/pricing', '_blank')}
            className="mt-2 px-4 py-2 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600"
          >
            Xem gói đăng ký
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpgradePrompt; 