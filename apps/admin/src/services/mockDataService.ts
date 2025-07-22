// Mock data service để fallback khi backend không khả dụng
export const mockDataService = {
  // Mock data cho dashboard stats
  dashboardStats: {
    billingStats: {
      totalRevenue: 125000000, // 125 triệu VNĐ
      monthlyTransactions: 45
    },
    apiUsageStats: {
      totalRequests: 15234,
      costToday: 12.45
    }
  },

  // Mock data cho keys
  keys: [
    {
      _id: "mock-key-1",
      key: "TV-DEMO-2024-001",
      isActive: true,
      credit: 1000,
      expiredAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 ngày
      note: "Demo key cho testing",
      maxActivations: 100,
      activationCount: 15,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: "mock-key-2", 
      key: "TV-PROD-2024-002",
      isActive: true,
      credit: 5000,
      expiredAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 ngày
      note: "Production key",
      maxActivations: 500,
      activationCount: 234,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: "mock-key-3",
      key: "TV-EXPIRED-001", 
      isActive: false,
      credit: 0,
      expiredAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Hết hạn 7 ngày trước
      note: "Expired key",
      maxActivations: 50,
      activationCount: 50,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ],

  // Mock data cho API providers
  apiProviders: [
    {
      _id: "mock-provider-1",
      name: "OpenAI GPT-4",
      status: "Operational",
      costToday: 8.25,
      apiKeys: ["sk-mock-key-1", "sk-mock-key-2"],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: "mock-provider-2", 
      name: "Google Gemini Pro",
      status: "Operational",
      costToday: 3.15,
      apiKeys: ["gem-mock-key-1"],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: "mock-provider-3",
      name: "Deepseek V3",
      status: "Degraded",
      costToday: 1.05,
      apiKeys: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ],

  // Mock data cho audit logs
  auditLogs: [
    {
      _id: "mock-log-1",
      action: "CREATE_KEY",
      details: "Tạo key mới TV-DEMO-2024-001",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 giờ trước
      userId: "admin",
      ip: "192.168.1.1"
    },
    {
      _id: "mock-log-2",
      action: "UPDATE_CREDIT", 
      details: "Cộng 1000 credit cho key TV-PROD-2024-002",
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 giờ trước
      userId: "admin",
      ip: "192.168.1.1"
    },
    {
      _id: "mock-log-3",
      action: "REVOKE_KEY",
      details: "Thu hồi key TV-EXPIRED-001",
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 giờ trước
      userId: "admin", 
      ip: "192.168.1.1"
    }
  ],

  // Mock data cho packages
  packages: [
    {
      _id: "mock-package-1",
      name: "Gói Cơ Bản",
      credits: 1000,
      price: 50000, // 50k VNĐ
      isActive: true,
      description: "Gói dành cho người dùng cá nhân"
    },
    {
      _id: "mock-package-2",
      name: "Gói Pro",
      credits: 5000,
      price: 200000, // 200k VNĐ  
      isActive: true,
      description: "Gói dành cho doanh nghiệp nhỏ"
    },
    {
      _id: "mock-package-3",
      name: "Gói Enterprise", 
      credits: 20000,
      price: 750000, // 750k VNĐ
      isActive: true,
      description: "Gói dành cho doanh nghiệp lớn"
    }
  ]
};

// Helper function để simulate network delay
export const simulateNetworkDelay = (ms: number = 1000) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}; 