//! # Window Manager
//!
//! Purpose: Creates and manages Tauri webview windows (document, settings,
//! transfer) and owns the Finder/CLI file-open decision state.
//!
//! Pipeline: Menu/dock/CLI/Finder actions → functions here → `WebviewWindowBuilder` →
//! new OS window with the React frontend.
//!
//! Module map (one responsibility each, split from the former single file):
//!
//! | Module | Owns |
//! |---|---|
//! | `file_open_state` | Finder/CLI open decisions, pending queue, workspace grouping |
//! | `document_windows` | Document/main window construction, URLs, labels, dock-reopen pick |
//! | `path_validation` | Security gates for frontend-supplied paths / workspace roots |
//! | `commands` | `open_*_in_new_window`, `close_window`, quit commands |
//! | `settings_window` | Settings window singleton (create / focus / navigate) |
//! | `native_theme` | Keeps macOS OS-drawn chrome (title bar, menu bar) on the in-app theme |
//! | `strip_caption` (top-level, Windows) | Removes WS_CAPTION/SYSMENU/min-max from undecorated windows |
//!
//! Key decisions:
//!   - Windows windows are created undecorated (per-platform config) and
//!     `strip_caption` removes the residual caption styles that tao's
//!     `decorations(false)` leaves on top-level windows.
//!
//! Everything is re-exported here so call sites keep using
//! `crate::window_manager::...` (and `lib.rs`'s `generate_handler!` paths
//! keep resolving — glob re-exports carry the `#[tauri::command]` macros).
//!
//! Known limitations:
//!   - Window counter is process-global (AtomicU32); labels are not recycled.

// Finder/dock-reopen helpers + the macOS-only settings `window` binding are
// compiled everywhere but only used on macOS; silence the off-macOS lints.
#![cfg_attr(not(target_os = "macos"), allow(dead_code, unused_variables))]

mod commands;
mod document_windows;
mod file_open_state;
mod native_theme;
mod path_validation;
mod settings_window;

pub use commands::*;
pub use document_windows::*;
pub use file_open_state::*;
pub use native_theme::*;
pub use settings_window::*;

/// Strip the caption/sysmenu/min-max box styles from a Windows HWND.
///
/// tao 0.35's `decorations(false)` does not remove `WS_CAPTION` on top-level
/// windows (it only does so for CHILD windows), so a config-declared
/// undecorated window still gets an OS title bar. This applies the classic
/// undecorated style set directly:
///   - remove WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX
///   - keep WS_THICKFRAME so tao's WM_NCHITTEST edge-resize still works
///   - SWP_FRAMECHANGED forces the frame to redraw
#[cfg(target_os = "windows")]
pub fn strip_caption(hwnd: *mut core::ffi::c_void) -> Result<(), String> {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetWindowLongW, SetWindowLongW, SetWindowPos, GWL_STYLE, SWP_FRAMECHANGED, SWP_NOACTIVATE,
        SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, WS_CAPTION, WS_MAXIMIZEBOX, WS_MINIMIZEBOX,
        WS_SYSMENU,
    };

    if hwnd.is_null() {
        return Err("null HWND".to_string());
    }
    let style = unsafe { GetWindowLongW(hwnd, GWL_STYLE) };
    let new_style = style & !(WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX) as i32;
    if new_style == style {
        return Ok(()); // already undecorated
    }
    let result = unsafe { SetWindowLongW(hwnd, GWL_STYLE, new_style) };
    if result == 0 {
        return Err("SetWindowLongW failed".to_string());
    }
    // Force the non-client area to recompute with the new style.
    let ok = unsafe {
        SetWindowPos(
            hwnd,
            std::ptr::null_mut(),
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
        )
    };
    if ok == 0 {
        return Err("SetWindowPos failed".to_string());
    }
    Ok(())
}

#[cfg(test)]
#[path = "mod.test.rs"]
mod tests;
