import React, { useState, useEffect } from 'react';
import StatCard from '../components/StatCard';
import { fetchKeys, fetchDashboardStats, fetchAuditLogs, fetchApiProviders, fetchDailyApiStats, wakeUpBackend } from '../services/keyService';
import { DollarSign, KeyRound, Users, Activity, Cpu, Cloud, Shield, CreditCard, Server, WifiOff } from 'lucide-react';
import { message, Empty, Row, Col, List, Card as AntCard, Spin, Skeleton, Result, Button } from 'antd';
import { AdminKey, ManagedApiProvider } from '../types';

// Helper
const formatNumber = (value: number) => (value || 0).toLocaleString('vi-VN');
const formatCurrency = (value: number) => `${(value || 0).toLocaleString('vi-VN')} VNĐ`;

type BackendStatus = 'connecting' | 'online' | 'offline';

const AdminDashboard: React.FC = () => {
    // Data states
    const [keyStats, setKeyStats] = useState({ total: 0, active: 0, expired: 0 });
    const [billingStats, setBillingStats] = useState({ totalRevenue: 0, monthlyTransactions: 0 });
    const [apiUsageStats, setApiUsageStats] = useState({ totalRequests: 0, costToday: 0 });
    const [apiProviders, setApiProviders] = useState<ManagedApiProvider[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    
    // UI states
    const [backendStatus, setBackendStatus] = useState<BackendStatus>('connecting');
    const [loadingData, setLoadingData] = useState(true);

    const loadAllData = async () => {
        setLoadingData(true);
        try {
            const [keysData, statsData, providersData, dailyApiData, logsData] = await Promise.all([
                fetchKeys(),
                fetchDashboardStats(),
                fetchApiProviders(),
                fetchDailyApiStats(),
                fetchAuditLogs()
            ]);

            // Process keys
            if (keysData) {
                const now = new Date();
                const activeKeys = keysData.filter((k: AdminKey) => k.isActive).length;
                const expiredKeys = keysData.filter((k: AdminKey) => k.expiredAt && new Date(k.expiredAt) < now).length;
                setKeyStats({ total: keysData.length, active: activeKeys, expired: expiredKeys });
            }

            // Process stats
            if (statsData) {
                setBillingStats(statsData.billingStats || { totalRevenue: 0, monthlyTransactions: 0 });
                setApiUsageStats(statsData.apiUsageStats || { totalRequests: 0, costToday: 0 });
            }

            // Merge daily API stats with providers data
            let mergedProviders = providersData || [];
            if (dailyApiData && Array.isArray(dailyApiData.providers) && dailyApiData.providers.length > 0) {
                mergedProviders = mergedProviders.map(provider => {
                    const dailyStats = dailyApiData.providers.find(daily => daily.name?.toLowerCase() === provider.name?.toLowerCase());
                    return {
                        ...provider,
                        dailyRequests: dailyStats?.dailyRequests || 0,
                        successfulRequests: dailyStats?.successfulRequests || 0,
                        failedRequests: dailyStats?.failedRequests || 0,
                        successRate: dailyStats?.successRate || '0%',
                        totalTokensToday: dailyStats?.totalTokensToday || 0
                    };
                });
            }

            // Process providers and logs  
            setApiProviders(mergedProviders);
            setAuditLogs(logsData || []);

        } catch (error: any) {
            message.error(`Lỗi khi tải dữ liệu: ${error.message}`);
            setBackendStatus('offline'); // Assume offline if data loading fails
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        const initializeBackend = async () => {
            setBackendStatus('connecting');
            const isAwake = await wakeUpBackend();
            if (isAwake) {
                setBackendStatus('online');
                await loadAllData();
            } else {
                setBackendStatus('offline');
            }
        };
        initializeBackend();
    }, []);

    if (backendStatus === 'connecting') {
        return (
            <div className="flex flex-col justify-center items-center h-80">
                <Spin size="large" tip="Đang khởi động máy chủ, vui lòng chờ..." />
                <p className="text-gray-500 mt-4">Quá trình này có thể mất đến 60 giây do chế độ ngủ của server miễn phí.</p>
            </div>
        );
    }

    if (backendStatus === 'offline') {
        return (
            <Result
                status="500"
                title="Không thể kết nối đến máy chủ"
                subTitle="Không thể kết nối đến máy chủ backend. Vui lòng thử lại sau hoặc kiểm tra trạng thái của máy chủ."
                extra={<Button type="primary" onClick={() => window.location.reload()}>Tải lại trang</Button>}
            />
        );
    }
    
    const activeProvidersCount = apiProviders.filter(p => p.status === 'Operational').length;

    return (
        <div className="space-y-8 animate-fadeIn">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800">Tổng Quan Hệ Thống</h1>
                <div className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 flex items-center">
                    <Server size={16} className="mr-2" /> Backend Online
                </div>
            </div>
            
            <Skeleton loading={loadingData} active paragraph={{ rows: 10 }}>
                {/* Key Statistics */}
                <div>
                    <h2 className="text-xl font-semibold text-gray-700 mb-4">📊 Thống Kê Key</h2>
                    <Row gutter={16}>
                        <Col span={6}><StatCard title="Tổng Số Key" value={formatNumber(keyStats.total)} Icon={KeyRound}/></Col>
                        <Col span={6}><StatCard title="Key Đang Hoạt Động" value={formatNumber(keyStats.active)} Icon={Users}/></Col>
                        <Col span={6}><StatCard title="Key Đã Hết Hạn" value={formatNumber(keyStats.expired)} Icon={Activity} changeType="negative"/></Col>
                    </Row>
                </div>

                {/* Billing Statistics */}
                <div>
                    <h2 className="text-xl font-semibold text-gray-700 mb-4">💰 Thống Kê Doanh Thu</h2>
                    <Row gutter={16}>
                        <Col span={6}><StatCard title="Tổng Doanh Thu" value={formatCurrency(billingStats.totalRevenue)} Icon={CreditCard}/></Col>
                        <Col span={6}><StatCard title="Giao Dịch Tháng Này" value={formatNumber(billingStats.monthlyTransactions)} Icon={Activity}/></Col>
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

                {/* Daily API Request Statistics by Provider */}
                <div>
                    <h2 className="text-xl font-semibold text-gray-700 mb-4">📈 Thống Kê Request Hôm Nay Theo API</h2>
                    <Row gutter={16}>
                        {apiProviders.map((provider, index) => {
                            const dailyRequests = provider.dailyRequests || 0;
                            const costToday = provider.costToday || 0;
                            const successRate = provider.successRate || '0%';
                            const successfulRequests = provider.successfulRequests || 0;
                            const failedRequests = provider.failedRequests || 0;
                            return (
                                <Col span={6} key={provider._id || index}>
                                    <AntCard size="small" className="h-full">
                                        <div className="text-center">
                                            <div className="text-lg font-semibold text-gray-800">{provider.name}</div>
                                            <div className="text-2xl font-bold text-blue-600 my-2">{formatNumber(dailyRequests)}</div>
                                            <div className="text-sm text-gray-500">requests hôm nay</div>
                                            <div className="text-xs text-gray-400 mb-1">
                                                ✅ {successfulRequests} • ❌ {failedRequests} • {successRate}
                                            </div>
                                            <div className="text-sm text-green-600 font-medium">${costToday.toFixed(2)}</div>
                                            <div className={`inline-block w-2 h-2 rounded-full mt-1 ${
                                                provider.status === 'Operational' ? 'bg-green-500' : 
                                                provider.status === 'Error' ? 'bg-red-500' : 'bg-yellow-500'
                                            }`}></div>
                                        </div>
                                    </AntCard>
                                </Col>
                            );
                        })}
                    </Row>
                </div>

                {/* Recent Activity & Provider Status */}
                <Row gutter={16}>
                    <Col span={12}>
                        <AntCard title="🛡️ Hoạt Động Gần Đây" size="small">
                            {auditLogs && auditLogs.length > 0 ? (
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
                            {apiProviders && apiProviders.length > 0 ? (
                                <div className="space-y-3">
                                    {apiProviders.map(provider => (
                                        <div key={provider._id} className="flex justify-between items-center">
                                            <div className="font-medium">{provider.name}</div>
                                            <div className="flex items-center space-x-2">
                                                <span className="text-xs text-gray-500">${(provider.costToday || 0).toFixed(2)}</span>
                                                <div className={`w-2 h-2 rounded-full ${
                                                    provider.status === 'Operational' ? 'bg-green-500' : 
                                                    provider.status === 'Error' ? 'bg-red-500' : 'bg-yellow-500'
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
            </Skeleton>
        </div>
    );
};

export default AdminDashboard;