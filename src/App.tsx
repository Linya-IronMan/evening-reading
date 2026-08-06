import React, { useState, useEffect, useRef } from 'react';
import { ConfigProvider, Layout, theme, message } from 'antd';
import { Book, ParagraphBlock, Comment, ReadingProgress, EDGE_VOICES } from './types/reader';
import { createDemoBook } from './services/importer';
import {
  getStoredBooks,
  importBookToBackend,
  getStoredBlocks,
  saveStoredBlocks,
  getStoredComments,
  createStoredComment,
  deleteStoredComment,
  getStoredProgress,
  saveStoredProgress,
  removeBookAndData,
} from './services/storage';
import { ttsService } from './services/ttsService';

import { BookList } from './components/sidebar/BookList';
import { ReaderView } from './components/reader/ReaderView';
import { AudioPlayer } from './components/reader/AudioPlayer';
import { CommentSidebar } from './components/comments/CommentSidebar';

const { Sider, Content } = Layout;

export default function App(): React.ReactElement {
  // 状态集合
  const [books, setBooks] = useState<Book[]>([]);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<ParagraphBlock[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);

  // 播放与音色状态
  const [currentPlayingBlockId, setCurrentPlayingBlockId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isAudioLoading, setIsAudioLoading] = useState<boolean>(false);
  const [scrollToBlockId, setScrollToBlockId] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [voiceId, setVoiceId] = useState<string>(EDGE_VOICES[0].id);

  // 1. 初始化数据加载
  useEffect(() => {
    getStoredBooks().then((storedBooks) => {
      if (storedBooks.length === 0) {
        const demo = createDemoBook();
        importBookToBackend(demo.book, demo.blocks).then(() => {
          setBooks([demo.book]);
          setActiveBookId(demo.book.id);
        });
        return;
      }
      setBooks(storedBooks);
      if (storedBooks.length > 0) {
        setActiveBookId(storedBooks[0].id);
      }
    });
  }, []);

  // 2. 切换当前书籍时，加载对应段落、进度与评论
  useEffect(() => {
    if (!activeBookId) return;

    ttsService.stop();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentPlayingBlockId(null);

    let isCancelled = false;
    getStoredBlocks(activeBookId).then(b => {
      if (isCancelled) return;
      setBlocks(b);
      ttsService.setPlaylist(b); // 向下同步播放列表
    });

    getStoredComments(activeBookId).then(c => {
      if (isCancelled) return;
      setComments(c);
    });

    getStoredProgress(activeBookId).then(p => {
      if (isCancelled || !p) return;
      setPlaybackSpeed(p.playbackSpeed || 1.0);
      ttsService.setRate(p.playbackSpeed || 1.0);
      if (p.voiceId) {
        setVoiceId(p.voiceId);
        ttsService.setVoice(p.voiceId);
      }
      setCurrentPlayingBlockId(p.currentBlockId);
    });
    
    return () => {
      isCancelled = true;
    };
  }, [activeBookId]);

  // 3. 注册 Edge-TTS 朗读回调
  useEffect(() => {
    ttsService.setListeners({
      onLoadStart: () => {
        setIsAudioLoading(true);
      },
      onStart: (blockId) => {
        setIsAudioLoading(false);
        setCurrentPlayingBlockId(blockId);
        setIsPlaying(true);
        setIsPaused(false);

        if (activeBookId) {
          const progress: ReadingProgress = {
            bookId: activeBookId,
            currentBlockId: blockId,
            playbackSpeed: ttsService.getRate(),
            voiceId: ttsService.getVoice(),
            updatedAt: Date.now(),
          };
          saveStoredProgress(progress);
        }
      },
      onEnd: (finishedBlockId) => {
        setIsAudioLoading(false);
        setIsPlaying(false);
        setIsPaused(false);
      },
      onError: (_blockId, errorMsg) => {
        setIsAudioLoading(false);
        setIsPlaying(false);
        setIsPaused(false);
        message.error(`语音朗读提示: ${errorMsg}`);
      },
    });
  }, [activeBookId]);

  // WebSocket 实时同步
  useEffect(() => {
    const wsUrl = window.location.port === '1421'
      ? `ws://${window.location.host}/api/ws`
      : 'ws://127.0.0.1:1421/api/ws';
    
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      try {
        if (!activeBookId) return;
        const data = JSON.parse(event.data);
        if (data.book_id === activeBookId) {
          if (data.event_type === 'SYNC_PROGRESS') {
            getStoredProgress(activeBookId).then(p => {
              if (p && p.currentBlockId !== currentPlayingBlockId) {
                setCurrentPlayingBlockId(p.currentBlockId);
              }
            });
          } else if (data.event_type === 'SYNC_BLOCKS') {
            getStoredBlocks(activeBookId).then(setBlocks);
          } else if (data.event_type === 'SYNC_COMMENTS') {
            getStoredComments(activeBookId).then(setComments);
          }
        }
      } catch (e) {
        console.error("WS Parse error", e);
      }
    };
    return () => ws.close();
  }, [activeBookId, currentPlayingBlockId]);

  // --- 业务交互句柄 ---

  const handleSelectBook = (bookId: string) => {
    setActiveBookId(bookId);
  };

  const handleImportBook = async (newBook: Book, newBlocks: ParagraphBlock[]) => {
    try {
      await importBookToBackend(newBook, newBlocks);
      const updatedBooks = [newBook, ...books];
      setBooks(updatedBooks);
      setActiveBookId(newBook.id);
      message.success(`成功导入《${newBook.title}》！`);
    } catch (e) {
      message.error("导入失败");
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    await removeBookAndData(bookId);
    const updated = books.filter((b) => b.id !== bookId);
    setBooks(updated);

    if (activeBookId === bookId) {
      setActiveBookId(updated.length > 0 ? updated[0].id : null);
    }
    message.info('书籍已成功删除');
  };

  const handlePlayBlock = (blockId: string) => {
    const target = blocks.find((b) => b.id === blockId);
    if (target) {
      ttsService.speakBlock(target.id, target.content);
    }
  };

  const handleTogglePlayPause = () => {
    const status = ttsService.getStatus();

    if (status.isPlaying) {
      ttsService.pause();
      setIsPlaying(false);
      setIsPaused(true);
    } else if (status.isPaused) {
      ttsService.resume();
      setIsPlaying(true);
      setIsPaused(false);
    } else {
      let targetBlockId = currentPlayingBlockId || (blocks.length > 0 ? blocks[0].id : null);
      if (targetBlockId) {
        handlePlayBlock(targetBlockId);
      }
    }
  };

  const handlePreviousBlock = () => {
    if (!currentPlayingBlockId) return;
    const index = blocks.findIndex((b) => b.id === currentPlayingBlockId);
    if (index > 0) {
      handlePlayBlock(blocks[index - 1].id);
    }
  };

  const handleNextBlock = () => {
    if (!currentPlayingBlockId) return;
    const index = blocks.findIndex((b) => b.id === currentPlayingBlockId);
    if (index !== -1 && index + 1 < blocks.length) {
      handlePlayBlock(blocks[index + 1].id);
    }
  };

  const handleChangeRate = (rate: number) => {
    setPlaybackSpeed(rate);
    ttsService.setRate(rate);
  };

  const handleChangeVoice = (newVoiceId: string) => {
    setVoiceId(newVoiceId);
    ttsService.setVoice(newVoiceId);

    if (currentPlayingBlockId && (isPlaying || isAudioLoading)) {
      handlePlayBlock(currentPlayingBlockId);
    }
    message.success('已切换至微软 Edge-TTS 神经网络新声线');
  };

  const handleUpdateBlockContent = (blockId: string, newContent: string) => {
    try {
      const updatedBlocks = blocks.map((b) => {
        if (b.id === blockId) {
          return { ...b, content: newContent, version: b.version + 1 };
        }
        return b;
      });

      if (activeBookId) {
        saveStoredBlocks(activeBookId, updatedBlocks).then(() => {
          // 强制回读契约 (Write-to-Read Back Contract)
          getStoredBlocks(activeBookId).then((readBackBlocks) => {
            setBlocks(readBackBlocks);
            ttsService.setPlaylist(readBackBlocks);
          });
        });
      } else {
        setBlocks(updatedBlocks);
        ttsService.setPlaylist(updatedBlocks);
      }

      ttsService.updateBlock(blockId, newContent);

      if (currentPlayingBlockId === blockId && isPlaying) {
        ttsService.speakBlock(blockId, newContent);
      }

      message.success('段落内容已保存');
    } catch (err) {
      message.error(`保存段落失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleCreateComment = async (blockId: string, quoteText: string, commentContent: string) => {
    if (!activeBookId) return;

    try {
      const newComment: Comment = {
        id: 'cmt_' + Math.random().toString(36).substring(2, 9),
        bookId: activeBookId,
        blockId,
        startOffset: 0,
        endOffset: quoteText.length,
        quoteText,
        content: commentContent,
        createdAt: Date.now(),
      };

      await createStoredComment(activeBookId, newComment);
      const readBackComments = await getStoredComments(activeBookId);
      setComments(readBackComments);
      message.success('已发布笔记！');
    } catch (err) {
      message.error(`发布笔记失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!activeBookId) return;
    try {
      await deleteStoredComment(activeBookId, commentId);
      const updated = comments.filter((c) => c.id !== commentId);
      setComments(updated);
      message.info('评论已删除');
    } catch (e) {
      message.error('删除失败');
    }
  };

  const handleScrollToBlock = (blockId: string) => {
    setScrollToBlockId(blockId);
    setTimeout(() => setScrollToBlockId(null), 100);
  };

  const currentBook = books.find((b) => b.id === activeBookId) || null;
  const currentBlockIndex = currentPlayingBlockId
    ? blocks.findIndex((b) => b.id === currentPlayingBlockId) + 1
    : 0;

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#d4af37',
          colorBgBase: '#0f141c',
          colorBgContainer: '#171e28',
          colorBorder: '#2b3544',
          colorTextBase: '#f0f4f8',
          borderRadius: 8,
        },
      }}
    >
      <Layout style={{ height: '100vh', width: '100vw', overflow: 'hidden', position: 'relative' }}>
        <Sider
          width={260}
          breakpoint="md"
          collapsedWidth="0"
          style={{ backgroundColor: '#0f141c', borderRight: '1px solid #2b3544' }}
        >
          <BookList
            books={books}
            activeBookId={activeBookId}
            onSelectBook={handleSelectBook}
            onImportBook={handleImportBook}
            onDeleteBook={handleDeleteBook}
            onJumpToChapter={handleScrollToBlock}
          />
        </Sider>

        <Content style={{ position: 'relative', backgroundColor: '#0f141c' }}>
          <ReaderView
            currentBook={currentBook}
            blocks={blocks}
            comments={comments}
            currentPlayingBlockId={currentPlayingBlockId}
            scrollToBlockId={scrollToBlockId}
            onPlayBlock={handlePlayBlock}
            onUpdateBlockContent={handleUpdateBlockContent}
            onCreateComment={handleCreateComment}
          />

          {currentBook && (
            <AudioPlayer
              currentBlockIndex={currentBlockIndex}
              totalBlocks={blocks.length}
              isLoading={isAudioLoading}
              isPlaying={isPlaying}
              isPaused={isPaused}
              rate={playbackSpeed}
              voiceId={voiceId}
              onTogglePlayPause={handleTogglePlayPause}
              onPreviousBlock={handlePreviousBlock}
              onNextBlock={handleNextBlock}
              onChangeRate={handleChangeRate}
              onChangeVoice={handleChangeVoice}
              onLocateCurrentBlock={() => currentPlayingBlockId && handleScrollToBlock(currentPlayingBlockId)}
            />
          )}
        </Content>

        {currentBook && (
          <Sider
            width={300}
            breakpoint="lg"
            collapsedWidth="0"
            style={{ backgroundColor: '#0f141c', borderLeft: '1px solid #2b3544' }}
          >
            <CommentSidebar
              comments={comments}
              blocks={blocks}
              onScrollToBlock={handleScrollToBlock}
              onDeleteComment={handleDeleteComment}
            />
          </Sider>
        )}
      </Layout>
    </ConfigProvider>
  );
}
