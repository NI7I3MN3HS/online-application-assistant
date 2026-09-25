// PaddleOCR v4 ONNX inference with bounded, local canvas preprocessing.
// Only axis-aligned line boxes are used; the PDF viewport applies page rotation.
export function probabilityBoxes(data, width, height, threshold = 0.3) {
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  const boxes = [];
  for (let start = 0; start < data.length; start++) {
    if (visited[start] || data[start] < threshold) continue;
    let head = 0, tail = 1, left = width, right = 0, top = height, bottom = 0, score = 0;
    queue[0] = start; visited[start] = 1;
    while (head < tail) {
      const index = queue[head++], x = index % width, y = Math.floor(index / width);
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); score += data[index];
      const neighbors = [x > 0 ? index - 1 : -1, x < width - 1 ? index + 1 : -1, y > 0 ? index - width : -1, y < height - 1 ? index + width : -1];
      for (const neighbor of neighbors) {
        if (neighbor >= 0 && !visited[neighbor] && data[neighbor] >= threshold) { visited[neighbor] = 1; queue[tail++] = neighbor; }
      }
    }
    const w = right-left+1, h = bottom-top+1;
    if (tail < 6 || w < 3 || h < 3 || score / tail < 0.5) continue;
    const padding = Math.max(2, w*h*1.5/(2*(w+h)));
    boxes.push({ x0: Math.max(0, left-padding), y0: Math.max(0, top-padding), x1: Math.min(width, right+padding+1), y1: Math.min(height, bottom+padding+1) });
    if (boxes.length > 1500) throw new Error('页面内容过于复杂，请裁剪无关图片或拆分后重试。');
  }
  return boxes.sort((a, b) => a.y0-b.y0 || a.x0-b.x0);
}

export function decodeCtc(output, dictionary) {
  const classes = output.dims.at(-1), steps = output.dims.at(-2);
  let previous = -1, text = '', confidence = 0, count = 0;
  for (let step = 0; step < steps; step++) {
    let best = 0, probability = -Infinity;
    for (let index = 0; index < classes; index++) {
      const value = output.data[step*classes+index];
      if (value > probability) { best = index; probability = value; }
    }
    if (best && best !== previous) { text += dictionary[best-1] || ''; confidence += probability; count++; }
    previous = best;
  }
  return { text, confidence: count ? confidence / count : 0 };
}

function tensorFromCanvas(canvas, ort) {
  const { width, height } = canvas;
  const rgba = canvas.getContext('2d').getImageData(0, 0, width, height).data;
  const plane = width * height, pixels = new Float32Array(plane * 3);
  for (let index = 0; index < plane; index++) {
    pixels[index] = rgba[index*4+2] / 255;
    pixels[plane+index] = rgba[index*4+1] / 255;
    pixels[plane*2+index] = rgba[index*4] / 255;
  }
  return new ort.Tensor('float32', pixels, [1, 3, height, width]);
}

export async function createPaddleReader(onProgress) {
  const ort = await import('../../vendor/paddle/ort.wasm.min.mjs');
  ort.env.wasm.wasmPaths = new URL('../../vendor/paddle/', import.meta.url).href;
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  const options = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' };
  onProgress('正在加载本机文字检测模型…');
  const detection = await ort.InferenceSession.create(new URL('../../vendor/paddle/ch_PP-OCRv4_det_infer.onnx', import.meta.url).href, options);
  let recognition;
  try {
    onProgress('正在加载本机中英文识别模型…');
    recognition = await ort.InferenceSession.create(new URL('../../vendor/paddle/ch_PP-OCRv4_rec_infer.onnx', import.meta.url).href, options);
    const response = await fetch(new URL('../../vendor/paddle/ppocr_keys_v1.txt', import.meta.url));
    if (!response.ok) throw new Error('本机 OCR 字典缺失，请完整解压安装包。');
    const dictionary = (await response.text()).trimEnd().split(/\r?\n/).concat(' ');
    return {
      async recognize(canvas) {
        const ratio = Math.min(1, 1536 / Math.max(canvas.width, canvas.height));
        const small = new OffscreenCanvas(Math.max(32, Math.ceil(canvas.width*ratio/32)*32), Math.max(32, Math.ceil(canvas.height*ratio/32)*32));
        small.getContext('2d').drawImage(canvas, 0, 0, small.width, small.height);
        const input = tensorFromCanvas(small, ort);
        let boxes;
        try {
          onProgress('正在本机检测文字位置…');
          const result = await detection.run({ [detection.inputNames[0]]: input });
          const output = result[detection.outputNames[0]];
          boxes = probabilityBoxes(output.data, output.dims[3], output.dims[2]).map(box => ({ x0: box.x0*canvas.width/small.width, x1: box.x1*canvas.width/small.width, y0: box.y0*canvas.height/small.height, y1: box.y1*canvas.height/small.height }));
          Object.values(result).forEach(tensor => tensor.dispose());
        } finally { input.dispose(); small.width = small.height = 1; }
        const lines = [];
        for (const [index, box] of boxes.entries()) {
          onProgress(`正在本机识别文字：${index+1} / ${boxes.length} 行…`);
          const width = Math.max(16, Math.min(4096, Math.ceil((box.x1-box.x0)/(box.y1-box.y0)*48)));
          const lineCanvas = new OffscreenCanvas(width, 48);
          lineCanvas.getContext('2d').drawImage(canvas, box.x0, box.y0, box.x1-box.x0, box.y1-box.y0, 0, 0, width, 48);
          const input = tensorFromCanvas(lineCanvas, ort);
          try {
            const result = await recognition.run({ [recognition.inputNames[0]]: input });
            const decoded = decodeCtc(result[recognition.outputNames[0]], dictionary);
            if (decoded.text.trim() && decoded.confidence >= 0.5) lines.push({ text: decoded.text, confidence: decoded.confidence, bbox: box, words: [{ text: decoded.text, bbox: box }] });
            Object.values(result).forEach(tensor => tensor.dispose());
          } finally { input.dispose(); lineCanvas.width = lineCanvas.height = 1; }
        }
        return { blocks: [{ paragraphs: [{ lines }] }], confidence: lines.length ? lines.reduce((sum,line)=>sum+line.confidence,0)/lines.length*100 : 0 };
      },
      async terminate() { await detection.release(); await recognition.release(); }
    };
  } catch (error) { await detection.release(); await recognition?.release(); throw error; }
}
