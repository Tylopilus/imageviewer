# Image Viewer Application - Specification

## 1. Overview

A browser-based image viewer application designed to help users review and select the best images from local folders. The application supports batch image selection through a grid view, progress persistence across multiple sessions, and final export of selected images.

## 2. Core Requirements

### 2.1 Target Platform
- Web browser application
- No server-side processing required
- Uses File System Access API for local file access

### 2.2 Technology Stack
- **Frontend Framework**: React
- **File Access**: File System Access API (browser native)
- **Storage**: IndexedDB or localStorage for progress persistence
- **Image Handling**: Native browser APIs with thumbnail generation

## 3. Functional Requirements

### 3.1 Folder Selection
- User can select a local folder containing images
- Application should scan and detect all image files (jpg, jpeg, png, gif, webp, bmp)
- Support for recursive folder scanning (optional)
- Display total image count after scanning

### 3.2 Grid View Display

#### 3.2.1 Grid Modes
- **5x5 Grid**: 25 images per page
- **4x6 Grid**: 24 images per page
- User can toggle between grid modes
- Grid should be responsive and maintain aspect ratios

#### 3.2.2 Thumbnail Display
- Generate thumbnails for performance optimization
- Display image filename or metadata (optional)
- Visual indicator for selected/unselected state
- Clear visual feedback on hover

### 3.3 Image Interaction

#### 3.3.1 Thumbnail Enlargement
- Click on thumbnail to open enlarged view
- Enlarged view shows full resolution or near-full resolution
- Easy navigation to previous/next image in enlarged view
- Close enlarged view to return to grid
- Selection capability from enlarged view

#### 3.3.2 Selection Mechanism
- Click to select/deselect individual images
- Visual indicator (checkbox, border, overlay, etc.) for selected images
- Select all / Deselect all option for current page
- Selection counter showing "X of Y images selected"

### 3.4 Pagination
- Navigate between pages of images
- Show current page and total pages
- Previous/Next page navigation
- Jump to specific page (optional)
- Keyboard shortcuts for navigation (arrow keys, space)

### 3.5 Progress Persistence

#### 3.5.1 Session Management
- Auto-save selection state periodically
- Save on every selection change (debounced)
- Restore previous session on application reload
- Associate saved state with specific folder path/hash

#### 3.5.2 Saved Data
- Selected image identifiers (file paths or hashes)
- Current page number
- Grid mode preference
- Folder reference
- Timestamp of last save

#### 3.5.3 Multi-Day Support
- Sessions can be resumed after days
- Multiple folder sessions can be stored
- Option to clear old sessions
- Session list view to resume specific folders

### 3.6 Export Functionality

#### 3.6.1 Final Output
- Copy selected images to a new destination folder
- User selects destination folder via File System Access API
- Progress indicator during copy operation
- Option to maintain folder structure or flatten
- Copy operation preserves original files (no modification)

#### 3.6.2 Export Options
- Preview selected images count before export
- Option to export a subset of selections
- Error handling for file access issues
- Summary report after export (X files copied successfully)

## 4. User Interface Requirements

### 4.1 Main Layout
```
+--------------------------------------------------+
|  Header: App Title | Grid Mode Toggle | Stats    |
+--------------------------------------------------+
|                                                  |
|              Grid View Container                 |
|          (5x5 or 4x6 thumbnail grid)            |
|                                                  |
+--------------------------------------------------+
|  Footer: Pagination | Selection Actions         |
+--------------------------------------------------+
```

### 4.2 UI Components

#### 4.2.1 Header
- Application title
- Grid mode selector (5x5 / 4x6)
- Statistics: "Page X of Y | Z images selected"
- Settings/Options menu

#### 4.2.2 Grid Container
- Responsive grid layout
- Thumbnails with selection state
- Loading indicators for thumbnails
- Empty state when no folder selected

#### 4.2.3 Footer
- Previous/Next page buttons
- Page number input/display
- "Select All" / "Deselect All" buttons
- "Export Selected" button
- "Save Progress" button (or auto-save indicator)

#### 4.2.4 Modal Views
- **Enlarged Image View**:
  - Full/large image display
  - Previous/Next navigation
  - Select/Deselect toggle
  - Close button
  - Image metadata display (filename, size, dimensions)

- **Folder Picker**:
  - Native file system dialog
  - Confirmation of selected folder
  - Scanning progress indicator

- **Export Dialog**:
  - Selected images count
  - Destination folder picker
  - Export progress bar
  - Completion message

### 4.3 Keyboard Shortcuts
- `Arrow Left/Right`: Navigate pages
- `Space`: Next page
- `Enter`: Open enlarged view (when thumbnail focused)
- `Esc`: Close enlarged view
- `Ctrl/Cmd + A`: Select all on current page
- `Ctrl/Cmd + D`: Deselect all on current page

## 5. Technical Architecture

### 5.1 Data Flow
```
User selects folder
    ↓
Scan folder with File System Access API
    ↓
Generate file list with metadata
    ↓
Create thumbnails (on-demand or cached)
    ↓
Display grid with pagination
    ↓
User selects images
    ↓
Save selection state to IndexedDB
    ↓
User exports
    ↓
Copy files using File System Access API
```

### 5.2 State Management
- React Context API or state management library (Redux, Zustand)
- Global state for:
  - Current folder handle
  - Complete image list
  - Selection state (Set or Map of selected file paths)
  - Current page number
  - Grid mode preference
  - Session metadata

### 5.3 Performance Considerations
- Lazy load thumbnails (only visible images)
- Virtual scrolling for large image sets (optional)
- Web Workers for image processing (optional)
- Debounced save operations
- IndexedDB for efficient storage of large datasets
- Thumbnail caching strategy

### 5.4 Browser Compatibility
- File System Access API support required:
  - Chrome 86+
  - Edge 86+
  - Opera 72+
  - (Not supported in Firefox, Safari as of spec date)
- Fallback UI to inform users of browser requirements
- Progressive enhancement where possible

## 6. Data Models

### 6.1 Image Item
```typescript
interface ImageItem {
  id: string;                    // Unique identifier (hash or path)
  fileHandle: FileSystemFileHandle;
  fileName: string;
  path: string;                  // Relative path within folder
  size: number;                  // File size in bytes
  dimensions?: {                 // Optional, loaded on demand
    width: number;
    height: number;
  };
  thumbnail?: string;            // Base64 or Blob URL
  lastModified: number;          // Timestamp
}
```

### 6.2 Session State
```typescript
interface SessionState {
  sessionId: string;
  folderName: string;
  folderHandle?: FileSystemDirectoryHandle; // May not persist
  createdAt: number;
  lastAccessedAt: number;
  imageCount: number;
  selectedImageIds: string[];    // Array of image IDs
  currentPage: number;
  gridMode: '5x5' | '4x6';
  viewedPages: number[];         // Track which pages have been viewed
}
```

### 6.3 Application Settings
```typescript
interface AppSettings {
  defaultGridMode: '5x5' | '4x6';
  autoSaveInterval: number;      // Milliseconds
  thumbnailQuality: number;      // 0-1
  thumbnailMaxSize: number;      // Max dimension in pixels
  theme: 'light' | 'dark';
}
```

## 7. File System Access API Usage

### 7.1 Folder Selection
```javascript
const dirHandle = await window.showDirectoryPicker({
  mode: 'read'
});
```

### 7.2 Scanning Directory
```javascript
for await (const entry of dirHandle.values()) {
  if (entry.kind === 'file' && isImageFile(entry.name)) {
    // Add to image list
  }
}
```

### 7.3 Export/Copy Files
```javascript
const destHandle = await window.showDirectoryPicker({
  mode: 'readwrite'
});

// For each selected file
const file = await sourceFileHandle.getFile();
const destFileHandle = await destHandle.getFileHandle(fileName, { create: true });
const writable = await destFileHandle.createWritable();
await writable.write(file);
await writable.close();
```

## 8. Edge Cases and Error Handling

### 8.1 Error Scenarios
- File System Access API not supported
- User denies folder access permission
- Files deleted/moved while session active
- Storage quota exceeded for IndexedDB
- Export destination has insufficient space
- File write errors during export
- Corrupted or invalid image files

### 8.2 Error Handling Strategy
- User-friendly error messages
- Graceful degradation where possible
- Retry mechanisms for transient errors
- Validation before export operations
- Clear error reporting with actionable steps

## 9. Future Enhancements (Optional)

### 9.1 Phase 2 Features
- Image rating system (1-5 stars)
- EXIF data display
- Image comparison view (side-by-side)
- Advanced filters (by date, size, dimensions)
- Batch rename during export
- Duplicate detection
- Cloud storage integration
- Share session with collaborators
- Undo/Redo for selections
- Custom grid sizes
- Slideshow mode
- Image editing (crop, rotate)

## 10. Testing Requirements

### 10.1 Unit Tests
- Image file detection logic
- Pagination calculations
- Selection state management
- Storage operations

### 10.2 Integration Tests
- File System Access API interactions
- Session save/restore flow
- Export operation
- Grid view rendering

### 10.3 User Testing Scenarios
- Select 100 images from 1000+ image folder
- Resume session after 3 days
- Export to new folder successfully
- Switch between grid modes
- Handle missing files gracefully

## 11. Development Phases

### Phase 1: MVP (Minimum Viable Product)
1. Basic folder selection and scanning
2. Grid view (5x5 and 4x6)
3. Thumbnail display
4. Image selection
5. Basic pagination
6. Session persistence (basic)
7. Export functionality

### Phase 2: Enhanced UX
1. Enlarged image view
2. Keyboard shortcuts
3. Improved session management
4. Better progress indicators
5. Performance optimizations

### Phase 3: Advanced Features
1. Multiple session management
2. Advanced filtering
3. Statistics and analytics
4. Settings panel
5. Accessibility improvements

## 12. Success Criteria

- User can select and scan a local folder
- Images display in configurable grid layout
- Selection state persists across browser sessions
- User can resume work after multiple days
- Selected images can be exported to new folder
- Application works smoothly with 1000+ images
- No data loss during normal operation
- Intuitive and responsive user interface

---

**Document Version**: 1.0
**Last Updated**: 2025-10-19
**Status**: Draft
