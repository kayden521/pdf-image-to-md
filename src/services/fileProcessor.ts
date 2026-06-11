import { plainTextToMarkdown, sanitizeFilename } from "./markdownConverter";
import { extractPdfToMarkdown } from "./pdfExtractor";
import { ocrImageFile, terminateOcrWorker } from "./imageOcr";

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/bmp",
]);

const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif|bmp)$/i;

export interface ProcessProgress {
  phase: "reading" | "extracting" | "done" | "error";
  message: string;
  percent: number;
}

export interface ProcessResult {
  markdown: string;
  filename: string;
}

export interface ProcessOptions {
  pageNumbers?: number[];
}

export function isPdfFileType(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function isImageFile(file: File): boolean {
  return IMAGE_TYPES.has(file.type) || IMAGE_EXTENSIONS.test(file.name);
}

export async function processFile(
  file: File,
  onProgress?: (progress: ProcessProgress) => void,
  options?: ProcessOptions,
): Promise<ProcessResult> {
  onProgress?.({
    phase: "reading",
    message: `正在读取 ${file.name}…`,
    percent: 5,
  });

  try {
    let markdown = "";

    if (isPdfFileType(file)) {
      const buffer = await file.arrayBuffer();
      onProgress?.({
        phase: "extracting",
        message: "正在提取 PDF 文字…",
        percent: 10,
      });

      const body = await extractPdfToMarkdown(buffer, options?.pageNumbers, (pageProgress) => {
        const percent =
          10 + Math.round((pageProgress.current / pageProgress.total) * 80);
        onProgress?.({
          phase: "extracting",
          message: pageProgress.message,
          percent,
        });
      });

      const title = sanitizeFilename(file.name.replace(/\.[^.]+$/, ""));
      markdown = `# ${title}\n\n${body}\n`;
    } else if (isImageFile(file)) {
      onProgress?.({
        phase: "extracting",
        message: "正在识别图片文字…",
        percent: 20,
      });

      const text = await ocrImageFile(file, (percent, message) => {
        onProgress?.({
          phase: "extracting",
          message,
          percent: 20 + Math.round(percent * 0.7),
        });
      });

      markdown = plainTextToMarkdown(text, file.name);
    } else {
      throw new Error("仅支持 PDF 与常见图片格式（PNG、JPG、WEBP、GIF、BMP）");
    }

    onProgress?.({
      phase: "done",
      message: "转换完成",
      percent: 100,
    });

    const baseName = sanitizeFilename(file.name.replace(/\.[^.]+$/, ""));
    return {
      markdown: markdown.trim() ? `${markdown.trim()}\n` : "# 未识别到文字内容\n",
      filename: `${baseName}.md`,
    };
  } finally {
    await terminateOcrWorker();
  }
}

export function buildDefaultMarkdownFilename(sourceFilename: string): string {
  const baseName = sanitizeFilename(sourceFilename.replace(/\.[^.]+$/, ""));
  return `${baseName}.md`;
}

export function resolveDownloadFilename(customName: string): string {
  const trimmed = customName.trim();
  if (!trimmed) {
    throw new Error("请输入文件名");
  }

  const withoutExtension = trimmed.replace(/\.md$/i, "");
  const sanitized = sanitizeFilename(withoutExtension);
  if (!sanitized) {
    throw new Error("文件名包含无效字符");
  }

  return `${sanitized}.md`;
}

export function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
