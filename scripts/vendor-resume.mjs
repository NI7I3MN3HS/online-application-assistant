// Run npm ci --ignore-scripts, then npm run vendor:resume. Runtime stays offline.
import { cp, mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const files = [
  ['pdfjs-dist/build/pdf.min.mjs', 'pdfjs/pdf.min.mjs'],
  ['pdfjs-dist/build/pdf.worker.min.mjs', 'pdfjs/pdf.worker.min.mjs'],
  ['pdfjs-dist/LICENSE', 'pdfjs/LICENSE'],
  ['pdfjs-dist/cmaps', 'pdfjs/cmaps'],
  ['pdfjs-dist/standard_fonts', 'pdfjs/standard_fonts'],
  ['mammoth/mammoth.browser.min.js', 'mammoth/mammoth.browser.min.js'],
  ['mammoth/LICENSE', 'mammoth/LICENSE']
];
for (const name of ['ort.wasm.min.mjs', 'ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']) {
  files.push([`onnxruntime-web/dist/${name}`, `paddle/${name}`]);
}
for (const name of ['ch_PP-OCRv4_det_infer.onnx', 'ch_PP-OCRv4_rec_infer.onnx', 'ppocr_keys_v1.txt']) {
  files.push([`@gutenye/ocr-models/assets/${name}`, `paddle/${name}`]);
}
// Remove the superseded, task-generated OCR reader. Only Paddle ships now.
await rm(new URL('vendor/tesseract/', root), { recursive: true, force: true });
await mkdir(new URL('vendor', root), { recursive: true });
for (const [source, target] of files) {
  const destination = new URL(`vendor/${target}`, root);
  await mkdir(new URL('.', destination), { recursive: true });
  await cp(new URL(`node_modules/${source}`, root), destination, { recursive: true });
}

// Retain the notices of dependencies embedded in Mammoth's browser distribution.
const visited = new Set();
async function copyLicenses(packageFile) {
  const info = JSON.parse(await readFile(packageFile, 'utf8'));
  if (visited.has(info.name)) return;
  visited.add(info.name);
  const directory = dirname(packageFile);
  const destination = new URL(`vendor/mammoth/licenses/${info.name.replace('/', '__')}/`, root);
  await mkdir(destination, { recursive: true });
  for (const name of await readdir(directory)) {
    if (/^(licen[cs]e|copying|notice)/i.test(name)) await cp(resolve(directory, name), new URL(name, destination));
  }
  const require = createRequire(packageFile);
  for (const name of Object.keys(info.dependencies || {})) {
    await copyLicenses(require.resolve(`${name}/package.json`));
  }
}
await copyLicenses(new URL('node_modules/mammoth/package.json', root).pathname);
const hashes = {};
async function hashFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) await hashFiles(file);
    else hashes[file.pathname.split('/vendor/')[1]] = createHash('sha256').update(await readFile(file)).digest('hex');
  }
}
await hashFiles(new URL('vendor/pdfjs/', root));
await hashFiles(new URL('vendor/mammoth/', root));
await hashFiles(new URL('vendor/paddle/', root));
await writeFile(new URL('vendor/checksums.json', root), JSON.stringify(hashes, null, 2) + '\n');
console.log(`Vendored PDF.js, Mammoth and PaddleOCR with local ONNX models. No CDN required.`);
