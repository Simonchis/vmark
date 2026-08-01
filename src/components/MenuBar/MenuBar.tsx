/**
 * MenuBar — the frontend title-bar menu (Windows self-drawn chrome).
 *
 * Purpose: Windows renders no native menu bar; the top-level menu items
 * (File, Edit, Format, …) live here in the title bar, rendered from the
 * serialized native menu tree (`useMenuTree`). Clicking a top-level button
 * opens a dropdown; clicking an item routes through `menu_click` → Rust's
 * shared dispatch (native semantics: quit, recent files, preferences, and
 * `menu:{id}` events for everything else).
 *
 * Keyboard: Left/Right move across top-level buttons, Down opens the active
 * menu, Up/Down move within the dropdown, Enter activates, Escape closes.
 *
 * @coordinates-with hooks/useMenuTree — tree fetch + click routing
 * @module components/MenuBar
 */

import { useEffect, useRef, useState } from "react";
import { useMenuTree, clickMenuId, type MenuTreeNode } from "@/hooks/useMenuTree";
import { isWindowsPlatform } from "@/utils/platform";
import "./menu-bar.css";

interface MenuBarProps {
  /** Bump to re-fetch the tree (e.g. after a locale change). */
  refreshKey?: string | number;
}

export function MenuBar({ refreshKey }: MenuBarProps) {
  const { tree, refresh } = useMenuTree(refreshKey);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  // Close on outside click or Escape.
  useEffect(() => {
    if (openIndex === null) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpenIndex(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenIndex(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openIndex]);

  // Tauri emits no menu:tree-changed on dynamic updates; refresh when the
  // dropdown opens so recent-files/genies lists are fresh.
  useEffect(() => {
    if (openIndex !== null) void refresh();
  }, [openIndex, refresh]);

  if (!isWindowsPlatform()) return null;
  if (tree.length === 0) return null;

  const handleTopKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      setFocusedIndex((i) => Math.min(i + 1, tree.length - 1));
      e.preventDefault();
    } else if (e.key === "ArrowLeft") {
      setFocusedIndex((i) => Math.max(i - 1, 0));
      e.preventDefault();
    } else if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      setOpenIndex(focusedIndex);
      e.preventDefault();
    }
  };

  return (
    <div
      ref={rootRef}
      className="menu-bar"
      role="menubar"
      aria-label="Application menu"
      onKeyDown={handleTopKeyDown}
    >
      {tree.map((node, index) => (
        <MenuBarItem
          key={node.id ?? index}
          node={node}
          index={index}
          focused={focusedIndex === index}
          open={openIndex === index}
          onFocus={() => setFocusedIndex(index)}
          onOpen={() => setOpenIndex(openIndex === index ? null : index)}
          onClose={() => setOpenIndex(null)}
        />
      ))}
    </div>
  );
}

function MenuBarItem({
  node,
  index,
  focused,
  open,
  onFocus,
  onOpen,
  onClose,
}: {
  node: MenuTreeNode;
  index: number;
  focused: boolean;
  open: boolean;
  onFocus: () => void;
  onOpen: () => void;
  onClose: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hasText = Boolean(node.text);

  // Move focus into the dropdown once opened.
  useEffect(() => {
    if (open) onFocus();
  }, [open, onFocus]);

  if (!hasText) return null;

  return (
    <div className="menu-bar__item" role="none">
      <button
        ref={buttonRef}
        type="button"
        role="menuitem"
        className="vm-btn"
        data-menu-trigger
        data-open={open ? "" : undefined}
        disabled={!node.enabled}
        aria-haspopup="menu"
        aria-expanded={open}
        tabIndex={focused ? 0 : -1}
        onMouseEnter={onFocus}
        onFocus={onFocus}
        onClick={onOpen}
        data-menu-index={index}
      >
        {node.text}
      </button>
      {open && node.children && (
        <MenuDropdown
          key={`${node.id}-${open ? "open" : "closed"}`}
          items={node.children}
          onActivate={() => onClose()}
          onClose={onClose}
        />
      )}
    </div>
  );
}

function MenuDropdown({
  items,
  onActivate,
  onClose,
}: {
  items: MenuTreeNode[];
  onActivate: () => void;
  onClose: () => void;
}) {
  const [active, setActive] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const focusVisible = items.filter((i) => i.text && i.enabled);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      setActive((a) => Math.min(a + 1, items.length - 1));
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setActive((a) => Math.max(a - 1, 0));
      e.preventDefault();
    } else if (e.key === "Escape") {
      onClose();
      e.preventDefault();
    } else if (e.key === "Enter") {
      const item = items[active];
      if (item?.id && item.enabled) {
        clickMenuId(item.id);
        onActivate();
      }
      e.preventDefault();
    }
  };

  // Refocus the active item so screen readers announce it.
  useEffect(() => {
    const el = menuRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.focus();
  }, [active]);

  return (
    <div
      ref={menuRef}
      role="menu"
      className="menu-bar__dropdown"
      onKeyDown={handleKeyDown}
      onMouseLeave={() => setActive(0)}
    >
      {items.map((item, index) => {
        if (!item.text) {
          return <div key={`sep-${index}`} role="separator" className="menu-bar__separator" />;
        }
        return (
          <button
            key={item.id ?? index}
            type="button"
            role="menuitem"
            data-index={index}
            className={[
              "menu-bar__menuitem",
              active === index ? "menu-bar__menuitem--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            disabled={!item.enabled}
            tabIndex={-1}
            onMouseEnter={() => setActive(index)}
            onFocus={() => setActive(index)}
            onClick={() => {
              if (item.id) {
                clickMenuId(item.id);
                onActivate();
              }
            }}
          >
            <span className="menu-bar__menuitem-label">
              {item.checked ? "✓ " : ""}
              {item.text}
            </span>
            {item.accelerator && (
              <span className="menu-bar__accelerator">{formatAccelerator(item.accelerator)}</span>
            )}
          </button>
        );
      })}
      {focusVisible.length === 0 && (
        <div className="menu-bar__empty">—</div>
      )}
    </div>
  );
}

/** Convert a Tauri accelerator (e.g. `CmdOrCtrl+Shift+N`) to a display string. */
function formatAccelerator(accel: string): string {
  return accel
    .replace(/CmdOrCtrl/g, "Ctrl")
    .replace(/Cmd/g, "⌘")
    .replace(/Alt/g, "Alt")
    .replace(/Shift/g, "Shift")
    .replace(/\+/g, " + ");
}
