# Development and packaging

[Back to README](../README.en.md) · [中文](development.md)

The extension uses plain HTML, CSS, JavaScript, and ES modules, loaded directly without a frontend build. Use Node.js 22.13+ for dependency maintenance and Python 3.9+ for the standard-library packaging script. End users do not need these tools.

```bash
# Install development dependencies and run tests
npm ci --ignore-scripts
npm test

# Refresh bundled readers/models only when updating these dependencies
npm run vendor:resume

# Package current source files and write a SHA-256 checksum
npm run package

# Or run directly with a fixed release date
python3 scripts/package.py --date 20260925
```

Output is written to `dist/online-application-assistant-v<version>-<date>.zip`. Packaging checks version declarations, vendor checksums, font references, and archive contents. It includes runtime assets, licenses, and usage documentation, excluding development dependencies, design drafts, and temporary files. Identical files and dates produce the same archive in the same tool environment.

Directory guide: `src/` contains extension pages and logic; `src/resume/` handles resume parsing; `src/applications/` handles application records; `vendor/` contains local runtime dependencies; `tests/` holds automated tests; `scripts/` maintains dependencies and packages releases. Tests cover resume mapping and merging, OCR processing, profile value retention, application records, and status management. Real website compatibility still requires site-specific verification.
