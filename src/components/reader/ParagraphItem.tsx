import React, { useState, useEffect, useRef } from 'react';
import { Button, Input, Popover, Space, Typography, Tooltip } from 'antd';
import { PlayCircleOutlined, SoundOutlined, EditOutlined, MessageOutlined, CheckOutlined, CloseOutlined, FormOutlined } from '@ant-design/icons';
import { ParagraphBlock } from '../../types/reader';
import { ActiveOperatingState } from './ReaderView';

const { TextArea } = Input;
const { Text } = Typography;

interface ParagraphItemProps {
  block: ParagraphBlock;
  isPlaying: boolean;
  isChapterHeader?: boolean;
  isFlashing?: boolean;
  flashingQuote?: string;
  commentCount: number;
  activeOperating: ActiveOperatingState;
  onActiveOperatingChange: (state: ActiveOperatingState) => void;
  onPlay: (blockId: string) => void;
  onUpdateContent: (blockId: string, newContent: string) => void;
  onCreateComment: (blockId: string, quoteText: string, commentContent: string) => void;
}

/**
 * 独立段落块卡片组件（包含编辑与选区评论交互）
 */
export const ParagraphItem: React.FC<ParagraphItemProps> = ({
  block,
  isPlaying,
  isChapterHeader = false,
  isFlashing = false,
  flashingQuote,
  commentCount,
  activeOperating,
  onActiveOperatingChange,
  onPlay,
  onUpdateContent,
  onCreateComment,
}) => {
  const isEditing = activeOperating?.blockId === block.id && activeOperating?.mode === 'editing';
  const isSelected = activeOperating?.blockId === block.id && activeOperating?.mode === 'selected';
  const isOperatingOtherBlock = activeOperating !== null && activeOperating.blockId !== block.id;

  const [editValue, setEditValue] = useState<string>(block.content);

  // 选中文本评论 Popover 状态
  const popoverRef = useRef<HTMLDivElement>(null);
  const lastSelectionTimeRef = useRef<number>(0);
  const [selectedText, setSelectedText] = useState<string>('');
  const [commentInput, setCommentInput] = useState<string>('');
  const [popoverOpen, setPopoverOpen] = useState<boolean>(false);

  // 同步外部 activeOperating 状态：如果当前不是 commenting，则确保 popover 关闭
  useEffect(() => {
    if (activeOperating?.blockId !== block.id || activeOperating?.mode !== 'commenting') {
      setPopoverOpen(false);
    }
  }, [activeOperating, block.id]);

  // 全局清理：点击页面任意其他地方时自动关闭 Popover
  useEffect(() => {
    if (!popoverOpen) return;

    const handleGlobalPointerDown = (e: MouseEvent | PointerEvent) => {
      // 如果刚刚进行了文本划选，忽略本次 pointerdown 判定
      if (Date.now() - lastSelectionTimeRef.current < 250) {
        return;
      }

      const target = e.target as HTMLElement | null;
      if (!target) return;

      // 如果点击在 Ant Design 的 Popover 气泡弹层内部，则保持打开
      if (target.closest && (target.closest('.ant-popover') || target.closest('.ant-popover-content'))) {
        return;
      }
      if (popoverRef.current && popoverRef.current.contains(target)) {
        return;
      }

      // 点击外部：自动关闭弹窗并清理高亮选区
      setPopoverOpen(false);
      onActiveOperatingChange(null);
      window.getSelection()?.removeAllRanges();
    };

    // 使用捕获阶段捕获所有外部点击
    document.addEventListener('pointerdown', handleGlobalPointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handleGlobalPointerDown, true);
    };
  }, [popoverOpen, onActiveOperatingChange]);

  /**
   * 监听文本选中事件
   */
  const handleMouseUp = () => {
    if (isEditing || isOperatingOtherBlock) return;

    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      const text = selection.toString().trim();
      if (text.length > 0) {
        lastSelectionTimeRef.current = Date.now();
        setSelectedText(text);
        setPopoverOpen(true);
        onActiveOperatingChange({ blockId: block.id, mode: 'commenting' });
        return;
      }
    }
  };

  /**
   * 提交编辑保存
   */
  const handleSaveEdit = () => {
    if (editValue.trim().length > 0) {
      onUpdateContent(block.id, editValue.trim());
    }
    onActiveOperatingChange(null);
  };

  /**
   * 取消编辑
   */
  const handleCancelEdit = () => {
    setEditValue(block.content);
    onActiveOperatingChange(null);
  };

  /**
   * 提交新增评论
   */
  const handleAddComment = () => {
    if (commentInput.trim().length > 0 && selectedText.length > 0) {
      onCreateComment(block.id, selectedText, commentInput.trim());
      setCommentInput('');
      setSelectedText('');
      setPopoverOpen(false);
      onActiveOperatingChange(null);
      // 清除窗口选中状态
      window.getSelection()?.removeAllRanges();
    }
  };

  /**
   * 全段评论入口
   */
  const handleParagraphComment = () => {
    if (isOperatingOtherBlock) return;
    const summaryText = block.content.length > 30 ? block.content.substring(0, 30) + '...' : block.content;
    setSelectedText(`【全段点评】${summaryText}`);
    setPopoverOpen(true);
    onActiveOperatingChange({ blockId: block.id, mode: 'commenting' });
  };

  // Popover 浮动面板内容
  const popoverContent = (
    <div ref={popoverRef} onClick={(e) => e.stopPropagation()} style={{ width: 260, padding: '0.2rem' }}>
      <Text type="secondary" style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.4rem' }}>
        已选划线: “{selectedText.length > 20 ? selectedText.substring(0, 20) + '...' : selectedText}”
      </Text>
      <TextArea
        rows={3}
        placeholder="写下您的感悟或评论..."
        value={commentInput}
        onChange={(e) => setCommentInput(e.target.value)}
        style={{ marginBottom: '0.6rem', fontSize: '0.85rem' }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
        <Button size="small" onClick={() => {
          setPopoverOpen(false);
          onActiveOperatingChange(null);
        }}>
          取消
        </Button>
        <Button
          type="primary"
          size="small"
          style={{ backgroundColor: '#d4af37', borderColor: '#d4af37' }}
          onClick={handleAddComment}
        >
          发布评论
        </Button>
      </div>
    </div>
  );

  return (
    <Popover
      content={popoverContent}
      title="添加选区评论"
      trigger={[]}
      open={popoverOpen}
      onOpenChange={(open) => {
        if (!open) {
          setPopoverOpen(false);
          onActiveOperatingChange(null);
        }
      }}
    >
      <div
        id={`block-${block.id}`}
        className={`paragraph-container ${isPlaying ? 'paragraph-active' : ''} ${isSelected ? 'paragraph-selected' : ''} ${isChapterHeader ? 'paragraph-chapter-header' : ''} ${isFlashing ? 'paragraph-flashing' : ''}`}
        style={{
          opacity: isOperatingOtherBlock ? 0.5 : 1,
          cursor: isOperatingOtherBlock ? 'default' : 'pointer',
        }}
        onMouseUp={handleMouseUp}
        onClick={(e) => {
          e.stopPropagation();

          // 如果刚刚进行了划选，或者当前正处于评论弹窗输入模式，不切换段落卡片选中态
          if (Date.now() - lastSelectionTimeRef.current < 300 || popoverOpen) {
            return;
          }
          const sel = window.getSelection();
          if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
            return;
          }

          if (!isEditing && !isOperatingOtherBlock) {
            // Toggle selection
            if (isSelected) {
              onActiveOperatingChange(null);
            } else {
              onActiveOperatingChange({ blockId: block.id, mode: 'selected' });
            }
          }
        }}
      >
        <div className="paragraph-actions">
          <Tooltip title="从该段开始朗读" placement="top">
            <Button
              type="text"
              size="small"
              icon={<PlayCircleOutlined style={{ color: isPlaying ? '#d4af37' : '#8c9ba8' }} />}
              onClick={(e) => {
                e.stopPropagation();
                onPlay(block.id);
              }}
            />
          </Tooltip>
          {!isEditing && (
            <>
              <Tooltip title="评论本段" placement="top">
                <Button
                  type="text"
                  size="small"
                  icon={<FormOutlined style={{ color: '#8c9ba8' }} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleParagraphComment();
                  }}
                />
              </Tooltip>
              <Tooltip title="编辑此段落" placement="top">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined style={{ color: '#8c9ba8' }} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditValue(block.content);
                    onActiveOperatingChange({ blockId: block.id, mode: 'editing' });
                  }}
                />
              </Tooltip>
            </>
          )}
        </div>

        {isEditing ? (
          <div style={{ marginTop: '0.5rem' }}>
            <TextArea
              rows={4}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              style={{
                backgroundColor: '#0f141c',
                color: '#f0f4f8',
                borderColor: '#d4af37',
                marginBottom: '0.6rem',
                fontSize: '1rem',
                lineHeight: 1.8,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button size="small" icon={<CloseOutlined />} onClick={handleCancelEdit}>
                取消
              </Button>
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                style={{ backgroundColor: '#d4af37', borderColor: '#d4af37' }}
                onClick={handleSaveEdit}
              >
                保存
              </Button>
            </div>
          </div>
        ) : (
          <div className="reader-paragraph-text">
            {(() => {
              if (!isFlashing || !flashingQuote) {
                return block.content;
              }
              const cleanQuote = flashingQuote.replace(/^【全段点评】/, '').trim();
              if (!cleanQuote || !block.content.includes(cleanQuote)) {
                return block.content;
              }
              const parts = block.content.split(cleanQuote);
              return (
                <>
                  {parts.map((part, i) => (
                    <React.Fragment key={i}>
                      {part}
                      {i < parts.length - 1 && (
                        <mark className="quote-highlight-flash">{cleanQuote}</mark>
                      )}
                    </React.Fragment>
                  ))}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </Popover>
  );
};
