import React from 'react';
import { Typography, Empty } from 'antd';
import { Book, ParagraphBlock, Comment } from '../../types/reader';
import { ParagraphItem } from './ParagraphItem';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';

const { Title, Text } = Typography;

interface ReaderViewProps {
  currentBook: Book | null;
  blocks: ParagraphBlock[];
  comments: Comment[];
  currentPlayingBlockId: string | null;
  scrollToBlockId?: string | null;
  onPlayBlock: (blockId: string) => void;
  onUpdateBlockContent: (blockId: string, newContent: string) => void;
  onCreateComment: (blockId: string, quoteText: string, commentContent: string) => void;
}

export type ActiveOperatingState = { blockId: string; mode: 'editing' | 'commenting' } | null;

/**
 * 主阅读视窗组件
 */
export const ReaderView: React.FC<ReaderViewProps> = ({
  currentBook,
  blocks,
  comments,
  currentPlayingBlockId,
  scrollToBlockId,
  onPlayBlock,
  onUpdateBlockContent,
  onCreateComment,
}) => {
  const virtuosoRef = React.useRef<VirtuosoHandle>(null);
  const [activeOperating, setActiveOperating] = React.useState<ActiveOperatingState>(null);
  const isFollowMode = React.useRef(true);

  // 1. 自动跟读滚屏 (仅在跟随模式激活时生效)
  React.useEffect(() => {
    if (isFollowMode.current && currentPlayingBlockId && virtuosoRef.current) {
      const idx = blocks.findIndex((b) => b.id === currentPlayingBlockId);
      if (idx !== -1) {
        virtuosoRef.current.scrollToIndex({ index: idx, align: 'center', behavior: 'smooth' });
      }
    }
  }, [currentPlayingBlockId, blocks]);

  // 2. 响应外部强制跳转 (例如点击目录、点击定位按钮)
  React.useEffect(() => {
    if (scrollToBlockId && virtuosoRef.current) {
      isFollowMode.current = true; // 强制跳转时重新激活跟随模式
      const idx = blocks.findIndex((b) => b.id === scrollToBlockId);
      if (idx !== -1) {
        virtuosoRef.current.scrollToIndex({ index: idx, align: 'center', behavior: 'smooth' });
      }
    }
  }, [scrollToBlockId, blocks]);

  // 当用户手动滑动滚轮或触摸屏幕时，立刻关闭跟随模式，把控制权还给用户
  const handleUserScroll = () => {
    if (isFollowMode.current) {
      isFollowMode.current = false;
    }
  };
  if (!currentBook) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description={<Text style={{ color: '#8c9ba8' }}>请在左侧书架选择或导入图书进行阅读</Text>} />
      </div>
    );
  }

  // 映射统计各段落的评论数
  const commentCountMap = new Map<string, number>();
  for (const c of comments) {
    if (!c.isOrphaned) {
      commentCountMap.set(c.blockId, (commentCountMap.get(c.blockId) || 0) + 1);
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部文章标题区 */}
      <div
        style={{
          padding: '1.2rem 2rem',
          borderBottom: '1px solid #2b3544',
          backgroundColor: '#171e28',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0, color: '#d4af37' }}>
            {currentBook.title}
          </Title>
          <Text type="secondary" style={{ fontSize: '0.85rem', color: '#8c9ba8' }}>
            文件: {currentBook.fileName} · 共 {blocks.length} 个自然段落
          </Text>
        </div>
      </div>

      {/* 段落卡片列表滚动容器（引入虚拟化） */}
      <div 
        style={{ flex: 1, overflowY: 'auto' }} 
        onWheel={handleUserScroll} 
        onTouchMove={handleUserScroll}
      >
        <Virtuoso
          ref={virtuosoRef}
          style={{ height: '100%' }}
          data={blocks}
          itemContent={(index, block) => (
            <div style={{ padding: '0 2rem', paddingTop: index === 0 ? '1.5rem' : 0 }}>
              <ParagraphItem
                block={block}
                isPlaying={block.id === currentPlayingBlockId}
                commentCount={commentCountMap.get(block.id) || 0}
                activeOperating={activeOperating}
                onActiveOperatingChange={setActiveOperating}
                onPlay={onPlayBlock}
                onUpdateContent={onUpdateBlockContent}
                onCreateComment={onCreateComment}
              />
            </div>
          )}
          components={{
            Footer: () => <div style={{ height: '10rem' }} />
          }}
        />
      </div>
    </div>
  );
};
