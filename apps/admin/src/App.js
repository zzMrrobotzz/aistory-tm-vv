// Final consolidated version
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Layout, Menu, Button, Card, Form, Input, message, Table, Tag, Space, Modal, Spin, Badge, InputNumber } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { saveAs } from 'file-saver';

const { Header, Content, Footer } = Layout;
const API_BASE = "https://key-manager-backend.onrender.com/api";

// --- Admin Login ---
const ADMIN_USER = "admin";
const ADMIN_PASS = "123456";

// --- Reusable Modal for API Key Management ---
const ApiKeyManagerModal = ({ provider, onClose, onUpdate }) => {
    const [newApiKey, setNewApiKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleAddKey = async (e) => {
        e.preventDefault();
        if (!newApiKey.trim()) return;
        setLoading(true);
        setError('');
        try {
            const res = await axios.post(`${API_BASE}/providers/${provider._id}/keys`, { apiKey: newApiKey });
            onUpdate(res.data);
            setNewApiKey('');
            message.success(`Added key to ${provider.name}`);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to add key.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteKey = async (apiKeyToDelete) => {
        if (!window.confirm(`Delete key ...${apiKeyToDelete.slice(-4)}?`)) return;
        setLoading(true);
        setError('');
        try {
            const res = await axios.delete(`${API_BASE}/providers/${provider._id}/keys`, { data: { apiKey: apiKeyToDelete } });
            onUpdate(res.data);
            message.success(`Deleted key from ${provider.name}`);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete key.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal title={`Manage Keys for ${provider.name}`} open={true} onCancel={onClose} footer={null}>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <Form onSubmitCapture={handleAddKey} style={{ marginBottom: '20px' }}>
                <Space.Compact style={{ width: '100%' }}>
                    <Input value={newApiKey} onChange={(e) => setNewApiKey(e.target.value)} placeholder="Enter new API key" disabled={loading} />
                    <Button type="primary" htmlType="submit" loading={loading}>Add</Button>
                </Space.Compact>
            </Form>
            <h4>Existing Keys:</h4>
            <ul style={{ listStyle: 'none', padding: 0, maxHeight: 200, overflowY: 'auto' }}>
                {provider.apiKeys?.map((key, index) => (
                    <li key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', borderBottom: '1px solid #eee' }}>
                        <span style={{ fontFamily: 'monospace' }}>...{key.slice(-12)}</span>
                        <Button danger size="small" onClick={() => handleDeleteKey(key)} loading={loading}>Delete</Button>
                    </li>
                ))}
            </ul>
        </Modal>
    );
};

// --- API Provider Management Page ---
const ApiProviderManager = () => {
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedProvider, setSelectedProvider] = useState(null);

    const fetchProviders = useCallback(async () => {
        setLoading(true);
        setError(''); // Reset error state
        try {
            const response = await axios.get(`${API_BASE}/providers`);
            setProviders(response.data || []); // Ensure providers is an array
        } catch (err) {
            const errorMsg = err.response?.data?.message || 'Failed to fetch API providers.';
            setError(errorMsg);
            message.error(errorMsg);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProviders();
    }, [fetchProviders]);

    const handleUpdate = (updatedProvider) => {
        setProviders(prev => prev.map(p => p._id === updatedProvider._id ? updatedProvider : p));
        setSelectedProvider(updatedProvider);
    };

    const columns = [
        { title: 'Provider', dataIndex: 'name', key: 'name' },
        { title: 'API Keys Count', dataIndex: 'apiKeys', key: 'apiKeys', render: (keys) => (keys ? keys.length : 0) },
        { title: 'Status', dataIndex: 'status', key: 'status', render: (status) => <Tag color={status === 'Operational' ? 'green' : 'red'}>{status}</Tag> },
        {
            title: 'Action',
            key: 'action',
            render: (_, record) => (
                <Button onClick={() => setSelectedProvider(record)}>
                    Manage Keys
                </Button>
            ),
        },
    ];

    if (loading) {
        return <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>;
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1>API Provider Management</h1>
                <Button onClick={fetchProviders} icon={<PlusOutlined />}>Refresh</Button>
            </div>
            {error && <div style={{ color: 'red', border: '1px solid red', padding: '10px', marginBottom: '20px' }}><strong>Error:</strong> {error}</div>}
            <Table dataSource={providers} columns={columns} rowKey="_id" />
            {selectedProvider && (
                <ApiKeyManagerModal
                    provider={selectedProvider}
                    onClose={() => setSelectedProvider(null)}
                    onUpdate={handleUpdate}
                />
            )}
        </div>
    );
};

// --- Key Management Page ---
const KeyManager = () => {
    const [keys, setKeys] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();

    const fetchKeys = useCallback(async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_BASE}/keys`);
            setKeys(response.data);
        } catch (err) {
            message.error("Không lấy được danh sách key!");
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchKeys();
    }, [fetchKeys]);

    const handleCreateKey = async (values) => {
        try {
            const payload = { ...values, credit: Number(values.credit || 0) };
            await axios.post(`${API_BASE}/keys`, payload);
            message.success('Tạo key thành công');
            setIsModalVisible(false);
            form.resetFields();
            fetchKeys();
        } catch (err) {
            message.error("Tạo key thất bại!");
        }
    };
    
    const columns = [
        { title: "Key", dataIndex: "key", key: "key" },
        { title: "Trạng thái", dataIndex: "isActive", key: "isActive", render: (active) => <Tag color={active ? 'green' : 'red'}>{active ? 'Hoạt động' : 'Đã thu hồi'}</Tag> },
        { title: "Ngày tạo", dataIndex: "createdAt", key: "createdAt", render: (date) => new Date(date).toLocaleString() },
        { title: "Credit", dataIndex: "credit", key: "credit", render: (num) => num ?? 0 },
    ];

    return (
        <div>
            <h1 style={{ marginBottom: '24px' }}>Quản lý Key Bản Quyền</h1>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)} style={{ marginBottom: 16 }}>Tạo Key mới</Button>
            <Spin spinning={loading}>
                <Table columns={columns} dataSource={keys} rowKey="_id" />
            </Spin>
            <Modal title="Tạo Key mới" open={isModalVisible} onCancel={() => setIsModalVisible(false)} footer={null}>
                <Form form={form} layout="vertical" onFinish={handleCreateKey}>
                    <Form.Item label="Key" name="key" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item label="Ngày hết hạn" name="expiredAt"><Input type="date" /></Form.Item>
                    <Form.Item label="Số máy tối đa" name="maxActivations" initialValue={1}><InputNumber min={1} /></Form.Item>
                    <Form.Item label="Số credit" name="credit" initialValue={0}><InputNumber min={0} /></Form.Item>
                    <Form.Item label="Ghi chú" name="note"><Input /></Form.Item>
                    <Button type="primary" htmlType="submit" block>Tạo Key</Button>
                </Form>
            </Modal>
        </div>
    );
};


// Main App Component - Final version with Manage Keys button
function App() {
    const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem("admin_logged_in"));
    const [currentView, setCurrentView] = useState('keys');

    const handleLogin = () => {
        localStorage.setItem("admin_logged_in", "1");
        setIsLoggedIn(true);
    };

    const handleLogout = () => {
        localStorage.removeItem("admin_logged_in");
        setIsLoggedIn(false);
    };

    if (!isLoggedIn) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f2f5' }}>
                <Card title="Đăng nhập Admin" style={{ width: 400 }}>
                    <Form onFinish={handleLogin} layout="vertical">
                        <Form.Item label="Tài khoản" required><Input defaultValue={ADMIN_USER} /></Form.Item>
                        <Form.Item label="Mật khẩu" required><Input.Password defaultValue={ADMIN_PASS} /></Form.Item>
                        <Button type="primary" htmlType="submit" block>Đăng nhập</Button>
                    </Form>
                </Card>
            </div>
        );
    }

    return (
        <Layout className="layout">
            <Header>
                <Menu theme="dark" mode="horizontal" selectedKeys={[currentView]} onClick={e => setCurrentView(e.key)}>
                    <Menu.Item key="keys">Quản lý Key</Menu.Item>
                    <Menu.Item key="providers">Quản lý API</Menu.Item>
                </Menu>
                <Button onClick={handleLogout} style={{ float: 'right', marginTop: 16 }}>Đăng xuất</Button>
            </Header>
            <Content style={{ padding: '0 50px', marginTop: 24 }}>
                <div style={{ background: '#fff', padding: 24, minHeight: 280 }}>
                    {currentView === 'keys' ? <KeyManager /> : <ApiProviderManager />}
                </div>
            </Content>
            <Footer style={{ textAlign: 'center' }}>Admin Panel ©{new Date().getFullYear()}</Footer>
        </Layout>
    );
}

export default App;