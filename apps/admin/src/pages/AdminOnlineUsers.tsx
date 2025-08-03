import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Tag, Tooltip, Spin, Alert, Row, Col, Statistic, Button } from 'antd';
import { 
  ReloadOutlined, 
  UserOutlined, 
  GlobalOutlined, 
  ClockCircleOutlined,
  DesktopOutlined,
  WifiOutlined
} from '@ant-design/icons';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

interface OnlineUser {
  userId: string;
  username: string;
  email: string;
  subscriptionType: string;
  sessionInfo: {
    lastActivity: string;
    loginAt: string;
    ipAddress: string;
    userAgent: string;
    deviceInfo: any;
    totalSessions: number;
  };
}

interface OnlineStats {
  totalOnline: number;
  totalSessions: number;
  bySubscription: {
    free: number;
    monthly: number;
    lifetime: number;
  };
  averageSessionTime: number;
}

interface ApiResponse {
  success: boolean;
  onlineUsers: OnlineUser[];
  stats: OnlineStats;
  lastUpdated: string;
}

const AdminOnlineUsers: React.FC = () => {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [stats, setStats] = useState<OnlineStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchOnlineUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('https://aistory-backend.onrender.com/api/admin/users/online');
      const data: ApiResponse = await response.json();
      
      if (data.success) {
        setOnlineUsers(data.onlineUsers);
        setStats(data.stats);
        setLastUpdated(data.lastUpdated);
      } else {
        setError('Không thể tải dữ liệu người dùng online');
      }
    } catch (err) {
      setError('Lỗi kết nối server');
      console.error('Error fetching online users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto refresh every 30 seconds
  useEffect(() => {
    fetchOnlineUsers();
    
    if (autoRefresh) {
      const interval = setInterval(fetchOnlineUsers, 30000);
      return () => clearInterval(interval);
    }
  }, [fetchOnlineUsers, autoRefresh]);

  const getSubscriptionColor = (type: string) => {
    switch (type) {
      case 'lifetime': return 'gold';
      case 'monthly': return 'blue';
      default: return 'default';
    }
  };

  const formatSessionTime = (milliseconds: number) => {
    const minutes = Math.floor(milliseconds / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const columns = [
    {
      title: 'Người dùng',
      key: 'user',
      render: (record: OnlineUser) => (
        <div>
          <div className="font-medium">{record.username}</div>
          <div className="text-sm text-gray-500">{record.email}</div>
        </div>
      ),
    },
    {
      title: 'Gói dịch vụ',
      dataIndex: 'subscriptionType',
      key: 'subscription',
      render: (type: string) => (
        <Tag color={getSubscriptionColor(type)}>
          {type === 'free' ? 'Miễn phí' : 
           type === 'monthly' ? 'Tháng' : 
           type === 'lifetime' ? 'Trọn đời' : type}
        </Tag>
      ),
    },
    {
      title: 'Hoạt động cuối',
      key: 'lastActivity',
      render: (record: OnlineUser) => (
        <Tooltip title={new Date(record.sessionInfo.lastActivity).toLocaleString('vi-VN')}>
          <span>
            {formatDistanceToNow(new Date(record.sessionInfo.lastActivity), { 
              addSuffix: true, 
              locale: vi 
            })}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Thời gian online',
      key: 'sessionTime',
      render: (record: OnlineUser) => {
        const sessionTime = new Date().getTime() - new Date(record.sessionInfo.loginAt).getTime();
        return (
          <span className="flex items-center">
            <ClockCircleOutlined className="mr-1" />
            {formatSessionTime(sessionTime)}
          </span>
        );
      },
    },
    {
      title: 'IP / Thiết bị',
      key: 'device',
      render: (record: OnlineUser) => (
        <div>
          <div className="flex items-center text-sm">
            <GlobalOutlined className="mr-1" />
            {record.sessionInfo.ipAddress}
          </div>
          <div className="flex items-center text-xs text-gray-500 mt-1">
            <DesktopOutlined className="mr-1" />
            {record.sessionInfo.userAgent ? 
              record.sessionInfo.userAgent.split(' ')[0] || 'Unknown Browser' : 
              'Unknown Browser'
            }
          </div>
        </div>
      ),
    },
    {
      title: 'Sessions',
      key: 'sessions',
      render: (record: OnlineUser) => (
        <Tag color={record.sessionInfo.totalSessions > 1 ? 'orange' : 'green'}>
          {record.sessionInfo.totalSessions}
        </Tag>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Người Dùng Online</h1>
        <div className="flex gap-2">
          <Button
            type={autoRefresh ? 'primary' : 'default'}
            onClick={() => setAutoRefresh(!autoRefresh)}
            icon={<WifiOutlined />}
          >
            {autoRefresh ? 'Tự động cập nhật' : 'Cập nhật thủ công'}
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchOnlineUsers}
            loading={loading}
          >
            Làm mới
          </Button>
        </div>
      </div>

      {error && (
        <Alert
          message="Lỗi"
          description={error}
          type="error"
          showIcon
          closable
          className="mb-4"
        />
      )}

      {stats && (
        <Row gutter={16} className="mb-6">
          <Col span={6}>
            <Card>
              <Statistic
                title="Người dùng online"
                value={stats.totalOnline}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Tổng sessions"
                value={stats.totalSessions}
                prefix={<DesktopOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Gói trả phí"
                value={stats.bySubscription.monthly + stats.bySubscription.lifetime}
                suffix={`/ ${stats.totalOnline}`}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Thời gian TB"
                value={formatSessionTime(stats.averageSessionTime)}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card 
        title={
          <div className="flex justify-between items-center">
            <span>Danh sách người dùng online ({onlineUsers.length})</span>
            {lastUpdated && (
              <span className="text-sm text-gray-500">
                Cập nhật: {new Date(lastUpdated).toLocaleTimeString('vi-VN')}
              </span>
            )}
          </div>
        }
      >
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={onlineUsers}
            rowKey={(record) => record.userId}
            pagination={{ 
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `Tổng ${total} người dùng`
            }}
            locale={{ emptyText: 'Không có người dùng online' }}
            size="middle"
          />
        </Spin>
      </Card>

      {/* Additional Stats Cards */}
      {stats && (
        <Row gutter={16} className="mt-6">
          <Col span={8}>
            <Card title="Phân bổ gói dịch vụ" size="small">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Miễn phí:</span>
                  <Tag color="default">{stats.bySubscription.free}</Tag>
                </div>
                <div className="flex justify-between">
                  <span>Hàng tháng:</span>
                  <Tag color="blue">{stats.bySubscription.monthly}</Tag>
                </div>
                <div className="flex justify-between">
                  <span>Trọn đời:</span>
                  <Tag color="gold">{stats.bySubscription.lifetime}</Tag>
                </div>
              </div>
            </Card>
          </Col>
          <Col span={8}>
            <Card title="Thông tin hệ thống" size="small">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Ngưỡng online:</span>
                  <span className="text-blue-600">5 phút</span>
                </div>
                <div className="flex justify-between">
                  <span>Tự động cập nhật:</span>
                  <span className={autoRefresh ? 'text-green-600' : 'text-red-600'}>
                    {autoRefresh ? 'Bật' : 'Tắt'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Chu kỳ:</span>
                  <span className="text-gray-600">30 giây</span>
                </div>
              </div>
            </Card>
          </Col>
          <Col span={8}>
            <Card title="Hoạt động" size="small">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Đa phiên:</span>
                  <span className="text-orange-600">
                    {onlineUsers.filter(u => u.sessionInfo.totalSessions > 1).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Session trung bình:</span>
                  <span className="text-purple-600">
                    {stats.totalOnline > 0 ? (stats.totalSessions / stats.totalOnline).toFixed(1) : '0'}
                  </span>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default AdminOnlineUsers;