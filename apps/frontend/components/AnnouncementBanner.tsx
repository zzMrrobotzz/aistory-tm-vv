import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface AnnouncementBannerProps {
  message: string;
  onClose?: () => void;
}

const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({ message, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  if (!message || !isVisible) {
    return null;
  }

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white relative overflow-hidden z-50">
      <div className="relative h-12 flex items-center">
        {/* Scrolling text container */}
        <div className="absolute inset-0 flex items-center overflow-hidden">
          <div className="animate-marquee whitespace-nowrap text-lg font-medium">
            📢 {message}
          </div>
        </div>
        
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 hover:bg-white/20 rounded-full p-1 transition-colors z-10"
          aria-label="Đóng thông báo"
        >
          <X size={20} />
        </button>
      </div>

    </div>
  );
};

export default AnnouncementBanner;