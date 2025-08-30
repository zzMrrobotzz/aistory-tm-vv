import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface AnnouncementBannerProps {
  messages: string[];
  onClose?: () => void;
}

const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({ messages, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Filter out empty messages
  const validMessages = messages.filter(msg => msg.trim() !== '');

  // Rotate through messages every 8 seconds
  useEffect(() => {
    if (validMessages.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % validMessages.length);
    }, 8000); // 8 seconds per message

    return () => clearInterval(interval);
  }, [validMessages.length]);

  if (validMessages.length === 0 || !isVisible) {
    return null;
  }

  const currentMessage = validMessages[currentIndex] || '';

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white relative overflow-hidden z-50">
      <div className="relative h-12 flex items-center">
        {/* Scrolling text container - from right to left across full screen */}
        <div className="absolute inset-0 flex items-center overflow-hidden">
          <div 
            className="animate-marquee-fullscreen whitespace-nowrap text-lg font-medium"
            key={currentIndex} // Force re-render animation when message changes
          >
            📢 {currentMessage}
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
        
        {/* Message indicator dots */}
        {validMessages.length > 1 && (
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 flex space-x-1 z-10">
            {validMessages.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentIndex ? 'bg-white' : 'bg-white/40'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnnouncementBanner;