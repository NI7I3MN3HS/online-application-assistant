# 网申助手 · Online Application Assistant

[中文](README.md) · [Report an issue](https://github.com/NI7I3MN3HS/online-application-assistant/issues)

<p align="center">
  <img src="assets/logo.png" alt="网申助手 · Online Application Assistant" width="720" />
</p>

A browser extension for local resume management and application form filling, with resume import, field memory, and application records. Maintain one profile, fill recruiting forms, then review and submit them yourself.

Current version: **v1.5.1**. Supports Chromium browsers such as Chrome, Edge, and Brave. Core features need no API key. The interface currently uses Chinese labels.

## Features

- **Resume profile:** organize personal details, education, work, and projects, with multiple entries and extra fields.
- **Resume import:** read PDF, DOCX, TXT, or pasted text, with local Chinese/English OCR for scanned PDFs. Review and select parsed fields before saving.
- **Form filling:** match fields using local rules, field memory, and optional AI. Search and copy values from the in-page profile panel.
- **Field memory:** learn successful matches or learn from manually completed pages, capture missing values, and confirm grouped fields.
- **Application records:** record company, role, and source after filling; add, edit, filter, keep notes, and customize statuses manually.

## Installation

1. Download and extract a complete package from [this repository](https://github.com/NI7I3MN3HS/online-application-assistant), or clone the source.
2. Open `chrome://extensions/`, `edge://extensions/`, or `brave://extensions/`.
3. Enable **Developer mode** and click **Load unpacked**.
4. Select the directory directly containing `manifest.json`, then pin the extension.

No build, Node.js, or Python installation is required. Keep all installation files and `vendor/` dependencies intact, and keep the directory in a permanent location.

## Usage

1. Open **简历资料** (Resume Profile), enter information or choose **导入简历** (Import Resume), then review and save.
2. Open a recruiting site's application form, click the extension icon, then **开始填写** (Start Filling).
3. Check the results: **green means filled; orange means needs attention**. Complete remaining fields and upload attachments yourself.
4. Review the company and role in the bottom-right record card, complete missing information, and save.
5. Submit the website form yourself, then manually change the record to **已投递** (Submitted).

Click Start Filling again for another page or form step. The extension does not submit applications automatically. To try it with example data, import [sample-profile.json](sample-profile.json) through the profile backup interface.

### Resume import

Compare parsed fields with the source, edit them, and select what to save. Existing values are preserved and empty fields filled by default; you can choose to overwrite selected fields. New experiences are appended and duplicates skipped. You can undo the latest import unless subsequent profile edits prevent it.

Files are limited to 10 MB; PDFs to 30 pages, including at most 10 OCR pages; text to 200,000 characters. Convert legacy `.doc` files to `.docx`, convert standalone images to PDF, and remove PDF password protection first. Review scans and complex layouts carefully.

### Field Memory

Confirmed mappings are saved after successful filling. After completing a page manually, click **从本页学习** (Learn from This Page) and select missing ordinary values to capture. Repeated fields require confirmation of the corresponding experience order.

Memory stores field mappings and usage statistics, not resume values. Enable, disable, delete individual entries, or clear all; capacity is 500 entries. Ambiguous matches are skipped, and upload and password fields are excluded from learning.

### Application records

A record is saved after at least one successful field fill. Uncertain company or role details display **待补全** (Incomplete) and can be edited. Repeated fills update existing records while preserving manual edits, status, and notes. Add a separate manual record for another application attempt.

New records always start at **填写** (Filled) and never automatically become Submitted. Default statuses are Filled, Submitted, Written Test, Interview, Offer, Rejected, and Withdrawn, with support for customization. Deleting a status in use requires a migration target. Creation and last-filled times are not submission times.

## Optional AI

Under **设置 → API 页面分析** (Settings → API Page Analysis), configure an OpenAI-compatible or custom API with its endpoint, model, and credentials. Save the configuration after testing the connection.

Local rules and field memory work without an API. AI requests contain the field catalog, form structure, and related page context without attaching actual local resume values. Requests go to your configured provider.

## Data and privacy

- Profiles, field memory, application records, and API keys use the current browser's local extension storage.
- Resume parsing and OCR run locally without uploading resume files or parsed source text.
- Scanning and filling are triggered by user actions without monitoring browsing history. Optional AI contacts your selected endpoint; update checks contact GitHub.
- Values entered into a page can be read by that website. Review them before submitting.

Import or export profile JSON under **设置 → 数据与备份** (Settings → Data and Backup). **Backups exclude application records and field memory, which currently have no separate export interface.** Clear Profile and API Settings preserves application records and field memory.

## Updates

Get updates from [this repository](https://github.com/NI7I3MN3HS/online-application-assistant). Back up your profile, close extension pages, replace files in the original installation directory, click **Reload** in the extension manager, and refresh recruiting pages. Preserve the original directory and browser profile to avoid losing access to data through uninstallation or duplicate installation.

The built-in update checker reads this project's GitHub Releases.

## Documentation and feedback

- [Resume parsing notes (Chinese)](docs/resume-parser-selection.md)
- [Application records guide (Chinese)](docs/application-records.md)
- [Development and packaging](docs/development.en.md)

Report bugs and suggestions in [Issues](https://github.com/NI7I3MN3HS/online-application-assistant/issues), including the website, browser version, and reproduction steps. Remove personal information from screenshots.

## Credits and license

- [Br1an67](https://github.com/Br1an67): profile management, form filling, and optional AI analysis.
- [zhangqiyuan24](https://github.com/zhangqiyuan24) and Field Memory contributors: mapping memory, page learning, and profile capture.

Thanks to everyone contributing code, tests, and issue reports.

Licensed under [MIT](LICENSE), with original copyright notices and the complete license text retained. Dependencies and fonts follow their respective licenses; see the [third-party notices](vendor/THIRD_PARTY_NOTICES.md).
