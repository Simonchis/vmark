//! Menu tree serialization for the frontend title-bar menu (Windows).
//!
//! Purpose: Windows renders no native menu bar — the menu lives in the
//! frontend title bar instead (self-drawn chrome, see `window_manager/
//! document_windows.rs`). This module serializes the live native menu tree
//! (labels already localized via rust-i18n) into JSON the frontend can
//! render, and routes a frontend menu click back through the existing
//! dispatch logic (`menu_events_dispatch.rs`).
//!
//! Pipeline: frontend invokes `get_menu_tree` → walk `app.menu()` recursively
//! → `MenuNode` JSON (id, text, accelerator, enabled, checked, children).
//! Frontend click → `menu_click(id)` → `handle_menu_id` (shared with the
//! native click path in `menu_events_dispatch.rs`).
//!
//! Key decisions:
//!   - The serialized tree is a live snapshot — the frontend re-fetches on
//!     demand (menu open) and after every `rebuild_menu`, so dynamic
//!     submenus (recent files, genies) and state sync (checkmarks, enabled)
//!     stay correct without a push channel.
//!   - Accelerator strings come from the accelerator baseline
//!     (`super::accelerators::ACCEL_CACHE`), the single source of truth for
//!     what was applied (custom shortcuts included). Tauri's menu wrapper
//!     exposes no accelerator getter.
//!   - Separators (`PredefinedMenuItem`) serialize as `{ kind: "separator" }`
//!     so the frontend can render dividers.
//!
//! @coordinates-with menu_events_dispatch.rs — `handle_menu_id` shared entry
//! @coordinates-with menu/accelerators.rs — accelerator baseline
//! @module menu/tree

use serde::Serialize;
use tauri::menu::{Menu, MenuItemKind, PredefinedMenuItem};
use tauri::{AppHandle, Wry};
/// One node of the serialized menu tree.
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MenuNode {
    /// Menu item id (`menu:` prefix NOT included — the frontend passes it
    /// back to `menu_click` verbatim). None for separators.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    /// Localized label. None for separators.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    /// Applied accelerator, if any (e.g. `CmdOrCtrl+S`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub accelerator: Option<String>,
    pub enabled: bool,
    /// True for check menu items; carries the current checked state.
    pub checked: bool,
    /// Submenu children. `Some(vec![])` for an empty submenu; `None` for a
    /// leaf item.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<MenuNode>>,
    /// True when the item is a submenu.
    pub is_submenu: bool,
}

/// Serialize the app's menu tree for the frontend title-bar menu.
pub fn serialize_menu_tree(app: &AppHandle) -> Result<Vec<MenuNode>, String> {
    let Some(menu) = app.menu() else {
        // No menu installed (e.g. early startup): render nothing rather than
        // fail — the frontend re-fetches on demand.
        return Ok(Vec::new());
    };
    serialize_menu_items(&menu, app).map_err(|e| e.to_string())
}

/// Serialize a top-level menu's items.
fn serialize_menu_items(menu: &Menu<Wry>, app: &AppHandle) -> tauri::Result<Vec<MenuNode>> {
    let mut nodes = Vec::new();
    for item in menu.items()? {
        nodes.push(serialize_item(&item, app)?);
    }
    Ok(nodes)
}

/// Serialize a submenu's items.
fn serialize_submenu_items(
    submenu: &tauri::menu::Submenu<Wry>,
    app: &AppHandle,
) -> tauri::Result<Vec<MenuNode>> {
    let mut nodes = Vec::new();
    for item in submenu.items()? {
        nodes.push(serialize_item(&item, app)?);
    }
    Ok(nodes)
}

/// Serialize one menu item kind.
fn serialize_item(item: &MenuItemKind<Wry>, app: &AppHandle) -> tauri::Result<MenuNode> {
    match item {
        MenuItemKind::MenuItem(i) => Ok(MenuNode {
            id: Some(i.id().as_ref().to_string()),
            text: Some(i.text()?),
            accelerator: accelerator_for(i.id().as_ref()),
            enabled: i.is_enabled()?,
            checked: false,
            children: None,
            is_submenu: false,
        }),
        MenuItemKind::Check(i) => Ok(MenuNode {
            id: Some(i.id().as_ref().to_string()),
            text: Some(i.text()?),
            accelerator: accelerator_for(i.id().as_ref()),
            enabled: i.is_enabled()?,
            checked: i.is_checked()?,
            children: None,
            is_submenu: false,
        }),
        MenuItemKind::Submenu(s) => Ok(MenuNode {
            id: Some(s.id().as_ref().to_string()),
            text: Some(s.text()?),
            accelerator: None,
            enabled: s.is_enabled()?,
            checked: false,
            children: Some(serialize_submenu_items(s, app)?),
            is_submenu: true,
        }),
        MenuItemKind::Predefined(p) => serialize_predefined(p),
        MenuItemKind::Icon(_) => {
            // Icon items are macOS-only decorations (no label/action); render
            // as separators so the frontend layout stays predictable.
            Ok(MenuNode {
                id: None,
                text: None,
                accelerator: None,
                enabled: false,
                checked: false,
                children: None,
                is_submenu: false,
            })
        }
    }
}

/// Predefined items: separators become divider nodes (no id/text); labeled
/// predefined items (Cut/Copy/Paste/Select All, macOS app-menu items) keep
/// their localized text so the frontend menu renders them like normal items.
///
/// muda assigns these an opaque numeric id; the frontend routes clicks by
/// semantic id, so we map the known edit commands onto stable ids
/// (`cut`/`copy`/`paste`/`select-all`) via their default label. `menu_click`
/// for those ids is handled by the frontend (document.execCommand) — the
/// native menu path never sees them (muda fires system edit commands
/// directly on Windows).
fn serialize_predefined(p: &PredefinedMenuItem<Wry>) -> tauri::Result<MenuNode> {
    let raw_text = p.text()?;
    // Windows mnemonic marker: "&Copy" → "Copy" ("&&" is a literal '&').
    let text = raw_text
        .replace("&&", "\u{0}")
        .replace('&', "")
        .replace('\u{0}', "&");
    let is_separator = raw_text.is_empty();
    Ok(MenuNode {
        id: (!is_separator).then(|| predefined_semantic_id(&raw_text, p.id().as_ref())),
        text: (!is_separator).then_some(text),
        accelerator: None,
        // Predefined items are always enabled (muda creates them enabled and
        // exposes no is_enabled on this wrapper).
        enabled: !is_separator,
        checked: false,
        children: None,
        is_submenu: false,
    })
}

/// Map a muda predefined item onto a stable semantic id. muda's numeric
/// per-process ids can't be routed by the frontend, so the known commands
/// are matched by their default label (muda's own English text — the same
/// text the OS would show). Anything else keeps muda's id (custom
/// `with_id` predefined items are already semantic).
fn predefined_semantic_id(label: &str, numeric_id: &str) -> String {
    match label.replace('&', "").trim() {
        "Copy" => "copy".to_string(),
        "Cut" => "cut".to_string(),
        "Paste" => "paste".to_string(),
        "Select All" => "select-all".to_string(),
        // Windows Quit predefined item ("&Exit"): route to the Rust quit
        // flow (unsaved-changes prompts) via the existing "quit" id.
        "Exit" => "quit".to_string(),
        // Windows Close Window predefined item ("Close").
        "Close" => "close".to_string(),
        _ => numeric_id.to_string(),
    }
}

/// Look up the applied accelerator for a menu id from the baseline cache.
fn accelerator_for(id: &str) -> Option<String> {
    super::accelerators::cached_accelerator(id).filter(|a| !a.is_empty())
}

/// Route a frontend menu-bar click through the shared dispatch logic.
///
/// Mirrors what a native click does: `handle_menu_id` (in
/// `menu_events_dispatch.rs`) classifies the id and either handles it in
/// Rust (quit, new-window, recent-file, preferences…) or emits `menu:{id}`
/// to the focused document window, which the frontend's CommandBus listener
/// already handles.
#[tauri::command]
pub fn menu_click(app: AppHandle, id: String) -> Result<(), String> {
    crate::menu_events::handle_menu_id(&app, &id);
    Ok(())
}

/// Serialize the app menu tree for the frontend title-bar menu.
#[tauri::command]
pub fn get_menu_tree(app: AppHandle) -> Result<Vec<MenuNode>, String> {
    serialize_menu_tree(&app)
}

#[cfg(test)]
#[path = "tree.test.rs"]
mod tests;
