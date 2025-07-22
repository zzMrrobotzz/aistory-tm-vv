
import React from 'react';

interface ModuleContainerProps {
  title: string;
  children: React.ReactNode;
}

const ModuleContainer: React.FC<ModuleContainerProps> = ({ title, children }) => {
  return (
    <div className="animate-fadeIn">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">{title}</h2>
      {children}
    </div>
  );
};

export default ModuleContainer;