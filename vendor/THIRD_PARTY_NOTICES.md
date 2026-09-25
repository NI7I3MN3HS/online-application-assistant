# Bundled runtime dependencies

The extension ships these readers locally. No runtime CDN or package installation is needed.

| Package | Version | License | Source |
| --- | --- | --- | --- |
| pdfjs-dist (PDF.js) | 6.3.289 | Apache-2.0 | https://github.com/mozilla/pdf.js |
| mammoth | 1.12.3 | BSD-2-Clause | https://github.com/mwilliamson/mammoth.js |
| ONNX Runtime Web | 1.30.0 | MIT and bundled dependency notices | https://github.com/microsoft/onnxruntime |
| PP-OCRv4 ONNX models and dictionary | @gutenye/ocr-models 1.4.2 | Apache-2.0 (PaddleOCR); MIT (Guten distribution) | https://github.com/PaddlePaddle/PaddleOCR and https://github.com/gutenye/ocr |

PDF.js license: `pdfjs/LICENSE`. Font/CMap notices are retained in `pdfjs/standard_fonts` and `pdfjs/cmaps`.
Mammoth license: `mammoth/LICENSE`. Notices for its dependencies and browser shims are retained in `mammoth/licenses` (some upstream packages publish their license in a README).

The prebuilt Mammoth browser distribution identifies these bundled versions: @xmldom/xmldom 0.8.6, base64-js 1.5.1, bluebird 3.4.7, buffer 4.9.1, dingbat-to-unicode 1.0.1, ieee754 1.1.8, isarray 1.0.0, jszip 3.7.1, lop 0.4.2, option 0.2.4, process 0.11.9, underscore 1.13.1, xmlbuilder 10.0.0. These are upstream's browser-bundle dependencies, which may differ from the Node dependency versions resolved in package-lock.json. JSZip is used under MIT.

The extra buffer, ieee754, isarray, process and dingbat-to-unicode notices were copied from their exact-version npm tarballs. `npm run vendor:resume` retains these notices while refreshing the primary bundles, installed dependency notices, and SHA-256 checksums. Recheck upstream's bundled-version list and corresponding notices when updating Mammoth.

No code from OpenResume, pyresparser, or MinerU is included. PaddleOCR detection/recognition models and dictionary are distributed unmodified from the pinned Guten model package. ONNX runtime bundles are unmodified; corresponding LICENSE files and upstream ThirdPartyNotices are under `paddle/`. Image-to-tensor layout and model decoding were informed by the GutenOCR model interfaces; project preprocessing, bounded inference, connected-component postprocessing, and CTC decoding are implemented locally. Tesseract and the GutenOCR/OpenCV browser wrappers are not shipped. The resume mapping, preview, and merge code is original project code under the repository's MIT license.

## Interface fonts

Cormorant Garamond, Plus Jakarta Sans, and Noto Serif SC are bundled locally under the SIL Open Font License 1.1. Source information is in [fonts/README.md](fonts/README.md); the respective licenses are [cormorant-OFL.txt](fonts/cormorant-OFL.txt), [jakarta-OFL.txt](fonts/jakarta-OFL.txt), and [noto-serif-sc-OFL.txt](fonts/noto-serif-sc-OFL.txt). The extension does not fetch these fonts from a CDN at runtime.
