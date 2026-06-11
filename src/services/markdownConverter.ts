const HEADING_MAX_LENGTH = 80;
const HEADING_PATTERN = /^第[一二三四五六七八九十百千\d]+[章节部分篇]|^[\d]+[.、]\s*.+/;

interface PositionedText {
  text: string;
  x: number;
  y: number;
  fontSize: number;
}

export function plainTextToMarkdown(text: string, title?: string): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
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
      .join(" ");

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

  return `${lines.join("\n").trim()}\n`;
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
