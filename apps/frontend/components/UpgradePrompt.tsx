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
          <p className="font-bold">Tính năng này yêu cầu nâng cấp</p>
          <p className="text-sm">
            Tài khoản của bạn là tài khoản miễn phí. Vui lòng nâng cấp để sử dụng toàn bộ tính năng của công cụ.
          </p>
          <button 
            onClick={() => window.open('/pricing', '_blank')}
            className="mt-2 px-4 py-2 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600"
          >
            Nâng cấp ngay
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpgradePrompt; 