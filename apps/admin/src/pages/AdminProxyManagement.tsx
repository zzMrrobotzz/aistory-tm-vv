import React, { useState, useEffect } from 'react';
import { 
    Table, Button, Modal, Form, Input, Select, Switch, Space, message, 
    Popconfirm, Badge, Tag, Card, Row, Col, Statistic, Tooltip, 
    InputNumber, Spin, Empty, Typography 
} from 'antd';
import { 
    Plus, Wifi, WifiOff, TestTube, Play, Settings, BarChart3, 
    Globe, Shield, Clock, CheckCircle, XCircle, AlertCircle 
} from 'lucide-react';
import { ProxyItem, ProxyStatistics, ProxyTestResult } from '../types';
import { 
    fetchProxies, createProxy, updateProxy, deleteProxy, 
    testProxy, batchTestProxies, autoAssignProxies, fetchProxyStats,
    formatProxyEndpoint, getProxyStatusColor, getProxyStatusText,
    formatResponseTime, formatSuccessRate 
} from '../services/proxyService';

const { Title, Text } = Typography;
const { Option } = Select;

const AdminProxyManagement: React.FC = () => {
    // State management
    const [proxies, setProxies] = useState<ProxyItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [statistics, setStatistics] = useState<ProxyStatistics | null>(null);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
        total: 0
    });

    // Modal states
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingProxy, setEditingProxy] = useState<ProxyItem | null>(null);
    const [isTestingAll, setIsTestingAll] = useState(false);
    const [isAutoAssigning, setIsAutoAssigning] = useState(false);

    // Filter states
    const [filters, setFilters] = useState({
        status: 'all',
        location: 'all',
        assigned: 'all'
    });

    const [form] = Form.useForm();

    // Load data on component mount
    useEffect(() => {
        loadProxies();
        loadStatistics();
    }, [pagination.current, pagination.pageSize, filters]);

    const loadProxies = async () => {
        try {
            setLoading(true);
            const result = await fetchProxies({
                page: pagination.current,
                limit: pagination.pageSize,
                status: filters.status !== 'all' ? filters.status as any : undefined,
                location: filters.location !== 'all' ? filters.location : undefined,
                assigned: filters.assigned !== 'all' ? filters.assigned as any : undefined
            });

            if (result) {
                setProxies(result.proxies);
                setPagination(prev => ({
                    ...prev,
                    total: result.pagination.totalItems
                }));
            }
        } catch (error: any) {
            message.error(`Failed to load proxies: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const loadStatistics = async () => {
        try {
            const stats = await fetchProxyStats();
            setStatistics(stats);
        } catch (error: any) {
            console.error('Failed to load proxy statistics:', error.message);
        }
    };

    const handleCreateProxy = () => {
        setEditingProxy(null);
        form.resetFields();
        setIsModalVisible(true);
    };

    const handleEditProxy = (proxy: ProxyItem) => {
        setEditingProxy(proxy);
        form.setFieldsValue({
            name: proxy.name,
            host: proxy.host,
            port: proxy.port,
            username: proxy.username || '',
            password: proxy.password || '',
            protocol: proxy.protocol,
            location: proxy.location,
            provider: proxy.provider,
            isActive: proxy.isActive,
            notes: proxy.notes || ''
        });
        setIsModalVisible(true);
    };

    const handleModalSubmit = async () => {
        try {
            const values = await form.validateFields();
            
            if (editingProxy) {
                // Update existing proxy
                await updateProxy(editingProxy._id, values);
                message.success('Proxy updated successfully');
            } else {
                // Create new proxy
                await createProxy(values);
                message.success('Proxy created successfully');
            }

            setIsModalVisible(false);
            loadProxies();
            loadStatistics();
        } catch (error: any) {
            message.error(`Operation failed: ${error.message}`);
        }
    };

    const handleDeleteProxy = async (proxyId: string) => {
        try {
            await deleteProxy(proxyId);
            message.success('Proxy deleted successfully');
            loadProxies();
            loadStatistics();
        } catch (error: any) {
            message.error(`Failed to delete proxy: ${error.message}`);
        }
    };

    const handleTestProxy = async (proxyId: string) => {
        try {
            const result = await testProxy(proxyId);
            if (result) {
                if (result.success) {
                    message.success(`Proxy test successful! IP: ${result.ip}, Response time: ${result.responseTime}ms`);
                } else {
                    message.error(`Proxy test failed: ${result.error}`);
                }
                loadProxies(); // Refresh to show updated stats
            }
        } catch (error: any) {
            message.error(`Test failed: ${error.message}`);
        }
    };

    const handleBatchTest = async () => {
        try {
            setIsTestingAll(true);
            const result = await batchTestProxies();
            if (result) {
                const { summary } = result;
                message.success(
                    `Batch test completed: ${summary.success}/${summary.total} proxies working (${summary.successRate}% success rate)`
                );
                loadProxies();
                loadStatistics();
            }
        } catch (error: any) {
            message.error(`Batch test failed: ${error.message}`);
        } finally {
            setIsTestingAll(false);
        }
    };

    const handleAutoAssign = async () => {
        try {
            setIsAutoAssigning(true);
            const result = await autoAssignProxies({ provider: 'all', forceReassign: false });
            if (result) {
                message.success(`Auto-assignment completed: ${result.totalAssigned} proxies assigned`);
                loadProxies();
                loadStatistics();
            }
        } catch (error: any) {
            message.error(`Auto-assignment failed: ${error.message}`);
        } finally {
            setIsAutoAssigning(false);
        }
    };

    const columns = [
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            render: (text: string, record: ProxyItem) => (
                <div>
                    <div className="font-medium">{text}</div>
                    <div className="text-xs text-gray-500">{formatProxyEndpoint(record)}</div>
                </div>
            ),
        },
        {
            title: 'Location',
            dataIndex: 'location',
            key: 'location',
            render: (location: string) => <Tag color="blue">{location}</Tag>,
        },
        {
            title: 'Protocol',
            dataIndex: 'protocol',
            key: 'protocol',
            render: (protocol: string) => <Tag color="green">{protocol.toUpperCase()}</Tag>,
        },
        {
            title: 'Status',
            key: 'status',
            render: (record: ProxyItem) => {
                const statusText = getProxyStatusText(record);
                const statusColor = getProxyStatusColor(record);
                
                return (
                    <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${
                            record.isActive ? 'bg-green-500' : 'bg-gray-400'
                        }`} />
                        <span className={statusColor}>{statusText}</span>
                    </div>
                );
            },
        },
        {
            title: 'Assignment',
            key: 'assignment',
            render: (record: ProxyItem) => (
                record.assignedApiKey ? (
                    <Badge status="success" text={`Assigned (${record.assignedApiKey.substring(0, 8)}...)`} />
                ) : (
                    <Badge status="default" text="Available" />
                )
            ),
        },
        {
            title: 'Performance',
            key: 'performance',
            render: (record: ProxyItem) => {
                const successRate = formatSuccessRate(record.successCount, record.failureCount);
                const avgTime = record.avgResponseTime ? formatResponseTime(record.avgResponseTime) : 'N/A';
                
                return (
                    <div className="text-xs">
                        <div>Success: {successRate}</div>
                        <div>Avg: {avgTime}</div>
                    </div>
                );
            },
        },
        {
            title: 'Last Used',
            dataIndex: 'lastUsed',
            key: 'lastUsed',
            render: (lastUsed: string) => (
                lastUsed ? (
                    <Tooltip title={new Date(lastUsed).toLocaleString()}>
                        <span className="text-xs text-gray-500">
                            {new Date(lastUsed).toLocaleDateString()}
                        </span>
                    </Tooltip>
                ) : (
                    <span className="text-xs text-gray-400">Never</span>
                )
            ),
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (record: ProxyItem) => (
                <Space size="small">
                    <Button
                        size="small"
                        icon={<TestTube size={14} />}
                        onClick={() => handleTestProxy(record._id)}
                        title="Test Proxy"
                    />
                    <Button
                        size="small"
                        icon={<Settings size={14} />}
                        onClick={() => handleEditProxy(record)}
                        title="Edit Proxy"
                    />
                    <Popconfirm
                        title="Are you sure you want to delete this proxy?"
                        onConfirm={() => handleDeleteProxy(record._id)}
                        okText="Yes"
                        cancelText="No"
                    >
                        <Button
                            size="small"
                            danger
                            icon={<XCircle size={14} />}
                            disabled={!!record.assignedApiKey}
                            title={record.assignedApiKey ? "Cannot delete assigned proxy" : "Delete Proxy"}
                        />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <Title level={2} className="mb-0">
                    <Wifi className="inline mr-2" size={28} />
                    Proxy Management
                </Title>
                <Space>
                    <Button
                        type="primary"
                        icon={<Plus size={16} />}
                        onClick={handleCreateProxy}
                    >
                        Add Proxy
                    </Button>
                    <Button
                        icon={<TestTube size={16} />}
                        onClick={handleBatchTest}
                        loading={isTestingAll}
                    >
                        Test All
                    </Button>
                    <Button
                        icon={<Play size={16} />}
                        onClick={handleAutoAssign}
                        loading={isAutoAssigning}
                    >
                        Auto Assign
                    </Button>
                </Space>
            </div>

            {/* Statistics Cards */}
            {statistics && (
                <Row gutter={16}>
                    <Col span={6}>
                        <Card>
                            <Statistic 
                                title="Total Proxies" 
                                value={statistics.overview.total}
                                prefix={<Globe size={16} />}
                            />
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card>
                            <Statistic 
                                title="Active Proxies" 
                                value={statistics.overview.active}
                                prefix={<CheckCircle size={16} />}
                                valueStyle={{ color: '#52c41a' }}
                            />
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card>
                            <Statistic 
                                title="Assigned Proxies" 
                                value={statistics.overview.assigned}
                                prefix={<Shield size={16} />}
                                valueStyle={{ color: '#1890ff' }}
                            />
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card>
                            <Statistic 
                                title="Assignment Rate" 
                                value={statistics.overview.assignmentRate}
                                suffix="%"
                                prefix={<BarChart3 size={16} />}
                                valueStyle={{ color: '#722ed1' }}
                            />
                        </Card>
                    </Col>
                </Row>
            )}

            {/* Filters */}
            <Card size="small">
                <Space>
                    <Text strong>Filters:</Text>
                    <Select
                        value={filters.status}
                        onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                        style={{ width: 120 }}
                    >
                        <Option value="all">All Status</Option>
                        <Option value="active">Active</Option>
                        <Option value="inactive">Inactive</Option>
                    </Select>
                    <Select
                        value={filters.assigned}
                        onChange={(value) => setFilters(prev => ({ ...prev, assigned: value }))}
                        style={{ width: 120 }}
                    >
                        <Option value="all">All</Option>
                        <Option value="true">Assigned</Option>
                        <Option value="false">Available</Option>
                    </Select>
                </Space>
            </Card>

            {/* Proxy Table */}
            <Card>
                <Table
                    columns={columns}
                    dataSource={proxies}
                    rowKey="_id"
                    loading={loading}
                    pagination={{
                        current: pagination.current,
                        pageSize: pagination.pageSize,
                        total: pagination.total,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total, range) => 
                            `${range[0]}-${range[1]} of ${total} proxies`,
                        onChange: (page, pageSize) => {
                            setPagination(prev => ({
                                ...prev,
                                current: page,
                                pageSize: pageSize || 10
                            }));
                        },
                    }}
                    locale={{
                        emptyText: (
                            <Empty
                                description="No proxies found"
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                            />
                        )
                    }}
                />
            </Card>

            {/* Create/Edit Modal */}
            <Modal
                title={editingProxy ? 'Edit Proxy' : 'Add New Proxy'}
                visible={isModalVisible}
                onOk={handleModalSubmit}
                onCancel={() => setIsModalVisible(false)}
                width={600}
                okText={editingProxy ? 'Update' : 'Create'}
            >
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={{
                        protocol: 'http',
                        isActive: true,
                        location: 'Unknown',
                        provider: 'Manual'
                    }}
                >
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="name"
                                label="Proxy Name"
                                rules={[{ required: true, message: 'Please enter proxy name' }]}
                            >
                                <Input placeholder="e.g., US East Proxy 1" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="protocol"
                                label="Protocol"
                                rules={[{ required: true }]}
                            >
                                <Select>
                                    <Option value="http">HTTP</Option>
                                    <Option value="https">HTTPS</Option>
                                    <Option value="socks4">SOCKS4</Option>
                                    <Option value="socks5">SOCKS5</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={16}>
                            <Form.Item
                                name="host"
                                label="Host/IP Address"
                                rules={[{ required: true, message: 'Please enter host' }]}
                            >
                                <Input placeholder="proxy.example.com or 1.2.3.4" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item
                                name="port"
                                label="Port"
                                rules={[{ required: true, message: 'Please enter port' }]}
                            >
                                <InputNumber 
                                    min={1} 
                                    max={65535} 
                                    style={{ width: '100%' }}
                                    placeholder="8080"
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="username"
                                label="Username (Optional)"
                            >
                                <Input placeholder="Authentication username" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="password"
                                label="Password (Optional)"
                            >
                                <Input.Password placeholder="Authentication password" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="location"
                                label="Location"
                            >
                                <Input placeholder="e.g., US East, EU West" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="provider"
                                label="Provider"
                            >
                                <Input placeholder="e.g., ProxyProvider, Manual" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item
                        name="notes"
                        label="Notes"
                    >
                        <Input.TextArea 
                            rows={3} 
                            placeholder="Additional notes about this proxy"
                        />
                    </Form.Item>

                    <Form.Item
                        name="isActive"
                        label="Status"
                        valuePropName="checked"
                    >
                        <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default AdminProxyManagement;