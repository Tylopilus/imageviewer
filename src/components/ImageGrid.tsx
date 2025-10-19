import { ImageThumbnail } from './ImageThumbnail';

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

type GridMode = '5x5' | '6x4';

interface ImageGridProps {
  images: ImageItem[];
  gridMode: GridMode;
  onSelectImage: (id: string) => void;
  onLongPressImage: (id: string) => void;
  focusedIndex: number;
  pageStartIndex: number;
  onThumbnailLoad?: (id: string) => void;
}

export function ImageGrid({ images, gridMode, onSelectImage, onLongPressImage, focusedIndex, pageStartIndex, onThumbnailLoad }: ImageGridProps) {
  const gridCols = gridMode === '5x5' ? 'grid-cols-5' : 'grid-cols-6';
  const gridRows = gridMode === '5x5' ? 'grid-rows-5' : 'grid-rows-4';

  return (
    <div className={`grid ${gridCols} ${gridRows} gap-4 p-4 h-full`}>
      {images.map((image, index) => {
        const globalIndex = pageStartIndex + index;
        return (
          <ImageThumbnail
            key={image.id}
            image={image}
            onSelect={onSelectImage}
            onLongPress={onLongPressImage}
            onLoad={onThumbnailLoad}
            isFocused={globalIndex === focusedIndex}
          />
        );
      })}
    </div>
  );
}
