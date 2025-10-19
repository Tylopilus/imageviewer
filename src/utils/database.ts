import initSqlJs, { Database } from 'sql.js';

let db: Database | null = null;

export async function initDatabase(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs({
    locateFile: (file) => `https://sql.js.org/dist/${file}`
  });

  db = new SQL.Database();

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_accessed INTEGER NOT NULL,
      grid_mode TEXT DEFAULT '5x5',
      current_page INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      size INTEGER,
      last_modified INTEGER,
      selected INTEGER DEFAULT 0,
      thumbnail_data TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);

  return db;
}

export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Session operations
export function createSession(folderName: string, gridMode: string = '5x5'): number {
  const db = getDatabase();
  const now = Date.now();

  db.run(
    'INSERT INTO sessions (folder_name, created_at, last_accessed, grid_mode) VALUES (?, ?, ?, ?)',
    [folderName, now, now, gridMode]
  );

  const result = db.exec('SELECT last_insert_rowid() as id');
  return result[0].values[0][0] as number;
}

export function updateSession(sessionId: number, gridMode: string, currentPage: number): void {
  const db = getDatabase();
  db.run(
    'UPDATE sessions SET grid_mode = ?, current_page = ?, last_accessed = ? WHERE id = ?',
    [gridMode, currentPage, Date.now(), sessionId]
  );
}

export function getSession(sessionId: number) {
  const db = getDatabase();
  const result = db.exec('SELECT * FROM sessions WHERE id = ?', [sessionId]);

  if (result.length === 0) return null;

  const row = result[0].values[0];
  return {
    id: row[0],
    folderName: row[1],
    createdAt: row[2],
    lastAccessed: row[3],
    gridMode: row[4],
    currentPage: row[5],
  };
}

export function getAllSessions() {
  const db = getDatabase();
  const result = db.exec('SELECT * FROM sessions ORDER BY last_accessed DESC');

  if (result.length === 0) return [];

  return result[0].values.map(row => ({
    id: row[0],
    folderName: row[1],
    createdAt: row[2],
    lastAccessed: row[3],
    gridMode: row[4],
    currentPage: row[5],
  }));
}

export function findSessionByFolderName(folderName: string) {
  const db = getDatabase();
  const result = db.exec('SELECT * FROM sessions WHERE folder_name = ? ORDER BY last_accessed DESC LIMIT 1', [folderName]);

  if (result.length === 0 || result[0].values.length === 0) return null;

  const row = result[0].values[0];
  return {
    id: row[0],
    folderName: row[1],
    createdAt: row[2],
    lastAccessed: row[3],
    gridMode: row[4],
    currentPage: row[5],
  };
}

// Image operations
export function saveImage(sessionId: number, image: {
  fileName: string;
  filePath: string;
  size: number;
  lastModified: number;
  selected: boolean;
  thumbnailData?: string;
}): void {
  const db = getDatabase();
  db.run(
    'INSERT INTO images (session_id, file_name, file_path, size, last_modified, selected, thumbnail_data) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [sessionId, image.fileName, image.filePath, image.size, image.lastModified, image.selected ? 1 : 0, image.thumbnailData || null]
  );
}

export function updateImageSelection(sessionId: number, filePath: string, selected: boolean): void {
  const db = getDatabase();
  db.run(
    'UPDATE images SET selected = ? WHERE session_id = ? AND file_path = ?',
    [selected ? 1 : 0, sessionId, filePath]
  );
}

export function getSessionImages(sessionId: number) {
  const db = getDatabase();
  const result = db.exec('SELECT * FROM images WHERE session_id = ? ORDER BY file_name', [sessionId]);

  if (result.length === 0) return [];

  return result[0].values.map(row => ({
    id: row[0],
    sessionId: row[1],
    fileName: row[2],
    filePath: row[3],
    size: row[4],
    lastModified: row[5],
    selected: row[6] === 1,
    thumbnailData: row[7],
  }));
}

export function getSelectedImages(sessionId: number) {
  const db = getDatabase();
  const result = db.exec('SELECT * FROM images WHERE session_id = ? AND selected = 1', [sessionId]);

  if (result.length === 0) return [];

  return result[0].values.map(row => ({
    id: row[0],
    sessionId: row[1],
    fileName: row[2],
    filePath: row[3],
    size: row[4],
    lastModified: row[5],
    selected: true,
    thumbnailData: row[7],
  }));
}

export function deleteSession(sessionId: number): void {
  const db = getDatabase();
  db.run('DELETE FROM sessions WHERE id = ?', [sessionId]);
}

// Export database to file
export function exportDatabase(): Uint8Array {
  const db = getDatabase();
  return db.export();
}

// Import database from file
export async function importDatabase(data: Uint8Array): Promise<void> {
  const SQL = await initSqlJs({
    locateFile: (file) => `https://sql.js.org/dist/${file}`
  });

  if (db) {
    db.close();
  }

  db = new SQL.Database(data);
}
