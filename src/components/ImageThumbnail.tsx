import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ImageItem {
  id: string;
  fileHandle: FileSystemFileHandle;
  fileName: string;
  path: string;
  size: number;
  thumbnailUrl?: string;
  lastModified: number;
  selected: boolean;
}

interface ImageThumbnailProps {
  image: ImageItem;
  onSelect: (id: string) => void;
  onLongPress: (id: string) => void;
  isFocused?: boolean;
  onLoad?: (id: string) => void;
}

export function ImageThumbnail({ image, onSelect, onLongPress, isFocused = false, onLoad }: ImageThumbnailProps) {
  const [isPressed, setIsPressed] = useState(false);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const pressStartTime = useRef<number>(0);
  const longPressTriggered = useRef<boolean>(false);

  const handlePressStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsPressed(true);
    pressStartTime.current = Date.now();
    longPressTriggered.current = false;

    pressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      onLongPress(image.id);
      setIsPressed(false);
    }, 500); // 500ms long press duration
  };

  const handlePressEnd = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();

    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }

    const pressDuration = Date.now() - pressStartTime.current;

    // Only trigger select if it was a short press and long press was NOT triggered
    if (pressDuration < 500 && isPressed && !longPressTriggered.current) {
      onSelect(image.id);
    }

    setIsPressed(false);
    longPressTriggered.current = false;
  };

  const handlePressCancel = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    setIsPressed(false);
    longPressTriggered.current = false;
  };

  useEffect(() => {
    return () => {
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
      }
    };
  }, []);

  return (
    <div
      className={cn(
        'relative w-full h-full bg-gray-200 rounded-lg overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-blue-500 select-none',
        image.selected && 'ring-2 ring-blue-600',
        isPressed && 'ring-4 ring-blue-400',
        isFocused && 'ring-4 ring-yellow-400 shadow-lg'
      )}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressCancel}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      onTouchCancel={handlePressCancel}
    >
      {image.thumbnailUrl ? (
        <img
          src={image.thumbnailUrl}
          alt={image.fileName}
          className="w-full h-full object-cover"
          onLoad={() => onLoad?.(image.id)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="animate-pulse bg-gray-300 w-full h-full" />
        </div>
      )}

      {image.selected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
          <svg
            className="w-4 h-4 text-white"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">
        {image.fileName}
      </div>
    </div>
  );
}
