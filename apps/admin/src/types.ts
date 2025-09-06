export type AdminActiveModule =
  | 'dashboard'
  | 'userManagement' // Quản lý người dùng mới
  | 'onlineUsers' // Theo dõi người dùng online
  | 'tutorials' // Quản lý hướng dẫn video
  | 'supportContent' // Quản lý nội dung hỗ trợ
  | 'rateLimiting' // Quản lý rate limiting
  | 'featureUsageManagement' // Quản lý feature usage limits
  | 'keyManagement' // Hợp nhất user và key
  | 'apiProviders' // Quản lý API provider keys
  | 'apiKeyPool' // Quản lý kho API key
  | 'proxyManagement' // Quản lý proxy
  | 'billing'
  | 'bankInfo' // Quản lý thông tin ngân hàng
  | 'subscriptionPlans' // Thay thế creditPackages
  | 'suspiciousActivity'
  | 'apis'
  | 'iconManager' // Quản lý icons tùy chỉnh
  | 'settings';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  plan: 'Free' | 'Pro' | 'Enterprise';
  status: 'Active' | 'Suspended';
  joinDate: string; // ISO string
  lastLogin: string; // ISO string
  credits: number; // Renamed from creditsUsed to represent balance
}

export interface ApiStatus {
  id: string;
  provider: 'Gemini' | 'ElevenLabs' | 'Stability AI' | 'OpenAI' | 'DeepSeek';
  status: 'Operational' | 'Degraded' | 'Error';
  requestsToday: number;
  costToday: number; // in USD
  rateLimitUsage: number; // percentage
}

export interface DashboardData {
  totalKeys: number;
  activeKeys: number;
  expiredKeys: number;
  totalCredit: number;
  totalActiveCredit: number;
  // Các số liệu khác nếu có
}

export type ApiProviderType = 'Gemini' | 'ElevenLabs' | 'Stability AI' | 'OpenAI' | 'DeepSeek';

export interface ManagedApiKey {
  id: string;
  provider: ApiProviderType;
  nickname: string;
  key: string; // The actual key
  status: 'Active' | 'Inactive' | 'Depleted';
  usage: string; // e.g., "150k/1M credits" or "$15.2 / $50.0"
  lastChecked: string; // ISO string
}

// Types for Billing/Credit System
export interface CreditPackage {
  _id: string;
  name: string;
  price: number;
  credits: number;
  bonus?: string;
  isPopular?: boolean;
  isActive?: boolean;
}

export interface Transaction {
  id: string;
  userId: string;
  userName: string;
  packageId: string;
  packageName: string;
  amount: number; // in VND
  creditsGranted: number;
  date: string; // ISO string
  status: 'Completed' | 'Pending' | 'Failed';
}

// Type for Suspicious Activity Monitoring
export interface SuspiciousActivityEvent {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  activityDescription: string;
  timestamp: string; // ISO string
  riskLevel: 'High' | 'Medium' | 'Low';
  status: 'New' | 'Investigating' | 'Resolved';
}

export interface AdminKey {
  _id: string;  // Backend dùng _id
  id?: string;  // Frontend alias cho _id
  key: string;
  credit: number;
  note: string;
  expiredAt: string | null;
  createdAt: string;
  isActive: boolean;
  maxActivations: number; // Từ backend
  isTrial?: boolean; // Optional vì backend không có
  __v?: number; // MongoDB version key
}

export interface ManagedApiProvider {
  _id: string; // Backend dùng _id
  id?: string; // Frontend alias
  name: string; // Đổi từ provider
  status: 'Operational' | 'Degraded' | 'Error' | 'Unknown'; // Đồng bộ với backend
  costToday: number;
  totalRequests: number;
  dailyRequests?: number; // Thống kê request hôm nay
  successfulRequests?: number; // Request thành công hôm nay
  failedRequests?: number; // Request thất bại hôm nay
  successRate?: string; // Tỷ lệ thành công (%)
  totalTokensToday?: number; // Tổng tokens sử dụng hôm nay
  avgResponseTime?: number; // Thời gian phản hồi trung bình (ms)
  lastChecked: string;
  apiKeys: string[]; // Thêm trường còn thiếu
}

// Proxy Management Types
export interface ProxyItem {
  _id: string;
  name: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol: 'http' | 'https' | 'socks4' | 'socks5';
  isActive: boolean;
  location: string;
  provider: string;
  lastUsed?: string;
  successCount: number;
  failureCount: number;
  avgResponseTime: number;
  assignedApiKey?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProxyStats {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgResponseTime: number;
  lastUsed?: string;
  isAssigned: boolean;
}

export interface ProxyTestResult {
  success: boolean;
  ip?: string;
  responseTime?: number;
  error?: string;
  message: string;
}

export interface ProxyBatchTestResult {
  results: Array<{
    proxyId: string;
    name: string;
    host: string;
    port: number;
    success: boolean;
    responseTime?: number;
    error?: string;
  }>;
  summary: {
    total: number;
    success: number;
    failed: number;
    successRate: number;
  };
}

export interface ProxyStatistics {
  overview: {
    total: number;
    active: number;
    assigned: number;
    available: number;
    recentActivity: number;
    assignmentRate: number;
  };
  locationStats: Array<{ _id: string; count: number }>;
  protocolStats: Array<{ _id: string; count: number }>;
  providerStats: Array<{ _id: string; count: number }>;
  topPerformers?: Array<{
    name: string;
    endpoint: string;
    successRate: number;
    avgResponseTime: number;
  }>;
} 