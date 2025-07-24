import React, { useState, useEffect } from 'react';
import { Badge, Tooltip, Button, Modal, Card, Statistic, Space, message, Divider } from 'antd';
import { 
  UserOutlined, 
  LockOutlined, 
  InfoCircleOutlined, 
  LogoutOutlined,
  ClockCircleOutlined,
  GlobalOutlined,
  ApiOutlined
} from '@ant-design/icons';
import { sessionService } from '../services/sessionService';

interface SessionInfo {
  sessionId: string;
  loginAt: string;
  lastActivity: string;
  totalApiCalls: number;
  ipAddress: string;
}

const SessionStatus: React.FC = () => {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSessionInfo();
    
    // Refresh session info every 30 seconds
    const interval = setInterval(() => {
      loadSessionInfo();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadSessionInfo = async () => {
    try {
      const info = await sessionService.getSessionInfo();
      setSessionInfo(info);
    } catch (error) {
      console.error('Failed to load session info:', error);
    }
  };

  const handleForceLogoutAll = async () => {
    Modal.confirm({
      title: 'Ngắt kết nối tất cả phiên đăng nhập',
      content: (
        <div>
          <p>Bạn có chắc chắn muốn ngắt kết nối tất cả phiên đăng nhập khác?</p>
          <p style={{ color: '#666', fontSize: '12px' }}>
            Điều này sẽ đăng xuất tài khoản khỏi tất cả thiết bị và trình duyệt khac.
          </p>
        </div>
      ),
      okText: 'Ngắt kết nối',
      cancelText: 'Hủy',
      okType: 'danger',
      onOk: async () => {
        setLoading(true);
        try {
          const success = await sessionService.forceLogoutAllSessions();
          if (success) {
            setIsModalVisible(false);
            await loadSessionInfo(); // Refresh info
          }
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    return `${diffDays} ngày trước`;
  };

  const getSessionStatusColor = () => {
    if (!sessionInfo) return 'default';
    
    const lastActivity = new Date(sessionInfo.lastActivity);
    const now = new Date();
    const diffMs = now.getTime() - lastActivity.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 5) return 'green'; // Very active
    if (diffMins < 15) return 'orange'; // Somewhat active
    return 'red'; // Inactive
  };

  const getSessionStatusText = () => {
    if (!sessionInfo) return 'Không xác định';
    
    const lastActivity = new Date(sessionInfo.lastActivity);
    const now = new Date();
    const diffMs = now.getTime() - lastActivity.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 2) return 'Đang hoạt động';
    if (diffMins < 10) return 'Hoạt động gần đây';
    return 'Không hoạt động';
  };

  return (
    <>
      <Tooltip 
        title={`Phiên đăng nhập: ${getSessionStatusText()}${sessionInfo ? ` (${formatTime(sessionInfo.lastActivity)})` : ''}`}
      >
        <Badge 
          status={getSessionStatusColor() as any} 
          style={{ cursor: 'pointer' }}
          onClick={() => setIsModalVisible(true)}
        >
          <UserOutlined style={{ fontSize: '16px', color: '#666' }} />
        </Badge>
      </Tooltip>

      <Modal
        title={
          <Space>
            <LockOutlined />
            Trạng thái phiên đăng nhập
          </Space>
        }
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={[
          <Button key="refresh" onClick={loadSessionInfo}>
            Làm mới
          </Button>,
          <Button 
            key="force-logout" 
            type="primary" 
            danger
            icon={<LogoutOutlined />}
            loading={loading}
            onClick={handleForceLogoutAll}
          >
            Ngắt kết nối tất cả
          </Button>,
          <Button key="close" onClick={() => setIsModalVisible(false)}>
            Đóng
          </Button>
        ]}
        width={600}
      >
        {sessionInfo ? (
          <div>
            <Card size="small" style={{ marginBottom: '16px' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Trạng thái hiện tại:</span>
                  <Badge 
                    status={getSessionStatusColor() as any} 
                    text={getSessionStatusText()}
                  />
                </div>
                
                <Divider style={{ margin: '12px 0' }} />
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <Statistic
                    title="Thời gian đăng nhập"
                    value={formatTime(sessionInfo.loginAt)}
                    prefix={<ClockCircleOutlined />}
                    valueStyle={{ fontSize: '14px' }}
                  />
                  
                  <Statistic
                    title="Hoạt động cuối"
                    value={formatTime(sessionInfo.lastActivity)}
                    prefix={<ClockCircleOutlined />}
                    valueStyle={{ fontSize: '14px' }}
                  />
                  
                  <Statistic
                    title="Số lần sử dụng AI"
                    value={sessionInfo.totalApiCalls}
                    prefix={<ApiOutlined />}
                    valueStyle={{ fontSize: '14px' }}
                  />
                  
                  <Statistic
                    title="Địa chỉ IP"
                    value={sessionInfo.ipAddress}
                    prefix={<GlobalOutlined />}
                    valueStyle={{ fontSize: '14px' }}
                  />
                </div>
              </Space>
            </Card>

            <div style={{ 
              background: '#f6ffed', 
              border: '1px solid #b7eb8f', 
              borderRadius: '6px', 
              padding: '12px',
              marginBottom: '16px'
            }}>
              <Space>
                <InfoCircleOutlined style={{ color: '#52c41a' }} />
                <div>
                  <div style={{ fontWeight: 500, color: '#52c41a' }}>
                    Chế độ đăng nhập đơn (Single Session)
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    Tài khoản chỉ có thể đăng nhập trên một thiết bị tại một thời điểm. 
                    Nếu đăng nhập ở nơi khác, phiên này sẽ tự động bị ngắt kết nối.
                  </div>
                </div>
              </Space>
            </div>

            <div style={{ 
              background: '#fff7e6', 
              border: '1px solid #ffd591', 
              borderRadius: '6px', 
              padding: '12px'
            }}>
              <Space>
                <InfoCircleOutlined style={{ color: '#fa8c16' }} />
                <div>
                  <div style={{ fontWeight: 500, color: '#fa8c16' }}>
                    Bảo mật tài khoản
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    Nếu bạn nghi ngờ tài khoản bị truy cập trái phép, hãy sử dụng nút 
                    "Ngắt kết nối tất cả" để đăng xuất khỏi tất cả thiết bị.
                  </div>
                </div>
              </Space>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <InfoCircleOutlined style={{ fontSize: '48px', color: '#ccc', marginBottom: '16px' }} />
            <div style={{ color: '#666' }}>
              Không thể tải thông tin phiên đăng nhập
            </div>
            <Button 
              type="primary" 
              style={{ marginTop: '16px' }}
              onClick={loadSessionInfo}
            >
              Thử lại
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
};

export default SessionStatus;