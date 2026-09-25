// Image preprocessing is local and only touches the temporary OCR raster.
// White lettering on dark title bands is often missed by full-page OCR.
export function prepareOcrImage(image) {
  const { data, width, height } = image;
  const minRun = Math.max(20, Math.round(width * 0.035));
  const maxX = Math.round(width * 0.55);
  const rows = [];
  for (let y = 0; y < height; y++) {
    let run = 0, left = width, right = 0;
    for (let x = 0; x < maxX; x++) {
      const i = (y * width + x) * 4;
      const dark = data[i] + data[i + 1] + data[i + 2] < 240;
      run = dark ? run + 1 : 0;
      if (run >= minRun) { left = Math.min(left, x - run + 1); right = x; }
    }
    if (right > left) rows.push({ y, left, right });
  }
  const bands = [];
  const joinGap = Math.max(2, Math.round(height * 0.015));
  for (const row of rows) {
    let band = bands.at(-1);
    if (!band || row.y - band.bottom > joinGap) {
      band = { top: row.y, bottom: row.y, left: row.left, right: row.right };
      bands.push(band);
    } else {
      band.bottom = row.y;
      band.left = Math.min(band.left, row.left);
      band.right = Math.max(band.right, row.right);
    }
  }
  const headings = bands.filter(band => band.bottom - band.top >= height * 0.004 && band.bottom - band.top <= height * 0.035 && band.right - band.left < width * 0.5);
  for (const band of headings) {
    for (let y = band.top; y <= band.bottom; y++) {
      let rightEdge = band.right;
      while (rightEdge > band.left) {
        const i = (y * width + rightEdge) * 4;
        if (data[i] + data[i + 1] + data[i + 2] < 240) break;
        rightEdge--;
      }
      for (let x = band.left; x <= band.right; x++) {
        const i = (y * width + x) * 4;
        if (x > rightEdge) data[i] = data[i + 1] = data[i + 2] = 255;
        else { data[i] = 255 - data[i]; data[i + 1] = 255 - data[i + 1]; data[i + 2] = 255 - data[i + 2]; }
      }
    }
  }
  return { image, invertedBands: headings };
}

export function cleanOcrText(text) {
  return String(text || '')
    .normalize('NFKC')
    // OCR commonly inserts spaces between Chinese glyphs; preserve Latin words.
    .replace(/(?<=[\p{Script=Han}]) +(?=[\p{Script=Han}])/gu, '')
    .replace(/([\d])\s*([.年/-])\s*(?=\d)/g, '$1$2')
    .replace(/^[ \t]*[oO。○º%]+\s+(?=[\p{Script=Han}])/gmu, '• ')
    .trim();
}

export function findPortraitOperations(operatorList, ops, pageView) {
  const skipped = new Set();
  // Only mask a small raster portrait when the surrounding text is drawn as
  // vectors. Never remove a page-sized scan or a rasterized document body.
  if (operatorList.fnArray.filter(fn => fn === ops.constructPath).length < 30) return skipped;
  const [pageX, pageY, right, top] = pageView;
  const width = right - pageX, height = top - pageY;
  let matrix = [1, 0, 0, 1, 0, 0];
  const stack = [];
  for (let i = 0; i < operatorList.fnArray.length; i++) {
    const op = operatorList.fnArray[i], args = operatorList.argsArray[i];
    if (op === ops.save) stack.push([...matrix]);
    else if (op === ops.restore) matrix = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (op === ops.transform) {
      const [a, b, c, d, e, f] = matrix;
      const [g, h, j, k, l, m] = args;
      matrix = [a*g+c*h, b*g+d*h, a*j+c*k, b*j+d*k, a*l+c*m+e, b*l+d*m+f];
    } else if ([ops.paintImageXObject, ops.paintInlineImageXObject].includes(op)) {
      const [a, b, c, d, e, f] = matrix;
      const xs = [e, e+a, e+c, e+a+c], ys = [f, f+b, f+d, f+b+d];
      const area = Math.abs(a*d-b*c) / (width*height);
      if (area > 0.001 && area < 0.12 && Math.min(...xs) > pageX + width*0.65 && Math.min(...ys) > pageY + height*0.7) skipped.add(i);
    }
  }
  return skipped;
}

// Word boxes recover the gap between a left-hand institution and a right-hand
// date/location. Retain that gap as a tab for the resume field mapper.
export function ocrResultToText(data) {
  const lines = [];
  for (const block of data.blocks || []) {
    for (const paragraph of block.paragraphs || []) {
      for (const line of paragraph.lines || []) {
        const words = (line.words || []).filter(word => word.text?.trim()).sort((a, b) => a.bbox.x0 - b.bbox.x0);
        const text = words.map((word, index) => {
          if (!index) return word.text;
          const previous = words[index - 1];
          const gap = word.bbox.x0 - previous.bbox.x1;
          const lineHeight = Math.max(1, line.bbox.y1 - line.bbox.y0);
          return (gap > lineHeight * 3 ? '\t' : ' ') + word.text;
        }).join('');
        if (text) lines.push({ text, box: line.bbox });
      }
    }
  }
  if (!lines.length) return cleanOcrText(data.text);
  lines.sort((a, b) => a.box.y0 - b.box.y0 || a.box.x0 - b.box.x0);
  const rows = [];
  for (const line of lines) {
    const previous = rows.at(-1);
    const tolerance = Math.min(line.box.y1 - line.box.y0, previous ? previous.box.y1 - previous.box.y0 : 0) * 0.45;
    if (previous && Math.abs(previous.box.y0 - line.box.y0) <= tolerance) {
      const [left, right] = previous.box.x0 < line.box.x0 ? [previous, line] : [line, previous];
      const gap = right.box.x0 - left.box.x1;
      const separator = gap > (line.box.y1 - line.box.y0) * 3 ? '\t' : ' ';
      previous.text = `${left.text}${separator}${right.text}`;
      previous.box = { x0: Math.min(left.box.x0, right.box.x0), x1: Math.max(left.box.x1, right.box.x1), y0: Math.min(left.box.y0, right.box.y0), y1: Math.max(left.box.y1, right.box.y1) };
    } else rows.push({ ...line });
  }
  return cleanOcrText(rows.map(row => row.text).join('\n'));
}
