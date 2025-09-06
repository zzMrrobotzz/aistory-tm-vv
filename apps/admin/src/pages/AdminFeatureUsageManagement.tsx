import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Statistic, Alert, Table, message, Modal, Spin, Row, Col, Typography, Divider, Tag } from 'antd';
import { BarChart3, Users, Target, TrendingUp, RefreshCw, Settings, AlertCircle, CheckCircle } from 'lucide-react';

const { Title, Text } = Typography;

interface FeatureSetting {
  key: string;
  value: number;
  type: string;
  description: string;
  category: string;
  lastModified: string;
  modifiedBy: string;
}

interface UsageStats {
  currentLimit: number;
  todayStats: {
    totalUsers: number;
    totalUsage: number;
    averageUsage: number;
    maxUsage: number;
    blockedUsers: number;
    utilizationRate: number;
  };
  featureBreakdown: Array<{
    _id: string;
    featureName: string;
    totalUses: number;
    userCount: number;
  }>;
  weeklyTrend: Array<{
    _id: string;
    totalUsage: number;
    userCount: number;
  }>;
}

const AdminFeatureUsageManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [settings, setSettings] = useState<Record<string, FeatureSetting[]>>({});
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [newLimit, setNewLimit] = useState<string>('');
  const [isModalVisible, setIsModalVisible] = useState(false);

  const API_BASE_URL = 'https://aistory-backend.onrender.com/api';

  // Note: Admin system currently doesn't use JWT tokens - matches existing admin routes

  // Fetch feature settings
  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/feature-settings`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setSettings(data.data.settings);
      } else {
        message.error(data.message || 'Lỗi khi lấy cấu hình');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      message.error('Lỗi kết nối đến server');
    } finally {
      setLoading(false);
    }
  };

  // Fetch usage statistics
  const fetchUsageStats = async () => {
    setStatsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/feature-settings/stats`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setUsageStats(data.data);
      } else {
        message.error(data.message || 'Lỗi khi lấy thống kê');
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      message.error('Lỗi kết nối đến server');
    } finally {
      setStatsLoading(false);
    }
  };

  // Update daily limit
  const updateDailyLimit = async (value: number) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/feature-settings/feature_daily_limit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          value: value,
          description: `Daily feature usage limit for all users - Updated by admin`,
          type: 'number',
          category: 'feature_limits'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        message.success('Đã cập nhật giới hạn thành công!');
        fetchSettings();
        fetchUsageStats();
        setIsModalVisible(false);
        setNewLimit('');
      } else {
        message.error(data.message || 'Lỗi khi cập nhật');
      }
    } catch (error) {
      console.error('Error updating limit:', error);
      message.error('Lỗi kết nối đến server');
    } finally {
      setLoading(false);
    }
  };

  // Reset all usage
  const resetAllUsage = async () => {
    Modal.confirm({
      title: 'Xác nhận reset toàn bộ usage',
      content: 'Điều này sẽ reset usage của TẤT CẢ người dùng về 0. Bạn có chắc chắn?',
      okText: 'Xác nhận',
      cancelText: 'Hủy',
      okType: 'danger',
      onOk: async () => {
        setLoading(true);
        try {
          const response = await fetch(`${API_BASE_URL}/admin/feature-settings/reset-all-usage`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'reset' })
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();
          if (data.success) {
            message.success(`Đã reset thành công ${data.data.resetCount} người dùng!`);
            fetchUsageStats();
          } else {
            message.error(data.message || 'Lỗi khi reset');
          }
        } catch (error) {
          console.error('Error resetting usage:', error);
          message.error('Lỗi kết nối đến server');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleUpdateLimit = () => {
    const value = parseInt(newLimit);
    if (isNaN(value) || value < 1 || value > 50000) {
      message.error('Giới hạn phải từ 1-50000');
      return;
    }
    updateDailyLimit(value);
  };

  useEffect(() => {
    fetchSettings();
    fetchUsageStats();
  }, []);

  const featureBreakdownColumns = [
    {
      title: 'Tên Tính Năng',
      dataIndex: 'featureName',
      key: 'featureName',
      render: (text: string) => <Tag color="blue">{text}</Tag>
    },
    {
      title: 'Số Lượt Sử Dụng',
      dataIndex: 'totalUses',
      key: 'totalUses',
      render: (value: number) => <Text strong>{value.toLocaleString()}</Text>
    },
    {
      title: 'Số Người Dùng',
      dataIndex: 'userCount',
      key: 'userCount',
      render: (value: number) => <Text>{value}</Text>
    },
  ];

  const weeklyTrendColumns = [
    {
      title: 'Ngày',
      dataIndex: '_id',
      key: 'date',
    },
    {
      title: 'Tổng Sử Dụng',
      dataIndex: 'totalUsage',
      key: 'totalUsage',
      render: (value: number) => <Text>{value.toLocaleString()}</Text>
    },
    {
      title: 'Số Người Dùng',
      dataIndex: 'userCount',
      key: 'userCount',
    },
  ];

  const currentDailyLimit = settings.feature_limits?.find(s => s.key === 'feature_daily_limit')?.value || 0;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <Title level={2} className="mb-2">
              <BarChart3 className="inline-block mr-2" size={28} />
              Quản Lý Giới Hạn Tính Năng
            </Title>
            <Text type="secondary">
              Quản lý centralized giới hạn sử dụng tính năng cho tất cả người dùng
            </Text>
          </div>
          <Button 
            type="primary" 
            icon={<RefreshCw size={16} />}
            onClick={() => {
              fetchSettings();
              fetchUsageStats();
            }}
            loading={loading || statsLoading}
          >
            Làm mới
          </Button>
        </div>

        {/* Current Settings Card */}
        <Card className="mb-6" loading={loading}>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Statistic
                title="Giới Hạn Hiện Tại (Lượt/Ngày)"
                value={currentDailyLimit}
                prefix={<Target className="text-blue-500" size={20} />}
                suffix="lượt"
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col span={12}>
              <div className="flex gap-2">
                <Button 
                  type="primary" 
                  icon={<Settings size={16} />}
                  onClick={() => {
                    setNewLimit(currentDailyLimit.toString());
                    setIsModalVisible(true);
                  }}
                >
                  Thay Đổi Giới Hạn
                </Button>
                <Button 
                  danger 
                  icon={<AlertCircle size={16} />}
                  onClick={resetAllUsage}
                >
                  Reset Tất Cả Usage
                </Button>
              </div>
            </Col>
          </Row>
        </Card>

        {/* Usage Statistics */}
        <Card title="Thống Kê Sử Dụng Hôm Nay" className="mb-6" loading={statsLoading}>
          {usageStats && (
            <>
              <Row gutter={[16, 16]} className="mb-6">
                <Col span={6}>
                  <Statistic
                    title="Tổng Người Dùng"
                    value={usageStats.todayStats.totalUsers}
                    prefix={<Users className="text-green-500" size={20} />}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Tổng Lượt Sử Dụng"
                    value={usageStats.todayStats.totalUsage}
                    prefix={<TrendingUp className="text-blue-500" size={20} />}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Trung Bình/Người"
                    value={usageStats.todayStats.averageUsage}
                    precision={1}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Số Người Bị Chặn"
                    value={usageStats.todayStats.blockedUsers}
                    valueStyle={{ color: usageStats.todayStats.blockedUsers > 0 ? '#cf1322' : '#52c41a' }}
                    prefix={usageStats.todayStats.blockedUsers > 0 ? <AlertCircle className="text-red-500" size={20} /> : <CheckCircle className="text-green-500" size={20} />}
                  />
                </Col>
              </Row>

              <Alert
                message={`Tỷ lệ sử dụng: ${usageStats.todayStats.utilizationRate}%`}
                description={`Người dùng đang sử dụng trung bình ${usageStats.todayStats.utilizationRate}% giới hạn hàng ngày`}
                type={usageStats.todayStats.utilizationRate > 80 ? 'warning' : 'info'}
                showIcon
                className="mb-4"
              />
            </>
          )}
        </Card>

        {/* Feature Breakdown */}
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Card title="Phân Tích Theo Tính Năng" loading={statsLoading}>
              <Table
                dataSource={usageStats?.featureBreakdown || []}
                columns={featureBreakdownColumns}
                rowKey="_id"
                pagination={false}
                size="small"
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card title="Xu Hướng 7 Ngày Qua" loading={statsLoading}>
              <Table
                dataSource={usageStats?.weeklyTrend || []}
                columns={weeklyTrendColumns}
                rowKey="_id"
                pagination={false}
                size="small"
              />
            </Card>
          </Col>
        </Row>

        {/* Update Limit Modal */}
        <Modal
          title="Thay Đổi Giới Hạn Hàng Ngày"
          open={isModalVisible}
          onOk={handleUpdateLimit}
          onCancel={() => {
            setIsModalVisible(false);
            setNewLimit('');
          }}
          confirmLoading={loading}
          okText="Cập nhật"
          cancelText="Hủy"
        >
          <div className="mb-4">
            <Text strong>Giới hạn hiện tại: </Text>
            <Text>{currentDailyLimit} lượt/ngày</Text>
          </div>
          <div className="mb-4">
            <Text strong>Giới hạn mới (1-50000):</Text>
            <Input
              type="number"
              value={newLimit}
              onChange={(e) => setNewLimit(e.target.value)}
              placeholder="Nhập giới hạn mới..."
              min={1}
              max={50000}
              className="mt-2"
            />
          </div>
          <Alert
            message="Lưu ý"
            description="Thay đổi này sẽ áp dụng cho TẤT CẢ người dùng ngay lập tức. Tất cả 3 modules (Viết Lại, Viết Truyện, Tạo Truyện Nhanh) sẽ chia sẻ chung giới hạn này."
            type="warning"
            showIcon
          />
        </Modal>
      </div>
    </div>
  );
};

export default AdminFeatureUsageManagement;