import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogOverlay } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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

interface ImageLightboxProps {
  image: ImageItem;
  allImages: ImageItem[];
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
}

export function ImageLightbox({ image, allImages, onClose, onNavigate }: ImageLightboxProps) {
  const [fullResUrl, setFullResUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const currentIndex = allImages.findIndex(img => img.id === image.id);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < allImages.length - 1;

  useEffect(() => {
    const loadFullResolution = async () => {
      try {
        setIsLoading(true);
        const file = await image.fileHandle.getFile();
        const url = URL.createObjectURL(file);
        setFullResUrl(url);
      } catch (error) {
        console.error('Failed to load full resolution image:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFullResolution();

    return () => {
      if (fullResUrl) {
        URL.revokeObjectURL(fullResUrl);
      }
    };
  }, [image]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasPrevious) {
        onNavigate('prev');
      } else if (e.key === 'ArrowRight' && hasNext) {
        onNavigate('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasPrevious, hasNext, onClose, onNavigate]);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogOverlay className="bg-black/95" />
      <DialogContent
        className="max-w-[95vw] w-fit h-[95vh] p-0 border-0 bg-transparent shadow-none"
        showCloseButton={false}
      >
        {/* Close button */}
        <Button
          variant="ghost"
          className="absolute top-4 right-4 text-white hover:bg-white hover:bg-opacity-20 z-10"
          onClick={onClose}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Button>

        {/* Previous button */}
        {hasPrevious && (
          <Button
            variant="ghost"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white hover:bg-opacity-20 z-10 h-16 w-16"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('prev');
            }}
          >
            <svg
              className="w-8 h-8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </Button>
        )}

        {/* Next button */}
        {hasNext && (
          <Button
            variant="ghost"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white hover:bg-opacity-20 z-10 h-16 w-16"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('next');
            }}
          >
            <svg
              className="w-8 h-8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        )}

        {/* Image container */}
        <div className="w-full h-full flex items-center justify-center">
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white"></div>
            </div>
          ) : fullResUrl ? (
            <img
              src={fullResUrl}
              alt={image.fileName}
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <div className="text-white text-center">
              <p>Failed to load image</p>
              <p className="text-sm text-gray-400 mt-2">{image.fileName}</p>
            </div>
          )}
        </div>

        {/* Image info */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-center bg-black bg-opacity-50 px-4 py-2 rounded-lg">
          <p className="text-sm font-medium">{image.fileName}</p>
          <p className="text-xs text-gray-300 mt-1">
            {currentIndex + 1} of {allImages.length}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
