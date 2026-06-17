import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const langDir = path.join(root, "public/tesseract/lang");

const LANGUAGE_FILES = [
  {
    lang: "chi_sim",
    url: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/chi_sim/4.0.0_best_int/chi_sim.traineddata.gz",
  },
  {
    lang: "eng",
    url: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
  },
];

async function downloadFile(url, destination) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载失败 ${url}，HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destination, buffer);
}

async function ensureLanguageFiles() {
  fs.mkdirSync(langDir, { recursive: true });

  for (const { lang, url } of LANGUAGE_FILES) {
    const destination = path.join(langDir, `${lang}.traineddata.gz`);
    if (fs.existsSync(destination)) {
      continue;
    }

    console.log(`下载 OCR 语言包：${lang}`);
    await downloadFile(url, destination);
  }
}

await ensureLanguageFiles();
console.log("OCR 中文/英文语言包已就绪。");
