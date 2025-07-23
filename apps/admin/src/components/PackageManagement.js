import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Modal, 
  Form, 
  Input, 
  InputNumber, 
  Select, 
  Switch, 
  message, 
  Popconfirm, 
  Space, 
  Tag, 
  Typography,
  Card,
  Row,
  Col,
  Statistic
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  PoweroffOutlined,
  DollarOutlined,
  CalendarOutlined,
  CrownOutlined
} from '@ant-design/icons';

const { Title } = Typography;
const { Option } = Select;

const PackageManagement = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://aistory-backend.onrender.com/api/admin/packages');
      const data = await response.json();
      
      if (data.success) {
        setPackages(data.packages);
      } else {
        message.error('Failed to fetch packages');
      }
    } catch (error) {
      console.error('Error fetching packages:', error);
      message.error('Error fetching packages');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingPackage(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingPackage(record);
    form.setFieldsValue({
      planId: record.planId,
      name: record.name,
      description: record.description,
      price: record.price,
      durationType: record.durationType,
      durationValue: record.durationValue,
      isPopular: record.isPopular,
      isActive: record.isActive
    });
    setIsModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      const url = editingPackage 
        ? `https://aistory-backend.onrender.com/api/admin/packages/${editingPackage._id}`
        : 'https://aistory-backend.onrender.com/api/admin/packages';
      
      const method = editingPackage ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (data.success) {
        message.success(editingPackage ? 'Package updated successfully' : 'Package created successfully');
        setIsModalVisible(false);
        fetchPackages();
      } else {
        message.error(data.error || 'Operation failed');
      }
    } catch (error) {
      console.error('Error saving package:', error);
      message.error('Error saving package');
    }
  };

  const handleToggleStatus = async (record) => {
    try {
      const response = await fetch(`https://aistory-backend.onrender.com/api/admin/packages/${record._id}/toggle`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        message.success(`Package ${data.isActive ? 'activated' : 'deactivated'} successfully`);
        fetchPackages();
      } else {
        message.error(data.error || 'Toggle failed');
      }
    } catch (error) {
      console.error('Error toggling package:', error);
      message.error('Error toggling package status');
    }
  };

  const handleDelete = async (record, hardDelete = false) => {
    try {
      const url = `https://aistory-backend.onrender.com/api/admin/packages/${record._id}${hardDelete ? '?hardDelete=true' : ''}`;
      
      const response = await fetch(url, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        message.success(data.message);
        fetchPackages();
      } else {
        message.error(data.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Error deleting package:', error);
      message.error('Error deleting package');
    }
  };

  const formatDuration = (durationType: string, durationValue: number) => {
    if (durationType === 'days') {
      return `${durationValue} ngày`;
    }
    
    if (durationValue >= 999) {
      return 'Vĩnh viễn';
    }
    
    return `${durationValue} tháng`;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  };

  const getStats = () => {
    const total = packages.length;
    const active = packages.filter(p => p.isActive).length;
    const dailyPackages = packages.filter(p => p.durationType === 'days').length;
    const totalRevenue = packages.reduce((sum, p) => sum + (p.isActive ? p.price : 0), 0);

    return { total, active, dailyPackages, totalRevenue };
  };

  const stats = getStats();

  const columns = [
    {
      title: 'Plan ID',
      dataIndex: 'planId',
      key: 'planId',
      width: 120,
      render: (text) => <code style={{ fontSize: '12px' }}>{text}</code>
    },
    {
      title: 'Tên gói',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Giá',
      dataIndex: 'price',
      key: 'price',
      width: 120,
      render: (price) => formatPrice(price),
      sorter: (a, b) => a.price - b.price,
    },
    {
      title: 'Thời hạn',
      key: 'duration',
      width: 100,
      render: (record) => formatDuration(record.durationType, record.durationValue),
      sorter: (a, b) => {
        const aValue = a.durationType === 'days' ? a.durationValue : a.durationValue * 30;
        const bValue = b.durationType === 'days' ? b.durationValue : b.durationValue * 30;
        return aValue - bValue;
      },
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 120,
      filters: [
        { text: 'Active', value: true },
        { text: 'Inactive', value: false },
      ],
      onFilter: (value, record) => record.isActive === value,
      render: (record) => (
        <Space>
          <Tag color={record.isActive ? 'green' : 'red'}>
            {record.isActive ? 'Active' : 'Inactive'}
          </Tag>
          {record.isPopular && <Tag color="gold" icon={<CrownOutlined />}>Popular</Tag>}
        </Space>
      ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date) => new Date(date).toLocaleDateString('vi-VN'),
      sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 200,
      render: (record) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Sửa
          </Button>
          <Button
            type={record.isActive ? 'default' : 'primary'}
            size="small"
            icon={<PoweroffOutlined />}
            onClick={() => handleToggleStatus(record)}
          >
            {record.isActive ? 'Tắt' : 'Bật'}
          </Button>
          <Popconfirm
            title="Bạn có chắc muốn xóa gói này?"
            description="Thao tác này sẽ vô hiệu hóa gói (soft delete)"
            onConfirm={() => handleDelete(record, false)}
            okText="Có"
            cancelText="Không"
          >
            <Button
              danger
              size="small"
              icon={<DeleteOutlined />}
            >
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Quản lý gói subscription</Title>
      
      {/* Statistics Cards */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Tổng số gói"
              value={stats.total}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Gói đang hoạt động"
              value={stats.active}
              prefix={<PoweroffOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Gói dùng thử (ngày)"
              value={stats.dailyPackages}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Tổng giá trị gói"
              value={stats.totalRevenue}
              prefix={<DollarOutlined />}
              formatter={(value) => formatPrice(Number(value))}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Action Bar */}
      <div style={{ marginBottom: '16px' }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreate}
        >
          Tạo gói mới
        </Button>
      </div>

      {/* Packages Table */}
      <Table
        columns={columns}
        dataSource={packages}
        rowKey="_id"
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} gói`,
        }}
        scroll={{ x: 1200 }}
      />

      {/* Create/Edit Modal */}
      <Modal
        title={editingPackage ? 'Chỉnh sửa gói' : 'Tạo gói mới'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            durationType: 'days',
            durationValue: 1,
            isPopular: false,
            isActive: true
          }}
        >
          <Form.Item
            name="planId"
            label="Plan ID"
            rules={[
              { required: true, message: 'Vui lòng nhập Plan ID' },
              { pattern: /^[a-z0-9_]+$/, message: 'Plan ID chỉ được chứa chữ thường, số và dấu gạch dưới' }
            ]}
          >
            <Input 
              placeholder="Ví dụ: trial_5days, monthly_premium" 
              disabled={!!editingPackage}
            />
          </Form.Item>

          <Form.Item
            name="name"
            label="Tên gói"
            rules={[{ required: true, message: 'Vui lòng nhập tên gói' }]}
          >
            <Input placeholder="Ví dụ: Gói Dùng Thử 5 Ngày" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Mô tả"
          >
            <Input.TextArea 
              rows={3} 
              placeholder="Mô tả chi tiết về gói subscription"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="price"
                label="Giá (VNĐ)"
                rules={[
                  { required: true, message: 'Vui lòng nhập giá' },
                  { type: 'number', min: 0, message: 'Giá phải là số dương' }
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="49000"
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value!.replace(/\$\s?|(,*)/g, '')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="durationType"
                label="Loại thời hạn"
                rules={[{ required: true, message: 'Vui lòng chọn loại thời hạn' }]}
              >
                <Select placeholder="Chọn loại thời hạn">
                  <Option value="days">Ngày</Option>
                  <Option value="months">Tháng</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="durationValue"
            label="Thời hạn"
            rules={[
              { required: true, message: 'Vui lòng nhập thời hạn' },
              { type: 'number', min: 1, message: 'Thời hạn phải lớn hơn 0' }
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="5"
              addonAfter={
                <Form.Item name="durationType" noStyle>
                  {({ getFieldValue }) => getFieldValue('durationType') === 'days' ? 'ngày' : 'tháng'}
                </Form.Item>
              }
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="isPopular"
                label="Gói phổ biến"
                valuePropName="checked"
              >
                <Switch checkedChildren="Có" unCheckedChildren="Không" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="isActive"
                label="Kích hoạt"
                valuePropName="checked"
              >
                <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalVisible(false)}>
                Hủy
              </Button>
              <Button type="primary" htmlType="submit">
                {editingPackage ? 'Cập nhật' : 'Tạo mới'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PackageManagement;