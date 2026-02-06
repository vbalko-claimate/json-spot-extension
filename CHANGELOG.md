# Changelog

All notable changes to JSON Spot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.0] - 2026-02-06

### Added
- Success notifications: keyboard shortcut (Alt+Shift+F) and context menu actions now show green toast feedback ("JSON formatted", "XML minified", etc.)
- Dark mode: popup automatically adapts to system dark/light preference via `prefers-color-scheme`
- Syntax highlighting: Pick Element on `<pre>`/`<code>`/`<div>` displays formatted JSON/XML with color-coded syntax (keys, strings, numbers, tags, attributes)
- Copy button: success notification from Pick Element includes "Copy" action to copy formatted content to clipboard

### Removed
- Unnecessary `web_accessible_resources` from manifest (page script uses `"world": "MAIN"` injection)

## [0.6.0] - 2026-02-06

### Added
- XML detection: `isLikelyXML()` validates via strict DOMParser (`application/xml`) with lenient fallback for HTML5 output (void elements like `<meta>`, `<br>` without self-closing slash)
- XML/XHTML formatting: well-formed XHTML output (e.g. from XSLT) is detected and formattable, including `<!DOCTYPE>` handling and HTML5 void elements
- XML formatting: string-based tokenizer preserves attributes, CDATA, comments, processing instructions, DOCTYPE declarations
- XML minification: strips whitespace between tags
- Unified content detection: `detectContentType()` returns `'json'`, `'xml'`, or `null`
- Floating button shows `</>` icon for XML elements, `{ }` for JSON
- Code editors (Ace, CodeMirror, Monaco) now support XML format/minify via page script bridge
- Picker mode detects and formats both JSON and XML in arbitrary elements

### Changed
- New icon: flat Material Design style with curly braces `{·}` on green (#4CAF50) rounded square, SVG source included
- Context menus renamed to "Format JSON / XML" and "Minify JSON / XML"
- Keyboard shortcut description updated to "Format JSON/XML in focused element"
- Badge count now includes both JSON and XML elements
- Highlight and picker modes scan for both JSON and XML
- Popup labels updated: "Auto-detect JSON & XML", "Highlight Elements"
- Error messages now say "No valid JSON or XML found" instead of JSON-only
- Page script bridge protocol: `jsonspot-check-response` returns `contentType` instead of `isJSON`

## [0.5.0] - 2026-02-06

### Added
- Page reload detection: popup shows notice when content script isn't injected, with one-click reload button
- Highlight JSON: button in popup temporarily highlights all detected JSON elements with green glow animation (3s fade)
- Element picker: "Pick Element" activates DevTools-like inspector mode — hover to highlight, click to format JSON
- Element picker supports arbitrary elements (`<pre>`, `<code>`, `<div>`) beyond standard textareas/editors
- Success notification variant (green) for positive feedback from picker actions
- Action buttons section in popup for Highlight and Pick features

### Fixed
- Page script bridge: neither `CustomEvent.detail` nor `dataset` attributes cross the MAIN/ISOLATED world boundary in Chrome MV3 — replaced with `window.postMessage` communication

### Changed
- Popup layout updated with reload notice banner and action buttons section
- Notification system now supports success (green) and error (red) types
- Content script message listener accepts sendResponse for new message types
- Page script bridge now uses `window.postMessage` instead of `CustomEvent.detail` for cross-world data passing

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
