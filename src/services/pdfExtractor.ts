import * as pdfjsLib from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { positionedTextToMarkdown } from "./markdownConverter";
import { ocrCanvas } from "./imageOcr";

const MIN_TEXT_CHARS_PER_PAGE = 24;
const PDF_OCR_RENDER_SCALE = 3;
const PDFJS_VERSION = "4.10.38";

function getPdfDocumentInit(data: ArrayBuffer) {
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    return {
      data,
      cMapUrl: chrome.runtime.getURL("cmaps/"),
      cMapPacked: true,
      standardFontDataUrl: chrome.runtime.getURL("standard_fonts/"),
    };
  }

  return {
    data,
    cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/standard_fonts/`,
  };
}

function isGarbledText(text: string): boolean {
  if (!text.trim()) {
    return true;
  }

  const replacementCount = (text.match(/�/g) ?? []).length;
  if (replacementCount > 0 && replacementCount / text.length > 0.05) {
    return true;
  }

  const readableChars = text.match(/[\p{L}\p{N}\u3400-\u9fff]/gu) ?? [];
  return readableChars.length / text.length < 0.35;
}

function shouldUsePdfTextLayer(rawText: string): boolean {
  if (rawText.length < MIN_TEXT_CHARS_PER_PAGE) {
    return false;
  }

  if (isGarbledText(rawText)) {
    return false;
  }

  return true;
}

function getPdfWorkerSrc(): string {
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    return chrome.runtime.getURL("pdf.worker.min.mjs");
  }
  return new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).href;
}

pdfjsLib.GlobalWorkerOptions.workerSrc = getPdfWorkerSrc();

interface PdfProgress {
  current: number;
  total: number;
  message: string;
}

function textItemsToPositioned(items: TextItem[]) {
  return items
    .filter((item) => "str" in item && item.str.trim().length > 0)
    .map((item) => {
      const transform = item.transform;
      const fontSize = Math.hypot(transform[0], transform[1]);
      return {
        text: item.str,
        x: transform[4],
        y: transform[5],
        fontSize,
      };
    });
}

async function extractPageText(page: pdfjsLib.PDFPageProxy): Promise<string> {
  const textContent = await page.getTextContent();
  const positioned = textItemsToPositioned(textContent.items as TextItem[]);
  const rawText = positioned.map((item) => item.text).join("").trim();

  if (shouldUsePdfTextLayer(rawText)) {
    return positionedTextToMarkdown(positioned);
  }

  const viewport = page.getViewport({ scale: PDF_OCR_RENDER_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("无法创建画布上下文");
  }

  await page.render({ canvasContext: context, viewport }).promise;
  const ocrText = await ocrCanvas(canvas);
  return ocrText;
}

export async function getPdfPageCount(data: ArrayBuffer): Promise<number> {
  const pdf = await pdfjsLib.getDocument(getPdfDocumentInit(data)).promise;
  return pdf.numPages;
}

export async function extractPdfToMarkdown(
  data: ArrayBuffer,
  pageNumbers?: number[],
  onProgress?: (progress: PdfProgress) => void,
): Promise<string> {
  const pdf = await pdfjsLib.getDocument(getPdfDocumentInit(data)).promise;
  const pagesToProcess =
    pageNumbers && pageNumbers.length > 0
      ? pageNumbers
      : Array.from({ length: pdf.numPages }, (_, index) => index + 1);

  for (const pageNumber of pagesToProcess) {
    if (pageNumber < 1 || pageNumber > pdf.numPages) {
      throw new Error(`页码 ${pageNumber} 超出范围（PDF 共 ${pdf.numPages} 页）`);
    }
  }

  const pageTexts: string[] = [];
  const total = pagesToProcess.length;

  for (let index = 0; index < pagesToProcess.length; index += 1) {
    const pageNumber = pagesToProcess[index];
    onProgress?.({
      current: index + 1,
      total,
      message: `正在处理 PDF 第 ${pageNumber} 页（${index + 1}/${total}）…`,
    });

    const page = await pdf.getPage(pageNumber);
    const pageText = await extractPageText(page);
    if (pageText.trim()) {
      if (total > 1 || pdf.numPages > 1) {
        pageTexts.push(`## 第 ${pageNumber} 页\n\n${pageText.trim()}`);
      } else {
        pageTexts.push(pageText.trim());
      }
    }
  }

  return pageTexts.join("\n\n---\n\n").trim();
}
