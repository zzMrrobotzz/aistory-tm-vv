import React, { useState, useEffect } from 'react';
import { Card, Table, Button, InputNumber, Switch, message, Statistic, Row, Col, Tag, Alert, Modal, Form, Select } from 'antd';
import { 
  SettingOutlined, 
  BarChartOutlined, 
  UserOutlined, 
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  EditOutlined,
  SaveOutlined
} from '@ant-design/icons';

const API_BASE_URL = 'https://aistory-backend.onrender.com';

const { Option } = Select;

interface RateLimitConfig {
  _id?: string;
  dailyLimit: number;
  restrictedModules: Array<{
    moduleId: string;
    weight: number;
  }>;
  subscriptionLimits: {
    free: number;
    monthly: number;
    lifetime: number;
  };
  exemptUsers: string[];
  burstSettings: {
    enabled: boolean;
    burstLimit: number;
    burstWindow: number;
  };
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface UsageStats {
  totalUsers: number;
  activeToday: number;
  totalRequests: number;
  averageRequestsPerUser: number;
  topModules: Array<{
    moduleId: string;
    requestCount: number;
    userCount: number;
  }>;
  limitExceeded: number;
}

interface UserUsage {
  _id: string;
  userId: string;
  username: string;
  email: string;
  subscriptionType: string;
  date: string;
  totalUsage: number;
  usageLimit: number;
  moduleUsage: Array<{
    moduleId: string;
    requestCount: number;
    weightedUsage: number;
  }>;
  lastRequest: string;
  isBlocked: boolean;
}

const AdminRateLimiting: React.FC = () => {
  const [config, setConfig] = useState<RateLimitConfig | null>(null);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [userUsages, setUserUsages] = useState<UserUsage[]>([]);
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [form] = Form.useForm();

  const moduleNames = {
    'write-story': 'Viết Truyện',
    'batch-story-writing': 'Viết Truyện Hàng Loạt',
    'rewrite': 'Viết Lại',
    'batch-rewrite': 'Viết Lại Hàng Loạt'
  };

  // Load initial data
  useEffect(() => {
    loadConfig();
    loadStats();
    loadUserUsages();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/admin/rate-limit/config`);
      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
      } else {
        message.error('Không thể tải cấu hình rate limiting');
      }
    } catch (error) {
      console.error('Load config error:', error);
      message.error('Lỗi khi tải cấu hình');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/rate-limit/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Load stats error:', error);
    }
  };

  const loadUserUsages = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/rate-limit/users?limit=50`);
      if (response.ok) {
        const data = await response.json();
        setUserUsages(data.usages);
      }
    } catch (error) {
      console.error('Load user usages error:', error);
    }
  };

  const saveConfig = async (values: any) => {
    try {
      setLoading(true);
      const configData = {
        dailyLimit: values.dailyLimit,
        restrictedModules: [
          { moduleId: 'write-story', weight: values.writeStoryWeight || 1 },
          { moduleId: 'batch-story-writing', weight: values.batchStoryWeight || 1 },
          { moduleId: 'rewrite', weight: values.rewriteWeight || 1 },
          { moduleId: 'batch-rewrite', weight: values.batchRewriteWeight || 1 }
        ],
        subscriptionLimits: {
          free: values.freeLimit,
          monthly: values.monthlyLimit,
          lifetime: values.lifetimeLimit
        },
        burstSettings: {
          enabled: values.burstEnabled,
          burstLimit: values.burstLimit || 50,
          burstWindow: values.burstWindow || 3600
        },
        isActive: values.isActive
      };

      const response = await fetch(`${API_BASE_URL}/api/admin/rate-limit/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData)
      });

      if (response.ok) {
        message.success('Cấu hình đã được lưu thành công!');
        setEditModalVisible(false);
        loadConfig();
        loadStats();
      } else {
        message.error('Không thể lưu cấu hình');
      }
    } catch (error) {
      console.error('Save config error:', error);
      message.error('Lỗi khi lưu cấu hình');
    } finally {
      setLoading(false);
    }
  };

  const resetUserUsage = async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/rate-limit/reset-user/${userId}`, {
        method: 'POST'
      });
      
      if (response.ok) {
        message.success('Đã reset usage cho user');
        loadUserUsages();
      } else {
        message.error('Không thể reset usage');
      }
    } catch (error) {
      console.error('Reset usage error:', error);
      message.error('Lỗi khi reset usage');
    }
  };

  const openEditModal = () => {
    if (config) {
      const writeStoryModule = config.restrictedModules.find(m => m.moduleId === 'write-story');
      const batchStoryModule = config.restrictedModules.find(m => m.moduleId === 'batch-story-writing');
      const rewriteModule = config.restrictedModules.find(m => m.moduleId === 'rewrite');
      const batchRewriteModule = config.restrictedModules.find(m => m.moduleId === 'batch-rewrite');

      form.setFieldsValue({
        dailyLimit: config.dailyLimit,
        writeStoryWeight: writeStoryModule?.weight || 1,
        batchStoryWeight: batchStoryModule?.weight || 1,
        rewriteWeight: rewriteModule?.weight || 1,
        batchRewriteWeight: batchRewriteModule?.weight || 1,
        freeLimit: config.subscriptionLimits.free,
        monthlyLimit: config.subscriptionLimits.monthly,
        lifetimeLimit: config.subscriptionLimits.lifetime,
        burstEnabled: config.burstSettings.enabled,
        burstLimit: config.burstSettings.burstLimit,
        burstWindow: config.burstSettings.burstWindow,
        isActive: config.isActive
      });
    }
    setEditModalVisible(true);
  };

  const userUsageColumns = [
    {
      title: 'User',
      dataIndex: 'username',
      key: 'username',
      render: (text: string, record: UserUsage) => (
        <div>
          <div><strong>{text}</strong></div>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.email}</div>
        </div>
      )
    },
    {
      title: 'Subscription',
      dataIndex: 'subscriptionType',
      key: 'subscriptionType',
      render: (type: string) => (
        <Tag color={type === 'lifetime' ? 'gold' : type === 'monthly' ? 'blue' : 'default'}>
          {type.toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'Usage Today',
      key: 'usage',
      render: (_: any, record: UserUsage) => (
        <div>
          <div>{record.totalUsage} / {record.usageLimit}</div>
          <div style={{ 
            width: '100px', 
            height: '6px', 
            backgroundColor: '#f0f0f0', 
            borderRadius: '3px',
            marginTop: '4px'
          }}>
            <div style={{
              width: `${Math.min(100, (record.totalUsage / record.usageLimit) * 100)}%`,
              height: '100%',
              backgroundColor: record.totalUsage >= record.usageLimit ? '#ff4d4f' : '#52c41a',
              borderRadius: '3px'
            }} />
          </div>
        </div>
      )
    },
    {
      title: 'Module Usage',
      dataIndex: 'moduleUsage',
      key: 'moduleUsage',
      render: (moduleUsage: UserUsage['moduleUsage']) => (
        <div style={{ fontSize: '12px' }}>
          {moduleUsage.map(m => (
            <div key={m.moduleId}>
              {moduleNames[m.moduleId as keyof typeof moduleNames]}: {m.requestCount}
            </div>
          ))}
        </div>
      )
    },
    {
      title: 'Last Request',
      dataIndex: 'lastRequest',
      key: 'lastRequest',
      render: (date: string) => date ? new Date(date).toLocaleString('vi-VN') : 'Chưa có'
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: UserUsage) => (
        <div>
          {record.isBlocked && <Tag color="red">Blocked</Tag>}
          {record.totalUsage >= record.usageLimit && <Tag color="orange">Limit Exceeded</Tag>}
          {record.totalUsage < record.usageLimit && !record.isBlocked && <Tag color="green">Normal</Tag>}
        </div>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: UserUsage) => (
        <Button 
          size="small" 
          onClick={() => resetUserUsage(record.userId)}
          disabled={loading}
        >
          Reset Usage
        </Button>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>
          <SettingOutlined style={{ marginRight: '8px' }} />
          Quản Lý Rate Limiting
        </h1>
        <div>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={() => { loadConfig(); loadStats(); loadUserUsages(); }}
            style={{ marginRight: '8px' }}
          >
            Refresh
          </Button>
          <Button 
            type="primary" 
            icon={<EditOutlined />}
            onClick={openEditModal}
          >
            Chỉnh Sửa Cấu Hình
          </Button>
        </div>
      </div>

      {/* Configuration Overview */}
      <Card title="Cấu Hình Hiện Tại" style={{ marginBottom: '24px' }} loading={loading}>
        {config && (
          <Row gutter={[16, 16]}>
            <Col span={6}>
              <Statistic
                title="Daily Limit (Default)"
                value={config.dailyLimit}
                suffix="requests"
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Free Users"
                value={config.subscriptionLimits.free}
                suffix="requests/day"
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Monthly Users"
                value={config.subscriptionLimits.monthly}  
                suffix="requests/day"
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Lifetime Users"
                value={config.subscriptionLimits.lifetime}
                suffix="requests/day"
              />
            </Col>
          </Row>
        )}
        
        {config && (
          <div style={{ marginTop: '16px' }}>
            <Alert
              message={config.isActive ? "Rate Limiting đang BẬT" : "Rate Limiting đang TẮT"}
              type={config.isActive ? "success" : "warning"}
              showIcon
            />
          </div>
        )}
      </Card>

      {/* Statistics */}
      <Card title="Thống Kê Usage" style={{ marginBottom: '24px' }}>
        {stats && (
          <Row gutter={[16, 16]}>
            <Col span={6}>
              <Statistic
                title="Total Users"
                value={stats.totalUsers}
                prefix={<UserOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Active Today"
                value={stats.activeToday}
                prefix={<ClockCircleOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Total Requests"
                value={stats.totalRequests}
                prefix={<BarChartOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Limit Exceeded"
                value={stats.limitExceeded}
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: stats.limitExceeded > 0 ? '#cf1322' : '#3f8600' }}
              />
            </Col>
          </Row>
        )}
      </Card>

      {/* User Usage Table */}
      <Card title="Chi Tiết Usage Của Users">
        <Table
          dataSource={userUsages}
          columns={userUsageColumns}
          rowKey="userId"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `Tổng ${total} users`
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* Edit Configuration Modal */}
      <Modal
        title="Chỉnh Sửa Cấu Hình Rate Limiting"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={saveConfig}
        >
          <Alert
            message="Lưu ý: Thay đổi cấu hình sẽ áp dụng ngay lập tức cho tất cả users"
            type="warning"
            style={{ marginBottom: '16px' }}
          />

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Daily Limit (Mặc định)"
                name="dailyLimit"
                rules={[{ required: true, message: 'Vui lòng nhập daily limit!' }]}
              >
                <InputNumber min={1} max={10000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Trạng Thái"
                name="isActive"
                valuePropName="checked"
              >
                <Switch checkedChildren="BẬT" unCheckedChildren="TẮT" />
              </Form.Item>
            </Col>
          </Row>

          <h4>Limits Theo Subscription:</h4>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="Free Users"
                name="freeLimit"
                rules={[{ required: true }]}
              >
                <InputNumber min={1} max={1000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Monthly Users"
                name="monthlyLimit"
                rules={[{ required: true }]}
              >
                <InputNumber min={1} max={1000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Lifetime Users"
                name="lifetimeLimit"
                rules={[{ required: true }]}
              >
                <InputNumber min={1} max={2000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <h4>Trọng Số Modules:</h4>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item
                label="Viết Truyện"
                name="writeStoryWeight"
              >
                <InputNumber min={0.1} max={10} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label="Viết Truyện Hàng Loạt"
                name="batchStoryWeight"
              >
                <InputNumber min={0.1} max={10} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label="Viết Lại"
                name="rewriteWeight"
              >
                <InputNumber min={0.1} max={10} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label="Viết Lại Hàng Loạt"
                name="batchRewriteWeight"
              >
                <InputNumber min={0.1} max={10} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <h4>Burst Settings:</h4>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="Enable Burst"
                name="burstEnabled"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Burst Limit"
                name="burstLimit"
              >
                <InputNumber min={10} max={200} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Burst Window (giây)"
                name="burstWindow"
              >
                <InputNumber min={60} max={7200} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginTop: '24px', textAlign: 'right' }}>
            <Button onClick={() => setEditModalVisible(false)} style={{ marginRight: '8px' }}>
              Hủy
            </Button>
            <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
              Lưu Cấu Hình
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminRateLimiting;