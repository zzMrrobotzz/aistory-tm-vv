import React from 'react';
import { AdminActiveModule } from './types';
import { LayoutDashboard, KeyRound, CreditCard, ShieldAlert, Cloud, Settings, LogOut, Cpu, Database, Wifi, Banknote, Gift, Users, UserCheck, PlayCircle, HelpCircle, Timer, Palette, BarChart3 } from 'lucide-react';
import CustomIcon from './components/CustomIcon';

interface AdminSidebarProps {
  activeModule: AdminActiveModule;
  setActiveModule: (module: AdminActiveModule) => void;
  onLogout?: () => void;
}

const NAVIGATION_ITEMS = [
  { id: 'dashboard', label: 'Tổng Quan', icon: LayoutDashboard },
  { id: 'userManagement', label: 'Quản Lý Người Dùng', icon: Users },
  { id: 'onlineUsers', label: 'Người Dùng Online', icon: UserCheck },
  { id: 'tutorials', label: 'Hướng Dẫn', icon: PlayCircle },
  { id: 'supportContent', label: 'Nội Dung Hỗ Trợ', icon: HelpCircle },
  { id: 'rateLimiting', label: 'Quản Lý Rate Limiting', icon: Timer },
  { id: 'featureUsageManagement', label: 'Giới Hạn Tính Năng', icon: BarChart3 },
  { id: 'keyManagement', label: 'Quản Lý Key', icon: KeyRound },
  { id: 'apiProviders', label: 'Quản Lý API Providers', icon: Cpu },
  { id: 'apiKeyPool', label: 'Quản lý Kho Key', icon: Database },
  { id: 'proxyManagement', label: 'Quản Lý Proxy', icon: Wifi },
  { id: 'billing', label: 'Gói Cước & Thanh Toán', icon: CreditCard },
  { id: 'bankInfo', label: 'Thông Tin Ngân Hàng', icon: Banknote },
  { id: 'subscriptionPlans', label: 'Quản Lý Gói Cước', icon: Gift },
  { id: 'suspiciousActivity', label: 'Giám Sát & Log', icon: ShieldAlert },
  { id: 'apis', label: 'Theo Dõi API', icon: Cloud },
  { id: 'iconManager', label: 'Quản Lý Icons', icon: Palette },
  { id: 'settings', label: 'Cài Đặt Hệ Thống', icon: Settings },
];

const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeModule, setActiveModule, onLogout }) => {
  return (
    <aside className="w-64 bg-slate-900 text-slate-300 p-4 flex flex-col h-screen fixed top-0 left-0">
      <div className="text-center mb-10 pt-4">
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold text-white tracking-wider">ADMIN</span>
          <span className="text-sm font-semibold text-sky-400">AI Story Creator</span>
        </div>
      </div>
      <nav className="flex-grow">
        <ul>
          {NAVIGATION_ITEMS.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => setActiveModule(item.id as AdminActiveModule)}
                className={`flex items-center w-full text-left px-4 py-3 rounded-lg transition-all duration-200 ease-in-out font-medium text-sm mb-2
                            ${activeModule === item.id 
                                ? 'bg-sky-600 text-white shadow-lg' 
                                : 'hover:bg-slate-700/50 hover:text-white'
                            }`}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="text-center p-4 text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} Đức Đại MMO</p>
        <p>Admin Control Panel</p>
      </div>
      {onLogout && (
        <button
          onClick={onLogout}
          className="flex items-center justify-center w-full mt-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <LogOut className="mr-2 h-5 w-5" /> Đăng xuất
        </button>
      )}
    </aside>
  );
};

export default AdminSidebar; 