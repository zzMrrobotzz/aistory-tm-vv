import React, { useState, useEffect } from 'react';
import { Modal, Alert, Space, Button, Typography, Divider } from 'antd';
import { 
  ExclamationCircleOutlined, 
  UserOutlined, 
  DesktopOutlined,
  ClockCircleOutlined,
  GlobalOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;

interface ConcurrentLoginWarningProps {
  visible: boolean;
  onProceed: () => void;
  onCancel: () => void;
  sessionInfo?: {
    deviceName?: string;
    ipAddress?: string;
    lastActivity?: string;
    loginAt?: string;
  };
}

const ConcurrentLoginWarning: React.FC<ConcurrentLoginWarningProps> = ({
  visible,
  onProceed,
  onCancel,
  sessionInfo
}) => {
  const [countdown, setCountdown] = useState(30);
  const [canProceed, setCanProceed] = useState(false);

  useEffect(() => {
    if (!visible) {
      setCountdown(30);
      setCanProceed(false);
      return;
    }

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setCanProceed(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [visible]);

  const formatTime = (dateString?: string) => {
    if (!dateString) return 'Không xác định';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    return date.toLocaleString();
  };

  return (
    <Modal
      title={
        <Space>
          <ExclamationCircleOutlined style={{ color: '#faad14' }} />
          <span>Tài khoản đang được sử dụng</span>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Hủy đăng nhập
        </Button>,
        <Button
          key="proceed"
          type="primary"
          danger
          disabled={!canProceed}
          onClick={onProceed}
        >
          {canProceed ? 'Tiếp tục đăng nhập' : `Chờ ${countdown}s`}
        </Button>
      ]}
      width={600}
      closable={false}
      maskClosable={false}
    >
      <div style={{ marginBottom: '20px' }}>
        <Alert
          message="Cảnh báo bảo mật"
          description="Tài khoản này đang được sử dụng ở thiết bị khác. Nếu bạn tiếp tục, phiên đăng nhập cũ sẽ bị ngắt kết nối ngay lập tức."
          type="warning"
          showIcon
        />
      </div>

      {sessionInfo && (
        <div style={{ 
          background: '#fafafa', 
          border: '1px solid #d9d9d9', 
          borderRadius: '6px', 
          padding: '16px',
          marginBottom: '20px'
        }}>
          <Title level={5} style={{ margin: '0 0 12px 0' }}>
            <DesktopOutlined /> Thông tin phiên đăng nhập hiện tại
          </Title>
          
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">Thiết bị:</Text>
              <Text>{sessionInfo.deviceName || 'Không xác định'}</Text>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">
                <GlobalOutlined /> Địa chỉ IP:
              </Text>
              <Text code>{sessionInfo.ipAddress || 'Không xác định'}</Text>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">
                <ClockCircleOutlined /> Đăng nhập lúc:
              </Text>
              <Text>{formatTime(sessionInfo.loginAt)}</Text>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">
                <ClockCircleOutlined /> Hoạt động cuối:
              </Text>
              <Text>{formatTime(sessionInfo.lastActivity)}</Text>
            </div>
          </Space>
        </div>
      )}

      <Divider />

      <div style={{ marginBottom: '16px' }}>
        <Title level={5} style={{ margin: '0 0 8px 0' }}>
          <UserOutlined /> Điều gì sẽ xảy ra khi bạn tiếp tục?
        </Title>
        
        <ul style={{ paddingLeft: '20px', margin: 0 }}>
          <li style={{ marginBottom: '4px' }}>
            Phiên đăng nhập cũ sẽ bị <strong>ngắt kết nối ngay lập tức</strong>
          </li>
          <li style={{ marginBottom: '4px' }}>
            Người dùng ở thiết bị cũ sẽ nhận được thông báo và bị đăng xuất
          </li>
          <li style={{ marginBottom: '4px' }}>
            Bạn sẽ trở thành phiên đăng nhập duy nhất và có thể sử dụng bình thường
          </li>
          <li style={{ marginBottom: '4px' }}>
            Mọi tiến trình đang chạy ở thiết bị cũ sẽ bị dừng
          </li>
        </ul>
      </div>

      <Alert
        message="Lưu ý quan trọng"
        description={
          <div>
            <p style={{ margin: '0 0 8px 0' }}>
              Nếu bạn không phải là người đang sử dụng thiết bị khác, có thể tài khoản của bạn đã bị xâm nhập.
            </p>
            <p style={{ margin: 0 }}>
              Trong trường hợp này, hãy:
            </p>
            <ul style={{ margin: '4px 0 0 16px' }}>
              <li>Tiếp tục đăng nhập để lấy lại quyền kiểm soát</li>
              <li>Thay đổi mật khẩu ngay lập tức</li>
              <li>Kiểm tra hoạt động tài khoản gần đây</li>
            </ul>
          </div>
        }
        type="info"
        showIcon
      />

      {!canProceed && (
        <div style={{ 
          textAlign: 'center', 
          marginTop: '16px',
          padding: '12px',
          background: '#fff2e8',
          borderRadius: '6px',
          border: '1px solid #ffbb96'
        }}>
          <Text type="secondary">
            Vui lòng đợi {countdown} giây trước khi có thể tiếp tuc...
          </Text>
        </div>
      )}
    </Modal>
  );
};

export default ConcurrentLoginWarning;