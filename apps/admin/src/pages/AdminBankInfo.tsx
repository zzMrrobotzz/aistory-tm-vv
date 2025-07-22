import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Spin, Typography, Space, Divider } from 'antd';
import { SaveOutlined, BankOutlined, ReloadOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface BankInfo {
  _id?: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  branchName: string;
  note: string;
  updatedAt?: string;
}

const AdminBankInfo: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);

  const fetchBankInfo = async () => {
    try {
      setFetching(true);
      const response = await fetch('https://key-manager-backend.onrender.com/api/bank-info');
      const data = await response.json();
      
      if (data.success && data.bankInfo) {
        setBankInfo(data.bankInfo);
        form.setFieldsValue({
          bankName: data.bankInfo.bankName,
          accountNumber: data.bankInfo.accountNumber,
          accountName: data.bankInfo.accountName,
          branchName: data.bankInfo.branchName,
          note: data.bankInfo.note || ''
        });
      }
    } catch (error) {
      console.error('Error fetching bank info:', error);
      message.error('Không thể tải thông tin ngân hàng');
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (values: BankInfo) => {
    try {
      setLoading(true);
      const response = await fetch('https://key-manager-backend.onrender.com/api/bank-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const data = await response.json();
      
      if (data.success) {
        message.success('Cập nhật thông tin ngân hàng thành công!');
        setBankInfo(data.bankInfo);
      } else {
        message.error(data.error || 'Cập nhật thất bại');
      }
    } catch (error) {
      console.error('Error updating bank info:', error);
      message.error('Lỗi kết nối server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBankInfo();
  }, []);

  if (fetching) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>
        <BankOutlined /> Quản Lý Thông Tin Ngân Hàng
      </Title>
      <Text type="secondary">
        Quản lý thông tin chuyển khoản hiển thị cho người dùng khi nạp credit
      </Text>
      
      <Divider />

      <div style={{ maxWidth: 800 }}>
        <Card 
          title="Thông Tin Chuyển Khoản" 
          extra={
            <Button 
              icon={<ReloadOutlined />} 
              onClick={fetchBankInfo}
              loading={fetching}
            >
              Làm mới
            </Button>
          }
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              bankName: 'Vietcombank',
              accountNumber: '',
              accountName: '',
              branchName: 'CN Ho Chi Minh',
              note: ''
            }}
          >
            <Form.Item
              label="Tên Ngân Hàng"
              name="bankName"
              rules={[{ required: true, message: 'Vui lòng nhập tên ngân hàng' }]}
            >
              <Input placeholder="VD: Vietcombank, Techcombank, BIDV..." />
            </Form.Item>

            <Form.Item
              label="Số Tài Khoản"
              name="accountNumber"
              rules={[
                { required: true, message: 'Vui lòng nhập số tài khoản' },
                { pattern: /^\d+$/, message: 'Số tài khoản chỉ được chứa số' }
              ]}
            >
              <Input placeholder="VD: 1234567890" />
            </Form.Item>

            <Form.Item
              label="Tên Chủ Tài Khoản"
              name="accountName"
              rules={[{ required: true, message: 'Vui lòng nhập tên chủ tài khoản' }]}
            >
              <Input placeholder="VD: NGUYEN VAN A" style={{ textTransform: 'uppercase' }} />
            </Form.Item>

            <Form.Item
              label="Chi Nhánh"
              name="branchName"
            >
              <Input placeholder="VD: CN Ho Chi Minh" />
            </Form.Item>

            <Form.Item
              label="Ghi Chú"
              name="note"
            >
              <Input.TextArea 
                rows={3} 
                placeholder="Ghi chú thêm về tài khoản..." 
              />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={loading}
                  icon={<SaveOutlined />}
                  size="large"
                >
                  Lưu Thông Tin
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>

        {bankInfo && (
          <Card 
            title="Thông Tin Hiện Tại" 
            style={{ marginTop: 24 }}
            type="inner"
          >
            <div style={{ backgroundColor: '#f5f5f5', padding: 16, borderRadius: 8 }}>
              <div><strong>Ngân hàng:</strong> {bankInfo.bankName}</div>
              <div><strong>Số tài khoản:</strong> {bankInfo.accountNumber}</div>
              <div><strong>Tên người nhận:</strong> {bankInfo.accountName}</div>
              <div><strong>Chi nhánh:</strong> {bankInfo.branchName}</div>
              {bankInfo.note && <div><strong>Ghi chú:</strong> {bankInfo.note}</div>}
              {bankInfo.updatedAt && (
                <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                  <strong>Cập nhật lần cuối:</strong> {new Date(bankInfo.updatedAt).toLocaleString('vi-VN')}
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminBankInfo;