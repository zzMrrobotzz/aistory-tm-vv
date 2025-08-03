import React, { useState } from 'react';
import AdminSidebar from './AdminSidebar';
import AdminDashboard from './pages/AdminDashboard';
import AdminApiKeyManagement from './pages/AdminApiKeyManagement';
import AdminApiProviders from './pages/AdminApiProviders';
import AdminApiMonitoring from './pages/AdminApiMonitoring';
import AdminBilling from './pages/AdminBilling';
import AdminSuspiciousActivity from './pages/AdminSuspiciousActivity';
import AdminLogin from './pages/AdminLogin';
import AdminApiKeyPool from './pages/AdminApiKeyPool';
import AdminProxyManagement from './pages/AdminProxyManagement';
import AdminSettings from './pages/AdminSettings';
import AdminBankInfo from './pages/AdminBankInfo';
import AdminSubscriptionPlans from './pages/AdminSubscriptionPlans'; // Đổi từ CreditPackages
import AdminUserManagement from './pages/AdminUserManagement'; // Thêm mới
import AdminOnlineUsers from './pages/AdminOnlineUsers'; // Thêm mới
import AdminTutorials from './pages/AdminTutorials'; // Quản lý hướng dẫn
import { AdminActiveModule } from './types';

const AdminApp: React.FC = () => {
  const [activeModule, setActiveModule] = useState<AdminActiveModule>('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('admin_logged_in'));

  const handleLogout = () => {
    localStorage.removeItem('admin_logged_in');
    setIsLoggedIn(false);
  };

  if (!isLoggedIn) {
    return <AdminLogin onLogin={() => setIsLoggedIn(true)} />;
  }

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return <AdminDashboard />;
      case 'keyManagement':
        return <AdminApiKeyManagement />;
      case 'userManagement': // Thêm mới
        return <AdminUserManagement />;
      case 'onlineUsers': // Thêm mới
        return <AdminOnlineUsers />;
      case 'tutorials': // Quản lý hướng dẫn
        return <AdminTutorials />;
      case 'apiProviders':
        return <AdminApiProviders />;
      case 'apiKeyPool':
        return <AdminApiKeyPool />;
      case 'proxyManagement':
        return <AdminProxyManagement />;
      case 'apis':
        return <AdminApiMonitoring />;
      case 'billing': 
        return <AdminBilling />;
      case 'bankInfo':
        return <AdminBankInfo />;
      case 'subscriptionPlans': // Đổi từ creditPackages
        return <AdminSubscriptionPlans />;
      case 'suspiciousActivity':
        return <AdminSuspiciousActivity />;
      case 'settings':
        return <AdminSettings />;
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100 font-sans">
      <AdminSidebar activeModule={activeModule} setActiveModule={setActiveModule} onLogout={handleLogout} />
      <main className="flex-1 ml-64 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {renderActiveModule()}
        </div>
      </main>
    </div>
  );
};

export default AdminApp; 