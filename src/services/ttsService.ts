import { BookFormat, EDGE_VOICES } from '../types/reader';
import { fetchWithRetry } from '../utils/apiClient';
import { stripMarkdownForTTS } from '../utils/markdownText';

export interface TTSEventListeners {
  onLoadStart?: (blockId: string) => void;
  onStart?: (blockId: string) => void;
  onEnd?: (blockId: string) => void;
  onError?: (blockId: string, error: string) => void;
  onPlayNext?: (nextBlockId: string) => void; // 通知外部：触发了连播逻辑
}

interface PlaylistBlock {
  id: string;
  text: string;          // 原始内容（Markdown 场景为 MD 源码）
  speakable: string;     // 送 TTS 的纯净文本（TXT 场景等于 text）
  skipped: boolean;      // 是否为纯代码块/水平线等应跳过朗读的块
}

interface CacheEntry {
  blob?: Blob;
  error?: Error;
  promise?: Promise<Blob>;
  abortController?: AbortController;
  objectUrl?: string;
}

const PREFETCH_COUNT = 2; // 提前加载两段

/**
 * 微软 Edge-TTS 神经网络语音与 HTML5 Audio 合成播放服务
 * (支持静默预加载队列架构)
 */
class TTSService {
  private currentAudio: HTMLAudioElement | null = null;
  private currentBlockId: string | null = null;
  private voiceId: string = EDGE_VOICES[0].id;
  private rate: number = 1.0;
  private isPlaying: boolean = false;
  private isPaused: boolean = false;
  private listeners: TTSEventListeners = {};
  
  private playlist: PlaylistBlock[] = [];
  private cachePool = new Map<string, CacheEntry>();
  private playToken: number = 0;
  private bookFormat: BookFormat = 'txt';

  public setListeners(listeners: TTSEventListeners): void {
    this.listeners = listeners;
  }

  /**
   * 设置当前书籍格式。切换到 markdown 时会启用 TTS 清洗（去 # * ` 等标记）。
   */
  public setBookFormat(format: BookFormat): void {
    if (this.bookFormat === format) return;
    this.bookFormat = format;
    // 刷新 playlist 里已计算的 speakable/skipped，并清空缓存以防旧音频复用
    this.playlist = this.playlist.map((b) => this.buildPlaylistBlock(b.id, b.text));
    this.cachePool.forEach((_, key) => this.evictCache(key));
    this.cachePool.clear();
  }

  private buildPlaylistBlock(id: string, text: string): PlaylistBlock {
    if (this.bookFormat === 'markdown') {
      const { text: speakable, skipped } = stripMarkdownForTTS(text);
      return { id, text, speakable, skipped };
    }
    return { id, text, speakable: text, skipped: false };
  }

  public setVoice(voiceId: string): void {
    if (this.voiceId !== voiceId) {
      this.voiceId = voiceId;
      
      const wasPlaying = this.isPlaying;
      const currentId = this.currentBlockId;
      
      this.playToken++;
      // 切换音色时必须清空旧音色的缓存池，同时停止当前播放并撤销 Blob 资源
      this.stopInternal(true);

      // 如果之前正在播放，则用新音色重新播放当前段落
      if (wasPlaying && currentId) {
        this.speakBlock(currentId);
      }
    }
  }

  public getVoice(): string {
    return this.voiceId;
  }

  public setRate(rate: number): void {
    this.rate = rate;
    if (this.currentAudio) {
      this.currentAudio.playbackRate = rate;
    }
  }

  public getRate(): number {
    return this.rate;
  }

  /**
   * 注入最新的播放列表
   */
  public setPlaylist(blocks: { id: string; content: string }[]): void {
    this.playlist = blocks.map((b) => this.buildPlaylistBlock(b.id, b.content));
  }

  /**
   * 用户编辑文本时，更新并使对应段落缓存失效
   */
  public updateBlock(blockId: string, newText: string): void {
    const idx = this.playlist.findIndex(b => b.id === blockId);
    if (idx !== -1) {
      this.playlist[idx] = this.buildPlaylistBlock(blockId, newText);
    }
    this.evictCache(blockId);
  }

  private escapeXml(text: string): string {
    return text
      ? text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;')
      : '';
  }

  /**
   * 缓存回收：清理指定段落的预加载请求和 Blob
   */
  private evictCache(blockId: string): void {
    const entry = this.cachePool.get(blockId);
    if (!entry) return;

    if (entry.abortController) {
      entry.abortController.abort();
    }
    if (entry.objectUrl) {
      URL.revokeObjectURL(entry.objectUrl);
    }
    this.cachePool.delete(blockId);
  }

  /**
   * 静默预加载控制：拉取后续段落并回收历史段落
   */
  private prefetchNextBlocks(currentIndex: number): void {
    // 1. 垃圾回收之前已经播放完毕的旧段落
    for (let i = 0; i < currentIndex; i++) {
      const bId = this.playlist[i].id;
      this.evictCache(bId);
    }

    // 回收因大范围跳段而排队的过远未播段落
    for (let i = currentIndex + PREFETCH_COUNT + 1; i < this.playlist.length; i++) {
      const bId = this.playlist[i].id;
      this.evictCache(bId);
    }

    // 2. 预取接下来 N 个段落（跳过 skipped 段，如代码块）
    const targetCount = Math.min(this.playlist.length, currentIndex + 1 + PREFETCH_COUNT);
    for (let i = currentIndex + 1; i < targetCount; i++) {
      const block = this.playlist[i];
      if (block.skipped || !block.speakable) continue;
      this.enqueuePrefetch(block.id, block.speakable);
    }
  }

  private enqueuePrefetch(blockId: string, text: string): void {
    if (this.cachePool.has(blockId)) return; 

    const abortController = new AbortController();
    const entry: CacheEntry = {
      abortController
    };
    this.cachePool.set(blockId, entry);

    const promise = this.fetchEdgeTTSAudioBlob(text, this.voiceId, abortController.signal)
      .then(blob => {
        if (!abortController.signal.aborted) {
          entry.blob = blob;
          entry.objectUrl = URL.createObjectURL(blob);
          entry.promise = undefined;
        }
        return blob;
      })
      .catch(err => {
        if (!abortController.signal.aborted) {
          entry.error = err;
          entry.promise = undefined;
        }
        throw err;
      });

    entry.promise = promise;
  }

  /**
   * 获取缓存中的 Blob URL，如果没有则立刻当场请求并等待
   */
  private async getOrFetchBlobUrl(blockId: string, text: string, currentToken: number): Promise<string> {
    let entry = this.cachePool.get(blockId);
    if (!entry) {
      this.enqueuePrefetch(blockId, text);
      entry = this.cachePool.get(blockId)!;
    }

    if (entry.error) {
      throw entry.error;
    }
    if (entry.objectUrl) {
      return entry.objectUrl;
    }
    if (entry.promise) {
      await entry.promise;
      if (this.playToken !== currentToken) {
        throw new Error('AbortError: Token changed');
      }
      if (entry.error) throw entry.error;
      if (entry.objectUrl) return entry.objectUrl;
    }

    throw new Error('Failed to obtain Object URL');
  }

  private async fetchEdgeTTSAudioBlob(text: string, voice: string, signal: AbortSignal): Promise<Blob> {
    const requestId = Math.random().toString(36).substring(2, 18);
    console.log(`[TTS Frontend] Calling /api/tts with requestId: ${requestId}, voice: ${voice}, textLength: ${text.length}`);

    try {
      const response = await fetchWithRetry('/api/tts', {
        method: 'POST',
        signal,
        body: JSON.stringify({ text, voice }),
      }, 0); // No retries for TTS to avoid lag on fast forward

      const blob = await response.blob();
      console.log(`[TTS Frontend] Successfully received audio Blob for requestId: ${requestId}, size: ${blob.size}`);
      return blob;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log(`[TTS Frontend] AbortError for requestId: ${requestId}`);
        throw new Error('AbortError: TTS fetch cancelled');
      }
      throw err;
    }
  }

  /**
   * 离线降级方案：Web Speech API 兜底
   */
  private speakFallback(blockId: string, text: string, currentToken: number): void {
    if (!('speechSynthesis' in window)) {
      this.listeners.onError?.(blockId, '不支持离线语音兜底');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this.rate;
    utterance.lang = 'zh-CN';

    utterance.onstart = () => {
      if (this.playToken !== currentToken) return;
      this.isPlaying = true;
      this.isPaused = false;
      this.listeners.onStart?.(blockId);
      
      // Safety timeout for macOS Web Speech API bug (where onend never fires)
      // Estimate duration based on text length (approx 4 chars per second at 1.0x speed)
      const estimatedDurationMs = (text.length / 4) * 1000 / this.rate;
      const maxWaitTime = Math.max(estimatedDurationMs + 3000, 5000);
      
      setTimeout(() => {
        if (this.playToken === currentToken && this.isPlaying && this.currentBlockId === blockId) {
          console.warn('[TTS Frontend] Web Speech API timeout, manually advancing queue.');
          utterance.onend?.(new Event('end') as any);
        }
      }, maxWaitTime);
    };

    utterance.onend = () => {
      if (this.playToken !== currentToken) return;
      this.isPlaying = false;
      this.isPaused = false;
      const finishedBlockId = this.currentBlockId;
      this.currentBlockId = null;
      if (finishedBlockId) {
        this.listeners.onEnd?.(finishedBlockId);
      }

      // Auto Advance for fallback
      const playlistIndex = this.playlist.findIndex(b => b.id === finishedBlockId);
      if (playlistIndex !== -1 && playlistIndex + 1 < this.playlist.length) {
        const nextBlock = this.playlist[playlistIndex + 1];
        this.listeners.onPlayNext?.(nextBlock.id);
        this.speakBlock(nextBlock.id, nextBlock.text);
      }
    };

    utterance.onerror = (e) => {
      if (this.playToken !== currentToken) return;
      this.isPlaying = false;
      this.isPaused = false;
      this.listeners.onError?.(blockId, e.error);
    };

    window.speechSynthesis.speak(utterance);
  }

  /**
   * 朗读指定的段落文本（优先微软 Edge-TTS，内部自带队列推进机制）
   */
  public async speakBlock(blockId: string, text?: string): Promise<void> {
    this.stopInternal(false); // Stop current playback but KEEP caches

    const playlistIndex = this.playlist.findIndex(b => b.id === blockId);
    let entry: PlaylistBlock | undefined = playlistIndex !== -1 ? this.playlist[playlistIndex] : undefined;

    // 若外部临时传入 text 且不在 playlist 中，即时构造一个临时条目
    if (!entry && text) {
      entry = this.buildPlaylistBlock(blockId, text);
    } else if (!entry) {
      console.error("[TTS Frontend] No text provided and block not found in playlist");
      return;
    }

    // 若外部传入了新 text（例如刚保存的编辑），按新内容重建
    if (text && entry.text !== text) {
      entry = this.buildPlaylistBlock(blockId, text);
      if (playlistIndex !== -1) this.playlist[playlistIndex] = entry;
    }

    this.currentBlockId = blockId;
    this.listeners.onLoadStart?.(blockId);

    const currentToken = ++this.playToken;

    // Markdown 代码块等无需朗读的块：走跳过通道，仍触发 onStart→onEnd 保留 UI 高亮与自动前进
    if (entry.skipped || !entry.speakable) {
      this.listeners.onStart?.(blockId);
      this.isPlaying = true;
      this.isPaused = false;
      const skipDelay = window.setTimeout(() => {
        if (this.playToken !== currentToken) return;
        this.isPlaying = false;
        this.currentBlockId = null;
        this.listeners.onEnd?.(blockId);
        if (playlistIndex !== -1 && playlistIndex + 1 < this.playlist.length) {
          const nextBlock = this.playlist[playlistIndex + 1];
          this.listeners.onPlayNext?.(nextBlock.id);
          this.speakBlock(nextBlock.id);
        }
      }, 350);
      // 预取一下后续段
      if (playlistIndex !== -1) this.prefetchNextBlocks(playlistIndex);
      void skipDelay;
      return;
    }

    const contentToSpeak = entry.speakable;

    if (playlistIndex !== -1) {
      this.prefetchNextBlocks(playlistIndex);
    }

    try {
      const objectUrl = await this.getOrFetchBlobUrl(blockId, contentToSpeak!, currentToken);
      if (this.playToken !== currentToken) return;

      const audio = new Audio(objectUrl);
      audio.playbackRate = this.rate;
      this.currentAudio = audio;

      audio.onplay = () => {
        if (this.playToken !== currentToken) return;
        this.isPlaying = true;
        this.isPaused = false;
        this.listeners.onStart?.(blockId);
      };

      audio.onended = () => {
        if (this.playToken !== currentToken) return;
        this.isPlaying = false;
        this.isPaused = false;
        const finishedBlockId = this.currentBlockId;
        this.currentBlockId = null;
        
        if (finishedBlockId) {
          this.listeners.onEnd?.(finishedBlockId);
        }

        // Auto Advance (Seamless queue)
        if (playlistIndex !== -1 && playlistIndex + 1 < this.playlist.length) {
          const nextBlock = this.playlist[playlistIndex + 1];
          this.listeners.onPlayNext?.(nextBlock.id);
          this.speakBlock(nextBlock.id, nextBlock.text);
        }
      };

      audio.onerror = () => {
        if (this.playToken !== currentToken) return;
        console.warn('[TTS Frontend] Audio playback error, fallbacking to Web Speech API...');
        this.speakFallback(blockId, contentToSpeak!, currentToken);
      };

      await audio.play();
    } catch (err) {
      if (err instanceof Error && (err.name === 'AbortError' || err.message.includes('AbortError') || err.message.includes('Token changed'))) {
        return; // Silent abort
      }
      console.warn('[TTS Frontend] Edge-TTS synthesis failed/offline, switching to Web Speech fallback:', err);
      if (this.playToken === currentToken) {
        this.listeners.onError?.(blockId, `在线语音生成失败，已切换至离线语音`);
        this.speakFallback(blockId, contentToSpeak!, currentToken);
      }
    }
  }

  private stopInternal(clearAllCache: boolean): void {
    if (this.currentAudio) {
      this.currentAudio.onplay = null;
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      this.currentAudio.pause();
      this.currentAudio.src = '';
      this.currentAudio = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.isPlaying = false;
    this.isPaused = false;
    this.currentBlockId = null;
    
    if (clearAllCache) {
      this.cachePool.forEach((_, key) => this.evictCache(key));
      this.cachePool.clear();
    }
  }

  /**
   * 停止播放并释放全部资源与队列
   */
  public stop(): void {
    this.playToken++; // Abort any pending getOrFetchBlobUrl
    this.stopInternal(true);
  }

  public pause(): void {
    if (this.currentAudio && this.isPlaying) {
      this.currentAudio.pause();
      this.isPaused = true;
      this.isPlaying = false;
    } else if (typeof window !== 'undefined' && window.speechSynthesis?.speaking) {
      window.speechSynthesis.pause();
      this.isPaused = true;
      this.isPlaying = false;
    }
  }

  public resume(): void {
    if (this.currentAudio && this.isPaused) {
      this.currentAudio.play();
      this.isPaused = false;
      this.isPlaying = true;
    } else if (typeof window !== 'undefined' && window.speechSynthesis?.paused) {
      window.speechSynthesis.resume();
      this.isPaused = false;
      this.isPlaying = true;
    }
  }

  public getStatus() {
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      currentBlockId: this.currentBlockId,
    };
  }

  // --- 试听测试相关功能 ---
  private previewAudio: HTMLAudioElement | null = null;
  private previewAbortController: AbortController | null = null;

  /**
   * 停止音色试听播放
   */
  public stopPreview(): void {
    if (this.previewAbortController) {
      this.previewAbortController.abort();
      this.previewAbortController = null;
    }
    if (this.previewAudio) {
      this.previewAudio.pause();
      this.previewAudio = null;
    }
  }

  /**
   * 试听指定音色与文字内容（独立音频通道，不影响主阅读进度）
   */
  public async previewVoice(
    voiceId: string,
    text: string = '欢迎使用晚读，这是一段音色试听效果测试。',
    callbacks?: {
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: string) => void;
    }
  ): Promise<void> {
    this.stopPreview();

    const controller = new AbortController();
    this.previewAbortController = controller;
    let objectUrl = '';

    try {
      const blob = await this.fetchEdgeTTSAudioBlob(text, voiceId, controller.signal);
      if (controller.signal.aborted) return;

      objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(objectUrl);
      audio.playbackRate = this.rate;
      this.previewAudio = audio;

      audio.onplay = () => {
        callbacks?.onStart?.();
      };

      audio.onended = () => {
        URL.revokeObjectURL(objectUrl);
        if (this.previewAudio === audio) {
          this.previewAudio = null;
        }
        callbacks?.onEnd?.();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        if (this.previewAudio === audio) {
          this.previewAudio = null;
        }
        callbacks?.onError?.('试听语音播放失败');
      };

      await audio.play();
    } catch (err: any) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (err.name !== 'AbortError') {
        callbacks?.onError?.(err.message || '试听生成失败');
      }
    }
  }
}

export const ttsService = new TTSService();
