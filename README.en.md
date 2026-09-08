# OpenJobAutofill-FieldMemory

[中文 README](README.md)

An enhanced fork of the open-source [OpenJobAutofill](https://github.com/Br1an67/OpenJobAutofill) (MIT) that adds **Field Memory** on top of every official feature: the extension remembers which profile field a form field maps to, and fills it directly the next time it sees a field with the same label — no more re-asking local rules or the AI.

The official positioning is unchanged: a profile-based form filler. It never auto-submits, the AI only helps interpret field labels, and your resume values never leave your machine.

## What this fork adds: Field Memory

Fields like "place of origin", "home university" or "preferred city" show up on every application site under slightly different names, and neither local rules nor the AI recognize them every time. Field Memory fixes exactly that:

- **Automatic learning**: whenever a field is successfully auto-filled, the mapping "form field label → profile field path" is stored. The next occurrence of the same label is filled directly.
- **Learn from this page + one-click capture**: after you manually fill a page, click the new button in the popup. The extension reads the current page values, matches them against your local profile, and stores the mappings. Fields whose values are missing from the profile are listed in the popup together with the values you typed — tick them, click "Capture & re-learn", and the values are written into your local profile with an immediate re-learn (plain sections such as basic info; grouped sections like education or projects should still be added on the options page).
- **Grouped-field learning**: labels that appear multiple times on one page (e.g. "school" in each of two education entries) are learnable too — when the values line up with grouped profile entries, the popup shows a confirmation list of "Nth occurrence → Nth entry"; tick and confirm, and the mapping is stored by order of occurrence so the whole group auto-fills next time. Successful order-based local pairings are also memorized automatically.
- **Local management**: the options page offers an on/off toggle, the entry count, per-entry delete, and clear-all.

### Safety limits

- Only the mapping "field label → profile path" plus light statistics (most recent site, success count) are stored — **never any profile values**, consistent with the project's privacy stance.
- Fields that appear more than once on the same page (e.g. "school" across multiple education entries) are never written to ordinary single-value memory, preventing misplacement; only an explicit "grouped learning" confirmation in the popup — or a successful order-based local pairing — writes occurrence-indexed keys (Nth occurrence → Nth entry).
- Memory candidates still pass the upstream semantic-compatibility checks; category conflicts are rejected. Memory only fills gaps and never overrides local-rule or AI matches.
- "Learn from this page" skips upload/file/photo/password fields and skips ambiguous multi-value matches, reporting them instead.
- "Capture" is an explicit, opt-in action: only ticked fields have their values written into the local profile, plain (simple) sections only with an "other information" fallback; the memory itself still stores mappings only, never values.
- Capacity is capped at 500 entries with least-recently-used eviction.

## Installation (developer mode)

1. Download or clone this repository.
2. Open `chrome://extensions/` (or `brave://extensions/` on Brave).
3. Enable `Developer mode`, click `Load unpacked`, and select this repository's directory.
4. Pin the extension icon, fill in your profile on the options page, and you are ready.

No dependencies, no build step.

## Usage

Identical to official OpenJobAutofill (see the upstream [README](https://github.com/Br1an67/OpenJobAutofill)): maintain your local profile → open a job-application form → click "Start autofill" in the popup → review the green (filled) / orange (pending) marks → confirm and submit yourself.

The new flow: after manually filling a site for the first time, click "Learn from this page" once — the site's particular field naming gets memorized and future autofills cover it automatically. If some page values are not yet in your profile, a "Capture into profile" checklist appears in the popup: tick the fields, and they are written into the profile with an automatic re-learn — no detour to the options page.

The AI is optional: everything works without an API (local rules + field memory); configuring an OpenAI-compatible API improves recognition. AI requests contain field names only, never profile values.

## ⚠️ About updates

The built-in update check points at the upstream repository's releases. **Installing an official package over this fork will remove the field memory feature** (your profile data itself stays in browser storage). To keep field memory, update from this repository.

## Contact

For questions or suggestions about the field memory feature, email <1445668509@qq.com> or open an issue in this repository.

## Relationship to upstream

- Base: upstream `main` (`005eda9`, the line after v1.0.2), with roughly 490 added lines that do not alter any official behavior.
- See the commit history for the exact changes; a PR has been submitted upstream as well.
- Credit for the original work goes to [Br1an67](https://github.com/Br1an67).

## License

[MIT](LICENSE), Copyright Br1an67 and this fork's contributors.
