//! Tests for `settings_window.rs` (included via `#[path]`).
//!
//! `show_settings_window_section` itself needs a live Tauri runtime, so what
//! is covered here is the pure part it delegates to: turning an optional
//! section into the URL the Settings window is built with. That URL is the
//! one difference between the two Settings entry points (#1141), so it is
//! worth pinning down exactly.
//!
//! The window is routed by its **label** in the frontend (see
//! `utils/windowPage.ts`), so the URL only needs to serve `index.html` (at
//! `/`) and carry the optional `section` query param. Tauri's production
//! asset protocol rewrites non-file paths back to `/`, so we serve `/`
//! directly to keep the query string intact in packaged builds.

use super::*;

#[test]
fn no_section_is_the_root_route() {
    assert_eq!(settings_url(None), "/");
}

#[test]
fn section_becomes_a_query_param_on_root() {
    assert_eq!(
        settings_url(Some("integrations")),
        "/?section=integrations"
    );
}

/// Every section the frontend's `validSections` accepts must survive the
/// round trip unescaped — they are all plain lowercase words, so a section
/// that comes back percent-mangled means the encoder was applied too broadly.
#[test]
fn known_sections_round_trip_unescaped() {
    for section in [
        "about",
        "appearance",
        "editor",
        "files",
        "formats",
        "integrations",
        "language",
        "markdown",
        "shortcuts",
        "terminal",
        "advanced",
    ] {
        assert_eq!(
            settings_url(Some(section)),
            format!("/?section={section}"),
            "section `{section}` should not be escaped"
        );
    }
}

/// A section carrying reserved URL characters must not be able to smuggle in
/// extra query params or a fragment.
#[test]
fn reserved_characters_are_percent_encoded() {
    let url = settings_url(Some("a&b=c#d?e"));
    assert!(
        !url.contains('&') && !url.contains('#'),
        "reserved chars must be encoded, got {url}"
    );
    assert_eq!(url, "/?section=a%26b%3Dc%23d%3Fe");
}

#[test]
fn spaces_and_unicode_are_encoded() {
    assert_eq!(settings_url(Some("a b")), "/?section=a%20b");
    assert_eq!(
        settings_url(Some("中文")),
        "/?section=%E4%B8%AD%E6%96%87"
    );
}

/// The command filters empty sections to `None` before calling through, but
/// the builder should still be well-behaved if one arrives: an empty query
/// value must not corrupt the root route.
#[test]
fn empty_section_stays_on_the_root_route() {
    let url = settings_url(Some(""));
    assert!(
        url.starts_with("/?section="),
        "route must stay on / with a section query, got {url}"
    );
}
