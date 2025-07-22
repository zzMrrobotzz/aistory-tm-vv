import React, { useState, useEffect, useMemo } from 'react';
import { fetchKeys, createKey, updateCredit, updateKeyStatus, updateKeyDetails } from '../services/keyService'; // Thêm service mới
import { AdminKey } from '../types';
import { Button, Modal, Input, message, Table, Tag, Space, Select, DatePicker, Form, InputNumber, Switch, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { saveAs } from 'file-saver';
import dayjs from 'dayjs';
import { EditOutlined, PlusCircleOutlined, ExportOutlined, ReloadOutlined } from '@ant-design/icons';

const AdminKeyManagement: React.FC = () => {
    const [keys, setKeys] = useState<AdminKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingKey, setEditingKey] = useState<AdminKey | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [form] = Form.useForm();

    const loadKeys = async () => {
        setLoading(true);
        try {
            const data = await fetchKeys();
            setKeys(data || []);
        } catch (error: any) {
            message.error(error.message || 'Không thể tải danh sách key!');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadKeys();
    }, []);

    const filteredKeys = useMemo(() => {
        return keys.filter(key => {
            const matchSearch = key.key.toLowerCase().includes(searchTerm.toLowerCase()) || (key.note && key.note.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? key.isActive : !key.isActive);
            return matchSearch && matchStatus;
        });
    }, [keys, searchTerm, statusFilter]);

    const handleCreate = () => {
        setEditingKey(null);
        form.resetFields();
        form.setFieldsValue({ credit: 0, maxActivations: 1 });
        setIsModalVisible(true);
    };

    const handleEdit = (record: AdminKey) => {
        setEditingKey(record);
        form.setFieldsValue({
            ...record,
            expiredAt: record.expiredAt ? dayjs(record.expiredAt) : null,
        });
        setIsModalVisible(true);
    };
    
    const handleCreditUpdate = async (record: AdminKey) => {
        let amount = prompt(`Nhập số credit muốn CỘNG/TRỪ cho key:\n${record.key}\n(Nhập số âm để trừ)`, "0");
        if (amount === null) return;
        const creditAmount = parseInt(amount, 10);
        if (isNaN(creditAmount)) {
            message.warning('Vui lòng nhập một số hợp lệ.');
            return;
        }
        try {
            await updateCredit(record.key, creditAmount);
            message.success(`Đã cập nhật credit cho key!`);
            loadKeys();
        } catch (error: any) {
            message.error(error.message || 'Cập nhật credit thất bại!');
        }
    };

    const handleStatusChange = async (keyId: string, checked: boolean) => {
        try {
            await updateKeyStatus(keyId, checked);
            message.success('Cập nhật tr��ng thái thành công!');
            // Cập nhật lại state để giao diện phản hồi ngay lập tức
            setKeys(prevKeys => prevKeys.map(k => k._id === keyId ? { ...k, isActive: checked } : k));
        } catch (error: any) {
            message.error(error.message || 'Cập nhật trạng thái thất bại!');
        }
    };

    const handleFormSubmit = async () => {
        try {
            const values = await form.validateFields();

            if (editingKey) {
                const payload = {
                    note: values.note || '',
                    expiredAt: values.expiredAt ? values.expiredAt.toISOString() : null,
                    credit: Number(values.credit),
                    maxActivations: Number(values.maxActivations)
                };
                await updateKeyDetails(editingKey._id, payload);
                message.success('Cập nhật key thành công!');
            } else {
                const payload = {
                    key: values.key,
                    note: values.note || '',
                    expiredAt: values.expiredAt ? values.expiredAt.toISOString() : null,
                    credit: Number(values.credit),
                    maxActivations: Number(values.maxActivations)
                };
                await createKey(payload);
                message.success('Tạo key thành công!');
            }
            setIsModalVisible(false);
            loadKeys();

        } catch (error: any) {
            message.error(`Thao tác thất bại: ${error?.message || 'Lỗi không xác định'}`);
        }
    };

    const handleExportCSV = () => {
        const header = ['Key', 'Credit', 'Note', 'Status', 'Expired At', 'Created At'];
        const rows = filteredKeys.map(k => [k.key, k.credit, k.note, k.isActive ? 'Active' : 'Inactive', k.expiredAt, k.createdAt]);
        const csvContent = [header, ...rows].map(row => row.map(String).join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, 'keys_export.csv');
    };

    const columns: ColumnsType<AdminKey> = [
        { title: 'Key', dataIndex: 'key', key: 'key', fixed: 'left', width: 150, render: (text:string) => <code>{text}</code> },
        { title: 'Credit', dataIndex: 'credit', key: 'credit', sorter: (a: AdminKey, b: AdminKey) => a.credit - b.credit },
        { title: 'Note', dataIndex: 'note', key: 'note' },
        { 
            title: 'Trạng thái', 
            dataIndex: 'isActive', 
            key: 'isActive',
            render: (isActive: boolean, record: AdminKey) => (
                <Switch
                    checked={isActive}
                    onChange={(checked) => handleStatusChange(record._id, checked)}
                    checkedChildren="Active"
                    unCheckedChildren="Inactive"
                />
            )
        },
        { title: 'Ngày hết hạn', dataIndex: 'expiredAt', key: 'expiredAt', render: (date: string) => date ? dayjs(date).format('DD/MM/YYYY') : 'Vĩnh viễn' },
        { title: 'Ngày tạo', dataIndex: 'createdAt', key: 'createdAt', render: (date: string) => dayjs(date).format('DD/MM/YYYY') },
        {            title: 'Hành động',
            key: 'action',
            fixed: 'right',
            width: 120,
            render: (_: any, record: AdminKey) => (
                <Space>
                    <Tooltip title="Sửa ghi chú, credit, ngày hết hạn">
                        <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
                    </Tooltip>
                    <Tooltip title="Cộng/Trừ Credit">
                        <Button icon={<PlusCircleOutlined />} onClick={() => handleCreditUpdate(record)} />
                    </Tooltip>
                </Space>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Quản Lý Key</h1>
            <Space className="flex-wrap">
                <Input.Search placeholder="Tìm kiếm key hoặc note..." onSearch={setSearchTerm} style={{ width: 240 }} allowClear />
                <Select 
                    defaultValue="all" 
                    onChange={setStatusFilter} 
                    style={{ width: 140 }}
                    options={[
                        { value: 'all', label: 'Mọi trạng thái' },
                        { value: 'active', label: 'Active' },
                        { value: 'inactive', label: 'Inactive' }
                    ]}
                />
                <Button type="primary" icon={<PlusCircleOutlined />} onClick={handleCreate}>Tạo Key Mới</Button>
                <Button icon={<ExportOutlined />} onClick={handleExportCSV}>Xuất CSV</Button>
                <Button icon={<ReloadOutlined />} onClick={loadKeys} loading={loading} />
            </Space>
            <Table
                columns={columns}
                dataSource={filteredKeys}
                loading={loading}
                rowKey="_id"
                scroll={{ x: 1200 }}
            />
            <Modal
                title={editingKey ? 'Sửa Key' : 'Tạo Key Mới'}
                open={isModalVisible}
                onOk={handleFormSubmit}
                onCancel={() => setIsModalVisible(false)}
                destroyOnClose
            >
                <Form form={form} layout="vertical" initialValues={{ credit: 0, maxActivations: 1 }}>
                    <Form.Item name="key" label="Key" rules={[{ required: true, message: 'Vui lòng nhập key!' }]} hidden={!!editingKey}>
                        <Input disabled={!!editingKey} />
                    </Form.Item>
                    <Form.Item name="credit" label="Credit" rules={[{ required: true, message: 'Vui lòng nhập số credit!' }]}>
                        <InputNumber style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="maxActivations" label="Max Activations" rules={[{ required: true, message: 'Vui lòng nhập số lần kích hoạt tối đa!' }]}>
                        <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="note" label="Note (Ghi chú)">
                        <Input.TextArea />
                    </Form.Item>
                    <Form.Item name="expiredAt" label="Ngày hết hạn">
                        <DatePicker placeholder="Bỏ trống để không hết hạn" format="DD/MM/YYYY" style={{ width: '100%' }} />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default AdminKeyManagement;