# PDF/图片转 Markdown Chrome 扩展

## 目标
将 PDF 文件与图片文件中的文字内容提取并转换为可下载的 Markdown（.md）文件。

## 技术栈
- Chrome Extension Manifest V3
- Vite + TypeScript
- pdfjs-dist：PDF 文本层提取与页面渲染
- tesseract.js：图片 OCR 及扫描版 PDF 页面识别

## 目录结构
- `extension/` — manifest.json、background.js
- `src/` — 扩展页面与业务逻辑
- `scripts/pack-extension.mjs` — 打包为可加载的扩展目录

## 约束
- 所有脚本本地打包，符合 MV3 CSP
- 支持常见图片格式：PNG、JPG、JPEG、WEBP、GIF、BMP
- 支持 PDF；有文本层时直接提取，无文本层时逐页 OCR
