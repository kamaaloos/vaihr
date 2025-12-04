import React, { useState, useEffect } from 'react';
import { Avatar } from 'react-native-paper';

interface AvatarWithFallbackProps {
  size: number;
  imageUrl?: string | null;
  fallbackLabel: string;
  style?: any;
  onTouchEnd?: () => void;
}

/**
 * Avatar component that automatically falls back to text avatar if image fails to load
 */
export const AvatarWithFallback: React.FC<AvatarWithFallbackProps> = ({
  size,
  imageUrl,
  fallbackLabel,
  style,
  onTouchEnd,
}) => {
  const [imageError, setImageError] = useState(false);

  // Reset error state when imageUrl changes
  useEffect(() => {
    setImageError(false);
  }, [imageUrl]);

  // Check if URL is valid
  const isValidUrl = imageUrl && 
    typeof imageUrl === 'string' && 
    imageUrl.trim() !== '' &&
    (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'));

  // If image error occurred or URL is invalid, show text avatar
  if (imageError || !isValidUrl) {
    return (
      <Avatar.Text
        size={size}
        label={fallbackLabel}
        style={style}
        onTouchEnd={onTouchEnd}
      />
    );
  }

  // Clean URL - remove query parameters that might cause issues
  const cleanUrl = imageUrl.trim().split('?')[0];

  // Try to show image avatar
  return (
    <Avatar.Image
      size={size}
      source={{ uri: cleanUrl }}
      style={style}
      onTouchEnd={onTouchEnd}
      onError={(error) => {
        // Silently handle error and fall back to text avatar
        const errorMessage = error?.nativeEvent?.error || error?.message || 'Unknown error';
        // Only log if it's not a 400 error (file not found) to reduce noise
        if (!errorMessage.includes('400') && !errorMessage.includes('Unexpected HTTP code')) {
          console.warn('AvatarWithFallback: Image failed to load, using text avatar:', {
            url: cleanUrl,
            error: errorMessage
          });
        }
        setImageError(true);
      }}
      onLoad={() => {
        // Reset error state on successful load
        setImageError(false);
      }}
    />
  );
};

