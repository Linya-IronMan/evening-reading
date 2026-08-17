import { Book, ParagraphBlock, ReadingProgress, Comment } from '../types/reader';
import { fetchWithRetry } from '../utils/apiClient';

/**
 * 获取所有本地书籍
 */
export async function getStoredBooks(): Promise<Book[]> {
  try {
    const res = await fetchWithRetry('/api/books');
    return await res.json();
  } catch (err) {
    console.error('Failed to get books from backend:', err);
    return [];
  }
}

/**
 * 保存书籍列表 (Wait, backend API expects importing a single book)
 * Actually, we use POST /api/books for importing a new book
 */
export async function importBookToBackend(book: Book, blocks: ParagraphBlock[]): Promise<void> {
  try {
    await fetchWithRetry('/api/books', {
      method: 'POST',
      body: JSON.stringify({ book, blocks })
    });
  } catch (err) {
    console.error('Failed to import book:', err);
    throw err;
  }
}

/**
 * 获取特定书籍的段落块
 */
export async function getStoredBlocks(bookId: string): Promise<ParagraphBlock[]> {
  try {
    const res = await fetchWithRetry(`/api/books/${bookId}/blocks`);
    return await res.json();
  } catch (err) {
    console.error(`Failed to get blocks for book ${bookId}:`, err);
    return [];
  }
}

/**
 * 保存特定书籍的段落块
 */
export async function saveStoredBlocks(bookId: string, blocks: ParagraphBlock[]): Promise<void> {
  try {
    await fetchWithRetry(`/api/books/${bookId}/blocks`, {
      method: 'PUT',
      body: JSON.stringify(blocks)
    });
  } catch (err) {
    console.error(`Failed to save blocks for book ${bookId}:`, err);
    throw err;
  }
}

/**
 * 获取特定书籍的朗读进度
 */
export async function getStoredProgress(bookId: string): Promise<ReadingProgress | null> {
  try {
    const res = await fetchWithRetry(`/api/books/${bookId}/progress`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`Failed to get progress for book ${bookId}:`, err);
    return null;
  }
}

/**
 * 保存朗读进度
 */
export async function saveStoredProgress(progress: ReadingProgress): Promise<void> {
  try {
    await fetchWithRetry(`/api/books/${progress.bookId}/progress`, {
      method: 'PUT',
      body: JSON.stringify(progress)
    });
  } catch (err) {
    console.error('Failed to save progress:', err);
  }
}

/**
 * 获取特定书籍的评论列表
 */
export async function getStoredComments(bookId: string): Promise<Comment[]> {
  try {
    const res = await fetchWithRetry(`/api/books/${bookId}/comments`);
    return await res.json();
  } catch (err) {
    console.error(`Failed to get comments for book ${bookId}:`, err);
    return [];
  }
}

/**
 * 创建单条评论
 */
export async function createStoredComment(bookId: string, comment: Comment): Promise<void> {
  try {
    await fetchWithRetry(`/api/books/${bookId}/comments`, {
      method: 'POST',
      body: JSON.stringify(comment)
    });
  } catch (err) {
    console.error(`Failed to save comment for book ${bookId}:`, err);
    throw err;
  }
}

/**
 * 删除评论
 */
export async function deleteStoredComment(bookId: string, commentId: string): Promise<void> {
  try {
    await fetchWithRetry(`/api/books/${bookId}/comments/${commentId}`, {
      method: 'DELETE'
    });
  } catch (err) {
    console.error(`Failed to delete comment:`, err);
    throw err;
  }
}

/**
 * 删除书籍及其所有关联数据
 */
export async function removeBookAndData(bookId: string): Promise<void> {
  try {
    await fetchWithRetry(`/api/books/${bookId}`, {
      method: 'DELETE'
    });
  } catch (err) {
    console.error(`Failed to remove book ${bookId}:`, err);
    throw err;
  }
}
