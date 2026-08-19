import React from 'react';
import { List, Button, Typography, Popconfirm, Tooltip, Space, Badge } from 'antd';
import { BookOutlined, FileAddOutlined, DeleteOutlined, CheckCircleFilled, CloudDownloadOutlined, SettingOutlined, MenuFoldOutlined } from '@ant-design/icons';
import { Book } from '../../types/reader';
import { importTxtFile, importMarkdownFile } from '../../services/importer';

const { Text } = Typography;

interface BookListProps {
  books: Book[];
  activeBookId: string | null;
  onSelectBook: (bookId: string) => void;
  onImportBook: (book: Book, blocks: any[]) => void;
  onDeleteBook: (bookId: string) => void;
  onJumpToChapter?: (blockId: string) => void;
  /** 当前运行的应用版本号 */
  appVersion?: string;
  /** 是否有可用更新 */
  hasUpdate?: boolean;
  /** 打开更新弹窗回调 */
  onOpenUpdater?: () => void;
  /** 打开设置面板回调 */
  onOpenSettings?: () => void;
  /** 收起左侧书架侧栏 */
  onCollapseSider?: () => void;
}

/**
 * 左侧书架组件
 * @param {BookListProps} props 属性
 * @returns {JSX.Element} 组件节点
 */
export const BookList: React.FC<BookListProps> = ({
  books,
  activeBookId,
  onSelectBook,
  onImportBook,
  onDeleteBook,
  onJumpToChapter,
  appVersion = '0.2.1',
  hasUpdate = false,
  onOpenUpdater,
  onOpenSettings,
  onCollapseSider,
}) => {
  /**
   * 处理本地 TXT / Markdown 文件选择导入
   */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const isMarkdown = /\.(md|markdown)$/i.test(file.name);
      const { book, blocks } = isMarkdown
        ? await importMarkdownFile(file)
        : await importTxtFile(file);
      onImportBook(book, blocks);
    } catch (err) {
      console.error('Failed to import file:', err);
    } finally {
      // 重置 input 值以便重复选取相同文件
      e.target.value = '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1rem' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space size="small">
          <BookOutlined style={{ fontSize: '1.3rem', color: '#d4af37' }} />
          <Text strong style={{ fontSize: '1.1rem', color: '#f0f4f8' }}>
            我的书架
          </Text>
        </Space>

        <Space size={8}>
          {onCollapseSider && (
            <Tooltip title="收起书架">
              <Button
                type="text"
                size="small"
                icon={<MenuFoldOutlined style={{ color: '#8c9ba8', fontSize: '1rem' }} />}
                onClick={onCollapseSider}
              />
            </Tooltip>
          )}

          <label htmlFor="txt-upload-input">
            <Button
              type="primary"
              icon={<FileAddOutlined />}
              size="small"
              style={{ backgroundColor: '#d4af37', borderColor: '#d4af37' }}
              onClick={() => document.getElementById('txt-upload-input')?.click()}
            >
              导入书籍
            </Button>
          </label>
        </Space>
        <input
          id="txt-upload-input"
          type="file"
          accept=".txt,.md,.markdown"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <List
          dataSource={books}
          renderItem={(book) => {
            const isActive = book.id === activeBookId;
            return (
              <React.Fragment key={book.id}>
              <List.Item
                style={{
                  padding: '0.8rem',
                  marginBottom: '0.5rem',
                  borderRadius: '8px',
                  backgroundColor: isActive ? 'rgba(212, 175, 55, 0.12)' : '#171e28',
                  border: isActive ? '1px solid #d4af37' : '1px solid #2b3544',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => onSelectBook(book.id)}
              >
                <div style={{ flex: 1, overflow: 'hidden', marginRight: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.2rem' }}>
                    {isActive && (
                      <CheckCircleFilled style={{ color: '#d4af37', marginRight: '0.4rem', fontSize: '0.9rem' }} />
                    )}
                    <Text
                      ellipsis
                      style={{
                        color: isActive ? '#d4af37' : '#f0f4f8',
                        fontWeight: isActive ? 600 : 400,
                      }}
                    >
                      {book.title}
                    </Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: '0.8rem', color: '#8c9ba8' }}>
                    {book.totalBlocks} 个段落
                  </Text>
                </div>

                <Popconfirm
                  title="确认删除该书籍？"
                  description="删除后关联的进度与评论将一并清除"
                  onConfirm={(e) => {
                    e?.stopPropagation();
                    onDeleteBook(book.id);
                  }}
                  onCancel={(e) => e?.stopPropagation()}
                  okText="确定"
                  cancelText="取消"
                >
                  <Tooltip title="删除书籍">
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Tooltip>
                </Popconfirm>
              </List.Item>

              {/* 渲染该书的目录（如果是当前选中书且包含目录） */}
              {isActive && book.chapters && book.chapters.length > 0 && (
                <div style={{ marginLeft: '1rem', borderLeft: '1px solid #2b3544', paddingLeft: '0.8rem', marginBottom: '0.8rem' }}>
                  <Text type="secondary" style={{ fontSize: '0.8rem', marginBottom: '0.5rem', display: 'block' }}>
                    小说目录 ({book.chapters.length})
                  </Text>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                    {(book.chapters || []).map((chapter, index) => (
                      <div
                        key={index}
                        style={{
                          padding: '0.3rem 0.5rem',
                          paddingLeft: `${0.5 + ((chapter.level ?? 1) - 1) * 1}rem`,
                          fontSize: chapter.level === 2 ? '0.8rem' : '0.85rem',
                          color: '#8c9ba8',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#d4af37')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#8c9ba8')}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onJumpToChapter) {
                            onJumpToChapter(chapter.blockId);
                          }
                        }}
                      >
                        {chapter.title}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </React.Fragment>
            );
          }}
        />
      </div>

      {/* 底部版本与更新状态栏 */}
      <div
        style={{
          marginTop: '0.8rem',
          paddingTop: '0.8rem',
          borderTop: '1px solid #2b3544',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Space size="small">
          <Badge dot={hasUpdate} color="#d4af37">
            <Text type="secondary" style={{ fontSize: '0.8rem', color: '#8c9ba8' }}>
              晚读 v{appVersion}
            </Text>
          </Badge>
        </Space>

        <Space size={4}>
          <Tooltip title="打开设置 (⌘,)">
            <Button
              type="text"
              size="small"
              icon={<SettingOutlined style={{ color: '#8c9ba8' }} />}
              onClick={onOpenSettings}
              style={{
                fontSize: '0.8rem',
                color: '#8c9ba8',
                padding: '0 4px',
              }}
            />
          </Tooltip>

          <Button
            type="text"
            size="small"
            icon={<CloudDownloadOutlined style={{ color: hasUpdate ? '#d4af37' : '#8c9ba8' }} />}
            onClick={onOpenUpdater}
            style={{
              fontSize: '0.8rem',
              color: hasUpdate ? '#d4af37' : '#8c9ba8',
              padding: '0 4px',
            }}
          >
            {hasUpdate ? '发现新版本' : '检查更新'}
          </Button>
        </Space>
      </div>
    </div>
  );
};
