import { invoke } from '@tauri-apps/api/core';
import { EDGE_VOICES } from '../types/reader';

export interface TTSEventListeners {
  onLoadStart?: (blockId: string) => void;
  onStart?: (blockId: string) => void;
  onEnd?: (blockId: string) => void;
  onError?: (blockId: string, error: string) => void;
  onPlayNext?: (nextBlockId: string) => void; // 通知外部：触发了连播逻辑
}

interface PlaylistBlock {
  id: string;
  text: string;
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

  public setListeners(listeners: TTSEventListeners): void {
    this.listeners = listeners;
  }

  public setVoice(voiceId: string): void {
    if (this.voiceId !== voiceId) {
      this.voiceId = voiceId;
      // 切换音色时必须清空旧音色的缓存池，否则预加载的或者已缓存的都是旧音色
      this.cachePool.forEach((_, key) => this.evictCache(key));
      this.cachePool.clear();
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
    this.playlist = blocks.map(b => ({ id: b.id, text: b.content }));
  }

  /**
   * 用户编辑文本时，更新并使对应段落缓存失效
   */
  public updateBlock(blockId: string, newText: string): void {
    const idx = this.playlist.findIndex(b => b.id === blockId);
    if (idx !== -1) {
      this.playlist[idx].text = newText;
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

    // 2. 预取接下来 N 个段落
    const targetCount = Math.min(this.playlist.length, currentIndex + 1 + PREFETCH_COUNT);
    for (let i = currentIndex + 1; i < targetCount; i++) {
      const block = this.playlist[i];
      this.enqueuePrefetch(block.id, block.text);
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
    console.log(`[TTS Frontend] Calling fetch_edge_tts with requestId: ${requestId}, voice: ${voice}, textLength: ${text.length}`);

    const handleAbort = () => {
      console.log(`[TTS Frontend] Abort requested for requestId: ${requestId}. Invoking cancel_edge_tts...`);
      invoke('cancel_edge_tts', { requestId }).catch(e => console.error('[TTS Frontend] Cancel Error:', e));
    };

    if (signal.aborted) {
      handleAbort();
      throw new Error('AbortError: TTS fetch cancelled');
    } else {
      signal.addEventListener('abort', handleAbort);
    }

    try {
      const audioBytes = await invoke<number[]>('fetch_edge_tts', {
        requestId,
        text,
        voice
      });
      console.log(`[TTS Frontend] Successfully received audioBytes for requestId: ${requestId}, length: ${audioBytes.length}`);
      const uint8Array = new Uint8Array(audioBytes);
      return new Blob([uint8Array], { type: 'audio/mp3' });
    } finally {
      signal.removeEventListener('abort', handleAbort);
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

    let contentToSpeak = text;
    const playlistIndex = this.playlist.findIndex(b => b.id === blockId);
    
    if (playlistIndex !== -1) {
       contentToSpeak = this.playlist[playlistIndex].text;
    } else if (!contentToSpeak) {
       console.error("[TTS Frontend] No text provided and block not found in playlist");
       return;
    }

    this.currentBlockId = blockId;
    this.listeners.onLoadStart?.(blockId);

    const currentToken = ++this.playToken;

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
}

export const ttsService = new TTSService();
