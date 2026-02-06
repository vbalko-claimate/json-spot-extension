# Changelog

All notable changes to JSON Spot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0] - 2026-02-06

### Added
- Page reload detection: popup shows notice when content script isn't injected, with one-click reload button
- Highlight JSON: button in popup temporarily highlights all detected JSON elements with green glow animation (3s fade)
- Element picker: "Pick Element" activates DevTools-like inspector mode — hover to highlight, click to format JSON
- Element picker supports arbitrary elements (`<pre>`, `<code>`, `<div>`) beyond standard textareas/editors
- Success notification variant (green) for positive feedback from picker actions
- Action buttons section in popup for Highlight and Pick features

### Fixed
- Page script bridge: `CustomEvent.detail` is `null` when crossing MAIN/ISOLATED world boundary in Chrome MV3 — replaced with `data-*` attribute communication

### Changed
- Popup layout updated with reload notice banner and action buttons section
- Notification system now supports success (green) and error (red) types
- Content script message listener accepts sendResponse for new message types
- Page script bridge now uses `dataset` attributes instead of `CustomEvent.detail` for cross-world data passing

## [0.4.1] - 2026-02-06

### Fixed
- Ace Editor: internal textarea (`ace_text-input`) was captured by focusin handler, causing format action to silently fail on empty `.value`
- Format action checked textarea before code editor parent, preventing Ace/CodeMirror/Monaco formatting when focus was on internal elements
- Ace internal textareas no longer counted in badge or scanned for JSON

### Added
- Debug logging (`[JSON Spot]`) in content script and page script for diagnosing editor bridge issues

## [0.4.0] - 2026-02-06

### Added
- Settings popup: configurable indentation (2 spaces, 4 spaces, tab)
- Auto-detect toggle in settings (enable/disable floating button)
- Keyboard shortcut: Alt+Shift+F to format JSON in focused element
- Badge count showing number of detected JSON elements per tab
- Settings persistence via chrome.storage.sync
- Settings live-reload (changes apply immediately without page refresh)

## [0.3.0] - 2026-02-06

### Added
- Code editor support: CodeMirror 5, CodeMirror 6, Monaco Editor, Ace Editor
- Page script bridge (MAIN world) for accessing editor APIs from isolated content script
- CustomEvent-based communication protocol between content script and page script
- Editor JSON detection for floating button (async check via page script)
- Automatic retry with timeout for editor operations

## [0.2.0] - 2026-02-06

### Added
- Floating "Format JSON" button auto-appears near focused textareas/contenteditable with JSON
- Shadow DOM isolation prevents style conflicts with host pages
- Format/minify toggle: button switches between "Format" and "Minify" after each action
- Dismissable floating button (per-element, resets on page reload)
- MutationObserver detects dynamically added elements
- Scroll and resize repositioning for floating button
- Input debouncing: re-checks for JSON when user types/pastes in textareas
- Error notification system (Shadow DOM)

## [0.1.0] - 2026-02-06

### Added
- Basic JSON detection in textareas and contenteditable elements
- "Format JSON" and "Minify JSON" context menu items
- React/Vue/Angular textarea compatibility via native value setter
- Focus tracking for reliable context menu targeting
- Extension icons
- Initial project structure with MIT license
