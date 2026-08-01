/**
 * WindowControls
 *
 * Purpose: Self-drawn window control buttons (minimize / maximize-restore /
 * close) for platforms whose native chrome is hidden — Windows (undecorated
 * windows, self-drawn title bar) renders these; macOS keeps the native
 * traffic lights, so this component renders nothing there.
 *
 * The buttons use the Tauri window API directly. The close button follows the
 * app's quit-confirmation flow via the existing `request_quit` command rather
 * than the raw `close()` so unsaved-changes prompts still run.
 *
 * @coordinates-with components/TitleBar — the document title bar hosts these
 * @coordinates-with pages/Settings — the settings window hosts these
 * @module components/WindowControls
 */

import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { isWindowsPlatform } from "@/utils/platform";
import "./window-controls.css";

export function WindowControls() {
  // Re-render on maximize state so the maximize button toggles to restore.
  const [maximized, setMaximized] = useState(false);
  const win = getCurrentWindow();

  // Refresh the maximize glyph whenever it changes (system-triggered too).
  // Hooks run unconditionally (Rules of Hooks); the platform gate only
  // decides whether anything renders.
  useEffect(() => {
    if (!isWindowsPlatform()) return;
    let disposed = false;
    let unlisten: (() => void) | null = null;
    void win.isMaximized().then((m) => {
      if (!disposed) setMaximized(m);
    });
    void win.onResized(() => {
      void win.isMaximized().then((m) => {
        if (!disposed) setMaximized(m);
      });
    }).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [win]);

  if (!isWindowsPlatform()) return null;

  const onMinimize = () => {
    void win.minimize();
  };
  const onToggleMaximize = () => {
    void win.toggleMaximize().then(() => win.isMaximized().then(setMaximized));
  };
  const onClose = () => {
    // Route through the coordinated quit flow (unsaved-changes prompts).
    void invoke("request_quit");
  };

  return (
    <div className="window-controls" aria-label="Window controls">
      <button
        type="button"
        className="window-controls__btn"
        aria-label="Minimize"
        onClick={onMinimize}
      >
        <svg viewBox="0 0 10 10" aria-hidden="true">
          <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
      <button
        type="button"
        className="window-controls__btn"
        aria-label={maximized ? "Restore" : "Maximize"}
        onClick={onToggleMaximize}
      >
        {maximized ? (
          <svg viewBox="0 0 10 10" aria-hidden="true">
            <rect x="0.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M2.5 2.5 V0.5 H9.5 V7.5 H7.5" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 10 10" aria-hidden="true">
            <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        )}
      </button>
      <button
        type="button"
        className="window-controls__btn window-controls__btn--close"
        aria-label="Close"
        onClick={onClose}
      >
        <svg viewBox="0 0 10 10" aria-hidden="true">
          <line x1="0.5" y1="0.5" x2="9.5" y2="9.5" stroke="currentColor" strokeWidth="1" />
          <line x1="9.5" y1="0.5" x2="0.5" y2="9.5" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
    </div>
  );
}
