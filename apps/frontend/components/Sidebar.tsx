

import React, { useState, useEffect } from 'react';
import { ActiveModule, UserProfile } from '../types';
import { NAVIGATION_GROUPS } from '../constants';
import { ChevronDown, LogOut, User } from 'lucide-react';

interface SidebarProps {
  activeModule: ActiveModule;
  setActiveModule: (module: ActiveModule) => void;
  currentUser?: UserProfile | null;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeModule, setActiveModule, currentUser, onLogout }) => {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Find the group that contains the active module and open it.
    const currentGroup = NAVIGATION_GROUPS.find(group => 
        group.subItems.some(item => item.id === activeModule)
    );
    if (currentGroup && !openGroups[currentGroup.title]) {
        setOpenGroups(prev => ({ ...prev, [currentGroup.title]: true }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModule]);

  const toggleGroup = (title: string) => {
    setOpenGroups(prev => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <aside className="w-64 bg-gray-800 text-gray-300 p-5 flex flex-col h-screen fixed top-0 left-0 overflow-y-auto">
      <div className="text-center mb-8">
        {/* Updated title structure */}
        <div className="flex flex-col items-center">
          <span className="text-2xl font-semibold text-white">AI Story</span>
          <span className="text-xl font-semibold text-white -mt-0.5"> 
            ALL IN ONE
          </span>
        </div>
        <div className="bg-white/10 text-white py-1 px-3 rounded-full text-xs font-bold inline-block mt-2">
          Phiên Bản 1.1
        </div>
      </div>
      <nav className="flex-grow">
        {NAVIGATION_GROUPS.map((group) => (
          <div key={group.title} className="mb-2">
            <button
              onClick={() => toggleGroup(group.title)}
              className="flex items-center justify-between w-full text-left px-4 py-3 rounded-lg transition-all duration-200 ease-in-out font-semibold text-base mb-1 bg-gray-700/50 hover:bg-gray-700"
              aria-expanded={!!openGroups[group.title]}
            >
              <span className="flex items-center">
                  <span className="mr-3 text-lg">{group.icon}</span>
                  {group.title}
              </span>
              <ChevronDown
                className={`h-5 w-5 transition-transform duration-300 ${openGroups[group.title] ? 'rotate-180' : ''}`}
              />
            </button>
            <div
                className={`transition-all duration-500 ease-in-out overflow-hidden ${openGroups[group.title] ? 'max-h-[500px]' : 'max-h-0'}`}
            >
                <div className="pl-4 border-l-2 border-gray-700 ml-4 py-1">
                {group.subItems.map((item) => (
                    <button
                    key={item.id}
                    onClick={() => setActiveModule(item.id)}
                    className={`flex items-center w-full text-left px-4 py-3 rounded-lg transition-all duration-200 ease-in-out font-medium text-sm mt-1
                                ${activeModule === item.id 
                                    ? 'bg-indigo-600 text-white shadow-md' 
                                    : 'hover:bg-gray-700 hover:text-white'
                                }`}
                    >
                    <span className="mr-3">{item.icon}</span>
                    {item.label}
                    </button>
                ))}
                </div>
            </div>
          </div>
        ))}
      </nav>
      
      {/* User Info & Logout Section */}
      <div className="border-t border-gray-700 pt-4 mt-4">
        {currentUser && (
          <div className="flex items-center px-4 py-2 mb-3 text-sm">
            <User className="w-4 h-4 mr-2" />
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{currentUser.username}</p>
              <p className="text-gray-400 text-xs">
                {currentUser.subscriptionType === 'lifetime' ? 'Lifetime' : 
                 currentUser.subscriptionType === 'monthly' ? 'Monthly' : 'Free'}
              </p>
            </div>
          </div>
        )}
        
        <button
          onClick={onLogout}
          className="flex items-center w-full text-left px-4 py-3 rounded-lg transition-all duration-200 ease-in-out font-medium text-sm hover:bg-red-600 hover:text-white text-red-400"
        >
          <LogOut className="w-4 h-4 mr-3" />
          Đăng xuất
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;