---
name: playwright-research
description: Headless browser automation for navigating documentation, scraping dynamic single-page applications, and extracting readable text or DOM snapshots without user form submission or state mutation.
---

# Playwright Web Research & Browser Extraction

## Principles

1. **Read-Only Operation:** Only navigate, read, and extract. Never submit payment details, personal credentials, or mutating forms.
2. **Token Efficiency:** Convert HTML directly to clean, structured markdown before returning content to the agent context.
3. **Structured Citations:** Always record and return the canonical page title, target URL, timestamp, and section anchors.
4. **Resilience & Timeouts:** Enforce explicit 30-second navigation timeouts. If a page stalls, fall back to extracting the initial HTML payload.
