//! Tests for `menu/tree.rs` — menu tree serialization + click routing.
//!
//! `serialize_menu_tree` walks the live Tauri menu, which needs a real
//! `AppHandle<Wry>` — not available under `tauri::test::MockRuntime`
//! (and the mock runtime binary itself is broken on Windows:
//! STATUS_ENTRYPOINT_NOT_FOUND, see Cargo.toml). The serialization mapping
//! is therefore exercised on non-Windows targets with a mock app whose menu
//! is built through the same `create_localized_menu` path the app uses.
//!
//! `handle_menu_id` (the click router shared with the native menu) is pure
//! classification + existing dispatch — covered by
//! `menu_events_dispatch.test.rs`.

#[cfg(not(target_os = "windows"))]
mod serialization {
    use super::super::*;

    /// Build a mock app with the real localized menu installed, then verify
    /// the serialized tree mirrors the top-level structure: one node per
    /// top-level menu, each a submenu with children, ids present.
    fn menu_tree() -> Vec<MenuNode> {
        let app = tauri::test::mock_builder()
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .expect("mock app");
        let handle = app.handle().clone();
        let menu = crate::menu::localized::create_localized_menu(&handle, None)
            .expect("build localized menu");
        app.set_menu(menu).expect("set menu");
        serialize_menu_tree(&handle).expect("serialize tree")
    }

    #[test]
    fn top_level_nodes_are_submenus_with_children() {
        let tree = menu_tree();
        assert!(!tree.is_empty(), "menu should have top-level entries");
        for node in &tree {
            assert!(node.is_submenu, "top-level entry is a submenu: {node:?}");
            assert!(node.text.is_some(), "submenu has a label");
            let children = node.children.as_ref().expect("submenu has children");
            assert!(!children.is_empty(), "submenu '{:?}' is not empty", node.text);
        }
    }

    #[test]
    fn leaf_items_carry_ids() {
        let tree = menu_tree();
        let file = tree
            .iter()
            .find(|n| n.text.as_deref() == Some("File"))
            .expect("File menu present");
        let children = file.children.as_ref().expect("File has children");
        assert!(
            children.iter().any(|c| c.id.is_some()),
            "File has items with ids: {children:?}"
        );
    }

    #[test]
    fn separators_serialize_without_ids_or_text() {
        // Predefined items (separators) must not confuse the frontend renderer:
        // no id, no text, not a submenu.
        let tree = menu_tree();
        let file = tree
            .iter()
            .find(|n| n.text.as_deref() == Some("File"))
            .expect("File menu present");
        let children = file.children.as_ref().expect("File has children");
        let separators: Vec<&MenuNode> = children.iter().filter(|c| c.id.is_none()).collect();
        assert!(
            !separators.is_empty(),
            "File menu has at least one separator: {children:?}"
        );
        for sep in separators {
            assert!(sep.text.is_none(), "separator has no text");
            assert!(!sep.is_submenu, "separator is not a submenu");
        }
    }
}
