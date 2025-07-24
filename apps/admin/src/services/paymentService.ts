import axios from 'axios';

const API_BASE_URL = 'https://aistory-backend.onrender.com/api';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`🔄 API Request: ${config.method?.toUpperCase()} ${config.url}`, config.params || config.data);
    return config;
  },
  (error) => {
    console.error('❌ API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.config.url}`, response.data);
    return response;
  },
  (error) => {
    console.error('❌ API Response Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export interface PaymentStats {
  totalRevenue: number;
  totalPayments: number;
  completedPayments: number;
  pendingPayments: number;
  failedPayments: number;
  expiredPayments: number;
  revenueThisMonth: number;
  paymentsThisMonth: number;
  topPlanIds: Array<{
    planId: string;
    count: number;
    revenue: number;
  }>;
  recentPayments: Array<{
    _id: string;
    userId?: string;
    userKey?: string;
    planId?: string;
    price: number;
    status: 'pending' | 'completed' | 'failed' | 'expired' | 'refunded';
    createdAt: string;
    completedAt?: string;
    paymentMethod: string;
  }>;
}

export interface Payment {
  _id: string;
  userId?: string;
  userKey?: string;
  planId?: string;
  creditAmount?: number;
  price: number;
  status: 'pending' | 'completed' | 'failed' | 'expired' | 'refunded';
  paymentMethod: string;
  transactionId?: string;
  createdAt: string;
  completedAt?: string;
  expiredAt?: string;
  paymentData?: {
    payUrl?: string;
    qrCode?: string;
    bankAccount?: string;
    amount?: number;
    transferContent?: string;
    orderCode?: number;
    payosPaymentLinkId?: string;
  };
  metadata?: {
    ip?: string;
    userAgent?: string;
    referer?: string;
    userId?: string;
    planId?: string;
  };
  refundInfo?: {
    reason: string;
    refundAmount: number;
    refundedAt: string;
    refundedBy: string;
  };
  userInfo?: {
    username: string;
    email: string;
    registeredAt: string;
    isActive: boolean;
  };
  packageInfo?: {
    name: string;
    description: string;
    price: number;
    durationType: string;
    durationValue: number;
  };
}

export interface PaymentListResponse {
  success: boolean;
  payments: Payment[];
  pagination: {
    current: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface DailyStats {
  date: string;
  revenue: number;
  count: number;
}

// Fetch payment statistics for dashboard
export const fetchPaymentStats = async (): Promise<PaymentStats> => {
  try {
    const response = await apiClient.get('/admin/payments/stats');
    
    if (!response.data || !response.data.success) {
      throw new Error('Invalid response format');
    }
    
    // Destructure and return only the stats data
    const { success, ...stats } = response.data;
    return stats as PaymentStats;
    
  } catch (error: any) {
    console.error('❌ Error fetching payment stats:', error);
    throw new Error(error.response?.data?.error || 'Failed to fetch payment statistics');
  }
};

// Fetch payments list with filters and pagination
export const fetchPayments = async (
  page: number = 1,
  limit: number = 10,
  search: string = '',
  status: string = 'all',
  paymentMethod: string = 'all',
  startDate?: string,
  endDate?: string
): Promise<PaymentListResponse> => {
  try {
    const params: Record<string, any> = {
      page,
      limit,
      search,
      status,
      paymentMethod,
    };
    
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    
    const response = await apiClient.get('/admin/payments', { params });
    
    if (!response.data || !response.data.success) {
      throw new Error('Invalid response format');
    }
    
    return response.data as PaymentListResponse;
    
  } catch (error: any) {
    console.error('❌ Error fetching payments:', error);
    throw new Error(error.response?.data?.error || 'Failed to fetch payments');
  }
};

// Fetch payment details by ID
export const fetchPaymentDetails = async (paymentId: string): Promise<Payment> => {
  try {
    const response = await apiClient.get(`/admin/payments/${paymentId}`);
    
    if (!response.data || !response.data.success) {
      throw new Error('Invalid response format');
    }
    
    // Destructure and return payment data
    const { success, ...paymentData } = response.data;
    return paymentData as Payment;
    
  } catch (error: any) {
    console.error('❌ Error fetching payment details:', error);
    throw new Error(error.response?.data?.error || 'Failed to fetch payment details');
  }
};

// Admin complete payment manually
export const completePayment = async (
  paymentId: string,
  transactionId?: string,
  notes?: string
): Promise<{
  success: boolean;
  message: string;
  payment: Payment;
  newCreditBalance?: number;
}> => {
  try {
    const response = await apiClient.post(`/admin/payments/${paymentId}/complete`, {
      transactionId,
      notes,
    });
    
    if (!response.data || !response.data.success) {
      throw new Error(response.data?.error || 'Invalid response format');
    }
    
    return response.data;
    
  } catch (error: any) {
    console.error('❌ Error completing payment:', error);
    throw new Error(error.response?.data?.error || 'Failed to complete payment');
  }
};

// Admin refund payment
export const refundPayment = async (
  paymentId: string,
  reason?: string,
  refundAmount?: number
): Promise<{
  success: boolean;
  message: string;
  payment: Payment;
}> => {
  try {
    const response = await apiClient.post(`/admin/payments/${paymentId}/refund`, {
      reason,
      refundAmount,
    });
    
    if (!response.data || !response.data.success) {
      throw new Error(response.data?.error || 'Invalid response format');
    }
    
    return response.data;
    
  } catch (error: any) {
    console.error('❌ Error refunding payment:', error);
    throw new Error(error.response?.data?.error || 'Failed to refund payment');
  }
};

// Fetch daily revenue analytics
export const fetchDailyAnalytics = async (days: number = 30): Promise<{
  success: boolean;
  dailyStats: DailyStats[];
}> => {
  try {
    const response = await apiClient.get('/admin/payments/analytics/daily', {
      params: { days },
    });
    
    if (!response.data || !response.data.success) {
      throw new Error('Invalid response format');
    }
    
    return response.data;
    
  } catch (error: any) {
    console.error('❌ Error fetching daily analytics:', error);
    throw new Error(error.response?.data?.error || 'Failed to fetch daily analytics');
  }
};

// Export utility functions
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(amount);
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'completed': return 'green';
    case 'pending': return 'orange';
    case 'failed': return 'red';
    case 'expired': return 'default';
    case 'refunded': return 'purple';
    default: return 'default';
  }
};

export const getStatusText = (status: string): string => {
  switch (status) {
    case 'completed': return 'Hoàn thành';
    case 'pending': return 'Đang chờ';
    case 'failed': return 'Thất bại';
    case 'expired': return 'Hết hạn';
    case 'refunded': return 'Đã hoàn tiền';
    default: return status;
  }
};

export const getPaymentMethodText = (method: string): string => {
  switch (method) {
    case 'bank_transfer': return 'Chuyển khoản';
    case 'qr_code': return 'QR Code';
    case 'momo': return 'MoMo';
    case 'zalopay': return 'ZaloPay';
    default: return method;
  }
};
