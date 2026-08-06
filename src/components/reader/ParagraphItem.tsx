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
  commentCount,
  activeOperating,
  onActiveOperatingChange,
  onPlay,
  onUpdateContent,
  onCreateComment,
}) => {
  const isEditing = activeOperating?.blockId === block.id && activeOperating?.mode === 'editing';
  const isOperatingOtherBlock = activeOperating !== null && activeOperating.blockId !== block.id;

  const [editValue, setEditValue] = useState<string>(block.content);

  // 选中文本评论 Popover 状态
  const popoverRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [selectedText, setSelectedText] = useState<string>('');
  const [commentInput, setCommentInput] = useState<string>('');
  const [popoverOpen, setPopoverOpen] = useState<boolean>(false);

  // 全局清理：点击外部关闭 Popover
  useEffect(() => {
    const handleGlobalMouseDown = (e: MouseEvent) => {
      if (popoverOpen) {
        const target = e.target as Node;
        // 如果点击不在 popover 内部，且不在 card 内部，则关闭
        if (
          popoverRef.current && !popoverRef.current.contains(target) &&
          cardRef.current && !cardRef.current.contains(target)
        ) {
          setPopoverOpen(false);
          onActiveOperatingChange(null);
          window.getSelection()?.removeAllRanges();
        }
      }
    };
    
    document.addEventListener('mousedown', handleGlobalMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleGlobalMouseDown);
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
        className={`paragraph-container ${isPlaying ? 'paragraph-active' : ''}`}
        style={{
          opacity: isOperatingOtherBlock ? 0.5 : 1,
          pointerEvents: isOperatingOtherBlock ? 'none' : 'auto',
        }}
        onMouseUp={handleMouseUp}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="paragraph-actions">
          <Tooltip title="从该段开始朗读" placement="top">
            <Button
              type="text"
              size="small"
              icon={<PlayCircleOutlined style={{ color: isPlaying ? '#d4af37' : '#8c9ba8' }} />}
              onClick={() => onPlay(block.id)}
            />
          </Tooltip>
          {!isEditing && (
            <>
              <Tooltip title="评论本段" placement="top">
                <Button
                  type="text"
                  size="small"
                  icon={<FormOutlined style={{ color: '#8c9ba8' }} />}
                  onClick={handleParagraphComment}
                />
              </Tooltip>
              <Tooltip title="编辑此段落" placement="top">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined style={{ color: '#8c9ba8' }} />}
                  onClick={() => {
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
            {block.content}
          </div>
        )}
      </div>
    </Popover>
  );
};
