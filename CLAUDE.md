# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a browser-based image viewer application built with React. The application helps users review and select the best images from local folders through a grid-based interface, with persistent session support for multi-day workflows.

**Key Constraint**: The application uses the File System Access API, which limits browser compatibility to Chrome 86+, Edge 86+, and Opera 72+. Firefox and Safari are not supported.

## Architecture

### Core Data Flow
```
User selects folder → Scan with File System Access API → Generate file list
→ Create thumbnails (on-demand/cached) → Display paginated grid
→ User selects images → Auto-save to IndexedDB → Export to new folder
```

### State Management
Use React Context API or a state management library (Redux/Zustand) for:
- Current folder handle (FileSystemDirectoryHandle)
- Complete image list with metadata
- Selection state (use Set or Map for efficiency)
- Current page number and grid mode
- Session metadata for persistence

### Key Data Models

**ImageItem**: Each image requires a unique ID (hash or path), FileSystemFileHandle reference, file metadata (name, path, size, lastModified), and optional thumbnail data (Base64 or Blob URL).

**SessionState**: Sessions must track sessionId, folder reference, timestamps, selected image IDs array, current page, grid mode ('5x5' | '4x6'), and viewed pages.

**AppSettings**: Store user preferences for default grid mode, auto-save interval, thumbnail quality/size, and theme.

## File System Access API Patterns

### Folder Selection
```javascript
const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
```

### Directory Scanning
Iterate through directory entries asynchronously. Filter for image files (jpg, jpeg, png, gif, webp, bmp) and build the image list.

### Export/Copy Operation
Request destination folder with `mode: 'readwrite'`. For each selected file: get File object from source handle, create destination file handle, open writable stream, write file data, close stream. Always preserve original files.

## Performance Requirements

- **Lazy loading**: Only load thumbnails for visible images
- **Debounced saves**: Don't save on every selection change immediately
- **IndexedDB**: Use for efficient storage of large datasets and session state
- **Thumbnail caching**: Generate once and reuse
- **Target performance**: Must handle 1000+ images smoothly

## UI Structure

Main layout consists of three sections:
- **Header**: App title, grid mode toggle (5x5/4x6), statistics display
- **Grid Container**: Responsive thumbnail grid with selection indicators
- **Footer**: Pagination controls, bulk selection actions, export button

Modal views needed:
- **Enlarged Image View**: Full resolution display with prev/next navigation
- **Export Dialog**: Selection preview and progress tracking

## Keyboard Shortcuts
- Arrow Left/Right: Navigate pages
- Space: Next page
- Enter: Open enlarged view (when focused)
- Esc: Close enlarged view
- Ctrl/Cmd + A: Select all (current page)
- Ctrl/Cmd + D: Deselect all (current page)

## Session Persistence Strategy

Auto-save selection state to IndexedDB on every change (debounced). Associate sessions with folder identifier (hash or path). Support multiple folder sessions and resumption after days. On app load, check for existing sessions and offer restoration.

**Critical**: FileSystemDirectoryHandle may not persist across sessions. May need to re-request folder access on session resume.

## Development Phases

**Phase 1 (MVP)**: Basic folder selection and scanning, dual grid views, thumbnail display, image selection, pagination, basic session persistence, export functionality.

**Phase 2 (Enhanced UX)**: Enlarged image view with navigation, keyboard shortcuts, improved session management, progress indicators, performance optimizations.

**Phase 3 (Advanced)**: Multiple session management UI, filtering, analytics, settings panel, accessibility improvements.

## Grid Modes
- **5x5 Grid**: 25 images per page
- **4x6 Grid**: 24 images per page

Both must be responsive and maintain aspect ratios. User can toggle between modes, preference saved in session.

## Error Handling Priorities

Handle these critical scenarios:
- File System Access API not supported (show browser compatibility message)
- User denies folder permissions
- Files deleted/moved during active session
- IndexedDB quota exceeded
- Export destination insufficient space
- Invalid/corrupted image files

Provide user-friendly error messages with actionable steps. Implement retry mechanisms for transient errors.

## Testing Focus

Key scenarios to validate:
- Select 100 images from 1000+ image folder
- Resume session after 3+ days
- Successful export operation
- Grid mode switching
- Graceful handling of missing files

## Browser Compatibility Check

Always verify File System Access API support before core operations:
```javascript
if (!('showDirectoryPicker' in window)) {
  // Show compatibility warning
}
```
