import React from 'react';
import { List, Button, Typography, Popconfirm, Tooltip, Space } from 'antd';
import { BookOutlined, FileAddOutlined, DeleteOutlined, CheckCircleFilled } from '@ant-design/icons';
import { Book } from '../../types/reader';
import { importTxtFile } from '../../services/importer';

const { Text } = Typography;

interface BookListProps {
  books: Book[];
  activeBookId: string | null;
  onSelectBook: (bookId: string) => void;
  onImportBook: (book: Book, blocks: any[]) => void;
  onDeleteBook: (bookId: string) => void;
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
}) => {
  /**
   * 处理本地 TXT 文件选择导入
   */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { book, blocks } = await importTxtFile(file);
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

        <label htmlFor="txt-upload-input">
          <Button
            type="primary"
            icon={<FileAddOutlined />}
            size="small"
            style={{ backgroundColor: '#d4af37', borderColor: '#d4af37' }}
            onClick={() => document.getElementById('txt-upload-input')?.click()}
          >
            导入 TXT
          </Button>
        </label>
        <input
          id="txt-upload-input"
          type="file"
          accept=".txt"
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
            );
          }}
        />
      </div>
    </div>
  );
};
