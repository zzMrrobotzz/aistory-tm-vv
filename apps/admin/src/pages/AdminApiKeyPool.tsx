import React, { useState, useEffect } from 'react';
import { Select, Table, Button, message, Spin, Modal, Input } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { fetchApiProviders, addApiKeyToProvider, deleteApiKeyFromProvider } from '../services/keyService'; 
import { ManagedApiProvider } from '../types';

const { TextArea } = Input;

interface ApiKeyRecord {
    _id: string;
    key: string;
    displayKey: string;
}

const AdminApiKeyPool: React.FC = () => {
    const [providers, setProviders] = useState<ManagedApiProvider[]>([]);
    const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
    const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
    const [loadingProviders, setLoadingProviders] = useState(true);
    const [loadingKeys, setLoadingKeys] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [newKeys, setNewKeys] = useState('');

    const loadProviders = async () => {
        try {
            setLoadingProviders(true);
            const data = await fetchApiProviders();
            setProviders(data || []);
        } catch (error: any) {
            message.error(error.message || 'Không thể tải danh sách API providers');
        } finally {
            setLoadingProviders(false);
        }
    };

    useEffect(() => {
        loadProviders();
    }, []);

    const handleProviderChange = async (providerId: string) => {
        setSelectedProvider(providerId);
        if (!providerId) {
            setApiKeys([]);
            return;
        }
        
        setLoadingKeys(true);
        try {
            // Lấy provider đầy đủ từ state đã tải
            const providerData = providers.find(p => p._id === providerId);
            const keysFromApi = providerData?.apiKeys || [];

            const formattedKeys = keysFromApi.map((key, index) => ({
                _id: `${providerId}-${index}`, // ID này chỉ dùng cho UI, không gửi về backend
                key: key,
                displayKey: `${key.substring(0, 4)}...${key.substring(key.length - 4)}`
            }));
            setApiKeys(formattedKeys);
        } catch (error: any) {
            message.error(error.message || `Không thể tải API keys cho provider này.`);
            setApiKeys([]);
        } finally {
            setLoadingKeys(false);
        }
    };

    const handleAddKeys = async () => {
        if (!selectedProvider || !newKeys.trim()) {
            message.warning('Vui lòng chọn provider và nhập ít nhất một API key.');
            return;
        }
        const keysToAdd = newKeys.split('\n').map(k => k.trim()).filter(Boolean);
        if (keysToAdd.length === 0) {
            message.warning('Định dạng key không hợp lệ.');
            return;
        }

        try {
            const providerId = selectedProvider!;
            // Gửi một loạt các yêu cầu thêm key
            await Promise.all(keysToAdd.map(key => addApiKeyToProvider(providerId, key)));
            
            message.success(`${keysToAdd.length} key đã được thêm thành công!`);
            setIsModalVisible(false);
            setNewKeys('');
            
            // Tải lại danh sách providers và cập nhật bảng keys
            setLoadingKeys(true);
            const freshProviders = await fetchApiProviders();
            setProviders(freshProviders || []);

            const updatedProvider = (freshProviders || []).find(p => p._id === providerId);
            const keysFromApi = updatedProvider?.apiKeys || [];

            const formattedKeys = keysFromApi.map((key, index) => ({
                _id: `${providerId}-${index}`,
                key: key,
                displayKey: `${key.substring(0, 4)}...${key.substring(key.length - 4)}`
            }));
            setApiKeys(formattedKeys);
            setLoadingKeys(false);

        } catch (error: any) {
            message.error(error.message || 'Thêm key thất bại.');
            setLoadingKeys(false);
        }
    };

    const handleDeleteKey = (keyRecord: ApiKeyRecord) => {
        Modal.confirm({
            title: 'Bạn có chắc muốn xóa key này?',
            content: `Key: ${keyRecord.displayKey}`,
            okText: 'Xóa',
            okType: 'danger',
            cancelText: 'Hủy',
            onOk: async () => {
                try {
                    await deleteApiKeyFromProvider(selectedProvider!, keyRecord.key);
                    message.success(`Key ${keyRecord.displayKey} đã được xóa`);
                    // Tải lại danh sách providers để cập nhật UI
                    loadProviders();
                     // Reset view
                    setApiKeys([]);
                    setSelectedProvider(null);
                } catch (error: any) {
                    message.error(error.message || 'Xóa key thất bại.');
                }
            },
        });
    };

    const columns = [
        {
            title: 'API Key (che một phần)',
            dataIndex: 'displayKey',
            key: 'displayKey',
        },
        {
            title: 'Hành động',
            key: 'action',
            width: 120,
            render: (_: any, record: ApiKeyRecord) => (
                <Button
                    icon={<DeleteOutlined />}
                    danger
                    onClick={() => handleDeleteKey(record)}
                >
                    Xóa
                </Button>
            ),
        },
    ];

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800">Quản Lý Kho API Key</h1>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setIsModalVisible(true)}
                    disabled={!selectedProvider}
                >
                    Thêm Key Mới
                </Button>
            </div>

            <Select
                showSearch
                placeholder="Chọn một API Provider"
                style={{ width: '100%' }}
                onChange={handleProviderChange}
                loading={loadingProviders}
                options={providers.map(p => ({ label: p.name, value: p._id }))}
                filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
            />

            <Spin spinning={loadingKeys} tip="Đang tải keys...">
                <Table
                    columns={columns}
                    dataSource={apiKeys}
                    rowKey="_id"
                    pagination={{ pageSize: 10 }}
                    locale={{ emptyText: 'Chưa có API key nào cho provider này hoặc provider chưa được chọn.' }}
                />
            </Spin>

            <Modal
                title={`Thêm API Key cho ${providers.find(p => p._id === selectedProvider)?.name}`}
                visible={isModalVisible}
                onOk={handleAddKeys}
                onCancel={() => setIsModalVisible(false)}
                okText="Thêm"
                cancelText="Hủy"
            >
                <p>Dán danh sách API key vào ô bên dưới, mỗi key một dòng.</p>
                <TextArea
                    rows={6}
                    value={newKeys}
                    onChange={(e) => setNewKeys(e.target.value)}
                    placeholder="key-abc...&#10;key-def...&#10;key-ghi..."
                />
            </Modal>
        </div>
    );
};

export default AdminApiKeyPool;