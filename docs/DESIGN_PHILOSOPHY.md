# DESIGN PHILOSOPHY — PassAndPic Photobooth

> *"Every picture is a moment shared. Every collage is a memory made together."*

---

## 1. Core Philosophy

PassAndPic is built on one central belief: **connection should feel effortless, and memories should feel beautiful.** The product exists in the emotional space between togetherness and distance — people who are not in the same room but want to feel like they are. The design must honor that.

We lead with **warmth, clarity, and delight**. Nothing should feel cold, technical, or intimidating. A grandparent and a teenager should both feel at home the moment they open the app.

---

## 2. Visual Identity & Aesthetic Direction

### 2.1 Default Aesthetic — Clean White / Blank Canvas

The default state of PassAndPic is a **clean white canvas** — intentionally blank, like a fresh photo album or an empty pinboard waiting to be filled. This is not emptiness; it is *potential*.

**Psychological intent:**
- White communicates openness, purity, and creative freedom.
- It removes visual noise so the *photos themselves* become the hero.
- It signals professionalism and calm, reducing anxiety in first-time users.
- It provides maximum contrast for stickers, borders, and collage elements.

**Design language:**
- Backgrounds: `#FFFFFF` base with soft `#F7F7F7` surface layers
- Borders and dividers: hair-thin `1px` lines in `#E8E8E8`
- Shadows: ultra-soft, low-opacity diffuse shadows (`box-shadow: 0 2px 16px rgba(0,0,0,0.06)`)
- Corners: consistently rounded (`border-radius: 16px` for cards, `12px` for buttons)
- Typography: a single elegant serif or soft sans-serif pairing — refined but never cold

---

### 2.2 Theme System — Mood-First Design

Themes are not mere color swaps. Each theme carries its own **emotional mood** and adjusts typography weight, shadow intensity, and sticker palette accordingly.

| Theme Name | Primary Color | Mood | Personality |
|---|---|---|---|
| **Snow** (default) | `#FFFFFF` | Open, fresh, calm | The blank canvas |
| **Midnight** | `#1A2744` (Navy) | Intimate, dramatic, rich | Late-night vibes |
| **Petal** | `#F9D9E3` (Light Pink) | Playful, romantic, soft | Sweet and warm |
| **Slate** | `#2D3748` | Moody, editorial | Cool and modern |
| **Citrus** | `#FFF3CD` | Sunny, energetic | Bright and happy |
| **Custom** | User-defined via color wheel | Personal | Yours entirely |

**Theme Application Rules:**
- Themes affect: background, surface cards, button fills, sticker accent colors, collage frame tints
- Themes do NOT affect: core UI icons (always neutral), accessibility contrast ratios (always WCAG AA minimum), text legibility (always guaranteed)
- Theme transitions use a `300ms ease-in-out` crossfade — never jarring

**Color Wheel (Custom Theme):**
- Users pick a base hue; the system auto-generates a complementary surface color and a safe text contrast color
- Pastel/desaturated tones are nudged toward by default to keep the feel soft
- Extreme saturation is allowed but flagged visually as "Bold Mode"

---

## 3. Layout & Spatial Principles

### 3.1 Mobile-First, Desktop-Enhanced

PassAndPic is primarily used on phones — in kitchens, at parties, in bedrooms, at weddings. The mobile experience is the *real* experience. Desktop is an enhancement layer, not the baseline.

- **Mobile:** Full-bleed layouts, large tap targets (minimum `48x48px`), thumb-zone-optimized actions, bottom navigation bar
- **Tablet:** Two-column collage preview with side panel
- **Desktop:** Three-column layout, keyboard shortcut support, drag-and-drop sticker placement, larger collage grid previews

### 3.2 Breathing Room

Every screen gives content space to exist. We use generous padding (`24px` minimum on mobile, `48px` on desktop) and resist the urge to fill every pixel. Negative space is not waste — it is *rhythm*.

### 3.3 Hierarchy of Attention

Every screen should have exactly **one primary action** that is visually dominant. Secondary and tertiary actions exist but never compete. The user should always know what to do next without reading instructions.

---

## 4. Interaction Design & Motion

### 4.1 Micro-Interactions

Small moments of delight build trust and warmth:
- Camera shutter: a brief white flash + soft "click" haptic on mobile
- Photo landing in collage: a gentle `scale(1.04) → scale(1.0)` bounce
- Sticker placement: a satisfying elastic pop (`spring` easing)
- Party Code entry: character-by-character color fill as digits are typed
- Theme switching: a ripple-reveal transition from the selection point

### 4.2 Motion Principles

| Principle | Application |
|---|---|
| **Purposeful** | Every animation communicates something (success, transition, loading) |
| **Brief** | Max `400ms` for transitions; `200ms` for micro-interactions |
| **Respectful** | All motion respects `prefers-reduced-motion` — degrades to instant |
| **Elastic, not linear** | Use spring/ease-out curves; avoid robotic linear timing |

---

## 5. Sticker System

Stickers are an **emotional layer** — they let people express personality, mark moments, and personalize the shared space.

### 5.1 Sticker Philosophy
- Stickers should feel **handcrafted and warm**, not clipart-generic
- They exist in thematic packs that match the current theme
- Stickers are vector-based (SVG) for crisp rendering at any scale

### 5.2 Sticker Categories (Initial Set)
| Pack | Stickers Include |
|---|---|
| **Celebration** | confetti bursts, party hats, balloons, sparkles, stars |
| **Love** | hearts (filled, outline, floating), kisses, ribbons |
| **Nature** | flowers, leaves, sun, moon, clouds, rainbows |
| **Retro** | film frames, polaroid borders, grain overlays, vintage stamps |
| **Text Stamps** | "BFF", "Squad", "Unforgettable", "Here for it", custom text |
| **Seasonal** | rotated with holidays and seasons |

### 5.3 Sticker Behavior
- Draggable and pinch-to-resize on mobile; drag + scroll-to-resize on desktop
- Rotation via two-finger rotate gesture (mobile) or rotation handle (desktop)
- Stickers persist across user sessions per collage and are visible to all participants
- Host can lock stickers from editing once collage is finalized

---

## 6. Typography

Typography carries the brand's warmth and clarity.

- **Display / Headlines:** A soft, slightly rounded typeface — approachable but distinctive (e.g., *DM Serif Display*, *Playfair Display*, or a similar humanist serif)
- **Body / UI Text:** A clean, highly legible sans-serif optimized for small sizes on screens (e.g., *DM Sans*, *Plus Jakarta Sans*)
- **Party Codes / Monospace moments:** A friendly monospaced face for code display, avoiding the "developer terminal" feel
- **Size Scale:** Strict 4-step modular scale (base 16px). No arbitrary sizes.

---

## 7. Accessibility

Beauty and accessibility are not in conflict. PassAndPic is designed for everyone.

- **Color contrast:** Minimum WCAG AA (4.5:1 for text, 3:1 for UI components) across all themes
- **Touch targets:** Minimum `48x48px` on all interactive elements
- **Focus states:** Visible and styled (not browser default) for keyboard navigation
- **Screen reader support:** All collage slots, stickers, and photos have descriptive `aria-label` attributes
- **Reduced motion:** Fully respected via `@media (prefers-reduced-motion: reduce)`
- **Text scaling:** UI responds gracefully up to 200% browser text zoom

---

## 8. Emotional Design Goals

At every touchpoint, PassAndPic should make users feel:

1. **Safe** — "I know exactly what to do next."
2. **Delighted** — "Oh, that's a nice little touch."
3. **Connected** — "I feel close to the people I'm sharing this with."
4. **Proud** — "I want to save and share this collage."

---

*This document governs aesthetic and experiential decisions across the PassAndPic product. Revisit and evolve it as the product grows.*
