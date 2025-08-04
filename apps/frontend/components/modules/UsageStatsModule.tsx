import React, { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, Alert, Table, Tag, Button } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { UserProfile } from '../../types';
import ModuleContainer from '../ModuleContainer';
import UsageQuotaDisplay from '../UsageQuotaDisplay';
import { getUserUsageHistory, getUserUsageStatus } from '../../services/rateLimitService';
import { Activity, Calendar, TrendingUp, Clock, AlertTriangle } from 'lucide-react';

interface UsageStatsModuleProps {
  currentUser: UserProfile | null;
}

interface DailyUsage {
  date: string;
  totalUsage: number;
  moduleUsage: Array<{
    moduleId: string;
    requestCount: number;
    weightedUsage: number;
  }>;
}

interface UsageHistory {
  userId: string;
  dailyUsages: DailyUsage[];
  totalDays: number;
  totalRequests: number;
  averagePerDay: number;
}

const UsageStatsModule: React.FC<UsageStatsModuleProps> = ({ currentUser }) => {
  const [usageHistory, setUsageHistory] = useState<UsageHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const moduleNames = {
    'write-story': 'Viết Truyện',
    'batch-story-writing': 'Viết Truyện Hàng Loạt',
    'rewrite': 'Viết Lại',
    'batch-rewrite': 'Viết Lại Hàng Loạt'
  };

  const moduleColors = {
    'write-story': '#8884d8',
    'batch-story-writing': '#82ca9d',
    'rewrite': '#ffc658',
    'batch-rewrite': '#ff7300'
  };

  useEffect(() => {
    if (currentUser) {
      loadUsageHistory();
    }
  }, [currentUser]);

  const loadUsageHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const history = await getUserUsageHistory(7); // Last 7 days
      setUsageHistory(history.data);
    } catch (err) {
      console.error('Failed to load usage history:', err);
      setError('Không thể tải lịch sử sử dụng');
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data
  const chartData = usageHistory?.dailyUsages.map(day => ({
    date: new Date(day.date).toLocaleDateString('vi-VN', { 
      month: 'short', 
      day: 'numeric' 
    }),
    totalUsage: day.totalUsage,
    ...day.moduleUsage.reduce((acc, module) => ({
      ...acc,
      [moduleNames[module.moduleId as keyof typeof moduleNames] || module.moduleId]: module.requestCount
    }), {})
  })) || [];

  // Prepare pie chart data
  const moduleUsageTotal = usageHistory?.dailyUsages.reduce((acc, day) => {
    day.moduleUsage.forEach(module => {
      const moduleName = moduleNames[module.moduleId as keyof typeof moduleNames] || module.moduleId;
      acc[moduleName] = (acc[moduleName] || 0) + module.requestCount;
    });
    return acc;
  }, {} as Record<string, number>) || {};

  const pieData = Object.entries(moduleUsageTotal).map(([name, value]) => ({
    name,
    value,
    color: moduleColors[Object.keys(moduleNames).find(key => 
      moduleNames[key as keyof typeof moduleNames] === name
    ) as keyof typeof moduleColors] || '#8884d8'
  }));

  // Table data for daily breakdown
  const tableData = usageHistory?.dailyUsages.map((day, index) => ({
    key: index,
    date: new Date(day.date).toLocaleDateString('vi-VN'),
    totalUsage: day.totalUsage,
    modules: day.moduleUsage
  })) || [];

  const columns = [
    {
      title: 'Ngày',
      dataIndex: 'date',
      key: 'date',
      sorter: (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    },
    {
      title: 'Tổng Usage',
      dataIndex: 'totalUsage',
      key: 'totalUsage',
      sorter: (a: any, b: any) => a.totalUsage - b.totalUsage,
      render: (value: number) => <Tag color={value > 50 ? 'red' : value > 20 ? 'orange' : 'green'}>{value}</Tag>
    },
    {
      title: 'Chi Tiết Modules',
      dataIndex: 'modules',
      key: 'modules',
      render: (modules: any[]) => (
        <div>
          {modules.map(module => (
            <div key={module.moduleId} style={{ fontSize: '12px', marginBottom: '2px' }}>
              <strong>{moduleNames[module.moduleId as keyof typeof moduleNames] || module.moduleId}:</strong> {module.requestCount}
              {module.weightedUsage !== module.requestCount && (
                <span style={{ color: '#666' }}> (weight: {module.weightedUsage})</span>
              )}
            </div>
          ))}
        </div>
      )
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

        {/* Overview Statistics */}
        {usageHistory && (
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
              Tổng Quan 7 Ngày Qua
            </h3>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="Tổng Requests"
                    value={usageHistory.totalRequests}
                    prefix={<Activity />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="Trung Bình/Ngày"
                    value={Math.round(usageHistory.averagePerDay)}
                    prefix={<Calendar />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="Ngày Có Data"
                    value={usageHistory.totalDays}
                    prefix={<Clock />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="Peak Usage"
                    value={Math.max(...usageHistory.dailyUsages.map(d => d.totalUsage))}
                    prefix={<AlertTriangle />}
                  />
                </Card>
              </Col>
            </Row>
          </div>
        )}

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
            showIcon
          />
        )}
      </div>
    </ModuleContainer>
  );
};

export default UsageStatsModule;