import { useState, useEffect, useCallback, useRef } from 'react';
import type { Update } from '@tauri-apps/plugin-updater';
import {
  checkForAppUpdate,
  downloadAndInstallUpdate,
  relaunchApp,
  fetchCurrentAppVersion,
  isTauriEnvironment,
  type DownloadProgress,
  type UpdateMetadata,
} from '../services/updaterApi';

/**
 * 更新器生命周期状态
 */
export type UpdateStateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'error'
  | 'up-to-date';

/**
 * useUpdater 配置选项
 */
export interface UseUpdaterOptions {
  /** 当前业务是否处于忙碌状态（如 TTS 朗读或音频加载中） */
  isBusy?: boolean;
  /** 是否开启组件挂载后的延迟自动检查，默认为 true */
  autoCheck?: boolean;
}

/**
 * 应用原地更新 Hook
 *
 * 管理从版本检查、下载进度、就绪状态到安全重启的完整状态机流转。
 *
 * @param {UseUpdaterOptions} options - 配置参数
 * @returns 更新器状态与操作集合
 */
export function useUpdater(options: UseUpdaterOptions = {}) {
  const { isBusy = false, autoCheck = true } = options;

  const [status, setStatus] = useState<UpdateStateStatus>('idle');
  const [currentVersion, setCurrentVersion] = useState<string>('0.2.0');
  const [metadata, setMetadata] = useState<UpdateMetadata | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateRef = useRef<Update | null>(null);
  const isBusyRef = useRef<boolean>(isBusy);

  useEffect(() => {
    isBusyRef.current = isBusy;
  }, [isBusy]);

  // 初始化获取当前版本号
  useEffect(() => {
    fetchCurrentAppVersion().then(setCurrentVersion);
  }, []);

  /**
   * 触发检查更新
   *
   * @param {boolean} [isManual=false] - 是否由用户主动点击触发
   */
  const checkForUpdate = useCallback(async (isManual = false) => {
    if (!isTauriEnvironment()) {
      if (isManual) {
        setStatus('up-to-date');
      }
      return;
    }

    setStatus('checking');
    setError(null);

    try {
      const updateObj = await checkForAppUpdate();
      if (updateObj) {
        updateRef.current = updateObj;
        setMetadata({
          version: updateObj.version,
          currentVersion: updateObj.currentVersion,
          notes: updateObj.body ?? null,
          date: updateObj.date ?? null,
        });
        setStatus('available');
      } else {
        updateRef.current = null;
        setMetadata(null);
        setStatus(isManual ? 'up-to-date' : 'idle');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setStatus('error');
    }
  }, []);

  /**
   * 开始下载并安装更新包
   */
  const installUpdate = useCallback(async () => {
    const updateObj = updateRef.current;
    if (!updateObj) {
      setError('未找到可用的更新对象');
      return;
    }

    setStatus('downloading');
    setError(null);
    setProgress({ downloaded: 0, total: null, percent: 0 });

    try {
      await downloadAndInstallUpdate(updateObj, (p) => {
        setProgress(p);
      });
      setStatus('ready');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[useUpdater] 下载或安装更新失败:', message);
      setError(message);
      setStatus('error');
    }
  }, []);

  /**
   * 安全重启应用
   *
   * @param {() => Promise<void> | void} [onBeforeRestart] - 重启前的钩子（如保存进度、停止播放等）
   */
  const safeRestart = useCallback(
    async (onBeforeRestart?: () => Promise<void> | void) => {
      try {
        if (onBeforeRestart) {
          await onBeforeRestart();
        }
      } catch (hookErr: unknown) {
        console.warn('[useUpdater] 重启前钩子执行出现警告，继续重启:', hookErr);
      }
      await relaunchApp();
    },
    [],
  );

  /**
   * 忽略/关闭当前更新提示
   */
  const dismissUpdate = useCallback(() => {
    setStatus('idle');
  }, []);

  // 挂载后延迟 5 秒进行后台静默检查
  useEffect(() => {
    if (!autoCheck || !isTauriEnvironment()) return;

    const timer = setTimeout(() => {
      checkForUpdate(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, [autoCheck, checkForUpdate]);

  return {
    status,
    currentVersion,
    metadata,
    progress,
    error,
    isBusy,
    checkForUpdate,
    installUpdate,
    safeRestart,
    dismissUpdate,
  };
}
