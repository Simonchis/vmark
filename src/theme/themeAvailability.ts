/**
 * Which themes a platform can actually offer.
 *
 * Purpose: macOS and Windows draw their own window chrome (overlay title bar
 * with hidden native bar, and undecorated windows respectively), so every
 * theme in the catalog is renderable and the full set is offered. Linux and
 * other platforms still use the OS-drawn title bar, and the only choice the
 * OS accepts is light or dark. A sepia or mint theme there therefore has no
 * matching chrome available at any price — the window would always be
 * half-themed. Those platforms are limited to one light theme and one dark
 * theme, each of which maps exactly onto what the OS can render.
 *
 * Key decisions:
 *   - Coercion preserves *polarity*. Someone who chose sepia (light) and moves
 *     to Linux gets white, not night — settings sync between machines must
 *     not flip a user from light to dark.
 *   - Pure and platform-agnostic: callers pass `isMac`/`isWindows`, so this
 *     stays testable without stubbing `navigator`.
 *
 * @coordinates-with hooks/useEffectiveTheme.ts — coerces the resolved theme
 * @coordinates-with pages/settings/AppearanceSettings.tsx — filters the swatches
 * @module theme/themeAvailability
 */

import { themes } from "./themes";
import type { ThemeId } from "./themes";

/** The light/dark pair offered on platforms with OS-drawn chrome. */
export const NON_MAC_THEME_IDS: readonly ThemeId[] = Object.freeze([
  "white",
  "night",
] as ThemeId[]);

/**
 * Themes the theme picker should offer on this platform. Platforms with
 * self-drawn window chrome (macOS overlay, Windows undecorated) can render
 * the full catalog.
 */
export function selectableThemeIds(isMac: boolean, isWindows = false): ThemeId[] {
  if (isMac || isWindows) return Object.keys(themes) as ThemeId[];
  // Copies the branch so a caller mutating the result cannot corrupt the
  // frozen constant.
  return [...NON_MAC_THEME_IDS];
}

/**
 * Map a stored theme onto one this platform can render.
 *
 * Unknown ids fall back to white rather than throwing: corrupted persisted
 * settings are a real case, and the theme layer already treats them as
 * recoverable.
 */
export function coerceThemeId(id: ThemeId, isMac: boolean, isWindows = false): ThemeId {
  if (isMac || isWindows) return id;
  if (NON_MAC_THEME_IDS.includes(id)) return id;
  return themes[id]?.isDark ? "night" : "white";
}
