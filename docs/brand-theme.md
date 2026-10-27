# JARVIS Brand Identity & Color System (UI v2: Parchment & Pine)

**Source of Truth:** Reference Artwork (`resources/branding/jarvis-owl-reference.jpg`) & ADR-005  
**Design Paradigm:** "The Quiet Instrument" — Warm Parchment Ivory, Deep Spruce Pine, Mint Iris Glow, and Burnt Saffron Signals.

---

## 1. Dual Palette Architecture

The JARVIS interface employs a dual-theme design system engineered for maximum contrast, eye comfort, and visibility.

### A. Light Theme: "Parchment"
Evokes a precision field notebook with warm ivory canvas, deep spruce ink, and crisp forest emerald accents.

| Role | Color Name | Hex Code | Semantic Function | Contrast Ratio |
| :--- | :--- | :--- | :--- | :--- |
| **Canvas Base** | Warm Parchment | `#F2EEE5` | Main window deep background | — |
| **Surface** | Bone Ivory | `#FAF7F0` | Sidebar, header, dialog background | — |
| **Elevated** | Pure Pearl | `#FFFDF8` | Card backgrounds, raised dropdowns | — |
| **Primary Ink** | Deep Forest Spruce | `#0B110E` | Primary headings, readable text, high contrast | **18.2:1** |
| **Secondary Ink** | Pine Sage | `#212121` | Subtitles, body prose, secondary labels | **15.4:1** |
| **Muted Ink** | Forest Dust Muted | `#38463E` | Timestamps, counters, subtle indicators | **9.2:1** |
| **Primary Accent** | Deep Pine Emerald | `#13533B` | Send buttons, active tags, verified indicators | **7.8:1** |
| **Signal Accent** | Burnt Saffron | `#A0520E` | Approval required, security alerts | **4.9:1** |
| **Danger** | Rust Crimson | `#B42318` | Destructive actions, tool errors | **6.1:1** |
| **Info** | Steel Cobalt | `#2B5F8A` | Tool calls, system notifications | **5.8:1** |

### B. Dark Theme: "Observatory"
An atmospheric night console inspired by deep coniferous forests under starlight.

| Role | Color Name | Hex Code | Semantic Function | Contrast Ratio |
| :--- | :--- | :--- | :--- | :--- |
| **Canvas Base** | Obsidian Forest | `#0D1411` | Application base background | — |
| **Surface** | Deep Pine Timber | `#131C17` | Window chrome, sidebars, panels | — |
| **Elevated** | Elevated Spruce | `#1A251F` | Cards, popovers, active containers | — |
| **Primary Ink** | Warm Parchment Ivory | `#F3EEE3` | Primary headings, readable text | **16.1:1** |
| **Secondary Ink** | Pale Sage | `#C9D2CA` | Assistant prose, secondary metadata | **10.8:1** |
| **Muted Ink** | Pine Muted Dust | `#8E9C92` | Timestamps, token counts, muted labels | **6.5:1** |
| **Primary Accent** | Luminous Mint | `#7AD9AA` | Active states, live dots, send button | **11.0:1** |
| **Signal Accent** | Amber Saffron | `#F0B35E` | Approval prompts, attention badges | **10.1:1** |
| **Danger** | Coral Rose | `#F97066` | Critical warnings, process termination | **8.7:1** |
| **Info** | Sky Ice Blue | `#84B8E8` | External link badges, network logs | **7.9:1** |

---

## 2. Typography

Fonts are self-contained locally via `@fontsource-variable/*`:
- **Display:** `Fraunces Variable` (Optical weight 100–900, soft, serif)
- **UI & Prose:** `Instrument Sans Variable` (Humanist sans-serif)
- **Code & Ledger:** `JetBrains Mono Variable` (Precision monospace)

---

## 3. Surface Mapping

### Surface A: Ambient 3D Mascot Companion
- Three.js WebGL scene with transparent background.
- Preserved `left-facing-jarvis.glb` mesh, lighting rig, and cursor tracking.
- Subtle floating pill badges using theme-synchronized dark scrims and luminous mint pings.

### Surface B: Quick-Chat Capture Drawer (400×560)
- Frameless window with custom drag header.
- Full exact command approval card with one-click copy and zero text truncation.
- Multi-line textarea composer with keyboard shortcuts.

### Surface C: Main Desktop Window (1200×800)
- Native Windows titlebar overlay (`titleBarStyle: 'hidden'`, `titleBarOverlay`).
- Collapsible sidebar with conversation search and chronological grouping.
- Persistent `PlanCard` execution progress bar and dev server `ProcessStrip`.
- Collapsible 340px `EvidenceRail` with Plan and Timeline tabs.
- Full-screen `ApprovalDialog` with accessible alert dialog semantics.
