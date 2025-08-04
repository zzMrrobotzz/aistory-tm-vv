import React from 'react';

interface CustomIconProps {
  src?: string;
  alt?: string;
  size?: number;
  className?: string;
  fallbackIcon?: React.ComponentType<{ className?: string; size?: number }>;
}

const CustomIcon: React.FC<CustomIconProps> = ({ 
  src, 
  alt = 'Custom Icon', 
  size = 20, 
  className = '',
  fallbackIcon: FallbackIcon
}) => {
  const [imageError, setImageError] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setIsLoading(false);
  };

  // If no src provided or image failed to load, show fallback
  if (!src || imageError) {
    if (FallbackIcon) {
      return <FallbackIcon className={className} size={size} />;
    }
    // Default fallback - simple square icon
    return (
      <div 
        className={`inline-block bg-gray-400 rounded ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div className="relative inline-block">
      {isLoading && (
        <div 
          className={`absolute inset-0 bg-gray-200 animate-pulse rounded ${className}`}
          style={{ width: size, height: size }}
        />
      )}
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
        onLoad={handleImageLoad}
        onError={handleImageError}
        style={{ 
          maxWidth: size, 
          maxHeight: size,
          objectFit: 'contain'
        }}
      />
    </div>
  );
};

export default CustomIcon;