import React, { useState, useEffect } from 'react';
import { List, Card, Spin, message, Button } from 'antd';
import { fetchAuditLogs } from '../services/keyService'; // Sửa lại: dùng hàm mới

const AdminSuspiciousActivity: React.FC = () => {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadLogs = async () => {
        try {
            setLoading(true);
            const data = await fetchAuditLogs();
            setLogs(data || []);
        } catch (error: any) {
            message.error(error.message || 'Không thể tải nhật ký hoạt động');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLogs();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Spin size="large" tip="Đang tải nhật ký hoạt động..." />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800">Nhật Ký Hoạt Động Hệ Thống</h1>
                <Button type="primary" onClick={loadLogs} loading={loading}>
                    Làm Mới
                </Button>
            </div>
            <Card>
                <List
                    dataSource={logs}
                    renderItem={(item: any) => (
                        <List.Item>
                            <List.Item.Meta
                                title={<span className="font-semibold text-blue-600">{item.action}</span>}
                                description={item.details}
                            />
                            <div className="text-right text-gray-500">
                                <div>{new Date(item.timestamp).toLocaleString('vi-VN')}</div>
                                <div className="text-xs">Actor: {item.actor}</div>
                            </div>
                        </List.Item>
                    )}
                />
            </Card>
        </div>
    );
};

export default AdminSuspiciousActivity;