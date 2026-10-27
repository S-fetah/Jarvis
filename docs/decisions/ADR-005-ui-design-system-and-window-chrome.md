# ADR-005: "The Quiet Instrument" UI Design System, Native Window Chrome, and Trust Ledger Architecture

**Status:** Accepted & Implemented  
**Date:** October 2026  
**Deciders:** Core Engineering & Product  
**Consulted:** OpenCode Redesign Master Plan, ADR-002, ADR-004

---

## Context

Prior to this decision, the Jarvis desktop application utilized a generic emerald-on-slate chat interface template. While the underlying backend architecture was robust (20 native tools, HMAC cryptographic approval tokens, CDP browser automation, SMTP direct delivery, SQLite persistence), the user interface suffered from several critical usability and security limitations:

1. **Light Mode Contrast Failure:** Light mode rendered white typography against light surfaces, severely degrading readability and violating WCAG AAA contrast standards.
2. **Hidden Execution Evidence:** Tool executions and task progress were buried behind optional timeline toggles, concealing the agent's actions from the user.
3. **Approval Command Truncation:** In the quick-chat drawer, pending approval commands were truncated with CSS ellipsis (`truncate`), creating a security defect where users could not review the complete command before authorizing execution.
4. **Window Chrome Inconsistency:** The main window utilized standard OS frames while the quick-chat drawer was frameless without a defined drag region, resulting in mismatched window behaviors and jarring background color flashes during theme transitions.
5. **Monolithic Component Structure:** `App.tsx` spanned over 1,039 lines of mixed state, rendering logic, and event listeners, hindering modular maintenance and automated testing.

---

## Decision

We replace the legacy interface with **"The Quiet Instrument"** design system and modular component architecture across all three surfaces (Mascot, Quick-Chat Drawer, Main Window).

### 1. "Parchment & Pine" Design Token System
- **Light Mode ("Parchment"):** Canvas `#F2EEE5`, Surface `#FAF7F0`, Elevated `#FFFDF8`, Primary Ink `#17201B` (14.4:1 contrast), Pine Accent `#1E6A4E` (5.6:1 contrast), Burnt Saffron Signal `#A0520E` (4.9:1 contrast).
- **Dark Mode ("Observatory"):** Canvas `#0D1411`, Surface `#131C17`, Elevated `#1A251F`, Primary Ink `#F3EEE3` (16.1:1 contrast), Mint Accent `#7AD9AA` (11.0:1 contrast), Saffron Signal `#F0B35E` (10.1:1 contrast).
- **Typography:** Bundled variable font packages (`@fontsource-variable/fraunces` for editorial headings, `@fontsource-variable/instrument-sans` for UI and chat prose, `@fontsource-variable/jetbrains-mono` for commands and evidence) with zero external network dependencies.

### 2. Window Chrome & Platform Integration
- **Main Window Titlebar Overlay:** Adopt Electron's `titleBarStyle: 'hidden'` paired with `titleBarOverlay`. The renderer reserves 148px margin for native Windows minimize, maximize, and close caption buttons.
- **Dynamic Background Synchronization:** The main process dynamically updates window background colors (`#FAF7F0` in light, `#0D1411` in dark) and titlebar overlay symbol colors on theme changes, preventing frame color flash.
- **Quick-Chat Capture Drawer:** Window size expanded to 400×560. Dedicated `-webkit-app-region: drag` header with `.no-drag` interactive controls, fast-mode toggle, maximize shortcut, and close button.

### 3. Trust Ledger & Exact-Command Approval Integrity (ADR-004)
- **Elimination of Approval Truncation:** Both modal and quick-chat approval surfaces display the full, untruncated command inside a scrollable monospace code-well with syntax styling, working directory display, and one-click copy.
- **Accessible Alert Dialog:** Approvals are mounted inside a Radix UI `role="alertdialog"` with keyboard focus trapping. Escape key and outside pointer events are strictly prevented from dismissing the modal without explicit user authorization.
- **Prominent Plan & Process Tracking:** Real-time `PlanCard` steppers and `ProcessStrip` monitors are elevated directly into the active chat canvas alongside the collapsible 340px `EvidenceRail`.

### 4. Preservation of 3D Mascot Invariants
- The Three.js 3D Owl GLB rig (`left-facing-jarvis.glb`), animation controller (`MascotAnimationController.ts`), kinematics (`OwlMotion.ts`), and 60fps cursor tracking are strictly preserved. Only overlay HTML badges and resize handles are updated to align with the new design tokens.

---

## Consequences

### Positive
- **Visual Distinction:** Delivers a warm, editorial, and professional desktop assistant aesthetic distinct from generic AI chatbots.
- **WCAG AAA Compliance:** High-contrast text eliminates the white-on-white text defect in light mode and provides optimal dark mode readability.
- **Elevated Security UX:** Users are presented with the full, verifiable command and parameters prior to granting execution rights.
- **Maintainability:** `App.tsx` is modularized into dedicated components (`TitleBar`, `Sidebar`, `ChatHeader`, `MessageList`, `Composer`, `PlanCard`, `EvidenceRail`, `ApprovalDialog`, `ProcessStrip`), reducing file size by 50% and simplifying maintenance.

### Trade-offs & Mitigations
- **Bundle Footprint:** Bundling variable font woff2 files adds ~180 kB to the renderer assets. *Mitigation:* Assets are served entirely from local disk via Electron, incurring zero network overhead or latency.
- **Custom Titlebar Drag Regions:** Requires meticulous application of `-webkit-app-region: drag` and `no-drag` on all interactive buttons to avoid interfering with mouse clicks. *Mitigation:* Tested across Windows 10 and 11 display environments with automated Playwright harnesses.
