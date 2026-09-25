import { MAX_FILE_BYTES, MAX_PDF_PAGES, MAX_TEXT_LENGTH } from './parser.mjs';
import { createLocalOcr, MAX_OCR_PAGES, OffscreenCanvasFactory } from './ocr.mjs';

export function detectFileType(name) {
  const type = String(name || '').split('.').pop().toLowerCase();
  if (!['pdf', 'docx', 'txt'].includes(type)) throw new Error('支持 PDF、DOCX、TXT。图片请先转换为 PDF（扫描件会自动 OCR）；旧版 .doc 请另存为 .docx。');
  return type;
}

export function pdfItemsToText(items) {
  const rows = [];
  for (const item of items) {
    if (!item.str?.trim() || !item.transform) continue;
    const x = item.transform[4], y = item.transform[5];
    const height = Math.max(1, Math.abs(item.height || item.transform[3] || 10));
    let row = rows.find(row => Math.abs(row.y - y) <= Math.min(row.height, height) * 0.35);
    if (!row) { row = { y, height, items: [] }; rows.push(row); }
    row.items.push({ text: item.str, x, width: item.width || 0, height });
  }
  rows.sort((a, b) => b.y - a.y);
  let wideGaps = 0;
  const text = rows.map(row => {
    row.items.sort((a, b) => a.x - b.x);
    return row.items.map((item, i) => {
      const previous = row.items[i - 1];
      if (!previous) return item.text;
      const gap = item.x - previous.x - previous.width;
      if (gap > 80) wideGaps++;
      // Join split Chinese glyphs; keep visible column gaps for field extraction.
      const separator = gap > Math.max(10, item.height) ? '\t' : gap > item.height * 0.15 ? ' ' : '';
      return separator + item.text;
    }).join('').trim();
  }).join('\n');
  return { text, columns: wideGaps >= 3 };
}

// Read ZIP directory sizes before decompression. DOCX readers run in a disposable
// worker as a second bound on malicious/corrupt documents and very long work.
export function checkDocxArchive(buffer) {
  const view = new DataView(buffer);
  if (buffer.byteLength < 22 || view.getUint32(0, true) !== 0x04034b50) throw new Error('这不是有效的 DOCX 文件，请用 Word 重新另存为 .docx。');
  let end = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error('DOCX 文件不完整，请重新导出后重试。');
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true), total = 0;
  if (count > 2000) throw new Error('DOCX 包含过多资源，请精简简历后重试。');
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) throw new Error('DOCX 压缩目录无效，请重新导出。');
    total += view.getUint32(offset + 24, true);
    if (total > 50 * 1024 * 1024) throw new Error('DOCX 解压后超过 50 MB，请压缩图片或另存为 PDF。');
    offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
}

function decodeText(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return new TextDecoder('gb18030', { fatal: true }).decode(bytes); }
}

export async function extractResumeFile(buffer, type, onProgress = () => {}) {
  if (!buffer.byteLength) throw new Error('文件为空，请重新选择。');
  if (buffer.byteLength > MAX_FILE_BYTES) throw new Error('文件超过 10 MB，请压缩图片或精简后重试。');
  const warnings = [];
  let text;
  if (type === 'txt') text = decodeText(buffer);
  else if (type === 'docx') {
    checkDocxArchive(buffer);
    onProgress('正在本机读取 Word 文档…');
    await import('../../vendor/mammoth/mammoth.browser.min.js');
    const result = await globalThis.mammoth.extractRawText({ arrayBuffer: buffer });
    text = result.value;
    if (result.messages.length) warnings.push('Word 中部分格式可能未被识别，请检查提取原文。');
  } else if (type === 'pdf') {
    if (!new TextDecoder().decode(buffer.slice(0, 1024)).includes('%PDF-')) throw new Error('文件内容不是有效 PDF，请重新导出。');
    const pdfjs = await import('../../vendor/pdfjs/pdf.min.mjs');
    // Supply a port explicitly: PDF.js otherwise assumes a Window when creating
    // its worker, which is not available inside this disposable parsing worker.
    const pdfWorker = new Worker(new URL('../../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url), { type: 'module' });
    pdfjs.GlobalWorkerOptions.workerPort = pdfWorker;
    const task = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      cMapUrl: new URL('../../vendor/pdfjs/cmaps/', import.meta.url).href,
      cMapPacked: true,
      standardFontDataUrl: new URL('../../vendor/pdfjs/standard_fonts/', import.meta.url).href,
      useWorkerFetch: true,
      CanvasFactory: OffscreenCanvasFactory,
      useWasm: false,
      isEvalSupported: false,
      disableFontFace: true,
      enableXfa: false
    });
    let passwordRequired = false;
    let ocr = null;
    let ocrPages = 0;
    task.onPassword = () => { passwordRequired = true; void task.destroy(); };
    try {
      const document = await task.promise;
      if (document.numPages > MAX_PDF_PAGES) throw new Error(`PDF 超过 ${MAX_PDF_PAGES} 页，请只保留简历页。`);
      const pages = [];
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
        onProgress(`正在本机读取 PDF：${pageNumber} / ${document.numPages} 页…`);
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        let result = pdfItemsToText(content.items);
        if (result.text.replace(/\s/g, '').length < 12) {
          ocrPages++;
          if (ocrPages > MAX_OCR_PAGES) throw new Error(`需要 OCR 的页面超过 ${MAX_OCR_PAGES} 页，请拆分 PDF 后导入。`);
          ocr ||= await createLocalOcr(onProgress, pdfjs.OPS);
          result = await ocr.recognizePage(page, pageNumber, document.numPages);
          if (result.text.trim()) warnings.push(`第 ${pageNumber} 页已在本机完成 OCR${result.confidence < 60 ? '，清晰度较低' : ''}，请核对姓名、数字和专业术语。`);
        }
        pages.push(result.text);
        if (!result.text.trim()) warnings.push(`第 ${pageNumber} 页未识别到有效文字，可能为空白页或图像不清晰。`);
        if (result.columns) warnings.push(`第 ${pageNumber} 页可能有多栏排版，请检查提取原文的阅读顺序。`);
        if (pages.reduce((n, page) => n + page.length, 0) > MAX_TEXT_LENGTH) throw new Error('PDF 文字超过 20 万字，请精简后重试。');
        page.cleanup();
      }
      text = pages.join('\n\n');
    } catch (error) {
      if (passwordRequired || error.name === 'PasswordException') throw new Error('PDF 已加密，请先解除密码保护后重新导入。');
      throw error;
    } finally { await ocr?.terminate(); await task.destroy(); pdfWorker.terminate(); }
  } else throw new Error('不支持的文件类型。');
  if (!text?.trim()) throw new Error('没有提取到有效文字，请使用更清晰的文件或直接粘贴文字。');
  if (text.length > MAX_TEXT_LENGTH) throw new Error('简历文字超过 20 万字，请精简后重试。');
  return { text, warnings };
}
