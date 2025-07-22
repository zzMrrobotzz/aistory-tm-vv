import React, { useState, useEffect } from 'react';
import { Table, Tag, message, Spin } from 'antd';
import { fetchApiProviders } from '../services/keyService';
import { ManagedApiProvider } from '../types';

const AdminApiMonitoring: React.FC = () => {
    const [apiData, setApiData] = useState<ManagedApiProvider[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const getProviderData = async () => {
            try {
                setLoading(true);
                const providers = await fetchApiProviders();
                setApiData(providers || []);
            } catch (error: any) {
                message.error(error.message || 'Không thể tải dữ liệu trạng thái API!');
            } finally {
                setLoading(false);
            }
        };
        getProviderData();
    }, []);

    const getStatusTag = (status: 'Operational' | 'Degraded' | 'Error' | 'Unknown') => {
        switch (status) {
            case 'Operational':
                return <Tag color="green">Operational</Tag>;
            case 'Degraded':
                return <Tag color="orange">Degraded</Tag>;
            case 'Error':
                return <Tag color="red">Error</Tag>;
            default:
                return <Tag>Unknown</Tag>;
        }
    };
    
    const columns = [
        { title: 'Nhà Cung Cấp', dataIndex: 'name', key: 'name' },
        { title: 'Trạng Thái', dataIndex: 'status', key: 'status', render: getStatusTag },
        { title: 'Tổng Requests', dataIndex: 'totalRequests', key: 'totalRequests', render: (val: number) => (val || 0).toLocaleString() },
        { title: 'Chi phí Ước tính Hôm Nay', dataIndex: 'costToday', key: 'costToday', render: (val: number) => `$${(val || 0).toFixed(2)}` },
        { title: 'Kiểm tra Lần cuối', dataIndex: 'lastChecked', key: 'lastChecked', render: (val: string) => new Date(val).toLocaleString('vi-VN') },
    ];

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Spin size="large" tip="Đang tải trạng thái API..." />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fadeIn">
            <h1 className="text-3xl font-bold text-gray-800">Theo Dõi & Sức Khỏe API</h1>
            <Table 
                dataSource={apiData} 
                columns={columns}
                rowKey="_id"
                pagination={false}
            />
        </div>
    );
};

export default AdminApiMonitoring;