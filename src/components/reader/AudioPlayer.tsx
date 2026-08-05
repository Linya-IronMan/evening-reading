import React from 'react';
import { Button, Segmented, Select, Space, Tag, Typography, Tooltip } from 'antd';
import { PlayCircleFilled, PauseCircleFilled, StepBackwardOutlined, StepForwardOutlined, SoundOutlined, UserOutlined, LoadingOutlined } from '@ant-design/icons';
import { EDGE_VOICES } from '../../types/reader';

const { Text } = Typography;

interface AudioPlayerProps {
  currentBlockIndex: number;
  totalBlocks: number;
  isLoading?: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  rate: number;
  voiceId: string;
  onTogglePlayPause: () => void;
  onPreviousBlock: () => void;
  onNextBlock: () => void;
  onChangeRate: (rate: number) => void;
  onChangeVoice: (voiceId: string) => void;
}

/**
 * 底部极简音频朗读控制器（整合微软 Edge-TTS 神经网络音色选择）
 */
export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  currentBlockIndex,
  totalBlocks,
  isLoading,
  isPlaying,
  isPaused,
  rate,
  voiceId,
  onTogglePlayPause,
  onPreviousBlock,
  onNextBlock,
  onChangeRate,
  onChangeVoice,
}) => {
  const hasCurrentBlock = currentBlockIndex > 0;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '1.2rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        backgroundColor: '#202936',
        border: '1px solid #d4af37',
        borderRadius: '30px',
        padding: '0.6rem 1.6rem',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        gap: '1.2rem',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* 段落定位指示器 */}
      <Space align="center">
        <SoundOutlined style={{ color: '#d4af37', fontSize: '1.1rem' }} />
        <Tag color="gold" style={{ fontSize: '0.85rem', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>
          {hasCurrentBlock ? `段落 ${currentBlockIndex} / ${totalBlocks}` : '未播放'}
        </Tag>
      </Space>

      {/* 播放控制按钮组 */}
      <Space size="middle" align="center">
        <Tooltip title="上一段">
          <Button
            type="text"
            shape="circle"
            icon={<StepBackwardOutlined style={{ fontSize: '1.1rem', color: '#f0f4f8' }} />}
            disabled={!hasCurrentBlock || currentBlockIndex <= 1}
            onClick={onPreviousBlock}
          />
        </Tooltip>

        <Tooltip title={isLoading ? '正在加载语音...' : isPlaying ? '暂停' : isPaused ? '继续朗读' : '开始朗读'}>
          <Button
            type="text"
            shape="circle"
            style={{ width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            icon={
              isLoading ? (
                <LoadingOutlined style={{ fontSize: '2.4rem', color: '#d4af37' }} />
              ) : isPlaying ? (
                <PauseCircleFilled style={{ fontSize: '2.4rem', color: '#d4af37' }} />
              ) : (
                <PlayCircleFilled style={{ fontSize: '2.4rem', color: '#d4af37' }} />
              )
            }
            onClick={onTogglePlayPause}
          />
        </Tooltip>

        <Tooltip title="下一段">
          <Button
            type="text"
            shape="circle"
            icon={<StepForwardOutlined style={{ fontSize: '1.1rem', color: '#f0f4f8' }} />}
            disabled={!hasCurrentBlock || currentBlockIndex >= totalBlocks}
            onClick={onNextBlock}
          />
        </Tooltip>
      </Space>

      {/* 微软 Edge-TTS 神经网络音色选择器 */}
      <Space align="center" size="small">
        <UserOutlined style={{ color: '#d4af37', fontSize: '0.9rem' }} />
        <Select
          size="small"
          value={voiceId}
          onChange={onChangeVoice}
          style={{ width: 140 }}
          options={EDGE_VOICES.map((v) => ({ label: v.name, value: v.id }))}
        />
      </Space>

      {/* 语速调节 */}
      <Space align="center" size="small">
        <Text style={{ fontSize: '0.8rem', color: '#8c9ba8' }}>语速</Text>
        <Segmented
          size="small"
          options={[
            { label: '0.75x', value: 0.75 },
            { label: '1.0x', value: 1.0 },
            { label: '1.25x', value: 1.25 },
            { label: '1.5x', value: 1.5 },
            { label: '2.0x', value: 2.0 },
          ]}
          value={rate}
          onChange={(val) => onChangeRate(val as number)}
          style={{ backgroundColor: '#171e28' }}
        />
      </Space>
    </div>
  );
};
