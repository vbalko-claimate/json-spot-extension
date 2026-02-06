# JSON Spot

A Chrome extension that beautifies JSON inside textareas, code editors, and contenteditable elements on any webpage.

Unlike existing JSON viewer extensions that only format raw JSON responses, JSON Spot works with JSON embedded in page components — textareas, CodeMirror, Monaco Editor, Ace Editor, and contenteditable elements.

## Features

- Format/minify JSON in textareas and contenteditable elements
- Right-click context menu: "Format JSON" / "Minify JSON"
- Floating button auto-appears near elements containing JSON
- Code editor support: CodeMirror 5/6, Monaco, Ace
- Keyboard shortcut: Alt+Shift+F
- Configurable indentation (2 spaces, 4 spaces, tab)
- Works with React/Vue/Angular-controlled inputs

## Installation

1. Clone or download this repository
2. Open `chrome://extensions/` in Chrome
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select the project folder

## Usage

1. Navigate to any page with a textarea or code editor containing JSON
2. Right-click on the element and select "Format JSON" or "Minify JSON"
3. Or click the floating "{ } Format JSON" button that appears automatically

## License

MIT
