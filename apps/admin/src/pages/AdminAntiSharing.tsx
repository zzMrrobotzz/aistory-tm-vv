import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Tag, 
  Button, 
  Card, 
  Statistic, 
  Row, 
  Col, 
  Space,
  Alert,
  message,
  Spin
} from 'antd';
import { 
  LockOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  UserOutlined
} from '@ant-design/icons';

const API_BASE = "https://aistory-backend.onrender.com/api";

interface AntiSharingStats {
  totalBlocks: number;
  activeBlocks: number;
  appealsPending: number;
  suspiciousAccounts: number;
  totalDevices: number;
  activeSessions: number;
  averageSharingScore: number;
  blocksToday: number;
}

const AdminAntiSharing: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<AntiSharingStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/admin/anti-sharing/stats`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
      } else {
        throw new Error(data.message || 'Failed to load stats');
      }
    } catch (error) {
      console.error('Failed to load anti-sharing stats:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      message.error('Không thể tải thống kê anti-sharing');
    } finally {
      setLoading(false);
    }
  };

  const getSharingScoreColor = (score: number) => {
    if (score >= 85) return '#ff4d4f';
    if (score >= 75) return '#fa8c16';
    if (score >= 60) return '#fadb14';
    return '#52c41a';
  };

  if (error && !stats) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="Lỗi kết nối"
          description={`Không thể kết nối đến backend: ${error}`}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={loadStats} loading={loading}>
              Thử lại
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Space>
          <h1>Anti-Sharing Management</h1>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={loadStats}
            loading={loading}
            type="default"
          >
            Refresh
          </Button>
        </Space>
        <p>Monitor and manage account sharing detection</p>
      </div>

      {/* Statistics Cards */}
      <Spin spinning={loading}>
        {stats ? (
          <Row gutter={16} style={{ marginBottom: '24px' }}>
            <Col span={3}>
              <Card>
                <Statistic
                  title="Total Blocks"
                  value={stats.totalBlocks}
                  prefix={<LockOutlined />}
                />
              </Card>
            </Col>
            <Col span={3}>
              <Card>
                <Statistic
                  title="Active Blocks"
                  value={stats.activeBlocks}
                  valueStyle={{ color: '#cf1322' }}
                  prefix={<ExclamationCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={3}>
              <Card>
                <Statistic
                  title="Pending Appeals"
                  value={stats.appealsPending}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={3}>
              <Card>
                <Statistic
                  title="Suspicious Accounts"
                  value={stats.suspiciousAccounts}
                  valueStyle={{ color: '#fa8c16' }}
                  prefix={<WarningOutlined />}
                />
              </Card>
            </Col>
            <Col span={3}>
              <Card>
                <Statistic
                  title="Total Devices"
                  value={stats.totalDevices}
                />
              </Card>
            </Col>
            <Col span={3}>
              <Card>
                <Statistic
                  title="Active Sessions"
                  value={stats.activeSessions}
                  prefix={<UserOutlined />}
                />
              </Card>
            </Col>
            <Col span={3}>
              <Card>
                <Statistic
                  title="Avg Score"
                  value={stats.averageSharingScore}
                  precision={1}
                  suffix="/100"
                  valueStyle={{ color: getSharingScoreColor(stats.averageSharingScore) }}
                />
              </Card>
            </Col>
            <Col span={3}>
              <Card>
                <Statistic
                  title="Blocks Today"
                  value={stats.blocksToday}
                  valueStyle={{ color: stats.blocksToday > 0 ? '#cf1322' : '#52c41a' }}
                />
              </Card>
            </Col>
          </Row>
        ) : (
          <Row gutter={16} style={{ marginBottom: '24px' }}>
            {[...Array(8)].map((_, index) => (
              <Col span={3} key={index}>
                <Card>
                  <Statistic
                    title="Loading..."
                    value={0}
                  />
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Spin>

      {/* Status Information */}
      <Card title="Anti-Sharing System Status" style={{ marginBottom: '24px' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert
            message="Single Session Mode Active"
            description="Hệ thống đang hoạt động ở chế độ single session - chỉ cho phép 1 phiên đăng nhập tại 1 thời điểm."
            type="success"
            showIcon
          />
          
          <Alert
            message="Device Fingerprinting Enabled"
            description="Hệ thống đang thu thập device fingerprint để phát hiện account sharing."
            type="info"
            showIcon
          />
          
          <Alert
            message="Real-time Monitoring"
            description="Session heartbeat và behavioral analysis đang hoạt động 24/7."
            type="info"
            showIcon
          />
        </Space>
      </Card>

      {/* Feature Information */}
      <Card title="Anti-Sharing Features">
        <Row gutter={16}>
          <Col span={8}>
            <h4>🔒 Single Session</h4>
            <p>Chỉ cho phép 1 người dùng đăng nhập tại 1 thời điểm. Đăng nhập mới sẽ tự động đăng xuất session cũ.</p>
          </Col>
          
          <Col span={8}>
            <h4>📱 Device Fingerprinting</h4>
            <p>Thu thập thông tin hardware và browser để tạo fingerprint duy nhất cho mỗi thiết bị.</p>
          </Col>
          
          <Col span={8}>
            <h4>🤖 Behavioral Analysis</h4>
            <p>Phân tích pattern sử dụng để phát hiện hành vi chia sẻ tài khoản bất thường.</p>
          </Col>
        </Row>
        
        <Row gutter={16} style={{ marginTop: '16px' }}>
          <Col span={8}>
            <h4>⚡ Real-time Monitoring</h4>
            <p>Heartbeat system kiểm tra session status mỗi 2 phút, timeout sau 30 phút không hoạt động.</p>
          </Col>
          
          <Col span={8}>
            <h4>📊 Scoring System</h4>
            <p>35% hardware + 40% behavior + 25% session = total score. Block tự động khi ≥85 điểm.</p>
          </Col>
          
          <Col span={8}>
            <h4>🛡️ Auto Protection</h4>
            <p>Tự động block accounts với sharing score cao, có thể appeal và admin review.</p>
          </Col>
        </Row>
      </Card>

      {error && (
        <Alert
          message="Cảnh báo"
          description={`Có lỗi khi tải dữ liệu: ${error}`}
          type="warning"
          showIcon
          style={{ marginTop: '16px' }}
        />
      )}
    </div>
  );
};

export default AdminAntiSharing;