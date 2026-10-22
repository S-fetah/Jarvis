# Task 1: Floating 3D Owl Companion & Multi-Surface Desktop Architecture

**Status:** Completed & Tested  
**Date:** 2026-10-23  
**Approved Asset:** `left-facing-jarvis.glb` (8,832,044 bytes, glTF 2.0 binary, centered bounds `[-0.736, -0.951, -0.649]` to `[0.738, 0.947, 0.658]`, 0 embedded animations -> procedural state controller required).

---

## 1. Project Audit Summary

### A. Current Architecture
- **Framework:** Electron 34 (`34.2.0`), React 19 (`19.0.0`), Vite 6 (`6.1.0`), TypeScript 5 (`5.7.3`).
- **Build System:** `electron-vite` with separate `main`, `preload`, and `renderer` configurations.
- **Storage:** Local-first SQLite (`sql.js` WASM) persisted to disk at `userData/jarvis.sqlite`.
- **Model Gateway:** `ModelGatewayAdapter` interfacing with local FreeLLMAPI gateway (`http://127.0.0.1:31415`) with auto-detected unified API keys and multi-key rotation.
- **Safety & Policy:** `PolicyEngine` (ADR-004) enforcing Assistive Autonomy with HMAC argument tamper-proofing and approval gating.
- **Rendering:** Extended from a single window to 3 coordinated desktop surfaces (`MascotWindow`, `QuickChatWindow`, `MainWindow`).

### B. Asset Discovery & Inspection
- **Source Path:** `C:\Users\abdelfetah safiddine\Downloads\Documents\Wallpapers & Artwork\left-facing-jarvis.glb`
- **Asset Verified:** glTF 2.0 binary, 8.83 MB.
- **Geometry & Hierarchy:** 1 mesh, 1 material, 1 node, 0 skins, 0 embedded animation clips.
- **Bounding Box:** Perfectly centered at `(0.0007, -0.0017, 0.0040)`, dimensions `1.474 x 1.898 x 1.307`.
- **Project Asset Paths Established:**
  - `src/renderer/public/assets/mascot/left-facing-jarvis.glb` (served by Vite in development, copied to `out/renderer/assets/mascot/left-facing-jarvis.glb` on build)
  - `resources/mascot/left-facing-jarvis.glb` (extraResources fallback for electron packaging)

### C. Components Reused
- `src/main/storage/database.ts`: Persists mascot position (`mascot_pos_x`, `mascot_pos_y`), mascot preferences (`mascot_enabled`), and conversation history.
- `src/main/gateway/model-adapter.ts`: Shared LLM streaming and reasoning extraction.
- `src/main/policy/policy-engine.ts`: Shared ADR-004 approval gating.
- `src/renderer/src/components/MarkdownRenderer.tsx`: Clean markdown rendering with code highlighting & copy.
- `src/renderer/src/components/ThinkingBlock.tsx`: Collapsible chain-of-thought display.
- `src/renderer/src/components/RateLimitCard.tsx`: Interactive provider cooldown recovery.
- `src/renderer/src/components/SettingsModal.tsx` & `FreeModelsHubModal.tsx`: Gateway settings and free keys hub.

---

## 2. Multi-Surface Window Architecture

### Surface A: Floating 3D Owl Mascot Window (`mascotWindow`)
- **Dimensions:** `180 x 200` px.
- **Window Flags:** `transparent: true`, `frame: false`, `alwaysOnTop: true`, `resizable: false`, `hasShadow: false`, `skipTaskbar: true`, `backgroundColor: '#00000000'`.
- **Drag & Click Disambiguation:**
  - Mouse down records start coordinate `(x0, y0)`.
  - If mouse moves `> 4px`, window is dragged across the Windows desktop using Electron window position updates.
  - If mouse release is `< 4px` displacement without drag, it triggers a Click, toggling Surface B (Quick-Chat).
- **Position Clamping:** Clamped to active display work area so the mascot never gets lost off-screen on multi-monitor setups or resolution changes.
- **Position Persistence:** Saved in SQLite `settings` table on drag end.

### Surface B: Companion Quick-Chat Window (`quickChatWindow`)
- **Dimensions:** `380 x 520` px.
- **Window Flags:** `frame: false`, `alwaysOnTop: true`, `skipTaskbar: true`, `resizable: false`, `backgroundColor: '#0d1117'`.
- **Placement:** Intelligently anchored adjacent to the mascot (e.g., to the left or right based on screen edge clearance, clamped within screen).
- **Features:** Compact conversation stream, streaming thoughts & reply, message input, action cancellation, ADR-004 approval card, button to expand into full main app (`Surface C`), and dismiss button leaving the mascot floating.

### Surface C: Main Desktop Application (`mainWindow`)
- Full application with conversation drawer, model catalog, Free Models Hub, activity timeline, and system settings.
- Can be opened from Quick-Chat or top bar, closed or minimized without killing the mascot.

---

## 3. Three.js Rendering & Animation Strategy

- **WebGL Canvas:** Three.js `WebGLRenderer` configured with `{ alpha: true, antialias: true, powerPreference: 'low-power' }`.
- **Lighting:** Ambient light (intensity `1.25`) + Directional key light (`1.1`), soft cool rim light (`0.6`), and warm backlight (`0.4`) preserving authored palette, eye rings, and plumage without washing out.
- **Camera:** PerspectiveCamera (`fov: 36`), positioned at `(0, 0, 3.25)` framed to the owl's `[-0.74, 0.74]` width and `[-0.95, 0.95]` height with breathing room.
- **Device Pixel Ratio:** Capped at `Math.min(window.devicePixelRatio, 2)` to eliminate unnecessary GPU load on 4K/high-DPI monitors.
- **Procedural Animation State Machine (`MascotAnimationController`):**
  - `idle`: Gentle sinusoidal hovering (`sin(t * 1.6) * 0.04`), subtle breathing pitch (`sin(t * 0.8) * 0.02`), micro-swivels (`cos(t * 0.4) * 0.03`).
  - `attention`: Upright alert posture, quick smooth look towards user on click.
  - `thinking`: Contemplative subtle tilt and rhythmic micro-pacing while LLM streams reasoning.
  - `working`: Focused steady hovering while tasks execute.
  - `needsApproval`: Attentive alert pulse coordinating with ADR-004 approval prompt.
  - `completed`: Tasteful acknowledgment dip and return to perch.
  - `error`: Restrained tilt.
  - **Interactive Cursor Tracking:** Head and body turn gently to track mouse cursor movement over the mascot!
- **Resource Management:** Animation frame stops when window is hidden; full WebGL context loss handling and texture/geometry disposal.

---

## 4. Test Results & Build Verification

- **TypeScript Typecheck:** `npm run typecheck` passed (both `typecheck:node` and `typecheck:web` exit code 0).
- **Vitest Test Suite:** `npm test` passed 13/13 tests across 3 suites:
  - `tests/policy-engine.test.ts` (6 tests)
  - `tests/mascot-animation.test.ts` (4 tests)
  - `tests/model-adapter.test.ts` (3 tests)
- **Production Build:** `npm run build` succeeded in 12.16s:
  - `out/main/index.js` (50.72 kB)
  - `out/preload/index.cjs` (4.05 kB)
  - `out/renderer/` assets bundle + `out/renderer/assets/mascot/left-facing-jarvis.glb` (8.83 MB verified).
