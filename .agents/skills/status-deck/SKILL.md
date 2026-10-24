---
name: status-deck
description: Track Jarvis project progress and (re)generate the architecture slide deck (docs/architecture-slides.pdf). Use when the user asks to update progress, refresh/rebuild/regenerate the slides or deck, produce a status presentation, or asks "where are we" with a deliverable. Covers data gathering from trackers/ADRs/git, updating the HTML source, rendering the vector PDF, QA, and updating the trackers afterward.
---

# Jarvis Status Deck — progress tracking + architecture slide regeneration

Purpose: keep ONE deliverable — `docs/architecture-slides.pdf` (16:9, one topic per
page) — always in sync with the project's real state, driven by the trackers.

## 1. Gather current state (always do this first)

Read these, in order — they are the single source of truth:

1. `PROGRESS.md` — phase + ticket status, "Overall state" line, completed log.
2. `docs/HANDOFF.md` — current state, design decisions, immediate next step.
3. `README.md` — implementation status table (security controls, tests, versions).
4. `docs/decisions/ADR-*.md` — accepted architecture decisions (new ADR = new slide content or an update to the security/permission/gateway slides).
5. `git log --oneline -20` and `git status --porcelain` — latest commits and uncommitted work.
6. `package.json` — current stack versions.
7. Run `npm test` if the test count on slide "Security Model" needs refreshing (do not trust stale numbers).

Rule: if `PROGRESS.md` and `git log` disagree, trust git and FIX the tracker
before generating anything (the trackers must be updated every time state
changes — this is a standing user rule).

## 2. Update the slide source (never edit the PDF by hand)

Edit `docs/architecture-slides.html` (the deck source). Layout rules:

- 1280×720 per `.page` div, `@page { size: 1280px 720px; margin: 0 }` — keep.
- One topic per slide; keep each slide under ~150 readable words.
- Palette: indigo `#4f46e5` / `#3730a3` on slate `#0f172a` / `#f8fafc`; max one accent family.
- Fonts via Google Fonts `Inter` + `JetBrains Mono` (already linked).
- Slide footer uses `.slidefoot` flex (left label, right page number) — copy the pattern.
- Slides to refresh on every regeneration:
  - Cover (version, date) · "Status Today" (surfaces, working-now, next-up) ·
    "Roadmap" (phase table, mark the active phase with the `NOW` flag) ·
    stats on "Security Model" (findings/tests/ADRs) and "Evidence" (spike numbers) ·
    stack tags if `package.json` changed.
- When a new major capability lands, add a slide before the closing slide and
  bump every subsequent page number (`NN / TOTAL` in `.slidefoot`).

## 3. Validate and render (exact commands)

All commands from the repo root. Python is at `C:/Python314/python.exe`
(`python3` is a Store stub on this machine — never use it).

```bash
# a. pre-render validation (must PASS with 0 errors)
C:/Python314/python.exe "<PDF_SKILL_DIR>/scripts/poster_validate.py" check-html docs/architecture-slides.html

# b. render vector PDF (self-contained; finds Chromium in %LOCALAPPDATA%\ms-playwright
#    newest chromium-* dir, or falls back to Edge; env PLAYWRIGHT_CHROMIUM_PATH overrides)
node scripts/render-architecture-slides.cjs
```

`<PDF_SKILL_DIR>` = the pdf skill's base directory (print it from the skill
listing). If the playwright npm package is missing, bootstrap once:
`mkdir "%USERPROFILE%\pdf-tools" && cd /d "%USERPROFILE%\pdf-tools"` then
`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright`.

Known pitfalls (already solved — do not rediscover):
- The pdf plugin's `html2pdf-next.js` fails as ESM on this machine; the repo's
  `scripts/render-architecture-slides.cjs` replaces it (same output, no plugin needed).
- `pdf.py meta.set` cannot overwrite its input — write to `-o <temp>.pdf` then `mv`.
- Chromium cache may hold a different build number than the playwright package
  expects; the script's cache scan handles it.

## 4. Post-render QA (mandatory)

```bash
C:/Python314/python.exe "<PDF_SKILL_DIR>/scripts/pdf_qa.py" --no-tables docs/architecture-slides.pdf
```

- PASS → set metadata (then re-run QA once to confirm):
  `C:/Python314/python.exe "<PDF_SKILL_DIR>/scripts/pdf.py" meta.set docs/architecture-slides.pdf -o docs/architecture-slides-meta.pdf -d '{"Title":"Jarvis — Architecture Overview (<version>)","Author":"S-fetah","Subject":"Local-first Windows AI assistant: idea, stack, architecture, security model, and roadmap","Creator":"Jarvis status-deck skill"}' && mv -f docs/architecture-slides-meta.pdf docs/architecture-slides.pdf`
- Verify no empty pages: extract text per page with pymupdf (`import pymupdf`).
- Margin-symmetry or overflow warnings → fix the HTML, re-render. Do not deliver with FAIL.

Deliver BOTH files to the user (HTML source + PDF), with page count and size.

## 5. Close the loop (standing rule)

After the deck is regenerated:

1. Update `PROGRESS.md` ("Last updated", Overall state if changed, log line for
   the deck refresh) and `docs/HANDOFF.md` (add the deck to durable references
   if not present).
2. Commit everything together:
   `git add docs/architecture-slides.html docs/architecture-slides.pdf PROGRESS.md docs/HANDOFF.md && git commit -m "docs: refresh architecture deck (<reason>)"`.

## Quick checklist

- [ ] Read PROGRESS / HANDOFF / README / ADRs / git log / package.json
- [ ] Trackers consistent with git (fix first if not)
- [ ] HTML updated (status, roadmap, stats, version, page numbers)
- [ ] `poster_validate.py check-html` → 0 errors
- [ ] `node scripts/render-architecture-slides.cjs` → 16±N pages
- [ ] `pdf_qa.py --no-tables` → PASS; metadata set
- [ ] Trackers updated; committed with the deck
