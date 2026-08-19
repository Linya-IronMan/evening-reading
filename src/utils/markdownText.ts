/**
 * Markdown 段落源码 → TTS 可朗读的纯文本。
 *
 * 规则要点：
 * - 若整个块是围栏代码块（``` 包裹），返回 { text: '', skipped: true }
 * - 保留行内代码字面内容，仅去除反引号
 * - 剥离标题、引用、列表、粗斜体、链接、图片、HTML 标签、水平分隔线等语法符号
 * - 表格分隔行 (|---|:---:|) 直接丢弃，其余单元格按 " ｜ " 拼接（读起来自然停顿）
 */
export interface StrippedTTSText {
  text: string;
  skipped: boolean;
}

const FENCED_CODE_RE = /^\s*(```|~~~)[\s\S]*?\1\s*$/;
const TABLE_SEPARATOR_RE = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/;

/**
 * 剥离行内 Markdown 语法符号（加粗、斜体、链接、图片、行内代码、HTML 标签等）。
 */
function stripInline(source: string): string {
  let text = source;

  // 图片：![alt](url) -> alt
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  // 链接：[text](url) -> text
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
  // 引用式链接：[text][id] -> text
  text = text.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1');
  // 行内代码：`code` -> code
  text = text.replace(/`+([^`\n]+)`+/g, '$1');
  // 加粗：**text** or __text__
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  // 斜体：*text* or _text_（保守匹配，避免误伤中文下划线名词）
  text = text.replace(/(^|[\s\p{P}])\*([^*\n]+)\*(?=$|[\s\p{P}])/gu, '$1$2');
  text = text.replace(/(^|[\s\p{P}])_([^_\n]+)_(?=$|[\s\p{P}])/gu, '$1$2');
  // 删除线：~~text~~
  text = text.replace(/~~([^~]+)~~/g, '$1');
  // HTML 标签
  text = text.replace(/<[^>]+>/g, '');

  return text;
}

export function stripMarkdownForTTS(source: string): StrippedTTSText {
  const raw = source ?? '';
  const trimmed = raw.trim();

  if (!trimmed) return { text: '', skipped: true };

  if (FENCED_CODE_RE.test(trimmed)) {
    return { text: '', skipped: true };
  }

  // 水平分隔线：--- *** ___
  if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) {
    return { text: '', skipped: true };
  }

  const lines = raw.split(/\r\n|\n|\r/);
  const outLines: string[] = [];

  for (const rawLine of lines) {
    let line = rawLine;

    // 表格分隔行直接跳过
    if (TABLE_SEPARATOR_RE.test(line)) continue;

    // ATX 标题：# / ## / ### ...
    line = line.replace(/^\s{0,3}#{1,6}\s+/, '');
    // Setext 标题下划线（=== / ---）跳过
    if (/^\s*(=+|-+)\s*$/.test(line) && outLines.length > 0) continue;
    // 引用：> quote
    line = line.replace(/^\s{0,3}>\s?/g, '');
    // 有序列表：1. 2. 3.
    line = line.replace(/^\s*\d+[.、)]\s+/, '');
    // 无序列表：- * +
    line = line.replace(/^\s*[-*+]\s+/, '');
    // 任务列表：[ ] / [x]
    line = line.replace(/^\[\s?[xX ]?\]\s+/, '');

    line = stripInline(line);

    // 表格行：把 | 分隔转成自然停顿
    if (/\|/.test(line)) {
      const cells = line.split('|').map((c) => c.trim()).filter((c) => c.length > 0);
      line = cells.join('，');
    }

    const cleaned = line.trim();
    if (cleaned.length > 0) {
      outLines.push(cleaned);
    }
  }

  const text = outLines.join(' ').replace(/\s+/g, ' ').trim();
  return { text, skipped: text.length === 0 };
}
