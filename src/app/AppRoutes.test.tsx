/**
 * Tests for AppRoutes label-based routing.
 *
 * Tauri's production asset protocol rewrites non-file paths (e.g. /settings)
 * back to /, so routing is by window label, not URL path (see
 * utils/windowPage.ts). Every page is lazy; the chunks are mocked here so the
 * editor dependency tree is not pulled into the coverage denominator.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mockLabel = vi.hoisted(() => ({ current: "main" }));

vi.mock("@/contexts/WindowContext", () => ({
  useWindowLabel: () => mockLabel.current,
}));

vi.mock("@/pages/Settings", () => ({
  SettingsPage: () => <div data-testid="settings-page" />,
}));
vi.mock("@/pages/PdfExportPage", () => ({
  PdfExportPage: () => <div data-testid="pdf-export-page" />,
}));
vi.mock("./MainLayout", () => ({
  MainLayout: () => <div data-testid="main-route" />,
}));

import { AppRoutes } from "./AppRoutes";

describe("AppRoutes — label-based routing", () => {
  beforeEach(() => {
    mockLabel.current = "main";
  });

  it("renders the settings page for the settings window label", async () => {
    mockLabel.current = "settings";
    render(
      <MemoryRouter>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(await screen.findByTestId("settings-page")).toBeInTheDocument();
    expect(screen.queryByTestId("pdf-export-page")).not.toBeInTheDocument();
    expect(screen.queryByTestId("main-route")).not.toBeInTheDocument();
  });

  it("renders the pdf-export page for the pdf-export window label", async () => {
    mockLabel.current = "pdf-export";
    render(
      <MemoryRouter>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(await screen.findByTestId("pdf-export-page")).toBeInTheDocument();
    expect(screen.queryByTestId("settings-page")).not.toBeInTheDocument();
  });

  it("renders the main route for the main window label", async () => {
    mockLabel.current = "main";
    render(
      <MemoryRouter>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(await screen.findByTestId("main-route")).toBeInTheDocument();
    expect(screen.queryByTestId("settings-page")).not.toBeInTheDocument();
  });

  it("renders the main route for a document window label (doc-*)", async () => {
    mockLabel.current = "doc-7";
    render(
      <MemoryRouter>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(await screen.findByTestId("main-route")).toBeInTheDocument();
  });
});
