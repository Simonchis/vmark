/**
 * useMenuTree — fetch the serialized native menu tree.
 *
 * Tests:
 *   - Loads the tree via get_menu_tree on mount
 *   - Re-fetches when refreshKey changes
 *   - Re-fetches on the menu:tree-changed event
 *   - Handles fetch failure by rendering an empty tree
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useMenuTree, clickMenuId } from "./useMenuTree";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

const listeners = vi.hoisted(() => new Map<string, (e: unknown) => void>());
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((event: string, handler: (e: unknown) => void) => {
    listeners.set(event, handler);
    return Promise.resolve(() => listeners.delete(event));
  }),
}));

const TREE = [{ id: "file-menu", text: "File", enabled: true, checked: false, isSubmenu: true, children: [] }];

beforeEach(() => {
  invokeMock.mockReset();
  listeners.clear();
});

describe("useMenuTree", () => {
  it("loads the tree on mount", async () => {
    invokeMock.mockResolvedValue(TREE);
    const { result } = renderHook(() => useMenuTree(undefined));
    expect(invokeMock).toHaveBeenCalledWith("get_menu_tree");
    await waitFor(() => expect(result.current.tree).toEqual(TREE));
  });

  it("re-fetches when refreshKey changes", async () => {
    invokeMock.mockResolvedValue(TREE);
    const { rerender } = renderHook((props: { k?: number }) => useMenuTree(props.k), {
      initialProps: { k: 1 },
    });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
    rerender({ k: 2 });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(2));
  });

  it("re-fetches on the menu:tree-changed event", async () => {
    invokeMock.mockResolvedValue(TREE);
    renderHook(() => useMenuTree(undefined));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
    act(() => {
      listeners.get("menu:tree-changed")?.({ payload: undefined });
    });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(2));
  });

  it("renders an empty tree when the fetch fails", async () => {
    invokeMock.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useMenuTree(undefined));
    await waitFor(() => expect(result.current.tree).toEqual([]));
  });

  it("manual refresh re-fetches", async () => {
    invokeMock.mockResolvedValue(TREE);
    const { result } = renderHook(() => useMenuTree(undefined));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
    act(() => {
      void result.current.refresh();
    });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(2));
  });
});

describe("clickMenuId", () => {
  it("invokes menu_click with the id", () => {
    invokeMock.mockResolvedValue(undefined);
    clickMenuId("save");
    expect(invokeMock).toHaveBeenCalledWith("menu_click", { id: "save" });
  });
});
