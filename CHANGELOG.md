# Changelog

All notable changes to JSON Spot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
