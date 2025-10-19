import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ImageGrid } from '@/components/ImageGrid';
import { ImageLightbox } from '@/components/ImageLightbox';
import { scanFolder, createThumbnail, checkFileSystemSupport, exportSelectedImages } from '@/utils/fileSystem';
import {
  initDatabase,
  createSession,
  updateSession,
  saveImage,
  updateImageSelection,
  getSessionImages,
  getSession,
  findSessionByFolderName,
  exportDatabase,
  importDatabase
} from '@/utils/database';

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

function App() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [gridMode, setGridMode] = useState<GridMode>('5x5');
  const [folderHandle, setFolderHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [dbInitialized, setDbInitialized] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });
  const [lightboxImageId, setLightboxImageId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  // Initialize database
  useEffect(() => {
    const init = async () => {
      try {
        await initDatabase();
        setDbInitialized(true);
        console.log('Database initialized successfully');
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };
    init();
  }, []);

  useEffect(() => {
    setIsSupported(checkFileSystemSupport());

    // Load placeholder images for testing
    const placeholderImages: ImageItem[] = Array.from({ length: 70 }, (_, i) => ({
      id: `placeholder-${i}`,
      fileHandle: null as any,
      fileName: `Image ${i + 1}.jpg`,
      path: `placeholder-${i}.jpg`,
      size: 1024000,
      thumbnailUrl: `https://picsum.photos/seed/${i}/400/400`,
      lastModified: Date.now(),
      selected: false,
    }));
    setImages(placeholderImages);

    // Create a test session for placeholder images
    if (dbInitialized) {
      const sessionId = createSession('Placeholder Images', '5x5');
      setCurrentSessionId(sessionId);

      // Save placeholder images to database
      placeholderImages.forEach(img => {
        saveImage(sessionId, {
          fileName: img.fileName,
          filePath: img.path,
          size: img.size,
          lastModified: img.lastModified,
          selected: img.selected,
          thumbnailData: img.thumbnailUrl,
        });
      });
    }
  }, [dbInitialized]);

  const imagesPerPage = gridMode === '5x5' ? 25 : 24;
  const totalPages = Math.ceil(images.length / imagesPerPage);
  const startIdx = currentPage * imagesPerPage;
  const endIdx = startIdx + imagesPerPage;
  const currentImages = images.slice(startIdx, endIdx);
  const selectedCount = images.filter((img) => img.selected).length;

  const handleSelectFolder = async () => {
    if (!isSupported) {
      alert('File System Access API is not supported in your browser. Please use Chrome, Edge, or Opera.');
      return;
    }

    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
      setFolderHandle(dirHandle);
      setIsLoading(true);

      const folderName = dirHandle.name;

      // Check if session exists for this folder
      let sessionId: number;
      let existingSession = null;

      if (dbInitialized) {
        existingSession = findSessionByFolderName(folderName);
      }

      const scannedImages = await scanFolder(dirHandle);

      if (existingSession && dbInitialized) {
        // Restore existing session
        console.log('Restoring existing session:', existingSession);
        sessionId = existingSession.id as number;
        setCurrentSessionId(sessionId);
        setGridMode(existingSession.gridMode as GridMode);
        setCurrentPage(existingSession.currentPage as number);

        // Load saved selections from database
        const savedImages = getSessionImages(sessionId);
        const savedSelectionsMap = new Map(
          savedImages.map(img => [img.filePath, img.selected])
        );

        // Merge scanned images with saved selections
        const mergedImages = scannedImages.map(img => ({
          ...img,
          selected: savedSelectionsMap.get(img.path) || false
        }));

        setImages(mergedImages);

        // Update session last accessed
        updateSession(sessionId, existingSession.gridMode as string, existingSession.currentPage as number);
      } else {
        // Create new session
        setImages(scannedImages);
        setCurrentPage(0);

        if (dbInitialized) {
          sessionId = createSession(folderName, gridMode);
          setCurrentSessionId(sessionId);

          // Save images to database
          scannedImages.forEach(img => {
            saveImage(sessionId, {
              fileName: img.fileName,
              filePath: img.path,
              size: img.size,
              lastModified: img.lastModified,
              selected: img.selected,
            });
          });
        }
      }

      // Generate thumbnails in the background
      scannedImages.forEach(async (img, index) => {
        try {
          const thumbnailUrl = await createThumbnail(img.fileHandle);
          setImages((prev) =>
            prev.map((item) =>
              item.id === img.id ? { ...item, thumbnailUrl } : item
            )
          );
        } catch (error) {
          console.error(`Failed to create thumbnail for ${img.fileName}:`, error);
        }
      });

      setIsLoading(false);
    } catch (error) {
      console.error('Error selecting folder:', error);
      setIsLoading(false);
    }
  };

  const handleSelectImage = (id: string) => {
    setImages((prev) => {
      const updated = prev.map((img) => {
        if (img.id === id) {
          const newSelected = !img.selected;

          // Update database if session exists
          if (currentSessionId && dbInitialized) {
            try {
              updateImageSelection(currentSessionId, img.path, newSelected);
            } catch (error) {
              console.error('Failed to update selection in database:', error);
            }
          }

          return { ...img, selected: newSelected };
        }
        return img;
      });
      return updated;
    });
  };

  const handleToggleGridMode = () => {
    setGridMode((prev) => {
      const newMode = prev === '5x5' ? '6x4' : '5x5';

      // Update database session
      if (currentSessionId && dbInitialized) {
        try {
          updateSession(currentSessionId, newMode, 0);
        } catch (error) {
          console.error('Failed to update session in database:', error);
        }
      }

      return newMode;
    });
    setCurrentPage(0);
  };

  const handlePreviousPage = () => {
    setCurrentPage((prev) => {
      const newPage = Math.max(0, prev - 1);

      // Update database session
      if (currentSessionId && dbInitialized) {
        try {
          updateSession(currentSessionId, gridMode, newPage);
        } catch (error) {
          console.error('Failed to update session in database:', error);
        }
      }

      return newPage;
    });
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => {
      const newPage = Math.min(totalPages - 1, prev + 1);

      // Update database session
      if (currentSessionId && dbInitialized) {
        try {
          updateSession(currentSessionId, gridMode, newPage);
        } catch (error) {
          console.error('Failed to update session in database:', error);
        }
      }

      return newPage;
    });
  };

  const handleExportDatabase = () => {
    if (!dbInitialized) {
      alert('Database not initialized');
      return;
    }

    try {
      const data = exportDatabase();
      const blob = new Blob([data], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `imageviewer-db-${Date.now()}.sqlite`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log('Database exported successfully');
    } catch (error) {
      console.error('Failed to export database:', error);
      alert('Failed to export database');
    }
  };

  const handleImportDatabase = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.sqlite';

    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        await importDatabase(data);
        setDbInitialized(true);
        console.log('Database imported successfully');
        alert('Database imported successfully. Please refresh the page.');
      } catch (error) {
        console.error('Failed to import database:', error);
        alert('Failed to import database');
      }
    };

    input.click();
  };

  const handleExportSelected = async () => {
    const selectedCount = images.filter(img => img.selected).length;

    if (selectedCount === 0) {
      alert('No images selected. Please select at least one image to export.');
      return;
    }

    if (!confirm(`Export ${selectedCount} selected image(s) to a new folder?`)) {
      return;
    }

    setIsExporting(true);
    setExportProgress({ current: 0, total: selectedCount });

    try {
      const result = await exportSelectedImages(
        images,
        (current, total) => {
          setExportProgress({ current, total });
        }
      );

      setIsExporting(false);
      setExportProgress({ current: 0, total: 0 });

      if (result.failed > 0) {
        alert(
          `Export completed with errors:\n` +
          `Successfully copied: ${result.success}\n` +
          `Failed: ${result.failed}\n\n` +
          `Errors:\n${result.errors.join('\n')}`
        );
      } else {
        alert(`Successfully exported ${result.success} image(s)!`);
      }
    } catch (error) {
      setIsExporting(false);
      setExportProgress({ current: 0, total: 0 });
      console.error('Export failed:', error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleLongPress = (id: string) => {
    setLightboxImageId(id);
  };

  const handleCloseLightbox = () => {
    setLightboxImageId(null);
  };

  const handleNavigateLightbox = (direction: 'prev' | 'next') => {
    if (!lightboxImageId) return;

    const currentIndex = images.findIndex(img => img.id === lightboxImageId);
    if (currentIndex === -1) return;

    if (direction === 'prev' && currentIndex > 0) {
      setLightboxImageId(images[currentIndex - 1].id);
    } else if (direction === 'next' && currentIndex < images.length - 1) {
      setLightboxImageId(images[currentIndex + 1].id);
    }
  };

  const lightboxImage = lightboxImageId ? images.find(img => img.id === lightboxImageId) : null;

  // Keyboard navigation
  useEffect(() => {
    if (lightboxImageId) return; // Don't handle keyboard when lightbox is open

    const handleKeyDown = (e: KeyboardEvent) => {
      if (images.length === 0) return;

      const cols = gridMode === '5x5' ? 5 : 6;
      const rows = gridMode === '5x5' ? 5 : 4;
      const imagesPerPage = cols * rows;

      // Calculate position in current page grid
      const indexInPage = focusedIndex % imagesPerPage;
      const row = Math.floor(indexInPage / cols);
      const col = indexInPage % cols;

      let newIndex = focusedIndex;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (row > 0) {
            // Move up within current page
            newIndex = focusedIndex - cols;
          } else if (currentPage > 0) {
            // Move to previous page, bottom row
            const newPage = currentPage - 1;
            setCurrentPage(newPage);
            const newPageStartIdx = newPage * imagesPerPage;
            const lastRowStart = newPageStartIdx + (rows - 1) * cols;
            newIndex = Math.min(lastRowStart + col, images.length - 1);
          }
          break;

        case 'ArrowDown':
          e.preventDefault();
          if (row < rows - 1 && focusedIndex + cols < images.length) {
            // Move down within current page
            const potentialIndex = focusedIndex + cols;
            if (potentialIndex < Math.min(startIdx + imagesPerPage, images.length)) {
              newIndex = potentialIndex;
            }
          } else if (currentPage < totalPages - 1) {
            // Move to next page, top row
            const newPage = currentPage + 1;
            setCurrentPage(newPage);
            const newPageStartIdx = newPage * imagesPerPage;
            newIndex = Math.min(newPageStartIdx + col, images.length - 1);
          }
          break;

        case 'ArrowLeft':
          e.preventDefault();
          if (col > 0) {
            // Move left within row
            newIndex = focusedIndex - 1;
          } else if (focusedIndex > 0) {
            // Wrap to previous row or page
            newIndex = focusedIndex - 1;
            if (newIndex < startIdx && currentPage > 0) {
              setCurrentPage(currentPage - 1);
            }
          }
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (col < cols - 1 && focusedIndex + 1 < images.length) {
            // Move right within row
            const potentialIndex = focusedIndex + 1;
            if (potentialIndex < Math.min(startIdx + imagesPerPage, images.length)) {
              newIndex = potentialIndex;
            }
          } else if (focusedIndex + 1 < images.length) {
            // Wrap to next row or page
            newIndex = focusedIndex + 1;
            if (newIndex >= endIdx && currentPage < totalPages - 1) {
              setCurrentPage(currentPage + 1);
            }
          }
          break;

        case ' ':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < images.length) {
            handleSelectImage(images[focusedIndex].id);
          }
          break;

        case 'Enter':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < images.length) {
            handleLongPress(images[focusedIndex].id);
          }
          break;

        default:
          return;
      }

      // Ensure new index is valid
      if (newIndex >= 0 && newIndex < images.length) {
        setFocusedIndex(newIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, images, currentPage, totalPages, gridMode, startIdx, endIdx, lightboxImageId]);

  // Reset focused index when changing pages or folders
  useEffect(() => {
    setFocusedIndex(startIdx);
  }, [currentPage, folderHandle]);

  if (!isSupported) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md bg-white rounded-lg shadow-lg p-6 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Browser Not Supported</h1>
          <p className="text-gray-700 mb-4">
            This application requires the File System Access API, which is only available in:
          </p>
          <ul className="text-left text-gray-600 mb-4 space-y-1">
            <li>• Chrome 86+</li>
            <li>• Edge 86+</li>
            <li>• Opera 72+</li>
          </ul>
          <p className="text-gray-700">
            Please use one of these browsers to access the Image Viewer.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Image Viewer</h1>

            <div className="flex items-center gap-4">
              {images.length > 0 && (
                <>
                  <div className="text-sm text-gray-600">
                    Page {currentPage + 1} of {totalPages} | {selectedCount} selected
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleToggleGridMode}
                  >
                    {gridMode === '5x5' ? '5×5 Grid' : '6×4 Grid'}
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                onClick={handleExportDatabase}
                disabled={!dbInitialized}
              >
                Export DB
              </Button>
              <Button
                variant="outline"
                onClick={handleImportDatabase}
              >
                Import DB
              </Button>
              <Button onClick={handleSelectFolder} disabled={isLoading}>
                {isLoading ? 'Loading...' : folderHandle ? 'Change Folder' : 'Select Folder'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto h-full">
          {images.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-gray-600 text-lg mb-4">
                  No folder selected. Click "Select Folder" to get started.
                </p>
              </div>
            </div>
          ) : (
            <ImageGrid
              images={currentImages}
              gridMode={gridMode}
              onSelectImage={handleSelectImage}
              onLongPressImage={handleLongPress}
              focusedIndex={focusedIndex}
              pageStartIndex={startIdx}
            />
          )}
        </div>
      </main>

      {/* Lightbox */}
      {lightboxImage && (
        <ImageLightbox
          image={lightboxImage}
          allImages={images}
          onClose={handleCloseLightbox}
          onNavigate={handleNavigateLightbox}
        />
      )}

      {/* Footer */}
      {images.length > 0 && (
        <footer className="bg-white border-t flex-shrink-0">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handlePreviousPage}
                  disabled={currentPage === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages - 1}
                >
                  Next
                </Button>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600">
                  {images.length} images total
                </div>
                <Button
                  onClick={handleExportSelected}
                  disabled={selectedCount === 0 || isExporting}
                >
                  {isExporting
                    ? `Exporting... (${exportProgress.current}/${exportProgress.total})`
                    : `Export Selected (${selectedCount})`
                  }
                </Button>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

export default App;
