---
name: Modern Teacher
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#414754'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#727785'
  outline-variant: '#c1c6d6'
  surface-tint: '#005ac1'
  primary: '#0058bd'
  on-primary: '#ffffff'
  primary-container: '#0c70ea'
  on-primary-container: '#fefcff'
  inverse-primary: '#adc6ff'
  secondary: '#a04100'
  on-secondary: '#ffffff'
  secondary-container: '#fe6b00'
  on-secondary-container: '#572000'
  tertiary: '#4648d4'
  on-tertiary: '#ffffff'
  tertiary-container: '#6063ee'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a41'
  on-primary-fixed-variant: '#004494'
  secondary-fixed: '#ffdbcc'
  secondary-fixed-dim: '#ffb693'
  on-secondary-fixed: '#351000'
  on-secondary-fixed-variant: '#7a3000'
  tertiary-fixed: '#e1e0ff'
  tertiary-fixed-dim: '#c0c1ff'
  on-tertiary-fixed: '#07006c'
  on-tertiary-fixed-variant: '#2f2ebe'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: '1.3'
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  container-max: 1280px
  gutter: 24px
---

## Brand & Style
The design system is built for a contemporary educational environment that balances authority with accessibility. The brand personality is "Modern Teacher": a persona that is energetic, tech-savvy, and deeply encouraging. The target audience includes educators seeking efficiency and students looking for an engaging, non-intimidating learning space.

The visual style is **Corporate / Modern** with a high-energy twist. It utilizes a clean, systematic foundation but injects warmth through rounded geometry and vibrant accents. The UI should evoke a sense of clarity and optimism, ensuring that complex educational data feels manageable and inviting.

## Colors
The palette is anchored by **Professional Bright Blue**, used for primary actions, navigation, and structural elements to establish trust and focus. **Energetic Orange** serves as the secondary "spark" color, reserved for high-impact call-to-actions, progress indicators, and celebratory UI moments.

A neutral scale of cool grays provides a sophisticated backdrop, ensuring the vibrant primary colors remain legible and professional. Use pure white for surfaces and a very light gray ($F8FAFC) for page backgrounds to maintain a high-contrast, airy feel.

## Typography
This design system employs a dual-font strategy. **Plus Jakarta Sans** is used for headlines to provide a friendly, modern, and slightly rounded geometric feel that matches the logo's spirit. **Inter** is used for all body copy and functional labels to ensure maximum legibility and a systematic, professional tone.

Maintain generous line heights for body text to improve readability during long study sessions. Headings should use tight letter spacing and heavy weights to create a strong visual hierarchy.

## Layout & Spacing
The layout follows a **Fluid Grid** model with a soft 8px baseline rhythm. For desktop, use a 12-column grid with 24px gutters and 40px side margins. On mobile devices, transition to a 4-column grid with 16px gutters and 16px margins.

Prioritize whitespace to prevent "information overload"—a common issue in educational tools. Elements should be grouped using logical spacing increments (e.g., 8px for related items, 24px for distinct sections). Large card containers should utilize 32px or 40px internal padding to maintain a premium, airy feel.

## Elevation & Depth
Depth is created through **Tonal Layers** combined with **Ambient Shadows**. The design system avoids harsh black shadows in favor of soft, diffused blurs tinted with a hint of the primary blue or neutral gray.

- **Level 0 (Base):** Light gray background (#F8FAFC).
- **Level 1 (Cards/Surface):** Pure white surface with a subtle 1px border (#E2E8F0) and no shadow.
- **Level 2 (Hover/Active):** Pure white surface with a soft, medium-spread shadow (Opacity 8%, Blur 15px).
- **Level 3 (Modals/Popovers):** Pure white surface with a high-spread shadow (Opacity 12%, Blur 30px) to signify high priority.

## Shapes
The shape language is consistently **Rounded**. Standard components like buttons and input fields use a 0.5rem (8px) radius. Larger containers, such as course cards and dashboard widgets, should scale up to `rounded-xl` (1.5rem / 24px) to emphasize the approachable, friendly nature of the brand.

Avoid sharp corners entirely. Even "pill" shapes (full radius) are encouraged for tags, chips, and status indicators to contrast against the more structured rectangular cards.

## Components

### Buttons
Primary buttons use the Professional Bright Blue background with white text and a subtle drop shadow on hover. Secondary buttons use a light blue tint background with blue text. The "Energetic Orange" is reserved for high-conversion "Start Learning" or "Join Class" buttons.

### Cards
Cards are the primary content container. They should have a white background, a 1px soft gray border, and 24px rounded corners. On hover, cards should slightly lift using an ambient shadow and a primary blue border accent.

### Input Fields
Inputs feature a light gray background and a 1px border. On focus, the border transitions to Primary Blue with a soft blue outer glow (ring). Labels are always positioned above the field for clarity.

### Chips & Tags
Use highly rounded (pill-shaped) backgrounds. For category tags, use low-saturation versions of the primary colors (e.g., light blue background with dark blue text) to keep the UI clean.

### Progress Bars
Progress bars are a key educational element. Use a thick 8px height with fully rounded caps. The track is light gray, and the progress fill uses the Energetic Orange to signal momentum and achievement.

### Lists
Lists should have generous vertical padding (16px) between items and use subtle horizontal dividers. Active list items are indicated by a vertical 4px blue bar on the left edge.