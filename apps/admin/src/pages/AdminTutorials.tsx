import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Space,
  Tooltip,
  message,
  Popconfirm,
  Row,
  Col,
  Statistic,
  Badge,
  Switch,
  InputNumber
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  YoutubeOutlined,
  SearchOutlined,
  SortAscendingOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

const { Option } = Select;
const { TextArea } = Input;
const { Search } = Input;

interface Tutorial {
  _id: string;
  title: string;
  description: string;
  youtubeUrl: string;
  youtubeVideoId: string;
  category: string;
  tags: string[];
  orderIndex: number;
  isActive: boolean;
  thumbnail: string;
  duration: string;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

interface TutorialStats {
  totalTutorials: number;
  activeTutorials: number;
  inactiveTutorials: number;
  totalViews: number;
  categoryStats: Array<{ _id: string; count: number }>;
  topViewedTutorials: Array<{ title: string; viewCount: number; youtubeVideoId: string }>;
}

const AdminTutorials: React.FC = () => {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [stats, setStats] = useState<TutorialStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTutorial, setEditingTutorial] = useState<Tutorial | null>(null);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

  const [form] = Form.useForm();

  const categoryOptions = [
    { value: 'all', label: 'Tất Cả' },
    { value: 'basic', label: 'Cơ Bản' },
    { value: 'advanced', label: 'Nâng Cao' },
    { value: 'features', label: 'Tính Năng' },
    { value: 'troubleshooting', label: 'Khắc Phục Sự Cố' }
  ];

  const fetchTutorials = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.current.toString(),
        limit: pagination.pageSize.toString(),
        category: selectedCategory,
        search: searchText
      });

      const response = await fetch(`https://aistory-backend.onrender.com/api/admin/tutorials?${params}`);
      const data = await response.json();

      if (data.success) {
        setTutorials(data.tutorials);
        setPagination(prev => ({
          ...prev,
          total: data.pagination.total
        }));
      } else {
        message.error('Không thể tải dữ liệu tutorials');
      }
    } catch (error) {
      console.error('Error fetching tutorials:', error);
      message.error('Lỗi kết nối server');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, selectedCategory, searchText]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('https://aistory-backend.onrender.com/api/admin/tutorials/stats/summary');
      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchTutorials();
    fetchStats();
  }, [fetchTutorials, fetchStats]);

  const handleCreateTutorial = async (values: any) => {
    try {
      const response = await fetch('https://aistory-backend.onrender.com/api/admin/tutorials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...values,
          tags: values.tags ? values.tags.split(',').map((tag: string) => tag.trim()) : []
        }),
      });

      const data = await response.json();

      if (data.success) {
        message.success('Tạo tutorial thành công');
        setModalVisible(false);
        form.resetFields();
        fetchTutorials();
        fetchStats();
      } else {
        message.error(data.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error creating tutorial:', error);
      message.error('Lỗi kết nối server');
    }
  };

  const handleUpdateTutorial = async (values: any) => {
    if (!editingTutorial) return;

    try {
      const response = await fetch(`https://aistory-backend.onrender.com/api/admin/tutorials/${editingTutorial._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...values,
          tags: values.tags ? values.tags.split(',').map((tag: string) => tag.trim()) : []
        }),
      });

      const data = await response.json();

      if (data.success) {
        message.success('Cập nhật tutorial thành công');
        setModalVisible(false);
        setEditingTutorial(null);
        form.resetFields();
        fetchTutorials();
        fetchStats();
      } else {
        message.error(data.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error updating tutorial:', error);
      message.error('Lỗi kết nối server');
    }
  };

  const handleDeleteTutorial = async (tutorialId: string) => {
    try {
      const response = await fetch(`https://aistory-backend.onrender.com/api/admin/tutorials/${tutorialId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        message.success('Xóa tutorial thành công');
        fetchTutorials();
        fetchStats();
      } else {
        message.error(data.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error deleting tutorial:', error);
      message.error('Lỗi kết nối server');
    }
  };

  const handleToggleStatus = async (tutorial: Tutorial) => {
    try {
      const response = await fetch(`https://aistory-backend.onrender.com/api/admin/tutorials/${tutorial._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !tutorial.isActive
        }),
      });

      const data = await response.json();

      if (data.success) {
        message.success(`${!tutorial.isActive ? 'Kích hoạt' : 'Vô hiệu hóa'} tutorial thành công`);
        fetchTutorials();
        fetchStats();
      } else {
        message.error(data.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      message.error('Lỗi kết nối server');
    }
  };

  const openEditModal = (tutorial: Tutorial) => {
    setEditingTutorial(tutorial);
    form.setFieldsValue({
      ...tutorial,
      tags: tutorial.tags.join(', ')
    });
    setModalVisible(true);
  };

  const openCreateModal = () => {
    setEditingTutorial(null);
    form.resetFields();
    setModalVisible(true);
  };

  const columns = [
    {
      title: 'Video',
      key: 'video',
      width: 120,
      render: (record: Tutorial) => (
        <div style={{ textAlign: 'center' }}>
          <img
            src={record.thumbnail}
            alt={record.title}
            style={{ 
              width: 80, 
              height: 45, 
              objectFit: 'cover', 
              borderRadius: 4,
              display: 'block',
              margin: '0 auto'
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/80x45?text=Video';
            }}
          />
          <div style={{ marginTop: 4 }}>
            <a
              href={record.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-500"
            >
              <YoutubeOutlined />
            </a>
          </div>
        </div>
      ),
    },
    {
      title: 'Thông Tin',
      key: 'info',
      width: 300,
      render: (record: Tutorial) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: '14px', marginBottom: '4px' }}>
            {record.title}
          </div>
          <div style={{ 
            fontSize: '12px', 
            color: '#6b7280', 
            marginTop: '4px',
            maxWidth: 280,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {record.description.length > 80 ? record.description.substring(0, 80) + '...' : record.description}
          </div>
          <div style={{ 
            marginTop: '8px',
            maxWidth: 280,
            overflow: 'hidden'
          }}>
            {record.tags.slice(0, 3).map((tag, index) => (
              <Tag 
                key={index} 
                style={{ 
                  fontSize: '11px', 
                  padding: '1px 6px',
                  marginBottom: '2px',
                  marginRight: '4px'
                }}
              >
                {tag}
              </Tag>
            ))}
            {record.tags.length > 3 && (
              <Tag style={{ fontSize: '11px', padding: '1px 6px' }}>
                +{record.tags.length - 3}
              </Tag>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Danh Mục',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (category: string) => {
        const categoryMap: Record<string, { label: string; color: string }> = {
          'basic': { label: 'Cơ Bản', color: 'blue' },
          'advanced': { label: 'Nâng Cao', color: 'orange' },
          'features': { label: 'Tính Năng', color: 'green' },
          'troubleshooting': { label: 'Khắc Phục', color: 'red' }
        };
        const config = categoryMap[category] || { label: category, color: 'default' };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: 'Thứ Tự',
      dataIndex: 'orderIndex',
      key: 'orderIndex',
      width: 80,
      sorter: (a: Tutorial, b: Tutorial) => a.orderIndex - b.orderIndex,
    },
    {
      title: 'Lượt Xem',
      dataIndex: 'viewCount',
      key: 'viewCount',
      width: 100,
      sorter: (a: Tutorial, b: Tutorial) => a.viewCount - b.viewCount,
      render: (count: number) => (
        <div style={{ textAlign: 'center' }}>
          <EyeOutlined style={{ marginRight: '4px' }} />
          {count.toLocaleString()}
        </div>
      ),
    },
    {
      title: 'Trạng Thái',
      key: 'status',
      width: 100,
      render: (record: Tutorial) => (
        <Switch
          checked={record.isActive}
          onChange={() => handleToggleStatus(record)}
          checkedChildren="Hiện"
          unCheckedChildren="Ẩn"
          size="small"
        />
      ),
    },
    {
      title: 'Ngày Tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => (
        <div style={{ fontSize: '12px' }}>
          {formatDistanceToNow(new Date(date), { addSuffix: true, locale: vi })}
        </div>
      ),
    },
    {
      title: 'Thao Tác',
      key: 'actions',
      width: 120,
      render: (record: Tutorial) => (
        <Space>
          <Tooltip title="Chỉnh sửa">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
              size="small"
            />
          </Tooltip>
          <Tooltip title="Xem video">
            <Button
              type="text"
              icon={<PlayCircleOutlined />}
              onClick={() => window.open(record.youtubeUrl, '_blank')}
              size="small"
            />
          </Tooltip>
          <Popconfirm
            title="Bạn có chắc chắn muốn xóa tutorial này?"
            onConfirm={() => handleDeleteTutorial(record._id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Tooltip title="Xóa">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                size="small"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ 
          fontSize: '24px', 
          fontWeight: 'bold', 
          color: '#1f2937', 
          marginBottom: '8px' 
        }}>
          Quản Lý Hướng Dẫn
        </h1>
        <p style={{ color: '#6b7280' }}>
          Quản lý video hướng dẫn sử dụng cho người dùng
        </p>
      </div>

      {/* Statistics */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="Tổng Tutorials"
                value={stats.totalTutorials}
                prefix={<YoutubeOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Đang Hoạt Động"
                value={stats.activeTutorials}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Tạm Dừng"
                value={stats.inactiveTutorials}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Tổng Lượt Xem"
                value={stats.totalViews}
                prefix={<EyeOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Filters */}
      <Card style={{ marginBottom: '16px' }}>
        <Row gutter={[16, 16]} align="middle" wrap>
          <Col xs={24} sm={24} md={12} lg={14} xl={16}>
            <Search
              placeholder="Tìm kiếm theo tiêu đề, mô tả, tags..."
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onSearch={fetchTutorials}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={12} sm={8} md={6} lg={5} xl={4}>
            <Select
              value={selectedCategory}
              onChange={(value) => setSelectedCategory(value)}
              style={{ width: '100%' }}
            >
              {categoryOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} sm={8} md={6} lg={5} xl={4}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreateModal}
              style={{ width: '100%' }}
            >
              Thêm Tutorial
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={tutorials}
          rowKey="_id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} tutorials`,
            onChange: (page, pageSize) => {
              setPagination(prev => ({
                ...prev,
                current: page,
                pageSize: pageSize || prev.pageSize
              }));
            }
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* Modal */}
      <Modal
        title={editingTutorial ? 'Chỉnh Sửa Tutorial' : 'Thêm Tutorial Mới'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingTutorial(null);
          form.resetFields();
        }}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={editingTutorial ? handleUpdateTutorial : handleCreateTutorial}
        >
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="title"
                label="Tiêu Đề"
                rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
              >
                <Input placeholder="Nhập tiêu đề tutorial" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="description"
                label="Mô Tả"
                rules={[{ required: true, message: 'Vui lòng nhập mô tả' }]}
              >
                <TextArea 
                  rows={3} 
                  placeholder="Mô tả chi tiết về nội dung tutorial"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="youtubeUrl"
                label="YouTube URL"
                rules={[
                  { required: true, message: 'Vui lòng nhập URL YouTube' },
                  { 
                    pattern: /^(https?\:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/,
                    message: 'URL YouTube không hợp lệ'
                  }
                ]}
              >
                <Input placeholder="https://www.youtube.com/watch?v=..." />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="category"
                label="Danh Mục"
                rules={[{ required: true, message: 'Vui lòng chọn danh mục' }]}
              >
                <Select placeholder="Chọn danh mục">
                  <Option value="basic">Cơ Bản</Option>
                  <Option value="advanced">Nâng Cao</Option>
                  <Option value="features">Tính Năng</Option>
                  <Option value="troubleshooting">Khắc Phục Sự Cố</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="tags"
                label="Tags"
                extra="Các tags cách nhau bằng dấu phẩy"
              >
                <Input placeholder="tag1, tag2, tag3..." />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="orderIndex"
                label="Thứ Tự"
                initialValue={0}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingTutorial ? 'Cập Nhật' : 'Tạo Mới'}
              </Button>
              <Button onClick={() => {
                setModalVisible(false);
                setEditingTutorial(null);
                form.resetFields();
              }}>
                Hủy
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminTutorials;
