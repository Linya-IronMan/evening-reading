import React, { useState } from 'react';
import { Card, Typography, Button, Popconfirm, Tag, Empty, Space, Input, Tooltip } from 'antd';
import {
  MessageOutlined,
  DeleteOutlined,
  AimOutlined,
  WarningOutlined,
  EditOutlined,
  PlusOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { Comment, ParagraphBlock, SubComment } from '../../types/reader';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface CommentSidebarProps {
  comments: Comment[];
  blocks: ParagraphBlock[];
  onScrollToBlock: (blockId: string, quoteText?: string) => void;
  onUpdateComment: (comment: Comment) => void;
  onDeleteComment: (commentId: string) => void;
}

/**
 * 单条评论卡片（支持就地编辑主评论、追加子评论与子评论独立编辑/删除）
 */
const CommentCardItem: React.FC<{
  comment: Comment;
  block?: ParagraphBlock;
  onScrollToBlock: (blockId: string, quoteText?: string) => void;
  onUpdateComment: (comment: Comment) => void;
  onDeleteComment: (commentId: string) => void;
}> = ({ comment, block, onScrollToBlock, onUpdateComment, onDeleteComment }) => {
  const isOrphaned = !block || comment.isOrphaned;

  // 主评论编辑状态
  const [isEditingMain, setIsEditingMain] = useState<boolean>(false);
  const [mainContent, setMainContent] = useState<string>(comment.content);

  // 追加子评论输入状态
  const [isAddingReply, setIsAddingReply] = useState<boolean>(false);
  const [replyInput, setReplyInput] = useState<string>('');

  // 编辑某条子评论的状态
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [subContentInput, setSubContentInput] = useState<string>('');

  // 保存主评论修改
  const handleSaveMainEdit = () => {
    if (mainContent.trim().length === 0) return;
    onUpdateComment({
      ...comment,
      content: mainContent.trim(),
      updatedAt: Date.now(),
    });
    setIsEditingMain(false);
  };

  // 取消主评论修改
  const handleCancelMainEdit = () => {
    setMainContent(comment.content);
    setIsEditingMain(false);
  };

  // 提交新增子评论
  const handleAddReply = () => {
    if (replyInput.trim().length === 0) return;
    const newSub: SubComment = {
      id: 'sub_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36),
      content: replyInput.trim(),
      createdAt: Date.now(),
    };
    const updatedReplies = [...(comment.replies || []), newSub];
    onUpdateComment({
      ...comment,
      replies: updatedReplies,
      updatedAt: Date.now(),
    });
    setReplyInput('');
    setIsAddingReply(false);
  };

  // 保存子评论修改
  const handleSaveSubEdit = (subId: string) => {
    if (subContentInput.trim().length === 0) return;
    const updatedReplies = (comment.replies || []).map((sub) => {
      if (sub.id === subId) {
        return { ...sub, content: subContentInput.trim(), updatedAt: Date.now() };
      }
      return sub;
    });
    onUpdateComment({
      ...comment,
      replies: updatedReplies,
      updatedAt: Date.now(),
    });
    setEditingSubId(null);
    setSubContentInput('');
  };

  // 删除某条子评论
  const handleDeleteSub = (subId: string) => {
    const updatedReplies = (comment.replies || []).filter((sub) => sub.id !== subId);
    onUpdateComment({
      ...comment,
      replies: updatedReplies,
      updatedAt: Date.now(),
    });
  };

  return (
    <Card
      size="small"
      style={{
        marginBottom: '0.9rem',
        backgroundColor: '#171e28',
        borderColor: isOrphaned ? '#faad14' : '#2b3544',
        borderRadius: '8px',
      }}
    >
      {/* 顶部操作工具栏 (彻底移除了段落标记) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
        <div>
          {isOrphaned && (
            <Tag color="warning" icon={<WarningOutlined />}>
              孤立评论 (原文已改)
            </Tag>
          )}
        </div>

        <Space size="small">
          {!isOrphaned && (
            <Tooltip title="定位到正文段落">
              <Button
                type="text"
                size="small"
                icon={<AimOutlined style={{ color: '#4096ff' }} />}
                onClick={() => onScrollToBlock(comment.blockId, comment.quoteText)}
              >
                定位
              </Button>
            </Tooltip>
          )}

          {!isEditingMain && (
            <Tooltip title="编辑此条评论">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined style={{ color: '#8c9ba8' }} />}
                onClick={() => {
                  setMainContent(comment.content);
                  setIsEditingMain(true);
                }}
              />
            </Tooltip>
          )}

          <Popconfirm
            title="确认删除该评论及所有追加笔记？"
            onConfirm={() => onDeleteComment(comment.id)}
            okText="确认"
            cancelText="取消"
          >
            <Tooltip title="删除评论">
              <Button type="text" danger size="small" icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      </div>

      {/* 划线快照引用 */}
      <div
        style={{
          backgroundColor: '#0f141c',
          padding: '0.4rem 0.6rem',
          borderLeft: '3px solid #d4af37',
          marginBottom: '0.6rem',
          fontSize: '0.82rem',
          color: '#8c9ba8',
          borderRadius: '2px',
        }}
      >
        “{comment.quoteText}”
      </div>

      {/* 主评论内容区域 (支持就地编辑) */}
      {isEditingMain ? (
        <div style={{ marginBottom: '0.6rem' }}>
          <TextArea
            rows={3}
            value={mainContent}
            onChange={(e) => setMainContent(e.target.value)}
            style={{
              backgroundColor: '#0f141c',
              color: '#f0f4f8',
              borderColor: '#d4af37',
              fontSize: '0.88rem',
              marginBottom: '0.4rem',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
            <Button size="small" icon={<CloseOutlined />} onClick={handleCancelMainEdit}>
              取消
            </Button>
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              style={{ backgroundColor: '#d4af37', borderColor: '#d4af37' }}
              onClick={handleSaveMainEdit}
            >
              保存
            </Button>
          </div>
        </div>
      ) : (
        <Paragraph style={{ color: '#f0f4f8', margin: '0 0 0.5rem 0', fontSize: '0.9rem', lineHeight: 1.6 }}>
          {comment.content}
        </Paragraph>
      )}

      {/* 子评论列表 (追加笔记列表) */}
      {comment.replies && comment.replies.length > 0 && (
        <div
          style={{
            marginTop: '0.5rem',
            paddingLeft: '0.75rem',
            borderLeft: '2px solid rgba(212, 175, 55, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
          }}
        >
          {comment.replies.map((sub) => {
            const isEditingThisSub = editingSubId === sub.id;

            return (
              <div
                key={sub.id}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  padding: '0.35rem 0.55rem',
                  borderRadius: '4px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                {isEditingThisSub ? (
                  <div>
                    <TextArea
                      rows={2}
                      value={subContentInput}
                      onChange={(e) => setSubContentInput(e.target.value)}
                      style={{
                        backgroundColor: '#0f141c',
                        color: '#f0f4f8',
                        borderColor: '#d4af37',
                        fontSize: '0.85rem',
                        marginBottom: '0.3rem',
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.3rem' }}>
                      <Button size="small" onClick={() => setEditingSubId(null)}>
                        取消
                      </Button>
                      <Button
                        type="primary"
                        size="small"
                        style={{ backgroundColor: '#d4af37', borderColor: '#d4af37' }}
                        onClick={() => handleSaveSubEdit(sub.id)}
                      >
                        保存
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={{ color: '#e1e7ec', fontSize: '0.85rem', flex: 1, lineHeight: 1.5 }}>
                      {sub.content}
                    </Text>

                    <Space size={2} style={{ marginLeft: 6 }}>
                      <Button
                        type="text"
                        size="small"
                        style={{ padding: '0 4px', height: '20px', color: '#8c9ba8' }}
                        icon={<EditOutlined style={{ fontSize: '11px' }} />}
                        onClick={() => {
                          setEditingSubId(sub.id);
                          setSubContentInput(sub.content);
                        }}
                      />
                      <Popconfirm
                        title="确认删除该条追加笔记？"
                        onConfirm={() => handleDeleteSub(sub.id)}
                        okText="确认"
                        cancelText="取消"
                      >
                        <Button
                          type="text"
                          danger
                          size="small"
                          style={{ padding: '0 4px', height: '20px' }}
                          icon={<DeleteOutlined style={{ fontSize: '11px' }} />}
                        />
                      </Popconfirm>
                    </Space>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 底部“+ 追加笔记”按钮与输入框 */}
      <div style={{ marginTop: '0.5rem' }}>
        {isAddingReply ? (
          <div style={{ marginTop: '0.3rem' }}>
            <TextArea
              rows={2}
              placeholder="写下对该条划线的追加笔记或感悟..."
              value={replyInput}
              onChange={(e) => setReplyInput(e.target.value)}
              style={{
                backgroundColor: '#0f141c',
                color: '#f0f4f8',
                borderColor: '#d4af37',
                fontSize: '0.85rem',
                marginBottom: '0.35rem',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
              <Button size="small" onClick={() => setIsAddingReply(false)}>
                取消
              </Button>
              <Button
                type="primary"
                size="small"
                style={{ backgroundColor: '#d4af37', borderColor: '#d4af37' }}
                onClick={handleAddReply}
              >
                追加笔记
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="dashed"
            size="small"
            block
            icon={<PlusOutlined />}
            style={{
              fontSize: '0.8rem',
              borderColor: 'rgba(212, 175, 55, 0.3)',
              color: '#d4af37',
              height: '24px',
            }}
            onClick={() => setIsAddingReply(true)}
          >
            追加笔记
          </Button>
        )}
      </div>
    </Card>
  );
};

/**
 * 右侧划线评论侧边栏组件
 */
export const CommentSidebar: React.FC<CommentSidebarProps> = ({
  comments,
  blocks,
  onScrollToBlock,
  onUpdateComment,
  onDeleteComment,
}) => {
  const blockMap = new Map<string, ParagraphBlock>();
  for (const b of blocks) {
    blockMap.set(b.id, b);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1rem' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <MessageOutlined style={{ fontSize: '1.2rem', color: '#d4af37' }} />
        <Text strong style={{ fontSize: '1.1rem', color: '#f0f4f8' }}>
          划线与笔记 ({comments.length})
        </Text>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {comments.length === 0 ? (
          <div style={{ padding: '3rem 0', textAlign: 'center' }}>
            <Empty description={<Text style={{ color: '#8c9ba8', fontSize: '0.85rem' }}>暂无评论，选中文本即可发布划线感悟</Text>} />
          </div>
        ) : (
          comments.map((comment) => {
            const block = blockMap.get(comment.blockId);
            return (
              <CommentCardItem
                key={comment.id}
                comment={comment}
                block={block}
                onScrollToBlock={onScrollToBlock}
                onUpdateComment={onUpdateComment}
                onDeleteComment={onDeleteComment}
              />
            );
          })
        )}
      </div>
    </div>
  );
};
