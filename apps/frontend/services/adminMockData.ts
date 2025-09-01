import { AdminUser, ApiStatus, DashboardData, ManagedApiKey, Transaction, SuspiciousActivityEvent, Plan, ModuleCost, Coupon, Financials } from '../admin/types';
import { ActiveModule } from '../types';

export const mockUsers: AdminUser[] = [
  { id: '1', name: 'Nguyễn Văn A', email: 'nguyenvana@example.com', avatarUrl: 'https://i.pravatar.cc/150?u=1', planId: 'plan_pro', planName: 'Pro', status: 'Active', joinDate: '2023-10-26T10:00:00Z', lastLogin: '2024-07-28T14:30:00Z', creditWallets: { WRITING: 220, TTS: 50, IMAGE: 100 } },
  { id: '2', name: 'Trần Thị B', email: 'tranthib@example.com', avatarUrl: 'https://i.pravatar.cc/150?u=2', planId: 'plan_free', planName: 'Free', status: 'Active', joinDate: '2024-01-15T11:20:00Z', lastLogin: '2024-07-27T09:00:00Z', creditWallets: { WRITING: 5, TTS: 0, IMAGE: 1 } },
  { id: '3', name: 'Lê Văn C', email: 'levanc@example.com', avatarUrl: 'https://i.pravatar.cc/150?u=3', planId: 'plan_ent', planName: 'Enterprise', status: 'Active', joinDate: '2023-11-01T18:00:00Z', lastLogin: '2024-07-28T11:45:00Z', creditWallets: { WRITING: 750, TTS: 500, IMAGE: 1000 } },
  { id: '4', name: 'Phạm Thị D', email: 'phamthid@example.com', avatarUrl: 'https://i.pravatar.cc/150?u=4', planId: 'plan_pro', planName: 'Pro', status: 'Suspended', joinDate: '2024-03-20T08:10:00Z', lastLogin: '2024-06-10T18:20:00Z', creditWallets: { WRITING: 15, TTS: 2, IMAGE: 0 } },
  { id: '5', name: 'Hoàng Văn E', email: 'hoangvane@example.com', avatarUrl: 'https://i.pravatar.cc/150?u=5', planId: 'plan_free', planName: 'Free', status: 'Active', joinDate: '2024-07-25T15:00:00Z', lastLogin: '2024-07-28T10:05:00Z', creditWallets: { WRITING: 10, TTS: 5, IMAGE: 2 } },
];

export const mockApiStatus: ApiStatus[] = [
    { id: 'gemini', provider: 'Gemini', status: 'Operational', requestsToday: 12500, costToday: 12.50, rateLimitUsage: 65 },
    { id: 'elevenlabs', provider: 'ElevenLabs', status: 'Operational', requestsToday: 8300, costToday: 24.90, rateLimitUsage: 40 },
    { id: 'stability', provider: 'Stability AI', status: 'Degraded', requestsToday: 3200, costToday: 32.00, rateLimitUsage: 88 },
    { id: 'openai', provider: 'OpenAI', status: 'Error', requestsToday: 50, costToday: 0.50, rateLimitUsage: 100 },
    { id: 'deepseek', provider: 'DeepSeek', status: 'Operational', requestsToday: 1500, costToday: 1.50, rateLimitUsage: 20 },
];

export const mockDashboardData: DashboardData = {
    monthlyRevenue: 4850,
    revenueGoal: 10000,
    newUsers: 152,
    newUsersGoal: 500,
    activeUsers: 853,
    apiCosts: 71.40,
    profit: 4778.60,
    churnRate: 4.2,
    revenueHistory: [
        { name: 'Tháng 1', DoanhThu: 2400 },
        { name: 'Tháng 2', DoanhThu: 1398 },
        { name: 'Tháng 3', DoanhThu: 9800 },
        { name: 'Tháng 4', DoanhThu: 3908 },
        { name: 'Tháng 5', DoanhThu: 4800 },
        { name: 'Tháng 6', DoanhThu: 3800 },
        { name: 'Tháng 7', DoanhThu: 4300 },
    ],
    userGrowthHistory: [
        { name: 'T1', 'Người Dùng Mới': 80 },
        { name: 'T2', 'Người Dùng Mới': 95 },
        { name: 'T3', 'Người Dùng Mới': 110 },
        { name: 'T4', 'Người Dùng Mới': 105 },
        { name: 'T5', 'Người Dùng Mới': 140 },
        { name: 'T6', 'Người Dùng Mới': 130 },
        { name: 'T7', 'Người Dùng Mới': 152 },
    ],
};

export const mockFinancials: Financials = {
    mrr: 4850,
    churnRate: 4.2,
    totalRevenue: 52340,
    totalCosts: 856.80,
    profit: 51483.20,
    costVsRevenueHistory: [
        { name: 'Tháng 1', DoanhThu: 2400, ChiPhi: 50.2, LoiNhuan: 2349.8 },
        { name: 'Tháng 2', DoanhThu: 1398, ChiPhi: 35.5, LoiNhuan: 1362.5 },
        { name: 'Tháng 3', DoanhThu: 9800, ChiPhi: 150.7, LoiNhuan: 9649.3 },
        { name: 'Tháng 4', DoanhThu: 3908, ChiPhi: 65.1, LoiNhuan: 3842.9 },
        { name: 'Tháng 5', DoanhThu: 4800, ChiPhi: 88.0, LoiNhuan: 4712.0 },
        { name: 'Tháng 6', DoanhThu: 3800, ChiPhi: 75.4, LoiNhuan: 3724.6 },
        { name: 'Tháng 7', DoanhThu: 4300, ChiPhi: 71.4, LoiNhuan: 4228.6 },
    ],
    mrrHistory: [
        { name: 'T1', MRR: 2400 },
        { name: 'T2', MRR: 2800 },
        { name: 'T3', MRR: 3500 },
        { name: 'T4', MRR: 3800 },
        { name: 'T5', MRR: 4200 },
        { name: 'T6', MRR: 4500 },
        { name: 'T7', MRR: 4850 },
    ]
};

export const mockManagedApiKeys: ManagedApiKey[] = [
    { id: 'gem-1', provider: 'Gemini', nickname: 'Gemini Chính (Viết truyện)', key: 'AIzaSy...A1B2C3', status: 'Active', usage: '$15.32 / $100', lastChecked: '2024-07-28T10:00:00Z' },
    { id: 'gem-2', provider: 'Gemini', nickname: 'Gemini Phụ (Phân tích)', key: 'AIzaSy...X4Y5Z6', status: 'Active', usage: '$2.10 / $50', lastChecked: '2024-07-28T10:05:00Z' },
    { id: 'el-1', provider: 'ElevenLabs', nickname: 'ElevenLabs Pro', key: 'e1a2b3...c4d5e6', status: 'Active', usage: '1.2M / 2M ký tự', lastChecked: '2024-07-28T09:30:00Z' },
    { id: 'stab-1', provider: 'Stability AI', nickname: 'Stability AI - Gói 1000 credits', key: 'sk-abc...def123', status: 'Depleted', usage: '1000 / 1000 credits', lastChecked: '2024-07-27T18:00:00Z' },
    { id: 'oai-1', provider: 'OpenAI', nickname: 'DALL-E Key', key: 'sk-opn...xyz789', status: 'Inactive', usage: '$0.00 / $25', lastChecked: '2024-07-25T11:00:00Z' },
];

export const mockPlans: Plan[] = [
    { id: 'plan_free', name: 'Gói Miễn Phí', description: 'Trải nghiệm các tính năng cơ bản.', price: 0, is_active: true, credit_allowances: [
        { credit_type: 'WRITING', amount: 10 },
        { credit_type: 'IMAGE', amount: 2 },
    ]},
    { id: 'plan_pro', name: 'Gói Pro', description: 'Dành cho người dùng chuyên nghiệp với nhiều credits hơn.', price: 500000, is_active: true, credit_allowances: [
        { credit_type: 'WRITING', amount: 250 },
        { credit_type: 'TTS', amount: 50 },
        { credit_type: 'IMAGE', amount: 100 },
    ]},
    { id: 'plan_ent', name: 'Gói Enterprise', description: 'Giải pháp toàn diện cho doanh nghiệp.', price: 3000000, is_active: true, credit_allowances: [
        { credit_type: 'WRITING', amount: 1000 },
        { credit_type: 'TTS', amount: 500 },
        { credit_type: 'IMAGE', amount: 1000 },
        { credit_type: 'ANALYSIS', amount: 200 },
    ]},
    { id: 'plan_old', name: 'Gói Cũ (Ngừng hoạt động)', description: 'Gói cũ không còn áp dụng.', price: 200000, is_active: false, credit_allowances: []}
];

export const mockModuleCosts: ModuleCost[] = [
    { module_id: ActiveModule.SuperAgent, module_name: "Siêu Trợ Lý AI", credit_type: 'WRITING', cost: 5, is_active: true },
    { module_id: ActiveModule.CreativeLab, module_name: "Xây Dựng Truyện", credit_type: 'WRITING', cost: 1, is_active: true },
    { module_id: ActiveModule.ImageGenerationSuite, module_name: "Xưởng Tạo Ảnh AI", credit_type: 'IMAGE', cost: 2, is_active: true },
    { module_id: ActiveModule.WriteStory, module_name: "Viết Truyện & Hook", credit_type: 'WRITING', cost: 1, is_active: true },
    { module_id: ActiveModule.Rewrite, module_name: "Viết Lại", credit_type: 'WRITING', cost: 0.5, is_active: true },
    { module_id: ActiveModule.TTS, module_name: "Đọc Truyện AI", credit_type: 'TTS', cost: 1, is_active: true },
    { module_id: ActiveModule.Analysis, module_name: "Phân Tích Truyện", credit_type: 'ANALYSIS', cost: 2, is_active: false },
];

export const mockCoupons: Coupon[] = [
    { id: 'cp_1', code: 'GIAM50%', discount_type: 'percentage', value: 50, expires_at: '2024-12-31T23:59:59Z', status: 'active', usage_count: 12, usage_limit: 100 },
    { id: 'cp_2', code: 'TANG100K', discount_type: 'fixed_amount', value: 100000, expires_at: '2024-08-31T23:59:59Z', status: 'active', usage_count: 50, usage_limit: 50 },
    { id: 'cp_3', code: 'WELCOME20', discount_type: 'percentage', value: 20, expires_at: '2025-01-01T00:00:00Z', status: 'active', usage_count: 150, usage_limit: null },
    { id: 'cp_4', code: 'OLDCODE', discount_type: 'fixed_amount', value: 20000, expires_at: '2023-01-01T00:00:00Z', status: 'expired', usage_count: 200, usage_limit: 200 },
];

export const mockTransactions: Transaction[] = [
    { id: 'txn_1', userId: '1', userName: 'Nguyễn Văn A', description: 'Purchase: Gói Pro', amount: 500000, creditsChange: [{type: 'WRITING', change: 250}, {type: 'IMAGE', change: 100}], date: '2024-07-28T14:25:00Z', status: 'Completed' },
    { id: 'txn_2', userId: '5', userName: 'Hoàng Văn E', description: 'Manual Grant: Welcome gift', amount: 0, creditsChange: [{type: 'WRITING', change: 10}], date: '2024-07-28T10:00:00Z', status: 'Completed' },
    { id: 'txn_3', userId: '3', userName: 'Lê Văn C', description: 'Purchase: Gói Enterprise', amount: 3000000, creditsChange: [{type: 'WRITING', change: 1000}, {type: 'TTS', change: 500}], date: '2024-07-27T18:30:00Z', status: 'Completed' },
    { id: 'txn_4', userId: 'user_pending', userName: 'User Pending', description: 'Purchase: Gói Pro', amount: 500000, creditsChange: [], date: '2024-07-29T09:00:00Z', status: 'Pending' },
    { id: 'txn_5', userId: 'user_failed', userName: 'User Failed', description: 'Purchase: Gói Pro', amount: 500000, creditsChange: [], date: '2024-07-29T09:05:00Z', status: 'Failed' },
    { id: 'txn_6', userId: '1', userName: 'Nguyễn Văn A', description: 'Refund: Gói Pro', amount: -500000, creditsChange: [{type: 'WRITING', change: -250}], date: '2024-07-29T11:00:00Z', status: 'Refunded' },
];

export const mockSuspiciousActivity: SuspiciousActivityEvent[] = [
    { id: 'sa-1', userId: '2', userName: 'Trần Thị B', userEmail: 'tranthib@example.com', activityDescription: 'Sử dụng 50 credits trong vòng 10 phút.', timestamp: '2024-07-29T11:05:00Z', riskLevel: 'High', status: 'New' },
    { id: 'sa-2', userId: '4', userName: 'Phạm Thị D', userEmail: 'phamthid@example.com', activityDescription: 'Nhiều lần đăng nhập thất bại từ các địa chỉ IP khác nhau.', timestamp: '2024-07-29T10:30:00Z', riskLevel: 'Medium', status: 'New' },
    { id: 'sa-3', userId: '1', userName: 'Nguyễn Văn A', userEmail: 'nguyenvana@example.com', activityDescription: 'Tạo 20 câu chuyện hàng loạt chỉ trong 5 phút.', timestamp: '2024-07-28T23:15:00Z', riskLevel: 'Medium', status: 'Investigating' },
    { id: 'sa-4', userId: '3', userName: 'Lê Văn C', userEmail: 'levanc@example.com', activityDescription: 'Tỷ lệ yêu cầu API cao bất thường trong khung giờ thấp điểm.', timestamp: '2024-07-28T18:45:00Z', riskLevel: 'Low', status: 'Resolved' },
    { id: 'sa-5', userId: '5', userName: 'Hoàng Văn E', userEmail: 'hoangvane@example.com', activityDescription: 'Tốc độ sử dụng credit nhanh hơn 300% so với mức trung bình của tài khoản Free.', timestamp: '2024-07-28T15:00:00Z', riskLevel: 'Low', status: 'Resolved' },
];
