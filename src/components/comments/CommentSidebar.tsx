import React from 'react';
import { Card, Typography, Button, Popconfirm, Tag, Empty, Space } from 'antd';
import { MessageOutlined, DeleteOutlined, AimOutlined, WarningOutlined } from '@ant-design/icons';
import { Comment, ParagraphBlock } from '../../types/reader';

const { Text, Paragraph } = Typography;

interface CommentSidebarProps {
  comments: Comment[];
  blocks: ParagraphBlock[];
  onScrollToBlock: (blockId: string, quoteText?: string) => void;
  onDeleteComment: (commentId: string) => void;
}

/**
 * 右侧划线评论侧边栏组件
 */
export const CommentSidebar: React.FC<CommentSidebarProps> = ({
  comments,
  blocks,
  onScrollToBlock,
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
            const isOrphaned = !block || comment.isOrphaned;

            return (
              <Card
                key={comment.id}
                size="small"
                style={{
                  marginBottom: '0.8rem',
                  backgroundColor: '#171e28',
                  borderColor: isOrphaned ? '#faad14' : '#2b3544',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <Space size="small">
                    {isOrphaned ? (
                      <Tag color="warning" icon={<WarningOutlined />}>
                        孤立评论 (原文已改)
                      </Tag>
                    ) : (
                      <Tag color="gold">段落 #{block.index + 1}</Tag>
                    )}
                  </Space>

                  <Space size="small">
                    {!isOrphaned && (
                      <Button
                        type="text"
                        size="small"
                        icon={<AimOutlined style={{ color: '#4096ff' }} />}
                        onClick={() => onScrollToBlock(comment.blockId, comment.quoteText)}
                      >
                        定位
                      </Button>
                    )}

                    <Popconfirm
                      title="确认删除该评论？"
                      onConfirm={() => onDeleteComment(comment.id)}
                      okText="确认"
                      cancelText="取消"
                    >
                      <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                </div>

                {/* 划线快照引用 */}
                <div
                  style={{
                    backgroundColor: '#0f141c',
                    padding: '0.4rem 0.6rem',
                    borderLeft: '3px solid #d4af37',
                    marginBottom: '0.5rem',
                    fontSize: '0.8rem',
                    color: '#8c9ba8',
                    borderRadius: '2px',
                  }}
                >
                  “{comment.quoteText}”
                </div>

                {/* 评论内容 */}
                <Paragraph style={{ color: '#f0f4f8', margin: 0, fontSize: '0.9rem' }}>
                  {comment.content}
                </Paragraph>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};
