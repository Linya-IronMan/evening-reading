import { check, type Update, type DownloadEvent } from '@tauri-apps/plugin-updater';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';

/**
 * 更新下载进度状态接口
 */
export interface DownloadProgress {
  /** 已下载字节数 */
  downloaded: number;
  /** 总字节数 (若未知则为 null) */
  total: number | null;
  /** 下载百分比 (0-100, 若未知则为 null) */
  percent: number | null;
}

/**
 * 结构化的更新元数据信息
 */
export interface UpdateMetadata {
  /** 最新版本号 */
  version: string;
  /** 当前运行版本号 */
  currentVersion: string;
  /** 版本更新说明 / Changelog */
  notes: string | null;
  /** 发布日期 */
  date: string | null;
}

/**
 * 检查环境是否支持 Tauri 原生运行时
 *
 * @returns {boolean} 是否处于 Tauri 环境
 */
export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * 获取当前应用的版本号
 *
 * @returns {Promise<string>} 当前版本号
 */
export async function fetchCurrentAppVersion(): Promise<string> {
  if (!isTauriEnvironment()) {
    return '0.2.0';
  }
  try {
    return await getVersion();
  } catch (err: unknown) {
    console.warn('[updaterApi] 获取应用版本失败，回退默认版本:', err);
    return '0.2.0';
  }
}

/**
 * 检查是否有新版本可用
 *
 * @returns {Promise<Update | null>} 如果有可用更新则返回 Update 对象，否则返回 null
 */
export async function checkForAppUpdate(): Promise<Update | null> {
  if (!isTauriEnvironment()) {
    console.info('[updaterApi] 非 Tauri 桌面环境，跳过更新检查');
    return null;
  }

  try {
    const updateResult = await check({
      timeout: 8000,
    });
    return updateResult;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[updaterApi] 检查更新失败:', errorMessage);
    throw new Error(`检查更新失败: ${errorMessage}`);
  }
}

/**
 * 下载并原地安装更新
 *
 * @param {Update} update - check() 获取到的 Update 对象
 * @param {(progress: DownloadProgress) => void} onProgress - 下载进度回调
 * @returns {Promise<void>}
 */
export async function downloadAndInstallUpdate(
  update: Update,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<void> {
  let downloadedBytes = 0;
  let totalBytes: number | null = null;

  await update.downloadAndInstall((event: DownloadEvent) => {
    if (event.event === 'Started') {
      totalBytes = typeof event.data.contentLength === 'number' ? event.data.contentLength : null;
      onProgress?.({
        downloaded: 0,
        total: totalBytes,
        percent: 0,
      });
    } else if (event.event === 'Progress') {
      downloadedBytes += event.data.chunkLength;
      let calculatedPercent: number | null = null;
      if (totalBytes && totalBytes > 0) {
        calculatedPercent = Math.min(100, Math.round((downloadedBytes / totalBytes) * 100));
      }
      onProgress?.({
        downloaded: downloadedBytes,
        total: totalBytes,
        percent: calculatedPercent,
      });
    } else if (event.event === 'Finished') {
      onProgress?.({
        downloaded: downloadedBytes,
        total: totalBytes ?? downloadedBytes,
        percent: 100,
      });
    }
  });
}

/**
 * 请求后端优雅重启应用
 *
 * @returns {Promise<void>}
 */
export async function relaunchApp(): Promise<void> {
  if (!isTauriEnvironment()) {
    console.info('[updaterApi] 非 Tauri 环境，模拟重启应用');
    window.location.reload();
    return;
  }
  await invoke('restart_app');
}
