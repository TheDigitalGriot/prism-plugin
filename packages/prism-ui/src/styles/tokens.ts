/**
 * @prism/ui — CSS token reference constants.
 *
 * Typed references to all --prism-* CSS custom properties defined in bridge.css.
 * Use these constants when setting CSS variables programmatically or in tests.
 */

export const PRISM_TOKENS = {
  // Typography
  fontFamily: '--prism-font-family',
  fontMono: '--prism-font-mono',
  fontCode: '--prism-font-code',
  fontSize: '--prism-font-size',

  // Backgrounds
  bg: '--prism-bg',
  bgPanel: '--prism-bg-panel',
  bgEditor: '--prism-bg-editor',
  bgHover: '--prism-bg-hover',
  bgActive: '--prism-bg-active',
  bgInput: '--prism-bg-input',
  bgDropdown: '--prism-bg-dropdown',
  bgButton: '--prism-bg-button',
  bgButtonHover: '--prism-bg-button-hover',
  bgButtonSecondary: '--prism-bg-button-secondary',
  bgSurface: '--prism-bg-surface',
  bgRail: '--prism-bg-rail',
  bgCode: '--prism-bg-code',
  bgBlockquote: '--prism-bg-blockquote',
  bgBadge: '--prism-bg-badge',

  // Foregrounds / Text
  fg: '--prism-fg',
  fgMuted: '--prism-fg-muted',
  fgDisabled: '--prism-fg-disabled',
  fgActive: '--prism-fg-active',
  fgButton: '--prism-fg-button',
  fgEditor: '--prism-fg-editor',
  fgLink: '--prism-fg-link',
  fgLinkHover: '--prism-fg-link-hover',
  textDim: '--prism-text-dim',

  // Borders
  border: '--prism-border',
  borderFocus: '--prism-border-focus',
  borderInput: '--prism-border-input',
  borderActive: '--prism-border-active',
  widgetBorder: '--prism-widget-border',
  borderBlockquote: '--prism-border-blockquote',

  // Status
  success: '--prism-success',
  warning: '--prism-warning',
  error: '--prism-error',
  info: '--prism-info',

  // Scrollbar
  scrollbar: '--prism-scrollbar',
  scrollbarHover: '--prism-scrollbar-hover',

  // Radius
  radius: '--prism-radius',
  radiusMd: '--prism-radius-md',
  radiusLg: '--prism-radius-lg',

  // Phase colors
  blue: '--prism-blue',
  teal: '--prism-teal',
  green: '--prism-green',
  amber: '--prism-amber',
  purple: '--prism-purple',
  red: '--prism-red',

  // Phase semantics
  phaseIdle: '--prism-phase-idle',
  phaseResearch: '--prism-phase-research',
  phasePlan: '--prism-phase-plan',
  phaseImplement: '--prism-phase-implement',
  phaseValidate: '--prism-phase-validate',
  phaseTransition: '--prism-phase-transition',

  // Muted phase variants
  blueMuted: '--prism-blue-muted',
  tealMuted: '--prism-teal-muted',
  greenMuted: '--prism-green-muted',
  amberMuted: '--prism-amber-muted',
  purpleMuted: '--prism-purple-muted',

  // Gradients
  gradient: '--prism-gradient',
  gradientVertical: '--prism-gradient-vertical',
} as const;

export type PrismToken = typeof PRISM_TOKENS[keyof typeof PRISM_TOKENS];

/** Platform identifiers for data-platform attribute */
export type PrismPlatform = 'vscode' | 'electron';
