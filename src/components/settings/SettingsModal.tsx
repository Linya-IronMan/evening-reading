import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Typography, Card, Tag, Button, Space, Tooltip, Select, Input, message } from 'antd';
import {
  GlobalOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ExportOutlined,
  SettingOutlined,
  CloudDownloadOutlined,
  SoundOutlined,
  AudioOutlined,
  PauseOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { API_BASE_URL } from '../../utils/apiClient';
import { EDGE_VOICES } from '../../types/reader';
import { ttsService } from '../../services/ttsService';
import type { useUpdater } from '../../hooks/useUpdater';

const { Title, Text, Paragraph } = Typography;

interface SysInfo {
  version: string;
  local_ip: string;
  port: number;
}

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  updater?: ReturnType<typeof useUpdater>;
  onRestartApp?: () => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
  updater,
  onRestartApp,
}) => {
  const [sysInfo, setSysInfo] = useState<SysInfo>({
    version: '0.2.1',
    local_ip: '127.0.0.1',
    port: 1421,
  });

  const [healthStatus, setHealthStatus] = useState<'checking' | 'healthy' | 'offline'>('checking');
  const [latency, setLatency] = useState<number | null>(null);

  // 音色测试与试听状态
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(ttsService.getVoice());
  const [testText, setTestText] = useState<string>('欢迎使用晚读，这是一段音色试听效果测试。');
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);

  // 动态拼装局域网访问地址
  const currentPort = window.location.port || (sysInfo.port ? String(sysInfo.port) : '1421');
  const displayIp = sysInfo.local_ip && sysInfo.local_ip !== '127.0.0.1' 
    ? sysInfo.local_ip 
    : (window.location.hostname !== 'localhost' ? window.location.hostname : '127.0.0.1');
  const webUrl = `http://${displayIp}:${currentPort}`;

  // 弹窗关闭时自动停止试听
  useEffect(() => {
    if (!open) {
      ttsService.stopPreview();
      setIsPreviewing(false);
      setIsPreviewLoading(false);
    } else {
      setSelectedVoiceId(ttsService.getVoice());
    }
  }, [open]);

  // 触发/停止试听测试
  const handleTogglePreview = async () => {
    if (isPreviewing || isPreviewLoading) {
      ttsService.stopPreview();
      setIsPreviewing(false);
      setIsPreviewLoading(false);
      return;
    }

    setIsPreviewLoading(true);
    await ttsService.previewVoice(
      selectedVoiceId,
      testText || '欢迎使用晚读，这是一段音色试听效果测试。',
      {
        onStart: () => {
          setIsPreviewLoading(false);
          setIsPreviewing(true);
        },
        onEnd: () => {
          setIsPreviewing(false);
          setIsPreviewLoading(false);
        },
        onError: (errMsg) => {
          setIsPreviewLoading(false);
          setIsPreviewing(false);
          message.error(errMsg);
        },
      }
    );
  };

  // 应用当前音色为默认朗读音色
  const handleApplyVoice = () => {
    ttsService.setVoice(selectedVoiceId);
    const voiceObj = EDGE_VOICES.find((v) => v.id === selectedVoiceId);
    message.success(`已设置默认朗读音色为: ${voiceObj?.name || selectedVoiceId}`);
  };

  // 获取系统与网络信息
  const fetchSysInfo = useCallback(async () => {
    try {
      const info = await invoke<SysInfo>('get_app_sys_info');
      if (info) {
        setSysInfo(info);
      }
    } catch {
      // 非 Tauri 环境或未挂载后端命令时的降级逻辑
      setSysInfo({
        version: '0.2.1',
        local_ip: window.location.hostname || '127.0.0.1',
        port: Number(window.location.port) || 1421,
      });
    }
  }, []);

  // 执行 Web 服务健康检查（直接探测真正展示给用户的局域网 URL）
  const checkHealth = useCallback(async () => {
    setHealthStatus('checking');
    const startTime = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const targetUrl = `http://${displayIp}:${currentPort}/api/health`;
      const res = await fetch(targetUrl, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const endTime = performance.now();
      if (res.ok) {
        setLatency(Math.round(endTime - startTime));
        setHealthStatus('healthy');
      } else {
        setHealthStatus('offline');
        setLatency(null);
      }
    } catch {
      setHealthStatus('offline');
      setLatency(null);
    }
  }, [displayIp, currentPort]);

  useEffect(() => {
    if (open) {
      fetchSysInfo();
      checkHealth();
    }
  }, [open, fetchSysInfo, checkHealth]);

  // 一键复制地址
  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(webUrl);
      message.success(`已复制局域网访问地址: ${webUrl}`);
    } catch (err) {
      message.error('复制失败，请手动选择复制');
    }
  };

  // 默认浏览器中打开 URL
  const handleOpenInBrowser = async () => {
    try {
      await openUrl(webUrl);
    } catch {
      window.open(webUrl, '_blank');
    }
  };

  return (
    <Modal
      title={
        <Space>
          <SettingOutlined style={{ color: '#d4af37' }} />
          <span>软件设置与状态</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" type="primary" style={{ backgroundColor: '#d4af37', borderColor: '#d4af37' }} onClick={onClose}>
          完成
        </Button>,
      ]}
      width={560}
      centered
      destroyOnHidden
    >
      <div style={{ paddingTop: 12 }}>
        {/* 1. 软件信息与版本卡片 */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <img
              src="/app-icon.png"
              alt="App Icon"
              style={{ width: 54, height: 54, borderRadius: 12, objectFit: 'cover' }}
              onError={(e) => {
                // 回退占位
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Title level={5} style={{ margin: 0 }}>
                  Evening Reading (晚读)
                </Title>
                <Tag color="gold">v{sysInfo.version}</Tag>
              </div>
              <Text type="secondary" style={{ fontSize: 13 }}>
                基于 React + Tauri 2.0 打造的高品质智能语音伴读应用
              </Text>
            </div>
          </div>

          {updater && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed rgba(255, 255, 255, 0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {updater.status === 'available' ? (
                  <Text type="warning" style={{ fontSize: 13 }}>
                    🎉 发现新版本 v{updater.metadata?.version}！
                  </Text>
                ) : updater.status === 'ready' ? (
                  <Text type="success" style={{ fontSize: 13 }}>
                    新版本已就绪，准备重启生效
                  </Text>
                ) : (
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    {updater.status === 'up-to-date' ? '目前已是最新版本' : '检查应用更新'}
                  </Text>
                )}
              </div>
              <Space>
                {updater.status === 'ready' ? (
                  <Button
                    type="primary"
                    size="small"
                    style={{ backgroundColor: '#d4af37', borderColor: '#d4af37' }}
                    onClick={onRestartApp}
                  >
                    重启应用并完成更新
                  </Button>
                ) : (updater.status === 'available' || updater.status === 'downloading') ? (
                  <Button
                    type="primary"
                    size="small"
                    style={{ backgroundColor: '#d4af37', borderColor: '#d4af37' }}
                    icon={<CloudDownloadOutlined />}
                    loading={updater.status === 'downloading'}
                    onClick={() => updater.installUpdate()}
                  >
                    下载并更新
                  </Button>
                ) : (
                  <Button
                    size="small"
                    icon={<SyncOutlined spin={updater.status === 'checking'} />}
                    loading={updater.status === 'checking'}
                    onClick={() => updater.checkForUpdate(true)}
                  >
                    检查更新
                  </Button>
                )}
              </Space>
            </div>
          )}
        </Card>

        {/* 2. 声音音色一键测试与设置卡片 */}
        <Card
          size="small"
          style={{ marginBottom: 16 }}
          title={
            <Space>
              <AudioOutlined style={{ color: '#d4af37' }} />
              <span>声音音色一键测试与设置</span>
            </Space>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
                选择要测试的神经网络音色：
              </Text>
              <div style={{ display: 'flex', gap: 8 }}>
                <Select
                  value={selectedVoiceId}
                  onChange={(v) => {
                    setSelectedVoiceId(v);
                    if (isPreviewing) {
                      ttsService.stopPreview();
                      setIsPreviewing(false);
                    }
                  }}
                  style={{ flex: 1 }}
                  options={EDGE_VOICES.map((v) => ({
                    value: v.id,
                    label: (
                      <span>
                        {v.name}
                        <Tag color={v.gender === 'female' ? 'magenta' : 'blue'} style={{ marginLeft: 8, fontSize: 11 }}>
                          {v.gender === 'female' ? '女声' : '男声'}
                        </Tag>
                      </span>
                    ),
                  }))}
                />
                <Button
                  size="middle"
                  onClick={handleApplyVoice}
                  icon={<CheckOutlined />}
                  title="设置为当前全局朗读音色"
                >
                  设为默认
                </Button>
              </div>
            </div>

            <div>
              <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
                试听测试文本：
              </Text>
              <div style={{ display: 'flex', gap: 8 }}>
                <Input
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  placeholder="请输入要试听测试的文本句段..."
                  maxLength={100}
                  style={{ flex: 1 }}
                />
                <Button
                  type={isPreviewing ? 'default' : 'primary'}
                  danger={isPreviewing}
                  style={!isPreviewing ? { backgroundColor: '#d4af37', borderColor: '#d4af37' } : undefined}
                  icon={
                    isPreviewing ? (
                      <PauseOutlined />
                    ) : (
                      <SoundOutlined spin={isPreviewLoading} />
                    )
                  }
                  loading={isPreviewLoading}
                  onClick={handleTogglePreview}
                >
                  {isPreviewLoading ? '生成中...' : isPreviewing ? '停止试听' : '一键试听'}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* 3. Web 访问地址健康检查与快捷复制卡片 */}
        <Card
          size="small"
          title={
            <Space>
              <GlobalOutlined style={{ color: '#52c41a' }} />
              <span>Web 局域网访问与服务状态</span>
            </Space>
          }
          extra={
            <Tooltip title="重新检查服务健康状态">
              <Button
                type="text"
                size="small"
                icon={<SyncOutlined spin={healthStatus === 'checking'} />}
                onClick={checkHealth}
              />
            </Tooltip>
          }
        >
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                同局域网设备（手机/平板）访问地址：
              </Text>
              <div>
                {healthStatus === 'checking' && (
                  <Tag icon={<SyncOutlined spin />} color="processing">
                    检测中...
                  </Tag>
                )}
                {healthStatus === 'healthy' && (
                  <Tag icon={<CheckCircleOutlined />} color="success">
                    服务正常 {latency !== null ? `(${latency}ms)` : ''}
                  </Tag>
                )}
                {healthStatus === 'offline' && (
                  <Tag icon={<CloseCircleOutlined />} color="error">
                    服务未连接
                  </Tag>
                )}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.08)',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid rgba(255, 255, 255, 0.15)',
                fontFamily: 'monospace',
                fontSize: 14,
                justifyContent: 'space-between',
              }}
            >
              <Text copyable={{ text: webUrl, tooltips: ['点击复制', '已复制'] }} style={{ fontWeight: 600 }}>
                {webUrl}
              </Text>

              <Space>
                <Tooltip title="复制 Web 地址到剪贴板">
                  <Button
                    type="primary"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={handleCopyUrl}
                  >
                    复制地址
                  </Button>
                </Tooltip>

                <Tooltip title="在默认浏览器中打开此地址">
                  <Button
                    size="small"
                    icon={<ExportOutlined />}
                    onClick={handleOpenInBrowser}
                  >
                    打开
                  </Button>
                </Tooltip>
              </Space>
            </div>
          </div>

          <Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>
            💡 提示：按 <Text keyboard>⌘ + ,</Text> (或 <Text keyboard>Ctrl + ,</Text>) 可随时快速唤起或关闭此设置面板。手机与 Mac 连接相同 Wi-Fi 即可在移动端访问。
          </Paragraph>
        </Card>
      </div>
    </Modal>
  );
};
