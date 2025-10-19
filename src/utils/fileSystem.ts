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

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];

export function isImageFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase();
  return ext ? IMAGE_EXTENSIONS.includes(ext) : false;
}

export async function scanFolder(
  dirHandle: FileSystemDirectoryHandle
): Promise<ImageItem[]> {
  const images: ImageItem[] = [];

  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file' && isImageFile(entry.name)) {
      const file = await entry.getFile();
      images.push({
        id: `${entry.name}-${file.lastModified}`,
        fileHandle: entry,
        fileName: entry.name,
        path: entry.name,
        size: file.size,
        lastModified: file.lastModified,
        selected: false,
      });
    }
  }

  return images.sort((a, b) => a.fileName.localeCompare(b.fileName));
}

export async function createThumbnail(
  fileHandle: FileSystemFileHandle,
  maxSize: number = 400
): Promise<string> {
  const file = await fileHandle.getFile();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function checkFileSystemSupport(): boolean {
  return 'showDirectoryPicker' in window;
}

export async function exportSelectedImages(
  images: { fileHandle: FileSystemFileHandle; fileName: string; selected: boolean }[],
  onProgress?: (current: number, total: number) => void
): Promise<{ success: number; failed: number; errors: string[] }> {
  const selectedImages = images.filter(img => img.selected);

  if (selectedImages.length === 0) {
    throw new Error('No images selected');
  }

  // Ask user to select destination folder
  const destinationHandle = await window.showDirectoryPicker({
    mode: 'readwrite',
    startIn: 'pictures'
  });

  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < selectedImages.length; i++) {
    const image = selectedImages[i];

    try {
      // Get the file from the source
      const file = await image.fileHandle.getFile();

      // Create the file in destination folder
      const newFileHandle = await destinationHandle.getFileHandle(image.fileName, { create: true });

      // Write the file data
      const writable = await newFileHandle.createWritable();
      await writable.write(file);
      await writable.close();

      success++;

      if (onProgress) {
        onProgress(i + 1, selectedImages.length);
      }
    } catch (error) {
      failed++;
      const errorMsg = `Failed to copy ${image.fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      console.error(errorMsg);
    }
  }

  return { success, failed, errors };
}
