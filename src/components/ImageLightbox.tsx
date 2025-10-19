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
  fullResUrl?: string;
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
  const currentIndex = allImages.findIndex(img => img.id === image.id);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < allImages.length - 1;

  // Use cached fullResUrl if available, fallback to thumbnail for instant display
  const displayUrl = image.fullResUrl || image.thumbnailUrl;
  const isLoading = !displayUrl;
  const isFullRes = !!image.fullResUrl;

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
      <DialogOverlay className="bg-black/98" />
      <DialogContent
        className="max-w-full w-screen h-screen p-0 m-0 border-0 bg-transparent shadow-none rounded-none"
        showCloseButton={false}
      >
        {/* Close button */}
        <Button
          variant="ghost"
          className="absolute top-2 right-2 text-white hover:bg-white hover:bg-opacity-20 z-10 h-10 w-10 p-0"
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
            className="absolute left-2 top-1/2 -translate-y-1/2 text-white hover:bg-white hover:bg-opacity-20 z-10 h-20 w-12"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('prev');
            }}
          >
            <svg
              className="w-10 h-10"
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
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white hover:bg-white hover:bg-opacity-20 z-10 h-20 w-12"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('next');
            }}
          >
            <svg
              className="w-10 h-10"
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
        <div className="absolute inset-0 flex items-center justify-center">
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white"></div>
            </div>
          ) : displayUrl ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={displayUrl}
                alt={image.fileName}
                className="object-contain"
                style={{ maxWidth: '90vw', height: '80vh' }}
              />
              {!isFullRes && (
                <div className="absolute top-6 left-6 bg-black bg-opacity-50 px-3 py-1 rounded text-white text-xs">
                  Loading full resolution...
                </div>
              )}
            </div>
          ) : (
            <div className="text-white text-center">
              <p>Failed to load image</p>
              <p className="text-sm text-gray-400 mt-2">{image.fileName}</p>
            </div>
          )}
        </div>

        {/* Image info */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white text-center bg-black bg-opacity-60 px-3 py-1.5 rounded">
          <p className="text-xs font-medium">{image.fileName}</p>
          <p className="text-xs text-gray-300">
            {currentIndex + 1} / {allImages.length}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
