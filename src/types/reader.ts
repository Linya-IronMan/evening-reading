/**
 * 晚读 (Evening Reading) 领域模型定义
 */

export interface Chapter {
  title: string;
  blockId: string;
}

// 1. 书籍元信息
export interface Book {
  id: string;             // 唯一标志符 (UUID/Hash)
  title: string;          // 书名/文件名
  fileName: string;       // 原始文件名
  totalBlocks: number;    // 总段落块数量
  chapters?: Chapter[];   // 小说章节大纲
  createdAt: number;      // 创建/导入时间戳
  updatedAt: number;      // 最后阅读/修改时间戳
}

// 2. 段落块模型（带版本号用于状态机比对）
export interface ParagraphBlock {
  id: string;             // 段落 UUID
  bookId: string;         // 关联的书籍 ID
  index: number;          // 在文档中的物理段落序号 (0-indexed)
  content: string;        // 段落纯文本内容
  version: number;        // 修改版本号
}

// 3. 朗读进度
export interface ReadingProgress {
  bookId: string;
  currentBlockId: string; // 当前朗读所在的段落块 ID
  playbackSpeed: number;  // 语速倍率
  voiceId?: string;       // 当前使用的 Edge-TTS 音色 ID
  updatedAt: number;
}

// 4. 划线评论模型
export interface Comment {
  id: string;
  bookId: string;
  blockId: string;
  startOffset: number;
  endOffset: number;
  quoteText: string;
  content: string;
  isOrphaned?: boolean;
  createdAt: number;
}

// 5. 微软 Edge-TTS 神经网络音色配置
export interface VoiceOption {
  id: string;        // 如 'zh-CN-XiaoxiaoNeural'
  name: string;      // 显示名称
  gender: 'female' | 'male';
}

export const EDGE_VOICES: VoiceOption[] = [
  // —— 大陆普通话 (女声) ——
  { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓 (温柔亲切)', gender: 'female' },
  { id: 'zh-CN-XiaoyiNeural', name: '晓伊 (活泼可爱)', gender: 'female' },
  
  // —— 大陆普通话 (男声) ——
  { id: 'zh-CN-YunxiNeural', name: '云希 (阳光活泼)', gender: 'male' },
  { id: 'zh-CN-YunyangNeural', name: '云扬 (新闻播音)', gender: 'male' },
  { id: 'zh-CN-YunjianNeural', name: '云健 (影视旁白)', gender: 'male' },
  
  // —— 地方特色与方言 ——
  { id: 'zh-CN-liaoning-XiaobeiNeural', name: '晓北 (东北话)', gender: 'female' },
  { id: 'zh-CN-shaanxi-XiaoniNeural', name: '晓妮 (陕西话)', gender: 'female' },
  { id: 'zh-HK-HiuMaanNeural', name: '晓曼 (粤语女声)', gender: 'female' },
  { id: 'zh-HK-WanLungNeural', name: '云龙 (粤语男声)', gender: 'male' },
  { id: 'zh-TW-HsiaoChenNeural', name: '晓臻 (台湾女声)', gender: 'female' },
  { id: 'zh-TW-YunJheNeural', name: '云哲 (台湾男声)', gender: 'male' },
];
