# JARVIS Brand Identity & Color System

**Source of Truth:** Reference Artwork (`resources/branding/jarvis-owl-reference.jpg`)  
**Design Paradigm:** Premium Geometric Owl Mascot — Forest Spruce, Emerald Iris, and Warm Pearl Ivory.

---

## 1. Extracted Color Palette

The colors below were directly sampled from the approved JARVIS mascot reference image using pixel cluster analysis.

| Role | Color Name | Hex Code | RGB | Sampled From | Semantic Function |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Main Accent** | Emerald Iris | `#3ba172` | `59, 161, 114` | Owl's vibrant green circular iris | Primary buttons, active indicators, live status glow, send button |
| **Highlight Accent** | Luminous Mint | `#52c48e` | `82, 196, 142` | Brightest iris reflection facet | Hover states, glowing pings, focus rings, thinking indicator |
| **Primary Structural** | Deep Spruce Pine | `#111f1e` | `17, 31, 30` | Head crest & wing plumage | Main application window surfaces, sidebar, quick-chat background |
| **Secondary Surface** | Mid Pine Teal | `#172c29` | `23, 44, 41` | Inner wing facets & body feathers | Elevated message cards, modals, tool outputs, inputs |
| **Darkest Base** | Obsidian Charcoal | `#0a1114` | `10, 17, 20` | Beak, talons, and pupil center | Deepest backdrop, code block background, thought deliberation console |
| **Borders & Dividers** | Forest Pine Border | `#1f3832` | `31, 56, 50` | Facet separation lines | Structural dividers, card borders, subtle separators |
| **Border Active** | Viridian Strong | `#2b5049` | `43, 80, 73` | Well-lit wing facet boundaries | Focused inputs, hovered cards, active navigation borders |
| **Lightest Neutral** | Warm Pearl Ivory | `#f5f1ee` | `245, 241, 238` | Facial eye-ring & breast feathers | Primary headings, readable text, high-contrast foreground |
| **Secondary Text** | Soft Pale Sage | `#d1d7d0` | `209, 215, 208` | Light breast feather gradient | Body text, assistant message copy, timestamps |
| **Muted Text** | Pine Dust Muted | `#8a9992` | `138, 153, 146` | Shaded breast feather creases | Placeholders, token counts, subtle metadata |

---

## 2. Semantic UI Token Hierarchy

The palette is centralized in CSS custom properties and mapped to Tailwind utilities:

```css
:root {
  /* Backgrounds & Surfaces */
  --jarvis-base: #0a1114;
  --jarvis-surface: #111f1e;
  --jarvis-elevated: #172c29;
  --jarvis-hover: #1e3834;

  /* Borders & Dividers */
  --jarvis-border: #1f3832;
  --jarvis-border-strong: #2b5049;

  /* Accents & Interactions */
  --jarvis-accent: #3ba172;
  --jarvis-accent-hover: #46b883;
  --jarvis-accent-glow: #52c48e;

  /* Typography & Foreground */
  --jarvis-text-primary: #f5f1ee;
  --jarvis-text-secondary: #d1d7d0;
  --jarvis-text-muted: #8a9992;

  /* Status Tokens */
  --jarvis-success: #3ba172;
  --jarvis-warning: #eab308;
  --jarvis-danger: #ef4444;
  --jarvis-info: #2dd4bf;
}
```

---

## 3. Application Across Presentation Surfaces

### Surface A: Floating 3D Owl Mascot (`mascotWindow`)
- **Three.js Lighting:** Tuned to accentuate the spruce plumage and mint eye rings without wash-out:
  - Ambient: `#ffffff` (`1.2`)
  - Key Directional: `#ffffff` (`1.0`)
  - Soft Rim: `#52c48e` (`0.4`, matching the luminous mint iris reflection)
  - Under Bounce: `#f5f1ee` (`0.3`, reflecting the warm pearl ivory breast)
- **Status Badges:** Small pill badges rendered with `--jarvis-surface` and `--jarvis-accent` text.

### Surface B: Quick-Chat Companion (`quickChatWindow`)
- **Panel Surface:** `--jarvis-base` (`#0a1114`) with `--jarvis-border` (`#1f3832`).
- **User Bubble:** `--jarvis-accent` (`#3ba172`) with crisp `--jarvis-text-primary` (`#f5f1ee`).
- **Assistant Bubble:** `--jarvis-elevated` (`#172c29`) with `--jarvis-text-secondary` (`#d1d7d0`).
- **Reasoning Trace:** Obsidian console (`#070d0f`) with subtle Viridian border (`#1f3832`) and mint pulse.

### Surface C: Full Application (`mainWindow`)
- **Sidebar & Top Bar:** Deep Spruce Pine (`#111f1e`) with Ivory brand logo and Emerald Iris active accents.
- **Buttons & Switches:** Emerald Iris primary buttons (`#3ba172`) with smooth hover state (`#46b883`).
- **Code & Markdown:** Deep obsidian code blocks (`#070d0f`) with subtle Pine dividers and mint copy buttons.
