import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");
const extTemplate = path.join(root, "extension");
const outDir = path.join(root, "extension-package");

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function copyIfExists(src, dest) {
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

if (!fs.existsSync(distDir)) {
  console.error("请先运行: npm run build");
  process.exit(1);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

copyRecursive(distDir, outDir);

fs.copyFileSync(
  path.join(extTemplate, "manifest.json"),
  path.join(outDir, "manifest.json"),
);
fs.copyFileSync(
  path.join(extTemplate, "background.js"),
  path.join(outDir, "background.js"),
);

const iconsDir = path.join(outDir, "icons");
fs.mkdirSync(iconsDir, { recursive: true });
copyIfExists(
  path.join(root, "public", "icon.svg"),
  path.join(iconsDir, "icon.svg"),
);
copyIfExists(
  path.join(root, "public", "icon.svg"),
  path.join(outDir, "icon.svg"),
);

copyIfExists(
  path.join(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs"),
  path.join(outDir, "pdf.worker.min.mjs"),
);

const tesseractDir = path.join(outDir, "tesseract");
fs.mkdirSync(tesseractDir, { recursive: true });
copyIfExists(
  path.join(root, "node_modules/tesseract.js/dist/worker.min.js"),
  path.join(tesseractDir, "worker.min.js"),
);
console.log(`\n扩展已打包到：\n  ${outDir}\n`);
console.log(
  "安装：Chrome → 扩展程序 → 管理扩展 → 开发者模式 → 加载已解压的扩展程序 → 选择上述文件夹\n",
);
