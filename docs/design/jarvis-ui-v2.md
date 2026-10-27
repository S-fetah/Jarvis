# Jarvis UI v2 Design System: "The Quiet Instrument"

**Status:** Implemented & Verified  
**Date:** October 2026  
**Surfaces Covered:**
- Surface A: Ambient 3D Mascot Companion (200×230 transparent overlay)
- Surface B: Quick-Chat Capture Drawer (400×560 frameless window)
- Surface C: Main Desktop Window (1200×800 native titlebar overlay)

---

## 1. Design Philosophy

Jarvis is a local-first Windows desktop AI assistant with strict assistive autonomy. Its defining capability is not just chat, but planning, executing, verifying, and reporting across tools with cryptographic HMAC approvals.

**Core Thesis:** *Trust is a visual property.*
The interface feels like a precision field notebook crossed with an observatory console: warm, calm, exact, and quietly confident.

### Guiding Principles
1. **Trust is Visible:** Every action has an address: plan step, tool ledger row, cryptographic approval prompt, and verified output. The user always knows what Jarvis is doing, what it did, and what requires approval.
2. **Editorial Clarity over Generic Bubbles:** Assistant prose uses comfortable measures (max 760px, 15px/26px line-height), warm serif display typography for headings, and humanist sans for UI copy. No generic emerald/slate templates or purple gradients.
3. **Exact Command Integrity (ADR-004):** Approval dialogs and quick-chat cards never truncate commands. Full command text, working directory, target path, and risk category are plainly readable with one-click copy.
4. **Native Craft:** Seamless Windows 11 titlebar overlay (`titleBarStyle: 'hidden'`, `titleBarOverlay`), responsive snap layout support, and theme-synchronized frame backgrounds (`#FAF7F0` in light mode, `#0D1411` in dark mode) eliminate visual flashes.
5. **Preserved Mascot Invariants:** The approved Three.js 3D Owl GLB model, lighting, kinematics, procedural animation loop, and cursor tracking are 100% preserved.

---

## 2. Color System: Parchment & Pine

The color palette provides high-contrast, eye-friendly readability across both light ("Parchment") and dark ("Observatory") environments.

| Role | Light ("Parchment") | Dark ("Observatory") | WCAG Contrast (Text / Surface) |
| :--- | :--- | :--- | :--- |
| **Canvas Base** | `#F2EEE5` | `#0D1411` | — |
| **Primary Surface** | `#FAF7F0` | `#131C17` | — |
| **Elevated Surface** | `#FFFDF8` | `#1A251F` | — |
| **Primary Ink (Headings & Body)** | `#17201B` | `#F3EEE3` | **14.4:1** (Light) / **16.1:1** (Dark) |
| **Secondary Ink (Sage / Body)** | `#3E4A43` | `#C9D2CA` | **9.2:1** (Light) / **10.8:1** (Dark) |
| **Muted Ink (Timestamps / Meta)** | `#5F6B63` | `#8E9C92` | **4.8:1** (Light) / **6.5:1** (Dark) |
| **Primary Accent (Verified / Action)** | `#1E6A4E` | `#7AD9AA` | **5.6:1** (Light) / **11.0:1** (Dark) |
| **Accent Soft (Tints & Selections)** | `#DCEBE2` | `#1B3529` | — |
| **Signal (Approval Required / Warning)**| `#A0520E` | `#F0B35E` | **4.9:1** (Light) / **10.1:1** (Dark) |
| **Signal Soft** | `#F3E2CF` | `#3A2A17` | — |
| **Danger / Destructive** | `#B42318` | `#F97066` | **6.1:1** (Light) / **8.7:1** (Dark) |
| **Info / Informational** | `#2B5F8A` | `#84B8E8` | **5.8:1** (Light) / **7.9:1** (Dark) |
| **Borders & Dividers** | `#D9D2C3` | `#28362E` | — |
| **Code Block Background** | `#15201B` | `#0A100D` | — |
| **Code Block Ink** | `#E8E2D6` | `#E8E2D6` | **12.5:1** |

---

## 3. Typography Hierarchy

Fonts are bundled locally through `@fontsource-variable/*` packages with zero external CDN dependencies:
- **Display Face:** `Fraunces Variable` (`font-display`) — used for major headings, conversation titles, and empty-state headlines.
- **UI & Body Face:** `Instrument Sans Variable` (`font-sans`) — used for interface elements, conversation prose, metadata, and controls.
- **Code & Evidence Face:** `JetBrains Mono Variable` (`font-mono`) — used for execution commands, file paths, tool arguments, hashes, and raw logs.

| Role | Font Family | Size / Line Height | Usage |
| :--- | :--- | :--- | :--- |
| **Headline Display** | Fraunces Variable | 22px / 1.1 | Empty-state greetings, section hero headers |
| **Section Title** | Fraunces Variable | 17–18px / 1.2 | Active conversation title, Evidence header, Modal titles |
| **UI Primary** | Instrument Sans | 13–14px / 1.5 | Navigation labels, buttons, controls, input text |
| **Chat Prose** | Instrument Sans | 13.5–15px / 1.7 | Assistant editorial responses, user bubbles |
| **Meta & Badges** | Instrument Sans | 10–11px / 1.4 | Timestamps, status chips, micro-labels |
| **Code & Ledger** | JetBrains Mono | 10.5–12px / 1.6 | Terminal commands, file diffs, tool names, hashes |

---

## 4. Window & Surface Architecture

### Surface A: Ambient 3D Mascot Companion
- **Size:** 200×230 frameless, transparent, always-on-top.
- **Three.js Pipeline:** Preserves the `left-facing-jarvis.glb` rig, ambient/key/mint-rim lighting, procedural idle breathing, hop kinematics, blinking, and 60fps cursor tracking.
- **Modern Chrome:** Semi-transparent dark pill status badges with colored ping dots (`Thinking`, `Working`, `Approval Needed`, `Done`).
- **Resize Handle:** Bottom-right `<>` resize grip with pointer events enabled on hover.

### Surface B: Quick-Chat Capture Drawer
- **Size:** 400×560 frameless window, dynamically positioned adjacent to the mascot.
- **Title Bar:** Custom drag region (`.drag-region`), brand mark, "Quick chat" header, "Local" status pill, fast-mode toggle, maximize button, and close button (`.no-drag`).
- **Approval Card:** Full exact command displayed in a dedicated, scrollable code-well without text truncation, one-click copy button, working directory path, and explicit "Deny" / "Approve" actions.
- **Composer:** Multi-line textarea with Enter-to-send, Shift+Enter for newline, Prompt Controls bar (style/mode/depth), and Send button.

### Surface C: Main Desktop Window
- **Size:** 1200×800 (min 850×620).
- **Native Titlebar Overlay:** `titleBarStyle: 'hidden'`, `titleBarOverlay` with synchronized theme colors (`#FAF7F0` in light, `#0D1411` in dark), 44px height, reserving 148px margin for native Windows caption buttons.
- **Collapsible Sidebar (276px):** Search filter, "New conversation" button with shortcut tag, chronological day groups (Today, Yesterday, Earlier), delete conversation action, active conversation indicator, and workspace switcher.
- **Plan & Process Integration:** Real-time `PlanCard` stepper displaying progress percentage, step statuses, and active step directly inside the main chat view. Dev server process status strip with real-time log drawer and stop button.
- **Chat Timeline:** Editorial typography, user bubbles in accent green, assistant prose with syntax-highlighted code blocks, copy actions, thinking blocks with token counts, and jump-to-bottom behavior.
- **Evidence Rail (340px):** Collapsible right drawer with tabs for "Plan" and "Timeline", filterable by All / Tools / Approvals, with one-click artifact reveal in Windows Explorer.
- **Approval Dialog:** Accessible `role="alertdialog"` with focus trap, explicit prevention of escape/outside-click dismissal, exact command view, working directory, and risk classification.
