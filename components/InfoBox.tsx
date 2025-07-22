
import React from 'react';

interface InfoBoxProps {
  children: React.ReactNode;
  variant?: 'info' | 'warning';
}

const InfoBox: React.FC<InfoBoxProps> = ({ children, variant = 'info' }) => {
  let boxClasses = "p-4 rounded-md my-4 text-sm";
  if (variant === 'info') {
    boxClasses += " bg-blue-50 border-l-4 border-blue-500 text-blue-700";
  } else if (variant === 'warning') {
    boxClasses += " bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700";
  }

  return (
    <div className={boxClasses}>
      {children}
    </div>
  );
};

export default InfoBox;