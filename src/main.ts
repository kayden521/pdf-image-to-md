import "./styles.css";
import { getPdfPageCount } from "./services/pdfExtractor";
import {
  getAllPageNumbers,
  parsePageRanges,
} from "./services/pageRange";
import {
  downloadMarkdown,
  isPdfFileType,
  processFile,
  resolveDownloadFilename,
  type ProcessProgress,
} from "./services/fileProcessor";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("未找到应用根节点");
}

app.innerHTML = `
  <div class="page">
    <header class="header">
      <img class="logo" src="./icon.svg" alt="" width="40" height="40" />
      <div>
        <h1>文字转 Markdown</h1>
        <p class="subtitle">上传 PDF 或图片，提取文字并下载为 .md 文件</p>
      </div>
    </header>

    <section class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="上传文件">
      <input type="file" id="file-input" accept=".pdf,image/*" hidden />
      <div class="dropzone-icon">📄</div>
      <p class="dropzone-title">拖拽文件到此处，或点击选择</p>
      <p class="dropzone-hint">支持 PDF、PNG、JPG、WEBP、GIF、BMP</p>
    </section>

    <section class="page-options hidden" id="page-options-panel">
      <div class="page-options-header">
        <h2>PDF 页码选择</h2>
        <p class="page-options-meta" id="pdf-meta"></p>
      </div>

      <fieldset class="page-mode-group">
        <legend class="sr-only">转换范围</legend>
        <label class="radio-card">
          <input type="radio" name="page-mode" value="all" checked />
          <span class="radio-card-content">
            <span class="radio-card-title">全部转换</span>
            <span class="radio-card-desc">转换 PDF 的全部页面</span>
          </span>
        </label>
        <label class="radio-card">
          <input type="radio" name="page-mode" value="custom" />
          <span class="radio-card-content">
            <span class="radio-card-title">指定页码</span>
            <span class="radio-card-desc">仅转换选定页码或页码范围</span>
          </span>
        </label>
      </fieldset>

      <div class="page-range-field hidden" id="page-range-field">
        <label for="page-range-input">页码范围</label>
        <input
          type="text"
          id="page-range-input"
          placeholder="例如 1-10, 20-30"
          autocomplete="off"
        />
        <p class="field-hint">支持单页（如 5）或范围（如 1-10），多个范围用逗号分隔</p>
        <p class="field-error hidden" id="page-range-error"></p>
      </div>

      <div class="page-options-actions">
        <button type="button" class="btn btn-secondary" id="cancel-btn">重新选择文件</button>
        <button type="button" class="btn btn-primary" id="convert-btn">开始转换</button>
      </div>
    </section>

    <section class="status hidden" id="status-panel" aria-live="polite">
      <div class="status-row">
        <span class="status-label">状态</span>
        <span id="status-text">等待上传</span>
      </div>
      <div class="progress-track">
        <div class="progress-bar" id="progress-bar"></div>
      </div>
    </section>

    <section class="preview hidden" id="preview-panel">
      <div class="preview-header">
        <h2>预览</h2>
      </div>

      <div class="download-options">
        <h3 class="download-options-title">下载文件名</h3>
        <fieldset class="page-mode-group">
          <legend class="sr-only">下载命名方式</legend>
          <label class="radio-card">
            <input type="radio" name="download-name-mode" value="default" checked />
            <span class="radio-card-content">
              <span class="radio-card-title">使用原文件名</span>
              <span class="radio-card-desc" id="default-filename-hint">将使用原文件名保存为 .md</span>
            </span>
          </label>
          <label class="radio-card">
            <input type="radio" name="download-name-mode" value="custom" />
            <span class="radio-card-content">
              <span class="radio-card-title">自定义文件名</span>
              <span class="radio-card-desc">自行输入下载文件名</span>
            </span>
          </label>
        </fieldset>

        <div class="page-range-field hidden" id="custom-filename-field">
          <label for="custom-filename-input">文件名</label>
          <input
            type="text"
            id="custom-filename-input"
            placeholder="输入文件名（无需 .md 后缀）"
            autocomplete="off"
          />
          <p class="field-hint">保存时将自动添加 .md 后缀</p>
          <p class="field-error hidden" id="custom-filename-error"></p>
        </div>

        <div class="download-actions">
          <button type="button" class="btn btn-primary" id="download-btn">下载 Markdown</button>
        </div>
      </div>

      <pre class="preview-content" id="preview-content"></pre>
    </section>

    <footer class="footer">
      <p>含文本层的 PDF 将直接提取；扫描版 PDF 与图片将使用 OCR 识别（首次需下载语言包）。</p>
    </footer>
  </div>
`;

const dropzone = document.querySelector<HTMLDivElement>("#dropzone")!;
const fileInput = document.querySelector<HTMLInputElement>("#file-input")!;
const pageOptionsPanel = document.querySelector<HTMLElement>("#page-options-panel")!;
const pdfMeta = document.querySelector<HTMLElement>("#pdf-meta")!;
const pageRangeField = document.querySelector<HTMLElement>("#page-range-field")!;
const pageRangeInput = document.querySelector<HTMLInputElement>("#page-range-input")!;
const pageRangeError = document.querySelector<HTMLElement>("#page-range-error")!;
const cancelBtn = document.querySelector<HTMLButtonElement>("#cancel-btn")!;
const convertBtn = document.querySelector<HTMLButtonElement>("#convert-btn")!;
const pageModeInputs = document.querySelectorAll<HTMLInputElement>('input[name="page-mode"]');
const statusPanel = document.querySelector<HTMLElement>("#status-panel")!;
const statusText = document.querySelector<HTMLElement>("#status-text")!;
const progressBar = document.querySelector<HTMLElement>("#progress-bar")!;
const previewPanel = document.querySelector<HTMLElement>("#preview-panel")!;
const previewContent = document.querySelector<HTMLElement>("#preview-content")!;
const defaultFilenameHint = document.querySelector<HTMLElement>("#default-filename-hint")!;
const customFilenameField = document.querySelector<HTMLElement>("#custom-filename-field")!;
const customFilenameInput = document.querySelector<HTMLInputElement>("#custom-filename-input")!;
const customFilenameError = document.querySelector<HTMLElement>("#custom-filename-error")!;
const downloadNameModeInputs = document.querySelectorAll<HTMLInputElement>(
  'input[name="download-name-mode"]',
);
const downloadBtn = document.querySelector<HTMLButtonElement>("#download-btn")!;

let currentMarkdown = "";
let currentFilename = "document.md";
let isProcessing = false;
let pendingFile: File | null = null;
let pendingPdfPageCount = 0;

function setProgress(progress: ProcessProgress): void {
  statusPanel.classList.remove("hidden");
  statusText.textContent = progress.message;
  progressBar.style.width = `${progress.percent}%`;
}

function resetDownloadNameUi(): void {
  const defaultModeInput = document.querySelector<HTMLInputElement>(
    'input[name="download-name-mode"][value="default"]',
  );
  if (defaultModeInput) {
    defaultModeInput.checked = true;
  }
  customFilenameField.classList.add("hidden");
  customFilenameInput.value = "";
  customFilenameError.textContent = "";
  customFilenameError.classList.add("hidden");
  defaultFilenameHint.textContent = "将使用原文件名保存为 .md";
}

function resetResultUi(): void {
  currentMarkdown = "";
  currentFilename = "document.md";
  previewPanel.classList.add("hidden");
  previewContent.textContent = "";
  progressBar.style.width = "0%";
  statusPanel.classList.add("hidden");
  resetDownloadNameUi();
}

function getDownloadNameMode(): "default" | "custom" {
  const selected = document.querySelector<HTMLInputElement>(
    'input[name="download-name-mode"]:checked',
  );
  return selected?.value === "custom" ? "custom" : "default";
}

function showCustomFilenameError(message: string): void {
  customFilenameError.textContent = message;
  customFilenameError.classList.remove("hidden");
}

function clearCustomFilenameError(): void {
  customFilenameError.textContent = "";
  customFilenameError.classList.add("hidden");
}

function resolveDownloadName(): string {
  if (getDownloadNameMode() === "default") {
    return currentFilename;
  }
  return resolveDownloadFilename(customFilenameInput.value);
}

function updateDefaultFilenameHint(): void {
  defaultFilenameHint.textContent = `将保存为：${currentFilename}`;
}

function resetPendingFile(): void {
  pendingFile = null;
  pendingPdfPageCount = 0;
  pageOptionsPanel.classList.add("hidden");
  pageRangeField.classList.add("hidden");
  pageRangeInput.value = "";
  pageRangeError.textContent = "";
  pageRangeError.classList.add("hidden");

  const allModeInput = document.querySelector<HTMLInputElement>('input[name="page-mode"][value="all"]');
  if (allModeInput) {
    allModeInput.checked = true;
  }
}

function getSelectedPageMode(): "all" | "custom" {
  const selected = document.querySelector<HTMLInputElement>('input[name="page-mode"]:checked');
  return selected?.value === "custom" ? "custom" : "all";
}

function showPageRangeError(message: string): void {
  pageRangeError.textContent = message;
  pageRangeError.classList.remove("hidden");
}

function clearPageRangeError(): void {
  pageRangeError.textContent = "";
  pageRangeError.classList.add("hidden");
}

function resolvePdfPageNumbers(): number[] {
  if (getSelectedPageMode() === "all") {
    return getAllPageNumbers(pendingPdfPageCount);
  }

  const pageNumbers = parsePageRanges(pageRangeInput.value, pendingPdfPageCount);
  if (pageNumbers.length === 0) {
    throw new Error("请至少选择一个有效页码");
  }
  return pageNumbers;
}

async function startConversion(file: File, pageNumbers?: number[]): Promise<void> {
  if (isProcessing) {
    return;
  }

  isProcessing = true;
  resetResultUi();
  pageOptionsPanel.classList.add("hidden");
  dropzone.classList.add("processing");

  try {
    const result = await processFile(
      file,
      setProgress,
      pageNumbers ? { pageNumbers } : undefined,
    );
    currentMarkdown = result.markdown;
    currentFilename = result.filename;
    previewContent.textContent = result.markdown;
    updateDefaultFilenameHint();
    previewPanel.classList.remove("hidden");
    statusText.textContent = "转换完成，可预览或下载";
  } catch (error) {
    const message = error instanceof Error ? error.message : "转换失败";
    statusText.textContent = message;
    progressBar.style.width = "0%";

    if (isPdfFileType(file)) {
      pageOptionsPanel.classList.remove("hidden");
    }
  } finally {
    isProcessing = false;
    dropzone.classList.remove("processing");
  }
}

async function handleSelectedFile(file: File): Promise<void> {
  resetResultUi();
  resetPendingFile();
  pendingFile = file;

  if (!isPdfFileType(file)) {
    await startConversion(file);
    return;
  }

  try {
    statusPanel.classList.remove("hidden");
    statusText.textContent = "正在读取 PDF 页数…";
    progressBar.style.width = "0%";

    const buffer = await file.arrayBuffer();
    pendingPdfPageCount = await getPdfPageCount(buffer);

    pdfMeta.textContent = `文件：${file.name} · 共 ${pendingPdfPageCount} 页`;
    pageOptionsPanel.classList.remove("hidden");
    statusPanel.classList.add("hidden");
  } catch (error) {
    const message = error instanceof Error ? error.message : "无法读取 PDF";
    statusText.textContent = message;
    resetPendingFile();
  }
}

dropzone.addEventListener("click", () => {
  if (!isProcessing) {
    fileInput.click();
  }
});

dropzone.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && !isProcessing) {
    event.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  fileInput.value = "";
  if (file) {
    void handleSelectedFile(file);
  }
});

dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.classList.add("dragover");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragover");
});

dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropzone.classList.remove("dragover");
  const file = event.dataTransfer?.files[0];
  if (file) {
    void handleSelectedFile(file);
  }
});

pageModeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    const isCustomMode = getSelectedPageMode() === "custom";
    pageRangeField.classList.toggle("hidden", !isCustomMode);
    clearPageRangeError();
  });
});

pageRangeInput.addEventListener("input", () => {
  clearPageRangeError();
});

cancelBtn.addEventListener("click", () => {
  if (isProcessing) {
    return;
  }
  resetPendingFile();
  resetResultUi();
});

convertBtn.addEventListener("click", () => {
  if (!pendingFile || isProcessing) {
    return;
  }

  clearPageRangeError();

  try {
    const pageNumbers = resolvePdfPageNumbers();
    void startConversion(pendingFile, pageNumbers);
  } catch (error) {
    const message = error instanceof Error ? error.message : "页码选择无效";
    showPageRangeError(message);
  }
});

downloadNameModeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    const isCustomMode = getDownloadNameMode() === "custom";
    customFilenameField.classList.toggle("hidden", !isCustomMode);
    clearCustomFilenameError();
    if (isCustomMode) {
      customFilenameInput.focus();
    }
  });
});

customFilenameInput.addEventListener("input", () => {
  clearCustomFilenameError();
});

downloadBtn.addEventListener("click", () => {
  if (!currentMarkdown) {
    return;
  }

  clearCustomFilenameError();

  try {
    const filename = resolveDownloadName();
    downloadMarkdown(currentMarkdown, filename);
  } catch (error) {
    const message = error instanceof Error ? error.message : "文件名无效";
    showCustomFilenameError(message);
    customFilenameField.classList.remove("hidden");
    const customModeInput = document.querySelector<HTMLInputElement>(
      'input[name="download-name-mode"][value="custom"]',
    );
    if (customModeInput) {
      customModeInput.checked = true;
    }
    customFilenameInput.focus();
  }
});
