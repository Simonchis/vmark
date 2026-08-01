/**
 * WindowControls — Windows self-drawn window control buttons.
 *
 * Tests:
 *   - Windows-only rendering (null elsewhere)
 *   - Minimize / maximize-restore / close route to the right APIs
 *   - Close goes through the coordinated request_quit flow
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WindowControls } from "./WindowControls";

const platform = vi.hoisted(() => ({ isWindows: true }));
vi.mock("@/utils/platform", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/platform")>()),
  isWindowsPlatform: () => platform.isWindows,
}));

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

const winMock = vi.hoisted(() => ({
  minimize: vi.fn(),
  toggleMaximize: vi.fn().mockResolvedValue(undefined),
  isMaximized: vi.fn().mockResolvedValue(false),
  onResized: vi.fn().mockResolvedValue(() => {}),
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => winMock,
}));

beforeEach(() => {
  platform.isWindows = true;
  invokeMock.mockReset();
  winMock.minimize.mockReset();
  winMock.toggleMaximize.mockReset().mockResolvedValue(undefined);
  winMock.isMaximized.mockReset().mockResolvedValue(false);
  winMock.onResized.mockReset().mockResolvedValue(() => {});
});

describe("WindowControls", () => {
  it("renders nothing on non-Windows platforms", () => {
    platform.isWindows = false;
    const { container } = render(<WindowControls />);
    expect(container.firstChild).toBeNull();
  });

  it("renders minimize, maximize, and close buttons", () => {
    render(<WindowControls />);
    expect(screen.getByRole("button", { name: "Minimize" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Maximize" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("minimize calls the window minimize API", () => {
    render(<WindowControls />);
    fireEvent.click(screen.getByRole("button", { name: "Minimize" }));
    expect(winMock.minimize).toHaveBeenCalledTimes(1);
  });

  it("maximize toggles and flips the glyph to restore", async () => {
    render(<WindowControls />);
    fireEvent.click(screen.getByRole("button", { name: "Maximize" }));
    expect(winMock.toggleMaximize).toHaveBeenCalledTimes(1);
    // The toggle resolves; isMaximized() is re-read to flip the glyph.
    await waitFor(() => expect(winMock.isMaximized).toHaveBeenCalled());
  });

  it("close routes through the coordinated request_quit flow", () => {
    render(<WindowControls />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(invokeMock).toHaveBeenCalledWith("request_quit");
  });
});
