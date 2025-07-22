import React, { useState, useEffect } from 'react';
import StatCard from '../components/StatCard';
import { fetchKeys, fetchDashboardStats, fetchAuditLogs, fetchApiProviders } from '../services/keyService';
import { DollarSign, KeyRound, Users, Activity, Cpu, Cloud, Shield, CreditCard, TrendingUp, AlertTriangle } from 'lucide-react';
import { message, Empty, Row, Col, List, Card as AntCard, Spin } from 'antd';
import { AdminKey, ManagedApiProvider } from '../types';

// Helper để định dạng số và tiền tệ
const formatNumber = (value: number) => (value || 0).toLocaleString('vi-VN');
const formatCurrency = (value: number) => `${(value || 0).toLocaleString('vi-VN')} VNĐ`;

const AdminDashboard: React.FC = () => {
    // State cho từng phần dữ liệu
    const [keyStats, setKeyStats] = useState({ total: 0, active: 0, expired: 0 });
    const [billingStats, setBillingStats] = useState({ totalRevenue: 0, monthlyTransactions: 0 });
    const [apiUsageStats, setApiUsageStats] = useState({ totalRequests: 0, costToday: 0 });
    const [apiProviders, setApiProviders] = useState<ManagedApiProvider[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const getDashboardData = async () => {
            try {
                setLoading(true);
                
                // Gọi song song các API để tải nhanh hơn
                const [keysData, statsData, providersData, logsData] = await Promise.all([
                    fetchKeys(),
                    fetchDashboardStats(),
                    fetchApiProviders(),
                    fetchAuditLogs()
                ]);

                // Xử lý và cập nhật state cho Key
                if (keysData && keysData.length > 0) {
                    const now = new Date();
                    const activeKeys = keysData.filter((k: AdminKey) => k.isActive).length;
                    const expiredKeys = keysData.filter((k: AdminKey) => k.expiredAt && new Date(k.expiredAt) < now).length;
                    setKeyStats({ total: keysData.length, active: activeKeys, expired: expiredKeys });
                }

                // Xử lý và cập nhật state cho Stats
                if (statsData) {
                    setBillingStats(statsData.billingStats);
                    setApiUsageStats(statsData.apiUsageStats);
                }

                // Cập nhật state cho Providers và Logs
                setApiProviders(providersData || []);
                setAuditLogs(logsData || []);

            } catch (error: any) {
                message.error(error.message || 'Không thể tải dữ liệu dashboard!');
            } finally {
                setLoading(false);
            }
        };
        getDashboardData();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Spin size="large" tip="Đang tải dữ liệu hệ thống..." />
            </div>
        );
    }
    
    const activeProvidersCount = apiProviders.filter(p => p.status === 'Operational').length;

    return (
        <div className="space-y-8 animate-fadeIn">
            <h1 className="text-3xl font-bold text-gray-800">Tổng Quan Hệ Thống</h1>
            
            {/* Key Statistics */}
            <div>
                <h2 className="text-xl font-semibold text-gray-700 mb-4">📊 Thống Kê Key</h2>
                <Row gutter={16}>
                    <Col span={6}><StatCard title="Tổng Số Key" value={formatNumber(keyStats.total)} Icon={KeyRound}/></Col>
                    <Col span={6}><StatCard title="Key Đang Hoạt Động" value={formatNumber(keyStats.active)} Icon={Users}/></Col>
                    <Col span={6}><StatCard title="Key Đã Hết Hạn" value={formatNumber(keyStats.expired)} Icon={Activity} changeType="negative"/></Col>
                    {/* Có thể thêm tổng credit nếu cần */}
                </Row>
            </div>

            {/* Billing Statistics */}
            <div>
                <h2 className="text-xl font-semibold text-gray-700 mb-4">💰 Thống Kê Doanh Thu</h2>
                <Row gutter={16}>
                    <Col span={6}><StatCard title="Tổng Doanh Thu" value={formatCurrency(billingStats.totalRevenue)} Icon={CreditCard}/></Col>
                    <Col span={6}><StatCard title="Giao Dịch Tháng Này" value={formatNumber(billingStats.monthlyTransactions)} Icon={Activity}/></Col>
                    {/* Các thống kê khác có thể thêm sau */}
                </Row>
            </div>

            {/* API Providers & Usage Statistics */}
            <div>
                <h2 className="text-xl font-semibold text-gray-700 mb-4">🧠 Thống Kê Sử Dụng API</h2>
                <Row gutter={16}>
                    <Col span={6}><StatCard title="Tổng Số Providers" value={formatNumber(apiProviders.length)} Icon={Cpu}/></Col>
                    <Col span={6}><StatCard title="Providers Hoạt Động" value={formatNumber(activeProvidersCount)} Icon={Shield}/></Col>
                    <Col span={6}><StatCard title="Tổng Requests Toàn Hệ Thống" value={formatNumber(apiUsageStats.totalRequests)} Icon={Cloud}/></Col>
                    <Col span={6}><StatCard title="Chi Phí Ước Tính Hôm Nay" value={`$${(apiUsageStats.costToday || 0).toFixed(2)}`} Icon={DollarSign}/></Col>
                </Row>
            </div>

            {/* Recent Activity & Provider Status */}
            <Row gutter={16}>
                <Col span={12}>
                    <AntCard title="🛡️ Hoạt Động Gần Đây" size="small">
                        {auditLogs.length > 0 ? (
                            <List
                                size="small"
                                dataSource={auditLogs}
                                renderItem={(item: any) => (
                                    <List.Item>
                                        <div className="text-xs">
                                            <span className="text-gray-500 mr-2">[{new Date(item.timestamp).toLocaleString('vi-VN')}]</span>
                                            <span className="font-semibold text-blue-600">{item.action}:</span>
                                            <span className="ml-1">{item.details}</span>
                                        </div>
                                    </List.Item>
                                )}
                            />
                        ) : (
                            <Empty description="Chưa có hoạt động nào" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        )}
                    </AntCard>
                </Col>
                <Col span={12}>
                    <AntCard title="🧠 Trạng Thái API Providers" size="small">
                        {apiProviders.length > 0 ? (
                            <div className="space-y-3">
                                {apiProviders.map(provider => (
                                    <div key={provider._id} className="flex justify-between items-center">
                                        <div className="font-medium">{provider.name}</div>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-xs text-gray-500">${(provider.costToday || 0).toFixed(2)}</span>
                                            <div className={`w-2 h-2 rounded-full ${
                                                provider.status === 'Operational' ? 'bg-green-500' : 
                                                provider.status === 'Error' ? 'bg-red-500' : 'bg-yellow-500' // Degraded
                                            }`}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <Empty description="Chưa có API providers nào" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        )}
                    </AntCard>
                </Col>
            </Row>
        </div>
    );
};

export default AdminDashboard;