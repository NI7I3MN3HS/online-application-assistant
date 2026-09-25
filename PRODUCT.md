# 网申助手 · Online Application Assistant

Chrome MV3 browser extension for people filling recruitment application forms. Users keep one local profile, import PDF/DOCX/TXT resumes locally (including OCR), fill forms, learn field mappings, and maintain application records. It never submits an application automatically.

## Product constraints

- All 19 existing profile categories, custom fields, repeated experiences and backup compatibility remain supported.
- API page analysis is optional and does not receive personal profile values.
- Application records live separately in `applicationsV1`. Automatic fills start at “填写”; status changes are manual, and manually edited data is preserved.
- Record edits use revisions and background serialization. Clearing profile/API settings preserves application records and field memory.
- Do not introduce cloud sync, email tracking, reminders, accounts or automatic form submission.

## Confirmed visual commitment

Use the established linen/ink colors, serif headings, compact sans-serif controls, fine rules, four-pixel corners, desktop left navigation and contextual inspectors documented in DESIGN.md. Branding uses the supplied 网申助手 image in assets/logo.png and its extracted symbol in icons/. Keep existing profile data, message identifiers and backup format compatible across the product rename. Visual changes must not introduce unsupported features.
