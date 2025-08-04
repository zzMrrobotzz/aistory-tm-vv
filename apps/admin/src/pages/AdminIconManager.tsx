import React from 'react';
import { Card, Divider, Alert } from 'antd';
import IconUploader from '../components/IconUploader';

const AdminIconManager: React.FC = () => {
  const handleIconSelect = (iconData: any) => {
    console.log('Selected icon:', iconData);
    // This will be used when setting icons for menu items
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Quản Lý Icons Tùy Chỉnh</h1>
      </div>

      <Alert
        message="Hướng Dẫn Sử Dụng"
        description={
          <div>
            <p><strong>📁 Định dạng hỗ trợ:</strong> SVG, PNG, JPG, WebP (tối đa 1MB)</p>
            <p><strong>🎨 Khuyến nghị:</strong> Sử dụng file SVG để có chất lượng tốt nhất ở mọi kích thước</p>
            <p><strong>📏 Kích thước tối ưu:</strong> 24x24px hoặc 32x32px</p>
            <p><strong>💾 Lưu trữ:</strong> Icons được lưu trong LocalStorage của trình duyệt</p>
          </div>
        }
        type="info"
        showIcon
        className="mb-6"
      />

      <Card>
        <IconUploader 
          onIconSelect={handleIconSelect}
          showManagement={true}
        />
      </Card>

      <Divider />
      
      <Card title="📋 Thông Tin Bổ Sung">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold">🔧 Cách Sử Dụng Icons</h4>
            <p className="text-gray-600">
              Sau khi upload icon, bạn có thể sử dụng chúng trong các menu item của admin panel. 
              Icons sẽ được lưu trữ locally và có thể được chọn khi cấu hình sidebar.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold">💡 Tips cho Icons Chất Lượng Cao</h4>
            <ul className="text-gray-600 list-disc list-inside space-y-1">
              <li>Sử dụng màu đơn sắc (monochrome) để dễ thay đổi màu qua CSS</li>
              <li>Giữ thiết kế đơn giản và rõ ràng ở kích thước nhỏ</li>
              <li>SVG vector sẽ luôn sharp ở mọi độ phân giải</li>
              <li>Tránh chi tiết quá phức tạp trong icons nhỏ</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold">🗂️ Quản Lý Icons</h4>
            <p className="text-gray-600">
              Icons được lưu trong LocalStorage. Để backup hoặc chuyển icons sang máy khác, 
              bạn có thể export/import data từ Developer Tools của trình duyệt.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AdminIconManager;