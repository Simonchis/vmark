/**
 * useMenuTree — fetch the native menu tree for the frontend title-bar menu.
 *
 * Purpose: Windows renders no native menu bar (self-drawn chrome); the
 * frontend menu bar renders the serialized native menu tree. Labels arrive
 * already localized (rust-i18n) and accelerators come from the applied
 * baseline, so the frontend needs no parallel translation table.
 *
 * The tree is re-fetched on demand (menu open) and after a menu rebuild —
 * dynamic submenus (recent files, genies) and state sync (checkmarks,
 * enabled) stay correct via a fresh snapshot. No push channel needed.
 *
 * @coordinates-with menu/commands.rs (Rust) — get_menu_tree serialization
 * @module hooks/useMenuTree
 */

import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { menuError } from "@/utils/debug";

/** One serialized menu node (mirrors Rust `menu::tree::MenuNode`). */
export interface MenuTreeNode {
  id?: string;
  text?: string;
  accelerator?: string;
  enabled: boolean;
  checked: boolean;
  children?: MenuTreeNode[];
  isSubmenu: boolean;
}

/** Refresh triggers: a rebuild swaps the tree wholesale. */
const TREE_CHANGED_EVENT = "menu:tree-changed";

/**
 * Load the menu tree; re-fetches when `refreshKey` changes or a rebuild
 * event fires. `enabled` is false until the first successful fetch so the
 * menu bar renders disabled (no flash of empty items).
 */
export function useMenuTree(refreshKey: string | number | undefined): {
  tree: MenuTreeNode[];
  refresh: () => Promise<void>;
} {
  const [tree, setTree] = useState<MenuTreeNode[]>([]);

  const refresh = useCallback(async () => {
    try {
      setTree(await invoke<MenuTreeNode[]>("get_menu_tree"));
    } catch (err) {
      menuError("Failed to load menu tree:", err);
      setTree([]);
    }
  }, []);

  useEffect(() => {
    // Legitimate: the menu tree is fetched from the native menu (external
    // system) on mount and on rebuild events — not derivable during render.
    // Same pattern as useMcpServer.refresh (#1063).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh, refreshKey]);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    let cancelled = false;
    void listen(TREE_CHANGED_EVENT, () => {
      if (!cancelled) void refresh();
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [refresh]);

  return { tree, refresh };
}

/** Native edit commands muda would fire as system keyboard events (Windows
 *  predefined menu items). The frontend menu routes them through
 *  `document.execCommand`, which targets the focused editor surface the same
 *  way Ctrl+C/V/X/A do. */
const EDIT_COMMANDS = new Set(["cut", "copy", "paste", "select-all"]);

/**
 * Click a menu item: route through Rust's shared dispatch (`menu_click`),
 * which handles quit/new-window/recent-file/preferences in Rust and emits
 * `menu:{id}` to the focused document window for everything else.
 *
 * Native edit commands (cut/copy/paste/select-all) never reach Rust — muda
 * would fire them as system keyboard events on a native menu click, so we
 * replicate that here against the focused surface.
 */
export function clickMenuId(id: string): void {
  if (EDIT_COMMANDS.has(id)) {
    const cmd = id === "select-all" ? "selectAll" : id;
    document.execCommand(cmd as "cut" | "copy" | "paste" | "selectAll");
    return;
  }
  void invoke("menu_click", { id }).catch((err) =>
    menuError(`menu_click('${id}') failed:`, err),
  );
}
