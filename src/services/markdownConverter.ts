const HEADING_MAX_LENGTH = 80;
const HEADING_PATTERN = /^第[一二三四五六七八九十百千\d]+[章节部分篇]|^[\d]+[.、]\s*.+/;
const LINE_BREAK_BEFORE_PUNCTUATION =
  /[\n\r]+[\t ]*(?=[，。！？；：、）】》」』"'…．.!?;:)\]}>"'»])/;
const CJK_CHAR_PATTERN = /[\u3400-\u9fff]/;

export function normalizeOcrLineBreaks(text: string): string {
  let normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  normalized = normalized.replace(
    new RegExp(LINE_BREAK_BEFORE_PUNCTUATION.source, "g"),
    "",
  );

  normalized = normalized.replace(
    /([^\n。！？!?…])\s*\n+\s*(?=\S)/g,
    (match, before: string, offset: number, source: string) => {
      const nextIndex = offset + match.length;
      const nextChar = source[nextIndex] ?? "";
      const nextSlice = source.slice(nextIndex, nextIndex + 4);

      if (nextChar === "#" || /^[-•*]\s/.test(nextSlice)) {
        return match;
      }

      if (CJK_CHAR_PATTERN.test(before) && CJK_CHAR_PATTERN.test(nextChar)) {
        return before;
      }

      if (CJK_CHAR_PATTERN.test(before) && /[的之了地得和在以及与及]/.test(nextChar)) {
        return before;
      }

      if (before.endsWith("-") && /^[A-Za-z]/.test(nextChar)) {
        return before.slice(0, -1);
      }

      if (/[A-Za-z0-9]$/.test(before) && /^[A-Za-z0-9]/.test(nextChar)) {
        return `${before} `;
      }

      if (/[\u3400-\u9fffA-Za-z0-9（(]/.test(nextChar)) {
        return before;
      }

      return match;
    },
  );

  return normalized;
}

interface PositionedText {
  text: string;
  x: number;
  y: number;
  fontSize: number;
}

export function plainTextToMarkdown(text: string, title?: string): string {
  const normalized = normalizeOcrLineBreaks(text).trim();
  if (!normalized) {
    return title ? `# ${stripExtension(title)}\n\n` : "";
  }

  const blocks = normalized.split(/\n{2,}/);
  const lines: string[] = [];

  if (title) {
    lines.push(`# ${stripExtension(title)}`, "");
  }

  for (const block of blocks) {
    const paragraph = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join("");

    if (!paragraph) {
      continue;
    }

    if (isHeadingLine(paragraph)) {
      lines.push(`## ${paragraph}`, "");
    } else if (paragraph.startsWith("- ") || paragraph.startsWith("• ")) {
      lines.push(paragraph.replace(/^•\s*/, "- "), "");
    } else {
      lines.push(paragraph, "");
    }
  }

  return `${lines.join("\n").trim()}\n`;
}

export function positionedTextToMarkdown(
  items: PositionedText[],
  title?: string,
): string {
  if (items.length === 0) {
    return plainTextToMarkdown("", title);
  }

  const sorted = [...items].sort((a, b) => {
    const yDiff = b.y - a.y;
    if (Math.abs(yDiff) > 2) {
      return yDiff;
    }
    return a.x - b.x;
  });

  const fontSizes = sorted.map((item) => item.fontSize).filter((size) => size > 0);
  const medianSize =
    fontSizes.length > 0
      ? fontSizes.sort((a, b) => a - b)[Math.floor(fontSizes.length / 2)]
      : 12;

  const lines: string[] = [];
  if (title) {
    lines.push(`# ${stripExtension(title)}`, "");
  }

  let currentLine: PositionedText[] = [];
  let currentY = sorted[0]?.y ?? 0;

  const flushLine = () => {
    if (currentLine.length === 0) {
      return;
    }
    const text = currentLine
      .sort((a, b) => a.x - b.x)
      .map((item) => item.text)
      .join("")
      .trim();

    if (text) {
      const maxFontSize = Math.max(...currentLine.map((item) => item.fontSize));
      if (maxFontSize > medianSize * 1.25 && text.length <= HEADING_MAX_LENGTH) {
        lines.push(`## ${text}`, "");
      } else if (/^[-•*]\s/.test(text)) {
        lines.push(text.replace(/^•\s*/, "- "), "");
      } else {
        lines.push(text, "");
      }
    }
    currentLine = [];
  };

  for (const item of sorted) {
    if (currentLine.length > 0 && Math.abs(item.y - currentY) > 4) {
      flushLine();
    }
    currentLine.push(item);
    currentY = item.y;
  }
  flushLine();

  return `${normalizeOcrLineBreaks(lines.join("\n")).trim()}\n`;
}

function isHeadingLine(line: string): boolean {
  return (
    line.length <= HEADING_MAX_LENGTH &&
    (HEADING_PATTERN.test(line) ||
      (/^#{1,6}\s/.test(line) === false && line === line.toUpperCase() && /[A-Z]/.test(line)))
  );
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim() || "document";
}
