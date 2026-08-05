import { Book, ParagraphBlock } from '../types/reader';

/**
 * 随机生成简单唯一 ID
 * @returns {string} 唯一标志符
 */
function generateId(): string {
  return 'id_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
}

/**
 * 将文本内容解析并切分为段落块
 * @param {string} text 原始文本内容
 * @param {string} bookId 关联的书籍 ID
 * @returns {ParagraphBlock[]} 拆分后的段落块列表
 */
export function parseTextToBlocks(text: string, bookId: string): ParagraphBlock[] {
  // 兼容不同操作系统的换行符 (Windows: \r\n, Linux: \n, 老 Mac: \r)
  const rawLines = text.split(/\r\n|\n|\r/);
  const blocks: ParagraphBlock[] = [];
  let blockIndex = 0;

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (trimmed.length > 0) {
      blocks.push({
        id: `${bookId}_blk_${blockIndex}_${generateId().substring(0, 6)}`,
        bookId,
        index: blockIndex,
        content: trimmed,
        version: 1,
      });
      blockIndex++;
    }
  }

  return blocks;
}

/**
 * 导入文本文件并创建 Book 及其段落块
 * @param {File} file 用户选择的文件
 * @returns {Promise<{ book: Book; blocks: ParagraphBlock[] }>} 拆分后的书籍与段落
 */
export async function importTxtFile(file: File): Promise<{ book: Book; blocks: ParagraphBlock[] }> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  let text = '';
  
  // 1. 尝试检测 UTF-16 BOM
  if (uint8Array.length >= 2) {
    if (uint8Array[0] === 0xFE && uint8Array[1] === 0xFF) {
      text = new TextDecoder('utf-16be').decode(uint8Array);
    } else if (uint8Array[0] === 0xFF && uint8Array[1] === 0xFE) {
      text = new TextDecoder('utf-16le').decode(uint8Array);
    }
  }

  // 2. 尝试 UTF-8，如果不抛错说明是纯净的 UTF-8 或者全是 ASCII
  if (!text) {
    try {
      const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
      text = utf8Decoder.decode(uint8Array);
    } catch (e) {
      // 3. UTF-8 解码遇到乱码失败，对于中文小说而言，极大可能是 GBK/GB18030 编码
      console.warn("UTF-8 decoding failed, falling back to GBK encoding...");
      const gbkDecoder = new TextDecoder('gbk');
      text = gbkDecoder.decode(uint8Array);
    }
  }

  const bookId = generateId();

  const blocks = parseTextToBlocks(text, bookId);

  const book: Book = {
    id: bookId,
    title: file.name.replace(/\.txt$/i, ''),
    fileName: file.name,
    totalBlocks: blocks.length,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return { book, blocks };
}

/**
 * 带有演示示例文本的模版书籍生成器
 * @returns {{ book: Book; blocks: ParagraphBlock[] }} 示例书籍与段落
 */
export function createDemoBook(): { book: Book; blocks: ParagraphBlock[] } {
  const bookId = 'demo_book_001';
  const demoText = `欢迎使用【Evening Reading - 晚读】！
这是一款为您精雕细琢的跨平台沉浸式文本阅读与朗读助手。

【主要功能亮点】
1. 文本导入：轻松导入本地 TXT 格式经典书籍与文档。
2. 智能朗读：点击任意段落即可随时开启语音朗读，支持 0.75x 至 2.0x 语速随心调节。
3. 段落级进度记录：系统会自动记录您最后听读的段落，编辑前文也不必担心进度倒退或失效。
4. 段落编辑：支持双击或点击编辑按钮实时修改文本段落，修正错字。
5. 划线评论：选中文本即可发表您的阅读感悟与精彩笔记，随时在侧边栏回顾。

夜深人静，唯有书香与良声相伴。祝您享受美好的晚读时光！`;

  const blocks = parseTextToBlocks(demoText, bookId);

  const book: Book = {
    id: bookId,
    title: '晚读功能使用指南',
    fileName: 'guide.txt',
    totalBlocks: blocks.length,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return { book, blocks };
}
