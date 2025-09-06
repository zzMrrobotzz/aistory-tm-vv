import React, { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, Alert, Table, Tag, Button } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { UserProfile } from '../../types';
import ModuleContainer from '../ModuleContainer';
import UsageQuotaDisplay from '../UsageQuotaDisplay';
// Feature usage tracking instead of rate limit service
import featureUsageTracker from '../../services/featureUsageTracker';
import { Activity, Calendar, TrendingUp, Clock, AlertTriangle } from 'lucide-react';

interface UsageStatsModuleProps {
  currentUser: UserProfile | null;
}

interface DailyUsage {
  date: string;
  totalUsage: number;
  moduleUsage: Array<{
    moduleId: string;
    usageCount: number;
    weightedUsage: number;
  }>;
}

interface UsageHistory {
  userId: string;
  dailyUsages: DailyUsage[];
  totalDays: number;
  totalUsage: number;
  averagePerDay: number;
}

const UsageStatsModule: React.FC<UsageStatsModuleProps> = ({ currentUser }) => {
  const [usageStats, setUsageStats] = useState(featureUsageTracker.getUsageStatsSync());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const moduleNames = {
    'write-story': 'Viết Truyện',
    'write-story-batch': 'Viết Truyện Hàng Loạt',
    'rewrite': 'Viết Lại',
    'rewrite-batch': 'Viết Lại Hàng Loạt',
    'quick-story': 'Tạo Truyện Nhanh',
    'short-form-script': 'Kịch Bản Video Ngắn'
  };

  const moduleColors = {
    'write-story': '#8884d8',
    'write-story-batch': '#82ca9d',
    'rewrite': '#ffc658',
    'rewrite-batch': '#ff7300',
    'quick-story': '#ff6b8a',
    'short-form-script': '#4ecdc4'
  };

  useEffect(() => {
    if (currentUser) {
      loadUsageStats();
    }
  }, [currentUser]);

  const loadUsageStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const stats = await featureUsageTracker.getUsageStats();
      setUsageStats(stats);
    } catch (err) {
      console.error('Failed to load usage stats:', err);
      setError('Không thể tải thống kê sử dụng');
      // Fallback to sync stats
      const fallbackStats = featureUsageTracker.getUsageStatsSync();
      setUsageStats(fallbackStats);
    } finally {
      setLoading(false);
    }
  };

  // Current usage data for display
  const todayData = {
    date: new Date().toLocaleDateString('vi-VN'),
    totalUsage: usageStats.current,
    limit: usageStats.dailyLimit,
    remaining: usageStats.remaining,
    percentage: usageStats.percentage
  };

  // Simple usage breakdown for current status
  const usageBreakdown = [
    {
      name: 'Đã Sử Dụng',
      value: usageStats.current,
      color: usageStats.isBlocked ? '#ff4d4f' : usageStats.percentage > 80 ? '#faad14' : '#52c41a'
    },
    {
      name: 'Còn Lại', 
      value: usageStats.remaining,
      color: '#f0f0f0'
    }
  ];

  // Usage status data for table
  const statusData = [
    {
      key: 1,
      metric: 'Lượt sử dụng hôm nay',
      value: usageStats.current,
      limit: usageStats.dailyLimit,
      status: usageStats.isBlocked ? 'Đã hết' : 'Bình thường'
    },
    {
      key: 2, 
      metric: 'Còn lại',
      value: usageStats.remaining,
      limit: usageStats.dailyLimit,
      status: usageStats.remaining > 50 ? 'Khá tốt' : usageStats.remaining > 20 ? 'Cảnh báo' : 'Sắp hết'
    }
  ];

  const columns = [
    {
      title: 'Metric',
      dataIndex: 'metric',
      key: 'metric'
    },
    {
      title: 'Giá Trị',
      dataIndex: 'value', 
      key: 'value',
      render: (value: number) => <Tag color={value === 0 ? 'red' : 'green'}>{value}</Tag>
    },
    {
      title: 'Giới Hạn',
      dataIndex: 'limit',
      key: 'limit',
      render: (limit: number) => <span>{limit}</span>
    },
    {
      title: 'Trạng Thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const color = status === 'Đã hết' ? 'red' : 
                     status === 'Sắp hết' ? 'orange' : 
                     status === 'Cảnh báo' ? 'yellow' : 'green';
        return <Tag color={color}>{status}</Tag>;
      }
    }
  ];

  if (!currentUser) {
    return (
      <ModuleContainer title="📊 Thống Kê Usage">
        <Alert
          message="Vui lòng đăng nhập để xem thống kê usage"
          type="warning"
          showIcon
        />
      </ModuleContainer>
    );
  }

  return (
    <ModuleContainer title="📊 Thống Kê Usage & Quota">
      <div className="space-y-6">
        {/* Current Usage Status */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-blue-600" />
            Trạng Thái Usage Hiện Tại
          </h3>
          <UsageQuotaDisplay showDetails={true} />
        </div>

        {/* Usage Overview */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
            Thống Kê Sử Dụng Hôm Nay
          </h3>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Đã Sử Dụng"
                  value={usageStats.current}
                  prefix={<Activity />}
                  suffix="lượt"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Còn Lại"
                  value={usageStats.remaining}
                  prefix={<Calendar />}
                  suffix="lượt"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Giới Hạn Hàng Ngày"
                  value={usageStats.dailyLimit}
                  prefix={<Clock />}
                  suffix="lượt"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Phần Trăm Đã Dùng"
                  value={usageStats.percentage.toFixed(1)}
                  prefix={<AlertTriangle />}
                  suffix="%"
                />
              </Card>
            </Col>
          </Row>
        </div>

        {/* Charts */}
        {chartData.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">📈 Biểu Đồ Usage</h3>
            <Row gutter={[16, 16]}>
              {/* Bar Chart */}
              <Col xs={24} lg={16}>
                <Card title="Usage Theo Ngày" extra={<Button onClick={loadUsageHistory} loading={loading}>Refresh</Button>}>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      {Object.keys(moduleNames).map(moduleId => (
                        <Bar 
                          key={moduleId}
                          dataKey={moduleNames[moduleId as keyof typeof moduleNames]}
                          stackId="a"
                          fill={moduleColors[moduleId as keyof typeof moduleColors]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </Col>

              {/* Pie Chart */}
              <Col xs={24} lg={8}>
                <Card title="Phân Bố Theo Module">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            </Row>
          </div>
        )}

        {/* Detailed Table */}
        {tableData.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">📋 Chi Tiết Theo Ngày</h3>
            <Card>
              <Table
                dataSource={tableData}
                columns={columns}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `Tổng ${total} ngày`
                }}
                loading={loading}
              />
            </Card>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Alert
            message="Lỗi tải data"
            description={error}
            type="error"
            action={
              <Button size="small" onClick={loadUsageHistory}>
                Thử lại
              </Button>
            }
          />
        )}

        {/* No Data */}
        {!loading && !error && (!usageHistory || usageHistory.totalRequests === 0) && (
          <Alert
            message="Chưa có dữ liệu usage"
            description="Bạn chưa sử dụng các tính năng bị giới hạn. Hãy thử sử dụng Viết Truyện, Viết Lại để xem thống kê."
            type="info"
        />
      </div>
    </ModuleContainer>
  );
};

export default UsageStatsModule;