import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, message, Spin, Switch, Modal, Input } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { fetchApiProviders, createApiProvider } from '../services/keyService';
import { ManagedApiProvider } from '../types';

const AdminApiProviders: React.FC = () => {
    const [providers, setProviders] = useState<ManagedApiProvider[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [newProviderName, setNewProviderName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadProviders = async () => {
        try {
            setLoading(true);
            const data = await fetchApiProviders();
            setProviders(data || []);
        } catch (error: any) {
            message.error(error.message || 'Không thể tải danh sách API providers');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProviders();
    }, []);

    const handleStatusChange = async (providerId: string, newStatus: boolean) => {
        message.info('Chức năng cập nhật trạng thái đang được phát triển.');
    };

    const showCreateModal = () => {
        setIsModalVisible(true);
    };

    const handleCreateProvider = async () => {
        if (!newProviderName.trim()) {
            message.warning('Tên provider không được để trống.');
            return;
        }
        setIsSubmitting(true);
        try {
            await createApiProvider(newProviderName);
            message.success(`Provider '${newProviderName}' đã được tạo thành công!`);
            setIsModalVisible(false);
            setNewProviderName('');
            loadProviders(); // Tải lại danh sách
        } catch (error: any) {
            message.error(error.message || 'Tạo provider thất bại.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        setIsModalVisible(false);
        setNewProviderName('');
    };

    const columns = [
        { title: 'Nhà Cung Cấp', dataIndex: 'name', key: 'name' },
        { 
            title: 'Trạng Thái', 
            dataIndex: 'status', 
            key: 'status',
            render: (status: string) => {
                let color = 'grey';
                if (status === 'Operational') color = 'green';
                if (status === 'Degraded') color = 'orange';
                if (status === 'Error') color = 'red';
                return <Tag color={color}>{status}</Tag>;
            }
        },
        { title: 'Tổng Requests', dataIndex: 'totalRequests', key: 'totalRequests', render: (val: number) => (val || 0).toLocaleString() },
        { title: 'Chi phí Hôm Nay', dataIndex: 'costToday', key: 'costToday', render: (val: number) => `${(val || 0).toFixed(2)}` },
        {
            title: 'Hành động',
            key: 'action',
            render: (_: any, record: ManagedApiProvider) => (
                <Switch
                    checkedChildren="Hoạt động"
                    unCheckedChildren="Tắt"
                    checked={record.status === 'Operational'}
                    onChange={(checked) => handleStatusChange(record._id, checked)}
                    disabled // Tạm thời vô hiệu hóa cho đến khi có API
                />
            ),
        },
    ];

    if (loading && providers.length === 0) {
        return (
            <div className="flex justify-center items-center h-64">
                <Spin size="large" tip="Đang tải danh sách nhà cung cấp..." />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800">Quản Lý API Providers</h1>
                <div>
                    <Button onClick={loadProviders} loading={loading} style={{ marginRight: 8 }}>
                        Làm Mới
                    </Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={showCreateModal}>
                        Tạo Provider Mới
                    </Button>
                </div>
            </div>
            <Table
                columns={columns}
                dataSource={providers}
                rowKey="_id"
                pagination={false}
                loading={loading}
            />
            <Modal
                title="Tạo API Provider Mới"
                visible={isModalVisible}
                onOk={handleCreateProvider}
                onCancel={handleCancel}
                confirmLoading={isSubmitting}
                okText="Tạo"
                cancelText="Hủy"
            >
                <Input
                    placeholder="Nhập tên nhà cung cấp (ví dụ: Gemini, OpenAI)"
                    value={newProviderName}
                    onChange={(e) => setNewProviderName(e.target.value)}
                />
            </Modal>
        </div>
    );
};


export default AdminApiProviders;