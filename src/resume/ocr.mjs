import { prepareOcrImage, ocrResultToText, findPortraitOperations } from './ocr-layout.mjs';
import { createPaddleReader } from './paddle.mjs';

export const MAX_OCR_PAGES = 10;
export const OCR_MAX_EDGE = 3600;
export const OCR_MAX_PIXELS = 12_000_000;

export class OffscreenCanvasFactory {
  create(width, height) {
    const canvas = new OffscreenCanvas(Math.ceil(width), Math.ceil(height));
    return { canvas, context: canvas.getContext('2d') };
  }
  reset(target, width, height) { target.canvas.width = Math.ceil(width); target.canvas.height = Math.ceil(height); }
  destroy(target) { target.canvas.width = 1; target.canvas.height = 1; target.canvas = null; target.context = null; }
}

export function ocrScale(width, height) {
  return Math.min(OCR_MAX_EDGE / Math.max(width, height), Math.sqrt(OCR_MAX_PIXELS / (width * height)));
}

export async function createLocalOcr(onProgress, pdfOps) {
  let pageLabel = '';
  const worker = await createPaddleReader(message => onProgress(pageLabel ? `${pageLabel} · ${message}` : message));
  return {
    async recognizePage(page, pageNumber, totalPages) {
      pageLabel = `本机 OCR ${pageNumber} / ${totalPages} 页`;
      onProgress(`${pageLabel}：正在渲染无文字层页面…`);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: ocrScale(base.width, base.height) });
      const canvas = new OffscreenCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      try {
        const context = canvas.getContext('2d', { willReadFrequently: true });
        const portraitOps = findPortraitOperations(await page.getOperatorList(), pdfOps, page.view);
        await page.render({ canvas, canvasContext: context, viewport, background: '#ffffff', operationsFilter: index => !portraitOps.has(index) }).promise;
        const { image } = prepareOcrImage(context.getImageData(0, 0, canvas.width, canvas.height));
        context.putImageData(image, 0, 0);
        const data = await worker.recognize(canvas);
        return { text: ocrResultToText(data), confidence: data.confidence };
      } finally { canvas.width = 1; canvas.height = 1; }
    },
    terminate: () => worker.terminate()
  };
}
