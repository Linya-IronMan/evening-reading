import React from 'react';
import { Modal, Button, Typography, Progress, Space, Alert } from 'antd';
import {
  CloudDownloadOutlined,
  ReloadOutlined,
  CheckCircleFilled,
  SyncOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { UpdateStateStatus } from '../../hooks/useUpdater';
import type { DownloadProgress, UpdateMetadata } from '../../services/updaterApi';

const { Text, Paragraph, Title } = Typography;

/**
 * UpdateModal 组件入参属性
 */
export interface UpdateModalProps {
  /** 弹窗是否可见 */
  visible: boolean;
  /** 当前更新状态 */
  status: UpdateStateStatus;
  /** 当前应用版本 */
  currentVersion: string;
  /** 更新详情元数据 */
  metadata: UpdateMetadata | null;
  /** 下载进度信息 */
  progress: DownloadProgress | null;
  /** 错误信息 */
  error: string | null;
  /** 是否处于朗读忙碌状态 */
  isBusy: boolean;
  /** 关闭/隐藏弹窗回调 */
  onClose: () => void;
  /** 点击触发检查更新 */
  onCheckForUpdate: () => void;
  /** 点击触发下载并安装 */
  onInstallUpdate: () => void;
  /** 点击触发安全重启 */
  onRestart: () => void;
}

/**
 * 原地更新交互弹窗
 *
 * @param {UpdateModalProps} props 组件属性
 * @returns {React.ReactElement}
 */
export const UpdateModal: React.FC<UpdateModalProps> = ({
  visible,
  status,
  currentVersion,
  metadata,
  progress,
  error,
  isBusy,
  onClose,
  onCheckForUpdate,
  onInstallUpdate,
  onRestart,
}) => {
  const isChecking = status === 'checking';
  const isDownloading = status === 'downloading';
  const isReady = status === 'ready';
  const isAvailable = status === 'available';
  const isUpToDate = status === 'up-to-date';
  const isError = status === 'error';

  return (
    <Modal
      open={visible}
      onCancel={isDownloading ? undefined : onClose}
      closable={!isDownloading}
      maskClosable={!isDownloading}
      footer={null}
      centered
      width={480}
      styles={{
        content: {
          backgroundColor: '#171e28',
          border: '1px solid #2b3544',
          borderRadius: '12px',
          padding: '1.5rem',
          color: '#f0f4f8',
        },
        header: {
          backgroundColor: '#171e28',
          borderBottom: '1px solid #2b3544',
          paddingBottom: '0.8rem',
          marginBottom: '1.2rem',
        },
      }}
      title={
        <Space align="center">
          <CloudDownloadOutlined style={{ color: '#d4af37', fontSize: '1.2rem' }} />
          <span style={{ color: '#f0f4f8', fontWeight: 600 }}>软件更新</span>
        </Space>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* 1. 检查中状态 */}
        {isChecking && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <SyncOutlined spin style={{ fontSize: '2rem', color: '#d4af37', marginBottom: '1rem' }} />
            <div>
              <Text style={{ color: '#f0f4f8', fontSize: '1rem' }}>正在连接服务器检查新版本...</Text>
            </div>
          </div>
        )}

        {/* 2. 已是最新版本 */}
        {isUpToDate && (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <CheckCircleFilled style={{ fontSize: '2.5rem', color: '#52c41a', marginBottom: '0.8rem' }} />
            <div>
              <Title level={4} style={{ color: '#f0f4f8', margin: 0 }}>
                已是最新版本
              </Title>
              <Text type="secondary" style={{ color: '#8c9ba8', marginTop: '0.4rem', display: 'block' }}>
                当前运行版本: v{currentVersion}
              </Text>
            </div>
            <div style={{ marginTop: '1.5rem' }}>
              <Button type="primary" onClick={onClose} style={{ backgroundColor: '#d4af37', borderColor: '#d4af37' }}>
                确定
              </Button>
            </div>
          </div>
        )}

        {/* 3. 发现新版本 (Available) */}
        {isAvailable && metadata && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.8rem' }}>
              <div>
                <Text style={{ color: '#8c9ba8', fontSize: '0.85rem' }}>发现新版本</Text>
                <Title level={3} style={{ color: '#d4af37', margin: 0 }}>
                  v{metadata.version}
                </Title>
              </div>
              <Text type="secondary" style={{ color: '#8c9ba8', fontSize: '0.85rem' }}>
                当前: v{currentVersion}
              </Text>
            </div>

            {metadata.notes && (
              <div
                style={{
                  backgroundColor: '#121820',
                  border: '1px solid #2b3544',
                  borderRadius: '8px',
                  padding: '0.8rem 1rem',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  marginBottom: '1rem',
                }}
              >
                <Text strong style={{ color: '#f0f4f8', display: 'block', marginBottom: '0.4rem' }}>
                  更新说明:
                </Text>
                <Paragraph
                  style={{
                    color: '#c5d1de',
                    fontSize: '0.88rem',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {metadata.notes}
                </Paragraph>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', marginTop: '1rem' }}>
              <Button onClick={onClose} style={{ color: '#8c9ba8', borderColor: '#2b3544' }}>
                稍后提醒
              </Button>
              <Button
                type="primary"
                icon={<CloudDownloadOutlined />}
                onClick={onInstallUpdate}
                style={{ backgroundColor: '#d4af37', borderColor: '#d4af37', color: '#121820', fontWeight: 600 }}
              >
                立即下载并更新
              </Button>
            </div>
          </div>
        )}

        {/* 4. 下载与解包安装中 (Downloading) */}
        {isDownloading && (
          <div style={{ padding: '1rem 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <Text style={{ color: '#f0f4f8' }}>正在下载并原地安装更新包...</Text>
              <Text style={{ color: '#d4af37', fontWeight: 600 }}>
                {progress?.percent !== null && progress?.percent !== undefined ? `${progress.percent}%` : '下载中...'}
              </Text>
            </div>
            <Progress
              percent={progress?.percent ?? 0}
              status="active"
              strokeColor="#d4af37"
              trailColor="#2b3544"
              showInfo={false}
            />
            <Text type="secondary" style={{ color: '#8c9ba8', fontSize: '0.8rem', marginTop: '0.5rem', display: 'block' }}>
              下载完成后将自动就绪，支持稍后无缝重启生效。
            </Text>
          </div>
        )}

        {/* 5. 更新已就绪待重启 (Ready) */}
        {isReady && (
          <div style={{ padding: '0.5rem 0' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
              <CheckCircleFilled style={{ fontSize: '2.5rem', color: '#52c41a', marginBottom: '0.6rem' }} />
              <Title level={4} style={{ color: '#f0f4f8', margin: 0 }}>
                更新已安装完成
              </Title>
              <Text type="secondary" style={{ color: '#8c9ba8', marginTop: '0.3rem', display: 'block' }}>
                新版本已就绪，重启应用后即可生效。
              </Text>
            </div>

            {isBusy && (
              <Alert
                type="warning"
                showIcon
                icon={<ExclamationCircleOutlined style={{ color: '#faad14' }} />}
                message="正在语音朗读中"
                description="点击立即重启将先停止朗读并自动保存当前阅读进度。"
                style={{
                  backgroundColor: 'rgba(250, 173, 20, 0.1)',
                  border: '1px solid rgba(250, 173, 20, 0.3)',
                  marginBottom: '1rem',
                  color: '#f0f4f8',
                }}
              />
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', marginTop: '1rem' }}>
              <Button onClick={onClose} style={{ color: '#8c9ba8', borderColor: '#2b3544' }}>
                稍后重启
              </Button>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={onRestart}
                style={{ backgroundColor: '#d4af37', borderColor: '#d4af37', color: '#121820', fontWeight: 600 }}
              >
                立即重启生效
              </Button>
            </div>
          </div>
        )}

        {/* 6. 异常错误 (Error) */}
        {isError && (
          <div>
            <Alert
              type="error"
              showIcon
              icon={<InfoCircleOutlined style={{ color: '#ff4d4f' }} />}
              message="检查或更新失败"
              description={error || '网络连接超时或无法解析版本清单'}
              style={{
                backgroundColor: 'rgba(255, 77, 79, 0.1)',
                border: '1px solid rgba(255, 77, 79, 0.3)',
                color: '#f0f4f8',
                marginBottom: '1rem',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem' }}>
              <Button onClick={onClose} style={{ color: '#8c9ba8', borderColor: '#2b3544' }}>
                关闭
              </Button>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={onCheckForUpdate}
                style={{ backgroundColor: '#d4af37', borderColor: '#d4af37', color: '#121820' }}
              >
                重新检查
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
