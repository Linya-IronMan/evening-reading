import { Book, ParagraphBlock, ReadingProgress, Comment } from '../types/reader';

const STORAGE_KEYS = {
  BOOKS: 'evening_reading_books',
  PROGRESS_PREFIX: 'evening_reading_progress_',
  COMMENTS_PREFIX: 'evening_reading_comments_',
};

const DB_NAME = 'EveningReadingDB';
const STORE_NAME = 'blocks_store';

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 获取所有本地书籍
 * @returns {Book[]} 书籍列表
 */
export function getStoredBooks(): Book[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BOOKS);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to get books from localStorage:', err);
    return [];
  }
}

/**
 * 保存书籍列表
 * @param {Book[]} books 书籍数组
 */
export function saveStoredBooks(books: Book[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(books));
  } catch (err) {
    console.error('Failed to save books to localStorage:', err);
  }
}

/**
 * 获取特定书籍的段落块 (IndexedDB)
 * @param {string} bookId 书籍 ID
 * @returns {Promise<ParagraphBlock[]>} 段落块数组
 */
export async function getStoredBlocks(bookId: string): Promise<ParagraphBlock[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(bookId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error(`Failed to get blocks for book ${bookId} from IDB:`, err);
    return [];
  }
}

/**
 * 保存特定书籍的段落块 (IndexedDB，突破 localStorage 容量限制)
 * @param {string} bookId 书籍 ID
 * @param {ParagraphBlock[]} blocks 段落块数组
 */
export async function saveStoredBlocks(bookId: string, blocks: ParagraphBlock[]): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(blocks, bookId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error(`Failed to save blocks for book ${bookId} to IDB:`, err);
  }
}

/**
 * 获取特定书籍的朗读进度
 * @param {string} bookId 书籍 ID
 * @returns {ReadingProgress | null} 进度记录
 */
export function getStoredProgress(bookId: string): ReadingProgress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROGRESS_PREFIX + bookId);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error(`Failed to get progress for book ${bookId}:`, err);
    return null;
  }
}

/**
 * 保存朗读进度
 * @param {ReadingProgress} progress 进度记录
 */
export function saveStoredProgress(progress: ReadingProgress): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PROGRESS_PREFIX + progress.bookId, JSON.stringify(progress));
  } catch (err) {
    console.error('Failed to save progress:', err);
  }
}

/**
 * 获取特定书籍的评论列表
 * @param {string} bookId 书籍 ID
 * @returns {Comment[]} 评论数组
 */
export function getStoredComments(bookId: string): Comment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COMMENTS_PREFIX + bookId);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error(`Failed to get comments for book ${bookId}:`, err);
    return [];
  }
}

/**
 * 保存评论列表
 * @param {string} bookId 书籍 ID
 * @param {Comment[]} comments 评论数组
 */
export function saveStoredComments(bookId: string, comments: Comment[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.COMMENTS_PREFIX + bookId, JSON.stringify(comments));
  } catch (err) {
    console.error(`Failed to save comments for book ${bookId}:`, err);
  }
}

/**
 * 删除书籍及其所有关联数据
 * @param {string} bookId 书籍 ID
 */
export async function removeBookAndData(bookId: string): Promise<void> {
  try {
    const books = getStoredBooks().filter((b) => b.id !== bookId);
    saveStoredBooks(books);

    localStorage.removeItem(STORAGE_KEYS.PROGRESS_PREFIX + bookId);
    localStorage.removeItem(STORAGE_KEYS.COMMENTS_PREFIX + bookId);
    
    // Remove from IDB
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(bookId);
  } catch (err) {
    console.error(`Failed to remove book ${bookId}:`, err);
  }
}
