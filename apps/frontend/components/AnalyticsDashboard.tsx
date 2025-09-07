import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Select, Spin, message, Progress, Tag } from 'antd';
import { BarChart3, TrendingUp, Target, User, Calendar, PieChart } from 'lucide-react';

const { Option } = Select;

interface FeatureStat {
  featureId: string;
  featureName: string;
  count: number;
  percentage: number;
}

interface UserAnalytics {
  user: {
    id: string;
    username: string;
  };
  period: string;
  totalUsage: number;
  featureStats: FeatureStat[];
  summary: {
    totalFeatures: number;
    mostUsedFeature: FeatureStat | null;
    averagePerFeature: number;
  };
  timeRange: {
    start: string;
    end: string;
    description: string;
  };
}

const AnalyticsDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('all');

  const API_URL = 'https://aistory-backend.onrender.com/api';

  const fetchAnalytics = async (selectedPeriod: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('userToken') || localStorage.getItem('token');
      console.log('🔐 Analytics token check:', token ? `Found: ${token.substring(0,10)}...` : 'Not found');
      
      if (!token) {
        message.error('Vui lòng đăng nhập để xem thống kê');
        return;
      }

      const response = await fetch(`${API_URL}/features/user-analytics?period=${selectedPeriod}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
        },
      });

      console.log('🌐 Analytics response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Analytics error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      if (data.success) {
        setAnalytics(data.data);
        // console.log('📊 Analytics loaded:', data.data); // Reduced console logs
      } else {
        message.error(data.message || 'Lỗi khi tải thống kê');
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      message.error('Không thể tải thống kê. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(period);
  }, [period]);

  const handlePeriodChange = (value: string) => {
    setPeriod(value);
  };

  const getFeatureDisplayName = (featureId: string): string => {
    const nameMap: { [key: string]: string } = {
      'rewrite': 'Viết Lại',
      'write-story': 'Viết Truyện', 
      'quick-story': 'Tạo Truyện Nhanh',
      'short-form-script': 'Kịch Bản Video Ngắn',
      'image-generation': 'Tạo Ảnh',
      'text-to-speech': 'Chuyển Văn Bản Thành Giọng Nói',
    };
    return nameMap[featureId] || featureId;
  };

  const getFeatureColor = (featureId: string): string => {
    const colorMap: { [key: string]: string } = {
      'rewrite': '#52c41a',
      'write-story': '#1890ff', 
      'quick-story': '#722ed1',
      'short-form-script': '#fa8c16',
      'image-generation': '#eb2f96',
      'text-to-speech': '#13c2c2',
    };
    return colorMap[featureId] || '#666666';
  };

  return (
    <div className="analytics-dashboard">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 size={28} className="text-blue-500" />
          <div>
            <h2 className="text-2xl font-bold text-gray-800 m-0">Thống Kê Sử Dụng</h2>
            <p className="text-gray-600 m-0">Theo dõi hoạt động của bạn</p>
          </div>
        </div>
        <Select
          value={period}
          onChange={handlePeriodChange}
          style={{ width: 150 }}
        >
          <Option value="today">Hôm nay</Option>
          <Option value="week">Tuần này</Option>
          <Option value="month">Tháng này</Option>
          <Option value="all">Tất cả</Option>
        </Select>
      </div>

      <Spin spinning={loading}>
        {analytics ? (
          <>
            {/* Overview Statistics */}
            <Row gutter={[16, 16]} className="mb-6">
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Tổng Lượt Sử Dụng"
                    value={analytics.totalUsage}
                    prefix={<TrendingUp className="text-blue-500" size={20} />}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Số Tính Năng Đã Dùng"
                    value={analytics.summary.totalFeatures}
                    prefix={<Target className="text-green-500" size={20} />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Trung Bình/Tính Năng"
                    value={analytics.summary.averagePerFeature}
                    prefix={<PieChart className="text-purple-500" size={20} />}
                    valueStyle={{ color: '#722ed1' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Thời Gian"
                    value={analytics.timeRange.description}
                    prefix={<Calendar className="text-orange-500" size={20} />}
                    valueStyle={{ color: '#fa8c16' }}
                  />
                </Card>
              </Col>
            </Row>

            {/* Feature Breakdown */}
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card 
                  title="Phân Tích Theo Tính Năng" 
                  extra={analytics.summary.mostUsedFeature ? (
                    <Tag color="blue">
                      Yêu thích nhất: {getFeatureDisplayName(analytics.summary.mostUsedFeature.featureId)}
                    </Tag>
                  ) : null}
                >
                  {analytics.featureStats.length > 0 ? (
                    <div className="space-y-4">
                      {analytics.featureStats.map((feature, index) => (
                        <div key={feature.featureId} className="feature-stat-item">
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-800">
                                {getFeatureDisplayName(feature.featureId)}
                              </span>
                              <Tag color={getFeatureColor(feature.featureId)}>
                                #{index + 1}
                              </Tag>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-lg">{feature.count}</span>
                              <span className="text-gray-500 ml-2">({feature.percentage}%)</span>
                            </div>
                          </div>
                          <Progress 
                            percent={feature.percentage} 
                            strokeColor={getFeatureColor(feature.featureId)}
                            size="small"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <PieChart size={48} className="mx-auto mb-4 opacity-50" />
                      <p>Chưa có hoạt động nào</p>
                      <p className="text-sm">Hãy bắt đầu sử dụng các tính năng để xem thống kê</p>
                    </div>
                  )}
                </Card>
              </Col>

              <Col span={12}>
                <Card title="Thông Tin Người Dùng">
                  <div className="user-info-card">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                        <User size={32} className="text-blue-500" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-800 m-0">
                          {analytics.user.username}
                        </h3>
                        <p className="text-gray-600 m-0">ID: {analytics.user.id.substring(0, 8)}...</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Khoảng thời gian:</span>
                        <span className="font-medium">{analytics.timeRange.description}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Từ ngày:</span>
                        <span className="font-medium">{analytics.timeRange.start}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Đến ngày:</span>
                        <span className="font-medium">{analytics.timeRange.end}</span>
                      </div>
                      
                      {analytics.summary.mostUsedFeature && (
                        <>
                          <hr className="my-4" />
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <h4 className="text-sm font-medium text-blue-800 mb-2">Tính Năng Yêu Thích</h4>
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-blue-600">
                                {getFeatureDisplayName(analytics.summary.mostUsedFeature.featureId)}
                              </span>
                              <Tag color="blue">
                                {analytics.summary.mostUsedFeature.count} lượt
                              </Tag>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              </Col>
            </Row>
          </>
        ) : !loading ? (
          <Card>
            <div className="text-center py-12">
              <BarChart3 size={64} className="mx-auto mb-4 text-gray-300" />
              <h3 className="text-xl font-medium text-gray-600 mb-2">Chưa có dữ liệu thống kê</h3>
              <p className="text-gray-500">
                Vui lòng đăng nhập và sử dụng các tính năng để xem thống kê
              </p>
            </div>
          </Card>
        ) : null}
      </Spin>
    </div>
  );
};

export default AnalyticsDashboard;