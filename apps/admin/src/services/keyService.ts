import axios from 'axios';

// --- Base API Configuration ---
const API_BASE = process.env.REACT_APP_API_URL || "https://aistory-backend.onrender.com/api";

const apiClient = axios.create({
    baseURL: API_BASE,
    timeout: 30000, // 30 seconds timeout
    headers: {
        'Content-Type': 'application/json',
    },
});

// --- Mock Data for Fallback ---
const mockData = {
    dashboardStats: {
        totalKeys: 150,
        activeKeys: 120,
        totalRevenue: 2500000,
        monthlyRevenue: 450000,
        keyUsage: [
            { date: '2024-01', count: 45 },
            { date: '2024-02', count: 52 },
            { date: '2024-03', count: 48 },
            { date: '2024-04', count: 61 },
            { date: '2024-05', count: 58 },
            { date: '2024-06', count: 67 }
        ]
    },
    keys: [
        {
            id: '1',
            key: 'sk-1234567890abcdef',
            provider: 'OpenAI',
            status: 'active',
            credits: 1000,
            usedCredits: 250,
            createdAt: '2024-01-15T10:30:00Z',
            lastUsed: '2024-06-20T14:22:00Z'
        },
        {
            id: '2',
            key: 'sk-0987654321fedcba',
            provider: 'Anthropic',
            status: 'active',
            credits: 500,
            usedCredits: 180,
            createdAt: '2024-02-10T09:15:00Z',
            lastUsed: '2024-06-19T16:45:00Z'
        }
    ],
    providers: [
        { id: '1', name: 'OpenAI', status: 'active', keyCount: 5 },
        { id: '2', name: 'Anthropic', status: 'active', keyCount: 3 },
        { id: '3', name: 'Google', status: 'inactive', keyCount: 2 }
    ],
    auditLogs: [
        {
            id: '1',
            action: 'CREATE_KEY',
            userId: 'admin',
            details: 'Created new API key for OpenAI',
            timestamp: '2024-06-20T15:30:00Z'
        },
        {
            id: '2',
            action: 'UPDATE_CREDITS',
            userId: 'admin',
            details: 'Updated credits for key sk-1234567890abcdef',
            timestamp: '2024-06-20T14:22:00Z'
        }
    ],
    packages: [
        {
            id: '1',
            name: 'Basic Package',
            price: 100000,
            credits: 1000,
            duration: 30,
            status: 'active'
        },
        {
            id: '2',
            name: 'Premium Package',
            price: 250000,
            credits: 3000,
            duration: 30,
            status: 'active'
        }
    ]
};

// --- Backend Status Tracking ---
let isBackendAvailable = true;
let lastBackendCheck = 0;
const BACKEND_CHECK_INTERVAL = 60000; // 1 minute

export const getBackendStatus = () => isBackendAvailable;

const checkBackendStatus = async () => {
    const now = Date.now();
    if (now - lastBackendCheck < BACKEND_CHECK_INTERVAL) {
        console.log('📋 Using cached backend status:', isBackendAvailable);
        return isBackendAvailable;
    }

    try {
        console.log('🔍 Checking backend status...');
        await apiClient.get('/status');
        console.log('✅ Backend status check successful');
        isBackendAvailable = true;
        lastBackendCheck = now;
        return true;
    } catch (error: any) {
        console.warn('❌ Backend unavailable, using fallback data:', error.message);
        isBackendAvailable = false;
        lastBackendCheck = now;
        return false;
    }
};

// --- Centralized Error Handler with Fallback ---
const handleApiCall = async (apiCall: () => Promise<any>, fallbackData: any, context: string) => {
    try {
        const isAvailable = await checkBackendStatus();
        if (!isAvailable) {
            console.log(`Using fallback data for ${context}`);
            return fallbackData;
        }

        const result = await apiCall();
        return result;
    } catch (error) {
        console.error(`API Error in ${context}:`, error);
        console.log(`Falling back to mock data for ${context}`);
        return fallbackData;
    }
};

// --- API Functions with Fallback ---

export const fetchDashboardStats = async () => {
    return handleApiCall(
        async () => {
            const response = await apiClient.get('/stats/dashboard');
            if (response.data.success) {
                // Transform backend format to expected frontend format
                const stats = response.data;
                return {
                    totalKeys: stats.keyStats?.total || 0,
                    activeKeys: stats.keyStats?.active || 0,
                    totalRevenue: stats.billingStats?.totalRevenue || 0,
                    monthlyRevenue: stats.billingStats?.todayRevenue || 0,
                    billingStats: stats.billingStats,
                    apiUsageStats: stats.apiUsageStats,
                    keyUsage: [] // Will implement chart data later
                };
            }
            throw new Error('API response not successful');
        },
        mockData.dashboardStats,
        'fetchDashboardStats'
    );
};

export const fetchKeys = async () => {
    return handleApiCall(
        async () => {
            const response = await apiClient.get('/admin/keys');
            if (response.data.success) {
                return response.data.keys || [];
            }
            throw new Error('API response not successful');
        },
        mockData.keys,
        'fetchKeys'
    );
};

export const fetchApiProviders = async () => {
    return handleApiCall(
        async () => {
            console.log('📡 Fetching API providers...');
            const response = await apiClient.get('/providers');
            console.log('✅ API providers response:', response.data);
            return response.data;
        },
        mockData.providers,
        'fetchApiProviders'
    );
};

/**
 * Lấy thống kê chi tiết các API requests hôm nay theo từng provider.
 */
export const fetchDailyApiStats = async () => {
    return handleApiCall(
        async () => {
            console.log('📡 Fetching daily API stats...');
            const response = await apiClient.get('/admin/stats/daily-requests');
            console.log('✅ Daily API stats response:', response.data);
            return response.data?.data || response.data;
        },
        [], // Mock empty data for now
        'fetchDailyApiStats'
    );
};

export const fetchAuditLogs = async () => {
    return handleApiCall(
        async () => {
            const { data } = await apiClient.get('/audit-log');
            return data;
        },
        mockData.auditLogs,
        'fetchAuditLogs'
    );
};

export const fetchPackages = async () => {
    return handleApiCall(
        async () => {
            const { data } = await apiClient.get('/packages');
            return data;
        },
        mockData.packages,
        'fetchPackages'
    );
};

// --- Write Operations with Error Handling ---

export const createKey = async (payload: any) => {
    try {
        const isAvailable = await checkBackendStatus();
        if (!isAvailable) {
            throw new Error('Backend không khả dụng. Vui lòng thử lại sau.');
        }
        const { data } = await apiClient.post('/admin/keys', payload);
        return data;
    } catch (error) {
        console.error('Error creating key:', error);
        throw new Error(error.response?.data?.message || 'Không thể tạo key. Vui lòng thử lại.');
    }
};

export const updateCredit = async (key: string, amount: number) => {
    try {
        const isAvailable = await checkBackendStatus();
        if (!isAvailable) {
            throw new Error('Backend không khả dụng. Vui lòng thử lại sau.');
        }
        const { data } = await apiClient.post('/admin/keys/update-credit', { key, amount });
        return data;
    } catch (error) {
        console.error('Error updating credit:', error);
        throw new Error(error.response?.data?.message || 'Không thể cập nhật credit. Vui lòng thử lại.');
    }
};

export const updateKeyDetails = async (keyId: string, payload: any) => {
    try {
        const isAvailable = await checkBackendStatus();
        if (!isAvailable) {
            throw new Error('Backend không khả dụng. Vui lòng thử lại sau.');
        }
        const { data } = await apiClient.put(`/admin/keys/${keyId}/details`, payload);
        return data;
    } catch (error) {
        console.error('Error updating key details:', error);
        throw new Error(error.response?.data?.message || 'Không thể cập nhật thông tin key. Vui lòng thử lại.');
    }
};

export const updateKeyStatus = async (keyId: string, isActive: boolean) => {
    try {
        const isAvailable = await checkBackendStatus();
        if (!isAvailable) {
            throw new Error('Backend không khả dụng. Vui lòng thử lại sau.');
        }
        const { data } = await apiClient.put(`/admin/keys/${keyId}/status`, { isActive });
        return data;
    } catch (error) {
        console.error('Error updating key status:', error);
        throw new Error(error.response?.data?.message || 'Không thể cập nhật trạng thái key. Vui lòng thử lại.');
    }
};

export const createApiProvider = async (name: string) => {
    try {
        const isAvailable = await checkBackendStatus();
        if (!isAvailable) {
            throw new Error('Backend không khả dụng. Vui lòng thử lại sau.');
        }
        const { data } = await apiClient.post('/providers', { name });
        return data;
    } catch (error) {
        console.error('Error creating provider:', error);
        throw new Error(error.response?.data?.message || 'Không thể tạo provider. Vui lòng thử lại.');
    }
};

export const addApiKeyToProvider = async (providerId: string, apiKey: string) => {
    try {
        const isAvailable = await checkBackendStatus();
        if (!isAvailable) {
            throw new Error('Backend không khả dụng. Vui lòng thử lại sau.');
        }
        // FIX: Wrap the apiKey string in an object with the key "apiKey"
        const payload = { apiKey: apiKey };
        const { data } = await apiClient.post(`/providers/${providerId}/keys`, payload);
        return data;
    } catch (error) {
        console.error('Error adding key to provider:', error);
        throw new Error(error.response?.data?.message || 'Không thể thêm key vào provider. Vui lòng thử lại.');
    }
};

export const deleteApiKeyFromProvider = async (providerId: string, apiKeyId: string) => {
    try {
        const isAvailable = await checkBackendStatus();
        if (!isAvailable) {
            throw new Error('Backend không khả dụng. Vui lòng thử lại sau.');
        }
        const { data } = await apiClient.delete(`/providers/${providerId}/keys/${apiKeyId}`);
        return data;
    } catch (error) {
        console.error('Error deleting key from provider:', error);
        throw new Error(error.response?.data?.message || 'Không thể xóa key khỏi provider. Vui lòng thử lại.');
    }
};

export const createPackage = async (pkg: any) => {
    try {
        const isAvailable = await checkBackendStatus();
        if (!isAvailable) {
            throw new Error('Backend không khả dụng. Vui lòng thử lại sau.');
        }
        const { data } = await apiClient.post('/packages', pkg);
        return data;
    } catch (error) {
        console.error('Error creating package:', error);
        throw new Error(error.response?.data?.message || 'Không thể tạo package. Vui lòng thử lại.');
    }
};

export const updatePackage = async (packageId: string, pkg: any) => {
    try {
        const isAvailable = await checkBackendStatus();
        if (!isAvailable) {
            throw new Error('Backend không khả dụng. Vui lòng thử lại sau.');
        }
        const { data } = await apiClient.put(`/packages/${packageId}`, pkg);
        return data;
    } catch (error) {
        console.error('Error updating package:', error);
        throw new Error(error.response?.data?.message || 'Không thể cập nhật package. Vui lòng thử lại.');
    }
};

export const deletePackage = async (packageId: string) => {
    try {
        const isAvailable = await checkBackendStatus();
        if (!isAvailable) {
            throw new Error('Backend không khả dụng. Vui lòng thử lại sau.');
        }
        const { data } = await apiClient.delete(`/packages/${packageId}`);
        return data;
    } catch (error) {
        console.error('Error deleting package:', error);
        throw new Error(error.response?.data?.message || 'Không thể xóa package. Vui lòng thử lại.');
    }
};

// --- User Management Functions ---

export const fetchUsers = async (page = 1, limit = 10, search = '', status = 'all') => {
    return handleApiCall(
        async () => {
            const response = await apiClient.get('/admin/users', {
                params: { page, limit, search, status }
            });
            if (response.data.success) {
                return response.data;
            }
            throw new Error('API response not successful');
        },
        {
            users: [],
            pagination: { current: 1, pages: 1, total: 0 }
        },
        'fetchUsers'
    );
};

export const fetchUserStats = async () => {
    return handleApiCall(
        async () => {
            const response = await apiClient.get('/admin/users/stats/summary');
            if (response.data.success) {
                return response.data.stats;
            }
            throw new Error('API response not successful');
        },
        {
            totalUsers: 0,
            activeUsers: 0,
            inactiveUsers: 0,
            newUsersThisMonth: 0,
            recentUsers: []
        },
        'fetchUserStats'
    );
};

export const updateUserCredits = async (userId: string, credits: number) => {
    try {
        const isAvailable = await checkBackendStatus();
        if (!isAvailable) {
            throw new Error('Backend không khả dụng. Vui lòng thử lại sau.');
        }
        const { data } = await apiClient.put(`/admin/users/${userId}/credits`, { credits });
        return data;
    } catch (error) {
        console.error('Error updating user credits:', error);
        throw new Error(error.response?.data?.message || 'Không thể cập nhật credits. Vui lòng thử lại.');
    }
};

export const updateUserStatus = async (userId: string, isActive: boolean) => {
    try {
        const isAvailable = await checkBackendStatus();
        if (!isAvailable) {
            throw new Error('Backend không khả dụng. Vui lòng thử lại sau.');
        }
        const { data } = await apiClient.put(`/admin/users/${userId}/status`, { isActive });
        return data;
    } catch (error) {
        console.error('Error updating user status:', error);
        throw new Error(error.response?.data?.message || 'Không thể cập nhật trạng thái user. Vui lòng thử lại.');
    }
};

export const updateUserSubscription = async (userId: string, subscriptionType: string, subscriptionExpiresAt: string) => {
    try {
        const isAvailable = await checkBackendStatus();
        if (!isAvailable) {
            throw new Error('Backend không khả dụng. Vui lòng thử lại sau.');
        }
        const { data } = await apiClient.put(`/admin/users/${userId}/subscription`, { 
            subscriptionType, 
            subscriptionExpiresAt 
        });
        return data;
    } catch (error) {
        console.error('Error updating user subscription:', error);
        throw new Error(error.response?.data?.message || 'Không thể cập nhật subscription. Vui lòng thử lại.');
    }
};

// --- Backend Wake-up Function ---
export const wakeUpBackend = async () => {
    try {
        // Try with axios first
        await apiClient.get('/status');
        isBackendAvailable = true;
        lastBackendCheck = Date.now();
        console.log('✅ Backend connected successfully via axios');
        return true;
    } catch (error) {
        console.warn('❌ Axios request failed:', error.message);
        
        // Fallback: Try with fetch (no-cors mode for debugging)
        try {
            await fetch(`${API_BASE}/status`, {
                method: 'GET',
                mode: 'no-cors', // Bypass CORS for testing
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            console.log('🔄 Fetch with no-cors mode attempted');
            isBackendAvailable = true;
            lastBackendCheck = Date.now();
            return true;
        } catch (fetchError) {
            console.error('❌ Both axios and fetch failed:', fetchError.message);
            isBackendAvailable = false;
            lastBackendCheck = Date.now();
            return false;
        }
    }
}; 