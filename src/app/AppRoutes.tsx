/**
 * Window-level routing.
 *
 * Routing is **label-based**, not URL-path-based: Tauri's production asset
 * protocol rewrites non-file paths (e.g. `/settings`) back to `/` when
 * serving `index.html`, so `BrowserRouter` cannot distinguish a settings
 * window from the main window by path. The window label is set at creation
 * and is stable, so it is the reliable discriminator (see
 * `utils/windowPage.ts`).
 *
 * Every page is lazy-loaded so that importing this module (and therefore
 * `App.tsx`) does not pull the editor dependency tree into windows that do
 * not need it.
 *
 * @module app/AppRoutes
 */

import { lazy, Suspense, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Routes, Route } from "react-router-dom";
import { FeatureErrorBoundary } from "@/components/FeatureErrorBoundary";
import { useWindowLabel } from "@/contexts/WindowContext";
import { pickWindowPage } from "@/utils/windowPage";

const SettingsPage = lazy(() =>
  import("@/pages/Settings").then((m) => ({ default: m.SettingsPage })),
);
const PdfExportPage = lazy(() =>
  import("@/pages/PdfExportPage").then((m) => ({ default: m.PdfExportPage })),
);
const MainLayout = lazy(() => import("./MainLayout").then((m) => ({ default: m.MainLayout })));

/** Lazy page wrapped in its feature error boundary + suspense. */
function PageBoundary({ feature, children }: { feature: string; children: ReactNode }) {
  return (
    <FeatureErrorBoundary feature={feature}>
      <Suspense fallback={null}>{children}</Suspense>
    </FeatureErrorBoundary>
  );
}

export function AppRoutes() {
  const { t } = useTranslation("dialog");
  const page = pickWindowPage(useWindowLabel());
  if (page === "settings") {
    return <PageBoundary feature={t("errorBoundary.feature.settings")}><SettingsPage /></PageBoundary>;
  }
  if (page === "pdf-export") {
    return <PageBoundary feature={t("errorBoundary.feature.pdfExport")}><PdfExportPage /></PageBoundary>;
  }
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Suspense fallback={null}>
            <MainLayout />
          </Suspense>
        }
      />
    </Routes>
  );
}
