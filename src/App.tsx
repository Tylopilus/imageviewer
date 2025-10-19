import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ImageGrid } from '@/components/ImageGrid';
import { ImageLightbox } from '@/components/ImageLightbox';
import { scanFolder, createThumbnail, checkFileSystemSupport, exportSelectedImages } from '@/utils/fileSystem';
import {
  initDatabase,
  createSession,
  updateSession,
  saveImage,
  updateImageSelection,
  updateImageThumbnail,
  getSessionImages,
  getSession,
  getAllSessions,
  findSessionByFolderName,
  saveImagesToDatabase
} from '@/utils/database';

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
  const [lastSession, setLastSession] = useState<{ id: number; folderName: string } | null>(null);
  const [showResumeNotification, setShowResumeNotification] = useState(false);

  // Initialize database
  useEffect(() => {
    const init = async () => {
      try {
        await initDatabase();
        setDbInitialized(true);
        console.log('Database initialized successfully');

        // Check for last session
        try {
          const sessions = getAllSessions();
          console.log('Found sessions:', sessions);
          if (sessions.length > 0) {
            const mostRecent = sessions[0]; // Already sorted by last_accessed DESC
            console.log('Most recent session:', mostRecent);
            setLastSession({
              id: mostRecent.id as number,
              folderName: mostRecent.folderName as string
            });
            setShowResumeNotification(true);
          } else {
            console.log('No sessions found in database');
          }
        } catch (sessionError) {
          console.error('Failed to get sessions:', sessionError);
        }
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };
    init();
  }, []);

  useEffect(() => {
    setIsSupported(checkFileSystemSupport());
  }, []);

  const imagesPerPage = gridMode === '5x5' ? 25 : 24;
  const totalPages = Math.ceil(images.length / imagesPerPage);
  const startIdx = currentPage * imagesPerPage;
  const endIdx = startIdx + imagesPerPage;
  const currentImages = images.slice(startIdx, endIdx);
  const selectedCount = images.filter((img) => img.selected).length;

  const handleResumeSession = async () => {
    setShowResumeNotification(false);
    await handleSelectFolder();
  };

  const handleDismissNotification = () => {
    setShowResumeNotification(false);
    setLastSession(null);
  };

  const handleSelectFolder = async () => {
    if (!isSupported) {
      alert('File System Access API is not supported in your browser. Please use Chrome, Edge, or Opera.');
      return;
    }

    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
      setFolderHandle(dirHandle);
      setIsLoading(true);
      setShowResumeNotification(false); // Hide notification when folder is selected

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
        console.log('Restoring focusedIndex:', existingSession.focusedIndex);
        sessionId = existingSession.id as number;
        setCurrentSessionId(sessionId);
        setGridMode(existingSession.gridMode as GridMode);
        setCurrentPage(existingSession.currentPage as number);
        const restoredFocusedIndex = existingSession.focusedIndex as number || 0;
        console.log('Setting focusedIndex to:', restoredFocusedIndex);
        setFocusedIndex(restoredFocusedIndex);

        // Load saved selections and thumbnails from database
        const savedImages = getSessionImages(sessionId);
        const savedDataMap = new Map(
          savedImages.map(img => [img.filePath, { selected: img.selected, thumbnailData: img.thumbnailData }])
        );

        // Merge scanned images with saved selections and thumbnails
        const mergedImages = scannedImages.map(img => {
          const savedData = savedDataMap.get(img.path);
          return {
            ...img,
            selected: savedData?.selected || false,
            thumbnailUrl: savedData?.thumbnailData || undefined
          };
        });

        setImages(mergedImages);

        // Update session last accessed
        updateSession(sessionId, existingSession.gridMode as string, existingSession.currentPage as number, existingSession.focusedIndex as number);
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

          // Save to localStorage after all images are added
          saveImagesToDatabase();
          console.log('Saved', scannedImages.length, 'images to database');
        }
      }

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

  // Load full-resolution image and cache it
  const loadFullResImage = async (imageId: string) => {
    const image = images.find(img => img.id === imageId);
    if (!image) return;

    // If already loaded, return immediately
    if (image.fullResUrl) return;

    try {
      const file = await image.fileHandle.getFile();
      const url = URL.createObjectURL(file);

      // Update state with cached URL
      setImages((prev) =>
        prev.map((item) =>
          item.id === imageId ? { ...item, fullResUrl: url } : item
        )
      );
    } catch (error) {
      console.error('Failed to load full resolution image:', error);
    }
  };

  const handleLongPress = async (id: string) => {
    setLightboxImageId(id);

    // Load current image
    await loadFullResImage(id);

    // Preload adjacent images for faster navigation
    const currentIndex = images.findIndex(img => img.id === id);
    if (currentIndex > 0) {
      loadFullResImage(images[currentIndex - 1].id);
    }
    if (currentIndex < images.length - 1) {
      loadFullResImage(images[currentIndex + 1].id);
    }
  };

  const handleCloseLightbox = () => {
    setLightboxImageId(null);
  };

  const handleNavigateLightbox = async (direction: 'prev' | 'next') => {
    if (!lightboxImageId) return;

    const currentIndex = images.findIndex(img => img.id === lightboxImageId);
    if (currentIndex === -1) return;

    let newIndex = currentIndex;
    if (direction === 'prev' && currentIndex > 0) {
      newIndex = currentIndex - 1;
      setLightboxImageId(images[newIndex].id);
    } else if (direction === 'next' && currentIndex < images.length - 1) {
      newIndex = currentIndex + 1;
      setLightboxImageId(images[newIndex].id);
    }

    // Update focused index to match the lightbox navigation
    setFocusedIndex(newIndex);

    // Update database with new focused index
    if (currentSessionId && dbInitialized) {
      try {
        updateSession(currentSessionId, gridMode, currentPage, newIndex);
      } catch (error) {
        console.error('Failed to update focused index in database:', error);
      }
    }

    // Load the new image
    await loadFullResImage(images[newIndex].id);

    // Preload adjacent images
    if (newIndex > 0) {
      loadFullResImage(images[newIndex - 1].id);
    }
    if (newIndex < images.length - 1) {
      loadFullResImage(images[newIndex + 1].id);
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
            handleLongPress(images[focusedIndex].id);
          }
          break;

        case 'Enter':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < images.length) {
            handleSelectImage(images[focusedIndex].id);
          }
          break;

        default:
          return;
      }

      // Ensure new index is valid
      if (newIndex >= 0 && newIndex < images.length) {
        setFocusedIndex(newIndex);

        // Update database with new focused index
        if (currentSessionId && dbInitialized && newIndex !== focusedIndex) {
          try {
            updateSession(currentSessionId, gridMode, currentPage, newIndex);
          } catch (error) {
            console.error('Failed to update focused index in database:', error);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, images, currentPage, totalPages, gridMode, startIdx, endIdx, lightboxImageId, currentSessionId, dbInitialized]);

  // Initialize focused index when first loading (but not when restoring session)
  useEffect(() => {
    if (images.length > 0 && focusedIndex === 0 && !currentSessionId) {
      setFocusedIndex(startIdx);
    }
  }, [images.length]);

  // Generate thumbnails for current page and adjacent pages (performance optimization)
  useEffect(() => {
    if (images.length === 0 || !currentSessionId) return;

    // Process thumbnails in parallel with concurrency limit
    const generateThumbnailsForPage = async (pageIndex: number, priority: number = 0) => {
      const pageStartIdx = pageIndex * imagesPerPage;
      const pageEndIdx = Math.min(pageStartIdx + imagesPerPage, images.length);
      const pageImages = images.slice(pageStartIdx, pageEndIdx);

      // Filter images that need thumbnails
      const imagesNeedingThumbnails = pageImages.filter(img => !img.thumbnailUrl);

      if (imagesNeedingThumbnails.length === 0) return;

      // Process in batches of 4 for parallel processing
      const concurrency = 4;
      for (let i = 0; i < imagesNeedingThumbnails.length; i += concurrency) {
        const batch = imagesNeedingThumbnails.slice(i, i + concurrency);

        await Promise.all(
          batch.map(async (img) => {
            try {
              const thumbnailUrl = await createThumbnail(img.fileHandle);

              // Update in-memory state
              setImages((prev) =>
                prev.map((item) =>
                  item.id === img.id ? { ...item, thumbnailUrl } : item
                )
              );

              // Save thumbnail to database
              if (currentSessionId && dbInitialized) {
                updateImageThumbnail(currentSessionId, img.path, thumbnailUrl);
              }
            } catch (error) {
              console.error(`Failed to create thumbnail for ${img.fileName}:`, error);
            }
          })
        );
      }
    };

    // Generate for current page with highest priority
    generateThumbnailsForPage(currentPage, 0);

    // Generate for adjacent pages in background (prev and next)
    if (currentPage > 0) {
      setTimeout(() => generateThumbnailsForPage(currentPage - 1, 1), 500);
    }
    if (currentPage < totalPages - 1) {
      setTimeout(() => generateThumbnailsForPage(currentPage + 1, 1), 1000);
    }

    // Save thumbnails to IndexedDB after generation (debounced)
    const saveTimer = setTimeout(() => {
      if (dbInitialized) {
        saveImagesToDatabase();
      }
    }, 3000);

    return () => clearTimeout(saveTimer);
  }, [currentPage, images.length, currentSessionId, dbInitialized]);

  // Cleanup blob URLs when they're no longer needed
  useEffect(() => {
    return () => {
      // Revoke all blob URLs on unmount to prevent memory leaks
      images.forEach(img => {
        if (img.thumbnailUrl && img.thumbnailUrl.startsWith('blob:')) {
          URL.revokeObjectURL(img.thumbnailUrl);
        }
        if (img.fullResUrl && img.fullResUrl.startsWith('blob:')) {
          URL.revokeObjectURL(img.fullResUrl);
        }
      });
    };
  }, []);

  // Cleanup fullResUrl for images not on current or adjacent pages
  useEffect(() => {
    if (images.length === 0) return;

    // Keep full-res images only for current page and adjacent pages
    const pagesToKeep = new Set([currentPage - 1, currentPage, currentPage + 1]);

    setImages((prev) =>
      prev.map((img, index) => {
        const imagePage = Math.floor(index / imagesPerPage);

        // If image is not on a page we want to keep, cleanup its fullResUrl
        if (!pagesToKeep.has(imagePage) && img.fullResUrl) {
          if (img.fullResUrl.startsWith('blob:')) {
            URL.revokeObjectURL(img.fullResUrl);
          }
          return { ...img, fullResUrl: undefined };
        }

        return img;
      })
    );
  }, [currentPage, images.length, imagesPerPage]);

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
      {/* Resume Session Notification */}
      {showResumeNotification && lastSession && (
        <Alert className="rounded-none border-0 border-b bg-blue-50 text-blue-900 flex-shrink-0">
          <svg
            className="w-5 h-5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <AlertDescription className="flex items-center justify-between w-full">
            <span>
              Resume your last session for folder <strong>"{lastSession.folderName}"</strong>?
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleResumeSession}
              >
                Resume
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDismissNotification}
              >
                Dismiss
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <header className="bg-white shadow-sm border-b flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Image Viewer</h1>

            <div className="flex items-center gap-4">
              {images.length > 0 && (
                <Button
                  variant="outline"
                  onClick={handleToggleGridMode}
                >
                  {gridMode === '5x5' ? '5×5 Grid' : '6×4 Grid'}
                </Button>
              )}
              <Button variant="secondary" onClick={handleSelectFolder} disabled={isLoading}>
                {isLoading ? 'Loading...' : folderHandle ? 'Change Folder' : 'Select Folder'}
              </Button>
              {images.length > 0 && (
                <Button
                  onClick={handleExportSelected}
                  disabled={selectedCount === 0 || isExporting}
                >
                  {isExporting
                    ? `Exporting... (${exportProgress.current}/${exportProgress.total})`
                    : `Export Selected (${selectedCount})`
                  }
                </Button>
              )}
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

              <div className="text-sm text-gray-600">
                Page {currentPage + 1} of {totalPages} | {selectedCount} selected | {images.length} images total
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

export default App;
