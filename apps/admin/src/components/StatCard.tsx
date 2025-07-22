import React from 'react';
import { LucideProps } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative';
  Icon: React.ElementType<LucideProps>;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, change, changeType, Icon }) => {
  const changeColor = changeType === 'positive' ? 'text-green-500' : 'text-red-500';

  return (
    <div className="bg-white p-6 rounded-xl shadow-md flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        {change && (
          <p className={`text-xs mt-2 ${changeColor}`}>
            {change} so với tháng trước
          </p>
        )}
      </div>
      <div className="bg-sky-100 text-sky-600 p-3 rounded-full">
        <Icon className="h-6 w-6" />
      </div>
    </div>
  );
};

export default StatCard; 