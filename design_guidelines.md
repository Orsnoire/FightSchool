# Design Guidelines: RPG Combat Quiz Platform

## Design Approach

**Reference-Based Gaming UI**: Drawing inspiration from Discord's dark gaming aesthetic, Kahoot's engagement mechanics, and classic RPG interfaces (Final Fantasy, WoW) - creating an immersive fantasy battle experience that makes learning engaging.

**Core Principle**: Every interaction should feel like meaningful progression in an epic quest, transforming education into adventure.

---

## Color Palette

### Dark Fantasy Theme (Primary)
- **Background Dark**: 220 20% 12% (Deep slate for main backgrounds)
- **Surface Dark**: 220 18% 18% (Cards, panels, elevated surfaces)
- **Surface Lighter**: 220 16% 24% (Hover states, secondary surfaces)

### Combat & Energy (Accents)
- **Primary Combat**: 265 85% 58% (Vibrant purple for primary actions, magic effects)
- **Health/Success**: 142 70% 45% (Rich emerald for health bars, correct answers)
- **Damage/Error**: 0 72% 55% (Combat red for damage, incorrect answers)
- **Warning/Timer**: 38 95% 55% (Amber for countdown urgency)

### Class-Specific Colors
- **Knight (Tank)**: 210 65% 50% (Steel blue)
- **Wizard/Scout (DPS)**: 280 75% 55% (Arcane purple)
- **Herbalist (Healer)**: 145 60% 48% (Nature green)

### Light Mode Alternative
- **Background Light**: 220 30% 96%
- **Surface Light**: 220 25% 98%
- **Primary Light Mode**: 265 75% 48%

---

## Typography

**Families**:
- **Display/Headers**: 'Cinzel' or 'Marcellus' (fantasy serif for epic feel)
- **Body/UI**: 'Inter' or 'DM Sans' (clean, readable sans-serif)

**Scale**:
- **Epic Headers**: text-5xl to text-6xl, font-bold (Fight titles, victory screens)
- **Section Headers**: text-3xl to text-4xl, font-semibold (Phase names, enemy names)
- **Combat Text**: text-2xl, font-bold (Damage numbers, timer)
- **UI Labels**: text-sm to text-base, font-medium (Stats, buttons)
- **Body Text**: text-base, font-normal (Questions, descriptions)

---

## Layout System

**Spacing Primitives**: Tailwind units of **2, 4, 6, 8, 12, 16** (p-4, gap-6, mt-8, etc.)

**Grids**:
- **Teacher Dashboard**: 3-column grid (lg:grid-cols-3) for fight cards
- **Character Select**: 4-column grid (md:grid-cols-2 lg:grid-cols-4) for class cards
- **Equipment Shop**: 3-column grid (md:grid-cols-3) for items

**Key Layouts**:
- **Combat Screen**: Full-viewport height with distinct zones (enemy top, question center, player bottom)
- **Lobby**: Split layout - character preview left (40%), equipment/stats right (60%)
- **Teacher Host**: Dashboard layout with student grid (main) + control panel (sidebar)

---

## Component Library

### Core UI Elements

**Cards**:
- **Combat Question Card**: Dark surface (220 18% 18%), rounded-2xl, border border-purple-500/30, p-8
- **Character Class Card**: Hover-glow effect, transform scale on hover, class-specific accent border
- **Equipment Item**: Compact card with rarity-based border glow (common→legendary)

**Buttons**:
- **Primary Action**: bg-purple-600 hover:bg-purple-700, rounded-lg, px-6 py-3, font-semibold
- **Combat Answer**: Full-width, text-left, transition-all on selection, correct=green glow, incorrect=red shake
- **Danger**: bg-red-600 for destructive actions (delete fight, end game)

### Navigation

**Teacher Interface**:
- **Top Nav**: Sticky header with logo, "Create Fight" CTA, profile dropdown
- **Side Panel**: Collapsible fight list with status indicators (draft/active/completed)

**Student Interface**:
- **Minimal Nav**: Only logout in top-right during lobby
- **Combat**: No navigation - full immersion in battle

### Forms

**Teacher Fight Creator**:
- **Multi-step Wizard**: Tabs for Questions → Enemies → Settings
- **Question Builder**: Card-based with question type selector, answer inputs, timer slider
- **Rich Text**: Support for bold/italic in questions via simple markdown

**Student Registration**:
- **Single Page Form**: Class code → Nickname → Password → Class selection flow
- **Inline Validation**: Real-time feedback with icon indicators

### Data Display

**Health Bars**:
- **Animated Fill**: Smooth width transition, gradient fill (green→yellow→red based on %)
- **Segmented**: Show max HP as segments for tanks (easier to read blocks vs. smooth bar)

**Combat Log** (Optional for teacher view):
- **Scrollable Feed**: Recent 10 actions, color-coded by type (damage red, heal green, block blue)

**Student Grid** (Teacher host):
- **Avatar Tiles**: 4×4 grid showing character portrait, health, ready state
- **Status Icons**: Check (answered), clock (thinking), skull (eliminated)

### Overlays

**Victory/Defeat Modals**:
- **Full-screen Overlay**: Backdrop blur, celebration animation for victory, dramatic fade for defeat
- **Stats Summary**: Damage dealt, questions correct, MVP badge

**Phase Indicators**:
- **Toast Notifications**: Top-center, auto-dismiss, "Question Phase", "Tank Blocking", "Combat!"

---

## Interaction Patterns

**Combat Flow Visual Feedback**:
1. **Question Phase**: Pulsing border on question card, timer arc animation
2. **Tank Blocking**: Highlight selectable player icons, show shield preview
3. **Combat Phase**: Sequential damage numbers float up, health bars animate, screen shake on big hits
4. **Victory Check**: Pause → Enemy death animation OR victory fanfare

**Character Customization**:
- **Equipment Preview**: Real-time 3D-style character sprite updates as items are selected
- **Drag & Drop** (Advanced): Drag equipment onto character slots

**Answer Feedback**:
- **Correct**: Green glow pulse, +1 damage indicator floats up
- **Incorrect**: Red shake animation, crack effect on player health bar
- **Streak Counter** (DPS): Glowing number badge on avatar, crescendo effect at 3-streak

---

## Images & Visual Assets

**Hero Image**: 
- **Teacher Landing**: Fantasy classroom scene - wizard teaching students with magical combat hologram (wide hero, 60vh)
- **Student Login**: Epic battle scene background with character silhouettes (full-viewport backdrop)

**Character Assets**:
- Use pixel art style or hand-drawn fantasy sprites for classes (128×128px)
- Enemy images: Fantasy creatures (dragon, goblin horde, dark wizard) - larger format (512×512px)

**Equipment Icons**:
- Icon library for weapons/armor (sword, staff, bow, helmet, etc.) - 64×64px
- Rarity glow effects: white (common), blue (rare), purple (epic), gold (legendary)

---

## Accessibility & Responsiveness

- **Color Blind Modes**: Icon indicators alongside color (not just red/green)
- **Font Scaling**: Support browser zoom up to 150%
- **Mobile Combat**: Stack combat UI vertically, simplified equipment menu
- **Keyboard Navigation**: Full tab support for teacher interface, arrow keys for answer selection

---

## Animation Budget

**Strategic Animations**:
- Health bar transitions (500ms ease-out)
- Damage numbers float animation (1s fade-up)
- Victory/defeat modal entrance (dramatic 800ms)
- Screen shake on critical hits (200ms)

**Avoid**: Constant background animations, distracting combat loop animations, excessive particle effects

This design creates an immersive RPG learning experience where every quiz question becomes an epic battle moment, transforming education into an adventure students will remember.