/**
 * Decide which top-level page a window renders.
 *
 * Routing is **label-based**, not URL-path-based: Tauri's production asset
 * protocol rewrites unknown paths (e.g. `/settings`) back to `/` when serving
 * `index.html`, so `BrowserRouter` cannot distinguish a settings window from
 * the main window by path. The window label is set at creation and is stable,
 * so it is the reliable discriminator.
 *
 * @module utils/windowPage
 */

export type WindowPage = "main" | "settings" | "pdf-export";

/** Window labels that render the settings page. */
export const SETTINGS_PAGE_LABEL = "settings";

/** Window labels that render the PDF-export page. */
export const PDF_EXPORT_PAGE_LABEL = "pdf-export";

/**
 * Pick the page to render for a window label.
 *
 * - `"settings"` → settings page
 * - `"pdf-export"` → PDF-export page
 * - anything else (`"main"`, `"doc-*"`, `undefined`) → main layout
 */
export function pickWindowPage(windowLabel: string | undefined): WindowPage {
  if (windowLabel === SETTINGS_PAGE_LABEL) return "settings";
  if (windowLabel === PDF_EXPORT_PAGE_LABEL) return "pdf-export";
  return "main";
}
