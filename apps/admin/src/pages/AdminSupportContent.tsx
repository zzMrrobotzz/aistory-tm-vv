import React, { useState, useEffect } from 'react';
import { Card, Tabs, Form, Input, Button, Switch, Select, Table, Modal, message, Tag, Space, Popconfirm, InputNumber, DatePicker } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SaveOutlined, EyeOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const { TabPane } = Tabs;
const { TextArea } = Input;
const { Option } = Select;

interface FAQ {
  _id?: string;
  question: string;
  answer: string;
  category: 'general' | 'technical' | 'billing' | 'features' | 'troubleshooting';
  priority: number;
  isActive: boolean;
}

interface QuickLink {
  _id?: string;
  title: string;
  url: string;
  description?: string;
  icon: string;
  isActive: boolean;
}

interface ContactInfo {
  primaryContact: string;
  contactValue: string;
  contactName: string;
  secondaryContacts: Array<{
    type: string;
    label: string;
    value: string;
    isActive: boolean;
  }>;
}

interface SupportContent {
  _id?: string;
  supportTitle: string;
  supportDescription: string;
  contactInfo: ContactInfo;
  faqSection: {
    isEnabled: boolean;
    title: string;
    faqs: FAQ[];
  };
  contactGuidelines: {
    isEnabled: boolean;
    title: string;
    guidelines: Array<{
      text: string;
      isActive: boolean;
    }>;
  };
  quickLinks: {
    isEnabled: boolean;
    title: string;
    links: QuickLink[];
  };
  announcement: {
    isEnabled: boolean;
    type: 'info' | 'warning' | 'success' | 'error';
    title?: string;
    message?: string;
    expiresAt?: Date;
  };
  styling: {
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
  };
  isActive: boolean;
  lastUpdatedBy: string;
  version: number;
}

const AdminSupportContent: React.FC = () => {
  const [supportContent, setSupportContent] = useState<SupportContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [faqForm] = Form.useForm();
  const [linkForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState('general');
  
  // Modal states
  const [faqModalVisible, setFaqModalVisible] = useState(false);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [editingLink, setEditingLink] = useState<QuickLink | null>(null);

  const API_BASE = 'https://aistory-backend.onrender.com/api';

  useEffect(() => {
    fetchSupportContent();
  }, []);

  const fetchSupportContent = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/admin/support-content`);
      if (response.data.success) {
        const data = response.data.data;
        setSupportContent(data);
        form.setFieldsValue(data);
      }
    } catch (error) {
      console.error('Error fetching support content:', error);
      message.error('Không thể tải nội dung hỗ trợ');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const response = await axios.put(`${API_BASE}/admin/support-content`, values);
      if (response.data.success) {
        message.success('Lưu thành công!');
        setSupportContent(response.data.data);
      }
    } catch (error) {
      console.error('Error saving:', error);
      message.error('Lỗi khi lưu thay đổi');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFaq = () => {
    setEditingFaq(null);
    faqForm.resetFields();
    setFaqModalVisible(true);
  };

  const handleEditFaq = (faq: FAQ) => {
    setEditingFaq(faq);
    faqForm.setFieldsValue(faq);
    setFaqModalVisible(true);
  };

  const handleFaqSubmit = async () => {
    try {
      const values = await faqForm.validateFields();
      setLoading(true);

      if (editingFaq) {
        // Update existing FAQ
        const response = await axios.put(`${API_BASE}/admin/support-content/faq/${editingFaq._id}`, values);
        if (response.data.success) {
          message.success('Cập nhật FAQ thành công!');
          fetchSupportContent();
        }
      } else {
        // Add new FAQ
        const response = await axios.post(`${API_BASE}/admin/support-content/faq`, values);
        if (response.data.success) {
          message.success('Thêm FAQ thành công!');
          fetchSupportContent();
        }
      }
      
      setFaqModalVisible(false);
    } catch (error) {
      console.error('Error with FAQ:', error);
      message.error('Lỗi khi xử lý FAQ');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFaq = async (faqId: string) => {
    try {
      setLoading(true);
      const response = await axios.delete(`${API_BASE}/admin/support-content/faq/${faqId}`);
      if (response.data.success) {
        message.success('Xóa FAQ thành công!');
        fetchSupportContent();
      }
    } catch (error) {
      console.error('Error deleting FAQ:', error);
      message.error('Lỗi khi xóa FAQ');
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuickLink = () => {
    setEditingLink(null);
    linkForm.resetFields();
    setLinkModalVisible(true);
  };

  const handleQuickLinkSubmit = async () => {
    try {
      const values = await linkForm.validateFields();
      setLoading(true);

      const response = await axios.post(`${API_BASE}/admin/support-content/quick-link`, values);
      if (response.data.success) {
        message.success('Thêm liên kết thành công!');
        fetchSupportContent();
        setLinkModalVisible(false);
      }
    } catch (error) {
      console.error('Error adding quick link:', error);
      message.error('Lỗi khi thêm liên kết');
    } finally {
      setLoading(false);
    }
  };

  const faqColumns = [
    {
      title: 'Câu hỏi',
      dataIndex: 'question',
      key: 'question',
      width: '30%',
      ellipsis: true,
    },
    {
      title: 'Câu trả lời',
      dataIndex: 'answer',
      key: 'answer',
      width: '35%',
      ellipsis: true,
    },
    {
      title: 'Danh mục',
      dataIndex: 'category',
      key: 'category',
      width: '10%',
      render: (category: string) => {
        const colors = {
          general: 'blue',
          technical: 'orange',
          billing: 'green',
          features: 'purple',
          troubleshooting: 'red',
        };
        return <Tag color={colors[category as keyof typeof colors]}>{category}</Tag>;
      },
    },
    {
      title: 'Ưu tiên',
      dataIndex: 'priority',
      key: 'priority',
      width: '8%',
      sorter: (a: FAQ, b: FAQ) => b.priority - a.priority,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      width: '8%',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Hiện' : 'Ẩn'}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: '9%',
      render: (_: any, record: FAQ) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEditFaq(record)} />
          <Popconfirm
            title="Bạn có chắc muốn xóa FAQ này?"
            onConfirm={() => handleDeleteFaq(record._id!)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const quickLinkColumns = [
    {
      title: 'Biểu tượng',
      dataIndex: 'icon',
      key: 'icon',
      width: '8%',
      render: (icon: string) => <span style={{ fontSize: '18px' }}>{icon}</span>,
    },
    {
      title: 'Tiêu đề',
      dataIndex: 'title',
      key: 'title',
      width: '20%',
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      width: '25%',
      ellipsis: true,
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      width: '30%',
      ellipsis: true,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      width: '8%',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Hiện' : 'Ẩn'}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: '9%',
      render: (_: any, record: QuickLink) => (
        <Space size="small">
          <Button size="small" icon={<EyeOutlined />} onClick={() => window.open(record.url, '_blank')} />
        </Space>
      ),
    },
  ];

  if (!supportContent) {
    return <div>Đang tải...</div>;
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card 
        title="🛠️ Quản Lý Nội Dung Hỗ Trợ" 
        extra={
          <Button 
            type="primary" 
            icon={<SaveOutlined />} 
            onClick={handleSave}
            loading={loading}
          >
            Lưu Thay Đổi
          </Button>
        }
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={supportContent}
        >
          <Tabs activeKey={activeTab} onChange={setActiveTab}>
            <TabPane tab="📝 Thông Tin Chung" key="general">
              <Form.Item
                label="Tiêu đề trang hỗ trợ"
                name="supportTitle"
                rules={[{ required: true, message: 'Vui lòng nhập tiêu đề!' }]}
              >
                <Input placeholder="📞 Trung Tâm Hỗ Trợ & Liên Hệ" />
              </Form.Item>
              
              <Form.Item
                label="Mô tả"
                name="supportDescription"
                rules={[{ required: true, message: 'Vui lòng nhập mô tả!' }]}
              >
                <TextArea rows={3} placeholder="Mô tả về dịch vụ hỗ trợ..." />
              </Form.Item>
            </TabPane>

            <TabPane tab="📞 Thông Tin Liên Hệ" key="contact">
              <Form.Item label="Phương thức liên hệ chính" name={['contactInfo', 'primaryContact']}>
                <Input placeholder="Zalo" />
              </Form.Item>
              
              <Form.Item label="Giá trị liên hệ" name={['contactInfo', 'contactValue']}>
                <Input placeholder="0339933882" />
              </Form.Item>
              
              <Form.Item label="Tên liên hệ" name={['contactInfo', 'contactName']}>
                <Input placeholder="Đức Đại MMO" />
              </Form.Item>

              <Form.Item label="Hướng dẫn liên hệ">
                <Form.Item name={['contactGuidelines', 'isEnabled']} valuePropName="checked">
                  <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
                </Form.Item>
                <Form.Item name={['contactGuidelines', 'title']}>
                  <Input placeholder="Lưu ý khi liên hệ:" />
                </Form.Item>
              </Form.Item>
            </TabPane>

            <TabPane tab="❓ FAQ" key="faq">
              <div style={{ marginBottom: 16 }}>
                <Space>
                  <Form.Item name={['faqSection', 'isEnabled']} valuePropName="checked" style={{ margin: 0 }}>
                    <Switch checkedChildren="Bật FAQ" unCheckedChildren="Tắt FAQ" />
                  </Form.Item>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAddFaq}>
                    Thêm FAQ
                  </Button>
                </Space>
              </div>

              <Form.Item label="Tiêu đề phần FAQ" name={['faqSection', 'title']}>
                <Input placeholder="❓ Câu Hỏi Thường Gặp" />
              </Form.Item>

              <Table
                columns={faqColumns}
                dataSource={supportContent.faqSection.faqs}
                rowKey="_id"
                pagination={{ pageSize: 10 }}
                loading={loading}
              />
            </TabPane>

            <TabPane tab="🔗 Liên Kết Nhanh" key="quickLinks">
              <div style={{ marginBottom: 16 }}>
                <Space>
                  <Form.Item name={['quickLinks', 'isEnabled']} valuePropName="checked" style={{ margin: 0 }}>
                    <Switch checkedChildren="Bật Links" unCheckedChildren="Tắt Links" />
                  </Form.Item>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAddQuickLink}>
                    Thêm Liên Kết
                  </Button>
                </Space>
              </div>

              <Form.Item label="Tiêu đề phần liên kết" name={['quickLinks', 'title']}>
                <Input placeholder="🔗 Liên Kết Hữu Ích" />
              </Form.Item>

              <Table
                columns={quickLinkColumns}
                dataSource={supportContent.quickLinks.links}
                rowKey="_id"
                pagination={{ pageSize: 10 }}
                loading={loading}
              />
            </TabPane>

            <TabPane tab="📢 Thông Báo" key="announcement">
              <Form.Item name={['announcement', 'isEnabled']} valuePropName="checked">
                <Switch checkedChildren="Bật thông báo" unCheckedChildren="Tắt thông báo" />
              </Form.Item>

              <Form.Item label="Loại thông báo" name={['announcement', 'type']}>
                <Select>
                  <Option value="info">Thông tin</Option>
                  <Option value="warning">Cảnh báo</Option>
                  <Option value="success">Thành công</Option>
                  <Option value="error">Lỗi</Option>
                </Select>
              </Form.Item>

              <Form.Item label="Tiêu đề thông báo" name={['announcement', 'title']}>
                <Input placeholder="Tiêu đề thông báo..." />
              </Form.Item>

              <Form.Item label="Nội dung thông báo" name={['announcement', 'message']}>
                <TextArea rows={3} placeholder="Nội dung thông báo..." />
              </Form.Item>

              <Form.Item label="Hết hạn vào" name={['announcement', 'expiresAt']}>
                <DatePicker showTime />
              </Form.Item>
            </TabPane>

            <TabPane tab="🎨 Giao Diện" key="styling">
              <Form.Item label="Màu chính" name={['styling', 'primaryColor']}>
                <Input type="color" style={{ width: 100 }} />
              </Form.Item>

              <Form.Item label="Màu phụ" name={['styling', 'accentColor']}>
                <Input type="color" style={{ width: 100 }} />
              </Form.Item>

              <Form.Item label="Màu nền" name={['styling', 'backgroundColor']}>
                <Input type="color" style={{ width: 100 }} />
              </Form.Item>
            </TabPane>
          </Tabs>
        </Form>

        {/* FAQ Modal */}
        <Modal
          title={editingFaq ? "Chỉnh sửa FAQ" : "Thêm FAQ mới"}
          open={faqModalVisible}
          onOk={handleFaqSubmit}
          onCancel={() => setFaqModalVisible(false)}
          confirmLoading={loading}
          width={800}
        >
          <Form form={faqForm} layout="vertical">
            <Form.Item
              label="Câu hỏi"
              name="question"
              rules={[{ required: true, message: 'Vui lòng nhập câu hỏi!' }]}
            >
              <Input placeholder="Nhập câu hỏi..." />
            </Form.Item>

            <Form.Item
              label="Câu trả lời"
              name="answer"
              rules={[{ required: true, message: 'Vui lòng nhập câu trả lời!' }]}
            >
              <TextArea rows={4} placeholder="Nhập câu trả lời..." />
            </Form.Item>

            <Form.Item label="Danh mục" name="category" initialValue="general">
              <Select>
                <Option value="general">Chung</Option>
                <Option value="technical">Kỹ thuật</Option>
                <Option value="billing">Thanh toán</Option>
                <Option value="features">Tính năng</Option>
                <Option value="troubleshooting">Khắc phục sự cố</Option>
              </Select>
            </Form.Item>

            <Form.Item label="Độ ưu tiên" name="priority" initialValue={0}>
              <InputNumber min={0} max={100} />
            </Form.Item>

            <Form.Item name="isActive" valuePropName="checked" initialValue={true}>
              <Switch checkedChildren="Hiện" unCheckedChildren="Ẩn" />
            </Form.Item>
          </Form>
        </Modal>

        {/* Quick Link Modal */}
        <Modal
          title="Thêm liên kết nhanh"
          open={linkModalVisible}
          onOk={handleQuickLinkSubmit}
          onCancel={() => setLinkModalVisible(false)}
          confirmLoading={loading}
        >
          <Form form={linkForm} layout="vertical">
            <Form.Item
              label="Tiêu đề"
              name="title"
              rules={[{ required: true, message: 'Vui lòng nhập tiêu đề!' }]}
            >
              <Input placeholder="Nhập tiêu đề..." />
            </Form.Item>

            <Form.Item
              label="URL"
              name="url"
              rules={[{ required: true, message: 'Vui lòng nhập URL!' }]}
            >
              <Input placeholder="https://..." />
            </Form.Item>

            <Form.Item label="Mô tả" name="description">
              <TextArea rows={2} placeholder="Mô tả liên kết..." />
            </Form.Item>

            <Form.Item label="Biểu tượng" name="icon" initialValue="🔗">
              <Input placeholder="🔗" />
            </Form.Item>

            <Form.Item name="isActive" valuePropName="checked" initialValue={true}>
              <Switch checkedChildren="Hiện" unCheckedChildren="Ẩn" />
            </Form.Item>
          </Form>
        </Modal>
      </Card>
    </div>
  );
};

export default AdminSupportContent;