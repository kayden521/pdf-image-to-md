# 文字转 Markdown · Chrome 扩展

将 PDF 与图片中的文字提取并转换为可下载的 Markdown（`.md`）文件。

## 功能

- **PDF**：优先提取文本层；扫描版 PDF 自动逐页 OCR
- **图片**：支持 PNG、JPG、WEBP、GIF、BMP
- **输出**：预览 Markdown 内容，一键下载 `.md` 文件
- **语言**：OCR 支持简体中文与英文（首次使用需联网下载语言包）

## 开发与打包

```bash
cd pdf-image-to-md
npm install
npm run pack
```

打包产物位于 `extension-package/`，在 Chrome 中加载该文件夹即可。

## 安装

1. 打开 Chrome → **扩展程序** → **管理扩展**
2. 开启右上角 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择 `extension-package` 目录
5. 点击工具栏图标打开转换页面

## 使用

1. 拖拽或选择 PDF / 图片文件
2. 等待提取或 OCR 完成
3. 预览结果后点击 **下载 Markdown**
