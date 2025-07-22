import axios from 'axios';
import { ProxyItem, ProxyTestResult, ProxyBatchTestResult, ProxyStatistics } from '../types';

// --- Base API Configuration ---
const API_BASE = process.env.REACT_APP_API_URL || "https://key-manager-backend.onrender.com/api";

const apiClient = axios.create({
    baseURL: API_BASE,
    timeout: 60000, // 60 seconds for proxy operations
    headers: {
        'Content-Type': 'application/json',
    },
});

// --- Proxy API Services ---

export const fetchProxies = async (params?: {
    page?: number;
    limit?: number;
    status?: 'active' | 'inactive' | 'all';
    location?: string;
    assigned?: 'true' | 'false' | 'all';
}): Promise<{
    proxies: ProxyItem[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
    };
} | null> => {
    try {
        const response = await apiClient.get('/admin/proxies', { params });
        
        if (response.data.success) {
            return response.data.data;
        } else {
            console.error('API returned error:', response.data.message);
            return null;
        }
    } catch (error: any) {
        console.error('Error fetching proxies:', error.response?.data?.message || error.message);
        return null;
    }
};

export const createProxy = async (proxyData: {
    name: string;
    host: string;
    port: number;
    username?: string;
    password?: string;
    protocol?: 'http' | 'https' | 'socks4' | 'socks5';
    location?: string;
    provider?: string;
    notes?: string;
}): Promise<ProxyItem | null> => {
    try {
        const response = await apiClient.post('/admin/proxies', proxyData);
        
        if (response.data.success) {
            return response.data.data;
        } else {
            throw new Error(response.data.message || 'Failed to create proxy');
        }
    } catch (error: any) {
        console.error('Error creating proxy:', error.response?.data?.message || error.message);
        throw new Error(error.response?.data?.message || error.message);
    }
};

export const updateProxy = async (proxyId: string, proxyData: Partial<ProxyItem>): Promise<ProxyItem | null> => {
    try {
        const response = await apiClient.put(`/admin/proxies/${proxyId}`, proxyData);
        
        if (response.data.success) {
            return response.data.data;
        } else {
            throw new Error(response.data.message || 'Failed to update proxy');
        }
    } catch (error: any) {
        console.error('Error updating proxy:', error.response?.data?.message || error.message);
        throw new Error(error.response?.data?.message || error.message);
    }
};

export const deleteProxy = async (proxyId: string): Promise<boolean> => {
    try {
        const response = await apiClient.delete(`/admin/proxies/${proxyId}`);
        
        if (response.data.success) {
            return true;
        } else {
            throw new Error(response.data.message || 'Failed to delete proxy');
        }
    } catch (error: any) {
        console.error('Error deleting proxy:', error.response?.data?.message || error.message);
        throw new Error(error.response?.data?.message || error.message);
    }
};

export const testProxy = async (proxyId: string): Promise<ProxyTestResult | null> => {
    try {
        const response = await apiClient.post(`/admin/proxies/${proxyId}/test`);
        
        if (response.data.success) {
            return response.data.data;
        } else {
            throw new Error(response.data.message || 'Failed to test proxy');
        }
    } catch (error: any) {
        console.error('Error testing proxy:', error.response?.data?.message || error.message);
        throw new Error(error.response?.data?.message || error.message);
    }
};

export const batchTestProxies = async (): Promise<ProxyBatchTestResult | null> => {
    try {
        const response = await apiClient.post('/admin/proxies/batch-test');
        
        if (response.data.success) {
            return response.data.data;
        } else {
            throw new Error(response.data.message || 'Failed to batch test proxies');
        }
    } catch (error: any) {
        console.error('Error batch testing proxies:', error.response?.data?.message || error.message);
        throw new Error(error.response?.data?.message || error.message);
    }
};

export const autoAssignProxies = async (params?: {
    provider?: string;
    forceReassign?: boolean;
}): Promise<{
    totalAssigned: number;
    results: Array<{
        apiKey: string;
        provider: string;
        status: string;
        proxyName?: string;
        proxyHost?: string;
        error?: string;
    }>;
} | null> => {
    try {
        const response = await apiClient.post('/admin/proxies/auto-assign', params);
        
        if (response.data.success) {
            return response.data.data;
        } else {
            throw new Error(response.data.message || 'Failed to auto-assign proxies');
        }
    } catch (error: any) {
        console.error('Error auto-assigning proxies:', error.response?.data?.message || error.message);
        throw new Error(error.response?.data?.message || error.message);
    }
};

export const fetchProxyStats = async (): Promise<ProxyStatistics | null> => {
    try {
        const response = await apiClient.get('/admin/proxies/stats');
        
        if (response.data.success) {
            return response.data.data;
        } else {
            console.error('API returned error:', response.data.message);
            return null;
        }
    } catch (error: any) {
        console.error('Error fetching proxy stats:', error.response?.data?.message || error.message);
        return null;
    }
};

// --- Utility Functions ---

export const formatProxyEndpoint = (proxy: ProxyItem): string => {
    return `${proxy.host}:${proxy.port}`;
};

export const formatProxyUrl = (proxy: ProxyItem): string => {
    const auth = proxy.username && proxy.password ? `${proxy.username}:${proxy.password}@` : '';
    return `${proxy.protocol}://${auth}${proxy.host}:${proxy.port}`;
};

export const getProxyStatusColor = (proxy: ProxyItem): string => {
    if (!proxy.isActive) return 'text-gray-500';
    
    const totalRequests = proxy.successCount + proxy.failureCount;
    if (totalRequests === 0) return 'text-blue-500';
    
    const successRate = (proxy.successCount / totalRequests) * 100;
    if (successRate >= 90) return 'text-green-500';
    if (successRate >= 70) return 'text-yellow-500';
    return 'text-red-500';
};

export const getProxyStatusText = (proxy: ProxyItem): string => {
    if (!proxy.isActive) return 'Inactive';
    
    const totalRequests = proxy.successCount + proxy.failureCount;
    if (totalRequests === 0) return 'Never Used';
    
    const successRate = (proxy.successCount / totalRequests) * 100;
    if (successRate >= 90) return 'Excellent';
    if (successRate >= 70) return 'Good';
    return 'Poor';
};

export const formatResponseTime = (responseTime: number): string => {
    if (responseTime < 1000) return `${responseTime}ms`;
    return `${(responseTime / 1000).toFixed(1)}s`;
};

export const formatSuccessRate = (successCount: number, failureCount: number): string => {
    const total = successCount + failureCount;
    if (total === 0) return 'N/A';
    
    const rate = (successCount / total) * 100;
    return `${rate.toFixed(1)}%`;
};

// --- Mock Data for Development ---
export const getMockProxies = (): ProxyItem[] => [
    {
        _id: '1',
        name: 'US East Proxy 1',
        host: 'proxy1.example.com',
        port: 8080,
        username: 'user1',
        password: 'pass1',
        protocol: 'http',
        isActive: true,
        location: 'US East',
        provider: 'ProxyProvider',
        lastUsed: new Date().toISOString(),
        successCount: 150,
        failureCount: 5,
        avgResponseTime: 250,
        assignedApiKey: 'sk-1234...abcd',
        notes: 'Primary US proxy',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        _id: '2',
        name: 'EU West Proxy 1',
        host: 'proxy2.example.com',
        port: 3128,
        protocol: 'https',
        isActive: true,
        location: 'EU West',
        provider: 'ProxyProvider',
        successCount: 89,
        failureCount: 11,
        avgResponseTime: 320,
        notes: 'European region proxy',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        _id: '3',
        name: 'Asia Pacific Proxy 1',
        host: 'proxy3.example.com',
        port: 1080,
        protocol: 'socks5',
        isActive: false,
        location: 'Asia Pacific',
        provider: 'ProxyProvider',
        successCount: 45,
        failureCount: 15,
        avgResponseTime: 450,
        assignedApiKey: 'sk-5678...efgh',
        notes: 'Currently inactive due to issues',
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
    },
];