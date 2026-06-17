import { createWorker, PSM, type Worker } from "tesseract.js";

let sharedWorker: Worker | null = null;
let currentProgressHandler: ((progress: number, message: string) => void) | undefined;

function getTesseractOptions() {
  const extensionPaths =
    typeof chrome !== "undefined" && chrome.runtime?.getURL
      ? {
          workerPath: chrome.runtime.getURL("tesseract/worker.min.js"),
          langPath: chrome.runtime.getURL("tesseract/lang"),
        }
      : {};

  return {
    ...extensionPaths,
    logger: (message: { status: string; progress?: number }) => {
      if (message.status === "recognizing text") {
        const percent = Math.round((message.progress ?? 0) * 100);
        currentProgressHandler?.(percent, `OCR 识别中 ${percent}%`);
      }
    },
  };
}

async function getWorker(): Promise<Worker> {
  if (sharedWorker) {
    return sharedWorker;
  }

  sharedWorker = await createWorker(["chi_sim", "eng"], 1, getTesseractOptions());
  await sharedWorker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
  });
  return sharedWorker;
}

export async function terminateOcrWorker(): Promise<void> {
  if (sharedWorker) {
    await sharedWorker.terminate();
    sharedWorker = null;
  }
}

export async function ocrImageFile(
  file: File | Blob,
  onProgress?: (progress: number, message: string) => void,
): Promise<string> {
  currentProgressHandler = onProgress;
  const worker = await getWorker();

  try {
    const result = await worker.recognize(file);
    return result.data.text.trim();
  } finally {
    currentProgressHandler = undefined;
  }
}

export async function ocrCanvas(
  canvas: HTMLCanvasElement,
  onProgress?: (progress: number, message: string) => void,
): Promise<string> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) {
        resolve(value);
      } else {
        reject(new Error("无法将页面渲染为图片"));
      }
    }, "image/png");
  });

  return ocrImageFile(blob, onProgress);
}
