
import React from 'react';

interface ModuleContainerProps {
  title: string;
  children: React.ReactNode;
  badge?: 'FREE' | 'PRO';
}

const ModuleContainer: React.FC<ModuleContainerProps> = ({ title, children, badge }) => {
  return (
    <div className="animate-fadeIn">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-2xl font-semibold text-gray-800">{title}</h2>
        {badge && (
          <span className={`px-3 py-1 text-xs font-bold rounded-full ${
            badge === 'FREE' 
              ? 'bg-green-100 text-green-700 border border-green-200' 
              : 'bg-amber-100 text-amber-700 border border-amber-200'
          }`}>
            {badge === 'FREE' ? '🆓 MIỄN PHÍ' : '👑 PRO'}
          </span>
        )}
      </div>
      {children}
    </div>
  );
};

export default ModuleContainer;