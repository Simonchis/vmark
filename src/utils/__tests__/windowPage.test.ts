import { describe, expect, it } from "vitest";

import { pickWindowPage, PDF_EXPORT_PAGE_LABEL, SETTINGS_PAGE_LABEL } from "../windowPage";

describe("pickWindowPage", () => {
  it("routes the settings label to the settings page", () => {
    expect(pickWindowPage(SETTINGS_PAGE_LABEL)).toBe("settings");
  });

  it("routes the pdf-export label to the pdf-export page", () => {
    expect(pickWindowPage(PDF_EXPORT_PAGE_LABEL)).toBe("pdf-export");
  });

  it("routes the main window to the main layout", () => {
    expect(pickWindowPage("main")).toBe("main");
  });

  it("routes document windows (doc-*) to the main layout", () => {
    expect(pickWindowPage("doc-1")).toBe("main");
    expect(pickWindowPage("doc-42")).toBe("main");
  });

  it("routes unknown utility windows to the main layout", () => {
    expect(pickWindowPage("workflow-viewer")).toBe("main");
  });

  it("routes an undefined label to the main layout (defensive default)", () => {
    expect(pickWindowPage(undefined)).toBe("main");
  });
});
