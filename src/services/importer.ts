import { Book, ParagraphBlock, Chapter } from '../types/reader';

/**
 * 随机生成简单唯一 ID
 * @returns {string} 唯一标志符
 */
function generateId(): string {
  return 'id_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
}

/**
 * 将文本内容解析并切分为段落块，同时提取小说章节目录
 * @param {string} text 原始文本内容
 * @param {string} bookId 关联的书籍 ID
 * @returns {{ blocks: ParagraphBlock[], chapters: Chapter[] }}
 */
export function parseTextToBlocks(text: string, bookId: string): { blocks: ParagraphBlock[], chapters: Chapter[] } {
  const rawLines = text.split(/\r\n|\n|\r/);
  const blocks: ParagraphBlock[] = [];
  const chapters: Chapter[] = [];
  let blockIndex = 0;

  // 大陆网文通用章节格式匹配，需小于 50 字符防止误伤普通对话
  const chapterRegex = /^第\s*[一二三四五六七八九十百千万0-9]+\s*[章节回卷]/;

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (trimmed.length > 0) {
      const blockId = `${bookId}_blk_${blockIndex}_${generateId().substring(0, 6)}`;
      blocks.push({
        id: blockId,
        bookId,
        index: blockIndex,
        content: trimmed,
        version: 1,
      });

      if (trimmed.length < 50 && chapterRegex.test(trimmed)) {
        chapters.push({
          title: trimmed,
          blockId: blockId
        });
      }

      blockIndex++;
    }
  }

  return { blocks, chapters };
}

/**
 * 智能检测字节流编码并解码为字符串（UTF-16 BOM > UTF-8 > GBK 降级）
 */
async function decodeFileToText(file: File): Promise<string> {
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

  return text;
}

/**
 * 导入文本文件并创建 Book 及其段落块
 * @param {File} file 用户选择的文件
 * @returns {Promise<{ book: Book; blocks: ParagraphBlock[] }>} 拆分后的书籍与段落
 */
export async function importTxtFile(file: File): Promise<{ book: Book; blocks: ParagraphBlock[] }> {
  const text = await decodeFileToText(file);
  const bookId = generateId();

  const { blocks, chapters } = parseTextToBlocks(text, bookId);

  const book: Book = {
    id: bookId,
    title: file.name.replace(/\.txt$/i, ''),
    fileName: file.name,
    format: 'txt',
    totalBlocks: blocks.length,
    chapters,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return { book, blocks };
}

/**
 * 判断一行是否是围栏代码块起止标记
 */
function isFenceLine(line: string): { fence: string; lang?: string } | null {
  const m = line.match(/^(\s{0,3})(```+|~~~+)(.*)$/);
  if (!m) return null;
  return { fence: m[2], lang: m[3]?.trim() || undefined };
}

/**
 * 判断一行是否是表格分隔行 (|---|---|)
 */
function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

/**
 * 提取 ATX 标题层级与文本；非标题返回 null
 */
function matchAtxHeading(line: string): { level: number; text: string } | null {
  const m = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
  if (!m) return null;
  return { level: m[1].length, text: m[2].trim() };
}

/**
 * 将 Markdown 文本切分为顶层块（细粒度：段落、标题、列表项、引用、代码块、表格）
 * 并抽取 H1/H2 作为章节目录。
 */
export function parseMarkdownToBlocks(
  text: string,
  bookId: string
): { blocks: ParagraphBlock[]; chapters: Chapter[] } {
  const rawLines = text.split(/\r\n|\n|\r/);
  const blocks: ParagraphBlock[] = [];
  const chapters: Chapter[] = [];
  let blockIndex = 0;

  const pushBlock = (
    content: string,
    meta?: { headingLevel?: number; headingText?: string }
  ) => {
    const trimmed = content.replace(/\s+$/g, '');
    if (!trimmed.trim()) return;
    const blockId = `${bookId}_blk_${blockIndex}_${generateId().substring(0, 6)}`;
    blocks.push({
      id: blockId,
      bookId,
      index: blockIndex,
      content: trimmed,
      version: 1,
    });
    if (meta?.headingLevel === 1 || meta?.headingLevel === 2) {
      chapters.push({
        title: meta.headingText ?? trimmed,
        blockId,
        level: meta.headingLevel as 1 | 2,
      });
    }
    blockIndex++;
  };

  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];

    // 空行跳过
    if (!line.trim()) {
      i++;
      continue;
    }

    // 1. 围栏代码块
    const fence = isFenceLine(line);
    if (fence) {
      const codeLines: string[] = [line];
      i++;
      while (i < rawLines.length) {
        const cur = rawLines[i];
        codeLines.push(cur);
        const close = isFenceLine(cur);
        if (close && close.fence[0] === fence.fence[0] && close.fence.length >= fence.fence.length) {
          i++;
          break;
        }
        i++;
      }
      pushBlock(codeLines.join('\n'));
      continue;
    }

    // 2. ATX 标题（单行成块）
    const atx = matchAtxHeading(line);
    if (atx) {
      pushBlock(line, { headingLevel: atx.level, headingText: atx.text });
      i++;
      continue;
    }

    // 3. Setext 标题（下一行是 === 或 ---）
    if (i + 1 < rawLines.length) {
      const next = rawLines[i + 1];
      if (/^\s*=+\s*$/.test(next) && line.trim().length > 0) {
        pushBlock(`${line}\n${next}`, { headingLevel: 1, headingText: line.trim() });
        i += 2;
        continue;
      }
      if (/^\s*-+\s*$/.test(next) && line.trim().length > 0 && !isTableSeparator(next)) {
        pushBlock(`${line}\n${next}`, { headingLevel: 2, headingText: line.trim() });
        i += 2;
        continue;
      }
    }

    // 4. 水平分隔线（--- *** ___）
    if (/^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      pushBlock(line);
      i++;
      continue;
    }

    // 5. 引用块（连续 > 起始行合并）
    if (/^\s{0,3}>/.test(line)) {
      const buf: string[] = [];
      while (i < rawLines.length && rawLines[i].trim() && /^\s{0,3}>/.test(rawLines[i])) {
        buf.push(rawLines[i]);
        i++;
      }
      pushBlock(buf.join('\n'));
      continue;
    }

    // 6. 表格（首行含 | 且下一行是分隔行）
    if (/\|/.test(line) && i + 1 < rawLines.length && isTableSeparator(rawLines[i + 1])) {
      const buf: string[] = [line];
      i++;
      while (i < rawLines.length && rawLines[i].trim() && /\|/.test(rawLines[i])) {
        buf.push(rawLines[i]);
        i++;
      }
      pushBlock(buf.join('\n'));
      continue;
    }

    // 7. 列表项（细粒度：每个顶层列表项独立成块，包含其续行/子项）
    const listMarker = line.match(/^(\s*)([-*+]|\d+[.、)])\s+/);
    if (listMarker) {
      const baseIndent = listMarker[1].length;
      const buf: string[] = [line];
      i++;
      while (i < rawLines.length) {
        const cur = rawLines[i];
        if (!cur.trim()) break;
        const nextMarker = cur.match(/^(\s*)([-*+]|\d+[.、)])\s+/);
        if (nextMarker) {
          if (nextMarker[1].length > baseIndent) {
            // 更深缩进 → 子列表，仍归属当前块
            buf.push(cur);
            i++;
            continue;
          }
          break; // 同级/更浅的列表项 → 另起新块
        }
        // 缩进续行（悬挂续行）归属当前块
        if (/^\s+/.test(cur)) {
          buf.push(cur);
          i++;
          continue;
        }
        break;
      }
      pushBlock(buf.join('\n'));
      continue;
    }

    // 8. 普通段落：连续非空行且不触发上述结构
    const buf: string[] = [line];
    i++;
    while (i < rawLines.length) {
      const cur = rawLines[i];
      if (!cur.trim()) break;
      if (
        matchAtxHeading(cur) ||
        isFenceLine(cur) ||
        /^\s{0,3}>/.test(cur) ||
        /^(\s*)([-*+]|\d+[.、)])\s+/.test(cur) ||
        (i + 1 < rawLines.length && (/^\s*=+\s*$/.test(rawLines[i + 1]) || (/^\s*-+\s*$/.test(rawLines[i + 1]) && !isTableSeparator(rawLines[i + 1])))) ||
        /^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(cur)
      ) {
        break;
      }
      buf.push(cur);
      i++;
    }
    pushBlock(buf.join('\n'));
  }

  return { blocks, chapters };
}

/**
 * 导入 Markdown 文件并创建 Book 及其段落块
 */
export async function importMarkdownFile(file: File): Promise<{ book: Book; blocks: ParagraphBlock[] }> {
  const text = await decodeFileToText(file);
  const bookId = generateId();

  const { blocks, chapters } = parseMarkdownToBlocks(text, bookId);

  const book: Book = {
    id: bookId,
    title: file.name.replace(/\.(md|markdown)$/i, ''),
    fileName: file.name,
    format: 'markdown',
    totalBlocks: blocks.length,
    chapters,
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

  const { blocks, chapters } = parseTextToBlocks(demoText, bookId);

  const book: Book = {
    id: bookId,
    title: '晚读功能使用指南',
    fileName: 'guide.txt',
    totalBlocks: blocks.length,
    chapters,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return { book, blocks };
}
