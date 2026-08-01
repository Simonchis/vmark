/**
 * MenuBar — frontend title-bar menu (Windows self-drawn chrome).
 *
 * Tests:
 *   - Windows-only rendering (returns null elsewhere)
 *   - Top-level buttons render from the serialized tree
 *   - Clicking a menu item routes through menu_click
 *   - Keyboard: Escape closes, Enter activates
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MenuBar } from "./MenuBar";

const platform = vi.hoisted(() => ({ isWindows: true }));
vi.mock("@/utils/platform", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/platform")>()),
  isWindowsPlatform: () => platform.isWindows,
}));

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

// A minimal serialized tree mirroring the Rust MenuNode shape.
const TREE = [
  {
    id: "file-menu",
    text: "File",
    enabled: true,
    checked: false,
    isSubmenu: true,
    children: [
      { id: "new", text: "New", enabled: true, checked: false, isSubmenu: false },
      { id: null, text: null, enabled: false, checked: false, isSubmenu: false },
      { id: "save", text: "Save", accelerator: "CmdOrCtrl+S", enabled: true, checked: false, isSubmenu: false },
      { id: "quit", text: "Quit", enabled: true, checked: false, isSubmenu: false },
    ],
  },
  {
    id: "edit-menu",
    text: "Edit",
    enabled: true,
    checked: false,
    isSubmenu: true,
    children: [
      { id: "undo", text: "Undo", enabled: false, checked: false, isSubmenu: false },
    ],
  },
] as never[];

beforeEach(() => {
  platform.isWindows = true;
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(TREE);
});

describe("MenuBar", () => {
  it("renders nothing on non-Windows platforms", () => {
    platform.isWindows = false;
    const { container } = render(<MenuBar />);
    expect(container.firstChild).toBeNull();
  });

  it("renders top-level menu buttons from the tree", async () => {
    render(<MenuBar />);
    expect(await screen.findByRole("menubar")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "File" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
  });

  it("opens the dropdown on click and renders items with accelerators", async () => {
    render(<MenuBar />);
    fireEvent.click(await screen.findByRole("menuitem", { name: "File" }));
    expect(screen.getByRole("menuitem", { name: /New/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Save/ })).toBeInTheDocument();
    expect(screen.getByText("Ctrl + S")).toBeInTheDocument();
  });

  it("renders separators between items", async () => {
    render(<MenuBar />);
    fireEvent.click(await screen.findByRole("menuitem", { name: "File" }));
    expect(screen.getAllByRole("separator")).toHaveLength(1);
  });

  it("routes an item click through menu_click with its id", async () => {
    render(<MenuBar />);
    fireEvent.click(await screen.findByRole("menuitem", { name: "File" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Quit" }));
    expect(invokeMock).toHaveBeenCalledWith("menu_click", { id: "quit" });
  });

  it("does not activate disabled items", async () => {
    render(<MenuBar />);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    const undo = screen.getByRole("menuitem", { name: /Undo/ });
    expect(undo).toBeDisabled();
    fireEvent.click(undo);
    // The dropdown open re-fetches the tree (get_menu_tree); a disabled item
    // must not route a menu_click.
    expect(invokeMock).not.toHaveBeenCalledWith("menu_click", expect.anything());
  });

  it("closes the dropdown on Escape", async () => {
    render(<MenuBar />);
    fireEvent.click(await screen.findByRole("menuitem", { name: "File" }));
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes the dropdown on outside pointerdown", async () => {
    render(<MenuBar />);
    fireEvent.click(await screen.findByRole("menuitem", { name: "File" }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
