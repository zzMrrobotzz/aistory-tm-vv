import React, { useState, useEffect } from 'react';
import { Card, Button, Table, message, Modal, Form, Input, InputNumber, Switch, Popconfirm, Space, Typography } from 'antd';
import { CreditPackage } from '../types';
import { PlusOutlined, EditOutlined, DeleteOutlined, DollarOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const AdminBilling: React.FC = () => {
    const [packages, setPackages] = useState<CreditPackage[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingPackage, setEditingPackage] = useState<CreditPackage | null>(null);
    const [form] = Form.useForm();

    const loadPackages = async () => {
        setLoading(true);
        try {
            const response = await fetch('https://key-manager-backend.onrender.com/api/packages');
            const data = await response.json();
            
            if (data.success) {
                setPackages(data.packages || []);
            } else {
                message.error('Không thể tải danh sách gói cước');
                setPackages([]);
            }
        } catch (error: any) {
            console.error('Error loading packages:', error);
            message.error('Không thể tải danh sách gói cước');
            setPackages([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPackages();
    }, []);

    const handleAddNew = () => {
        setEditingPackage(null);
        form.resetFields();
        setIsModalVisible(true);
    };

    const handleEdit = (pkg: CreditPackage) => {
        setEditingPackage(pkg);
        form.setFieldsValue(pkg);
        setIsModalVisible(true);
    };

    const handleDelete = async (packageId: string) => {
        try {
            const response = await fetch(`https://key-manager-backend.onrender.com/api/packages/${packageId}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            
            if (data.success) {
                message.success('Xóa gói cước thành công!');
                loadPackages();
            } else {
                message.error(data.error || 'Xóa gói cước thất bại');
            }
        } catch (error: any) {
            console.error('Error deleting package:', error);
            message.error('Xóa gói cước thất bại');
        }
    };

    const handleFormSubmit = async () => {
        try {
            const values = await form.validateFields();
            const isEdit = editingPackage?._id;
            const url = isEdit 
                ? `https://key-manager-backend.onrender.com/api/packages/${editingPackage._id}`
                : 'https://key-manager-backend.onrender.com/api/packages';
            
            const response = await fetch(url, {
                method: isEdit ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(values),
            });

            const data = await response.json();
            
            if (data.success) {
                message.success(isEdit ? 'Cập nhật gói cước thành công!' : 'Tạo gói cước mới thành công!');
                setIsModalVisible(false);
                loadPackages();
            } else {
                message.error(data.error || 'Thao tác thất bại');
            }
        } catch (error: any) {
            console.error('Error saving package:', error);
            message.error('Thao tác thất bại');
        }
    };

    const columns = [
        { title: 'Tên Gói', dataIndex: 'name', key: 'name' },
        { title: 'Giá (VNĐ)', dataIndex: 'price', key: 'price', render: (price: number) => price.toLocaleString('vi-VN') },
        { title: 'Số Credit', dataIndex: 'credits', key: 'credits' },
        { title: 'Khuyến Mãi', dataIndex: 'bonus', key: 'bonus' },
        { title: 'Phổ Biến', dataIndex: 'isPopular', key: 'isPopular', render: (isPopular: boolean) => <Switch checked={isPopular} disabled /> },
        { title: 'Trạng Thái', dataIndex: 'isActive', key: 'isActive', render: (isActive: boolean) => <Switch checked={isActive} disabled /> },
        {
            title: 'Hành Động',
            key: 'action',
            render: (_: any, record: CreditPackage) => (
                <Space>
                    <Button icon={<EditOutlined />} onClick={() => handleEdit(record)}>Sửa</Button>
                    <Popconfirm
                        title="Bạn có chắc muốn xóa gói này?"
                        onConfirm={() => handleDelete(record._id)}
                        okText="Xóa"
                        cancelText="Hủy"
                    >
                        <Button icon={<DeleteOutlined />} danger />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div style={{ padding: 24 }}>
            <Title level={2}>
                <DollarOutlined /> Gói Cước & Thanh Toán
            </Title>
            <Text type="secondary">
                Quản lý các gói nạp credit và theo dõi thanh toán
            </Text>
            
            <Card 
                title="Danh Sách Gói Credit"
                extra={
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAddNew}>
                        Thêm Gói Mới
                    </Button>
                }
                style={{ marginTop: 16 }}
            >
                <Table
                    columns={columns}
                    dataSource={packages}
                    loading={loading}
                    rowKey="_id"
                    pagination={false}
                    locale={{ emptyText: 'Chưa có gói credit nào' }}
                />
            </Card>
            <Modal
                title={editingPackage ? 'Sửa Gói Cước' : 'Tạo Gói Cước Mới'}
                open={isModalVisible}
                onOk={handleFormSubmit}
                onCancel={() => setIsModalVisible(false)}
                destroyOnClose
            >
                <Form form={form} layout="vertical" initialValues={{ isPopular: false, isActive: true }}>
                    <Form.Item name="name" label="Tên Gói" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="price" label="Giá (VNĐ)" rules={[{ required: true }]}>
                        <InputNumber 
                            min={0} 
                            style={{ width: '100%' }} 
                        />
                    </Form.Item>
                    <Form.Item name="credits" label="Số Credit" rules={[{ required: true }]}>
                        <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="bonus" label="Khuyến Mãi (ví dụ: +10% tặng thêm)">
                        <Input />
                    </Form.Item>
                    <Form.Item name="isPopular" label="Đánh dấu là Gói Phổ Biến" valuePropName="checked">
                        <Switch />
                    </Form.Item>
                    <Form.Item name="isActive" label="Hiển thị Gói này cho người dùng" valuePropName="checked">
                        <Switch />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default AdminBilling;