# I Built a Chrome Extension in One Day Using Claude Code — Here's How AI-Powered Development Actually Works

*How I went from idea to Chrome Web Store using AI as my pair programmer, architect, and code reviewer.*

---

I'm a developer who works with JSON and XML data every day. And every day, I do the same thing: copy a blob of minified JSON from a textarea, paste it into some online formatter, copy it back. Over and over.

Last week I decided to fix this. Not by bookmarking yet another JSON formatter website, but by building a Chrome extension that formats JSON and XML **right where it lives** — inside textareas, code editors, and contenteditable elements on any webpage.

The twist? I built the entire thing in a single day, from zero to Chrome Web Store, using **Claude Code** (powered by Claude Opus 4.6) as my AI development partner.

Here's what I learned about AI-empowered development — and why it's not what most people think.

---

## The Problem: JSON Is Everywhere, Formatters Aren't

If you work with APIs, databases, or any kind of structured data, you've seen this: a wall of minified JSON crammed into a `<textarea>` on some admin panel, a monitoring dashboard, or a testing tool like XSLT Fiddle.

Existing Chrome extensions either:
- Only format raw JSON responses (useless when JSON is inside a page element)
- Require you to copy-paste to an external tool
- Don't work with code editors like Ace, CodeMirror, or Monaco

I wanted something that just **detects** JSON or XML in any input element and lets me format it with one click. No copy-pasting. No leaving the page.

---

## The Approach: AI as Architect, Not Just Autocomplete

Here's where it gets interesting. I didn't just ask Claude to "write me a Chrome extension." That's the mistake most people make with AI coding tools — treating them as fancy autocomplete.

Instead, I used Claude Code with a **structured development process**:

### Phase 1: Product Requirements Document

Before writing a single line of code, I described what I wanted — the problem, the target users, the key features. Claude helped me think through the architecture:

- **Manifest V3** (required for new Chrome extensions)
- **Two execution worlds**: An ISOLATED world content script for UI (Shadow DOM floating button, notifications) and a MAIN world script for accessing code editor APIs (Ace, CodeMirror, Monaco)
- **Cross-world communication**: `window.postMessage` bridge because Chrome MV3 doesn't allow direct API access across worlds
- **Shadow DOM**: To prevent the extension's UI from being affected by page CSS

### Phase 2: Iterative Planning

For each feature, Claude would enter **plan mode** — exploring the existing codebase, understanding the architecture, and proposing an implementation plan before writing any code. I'd review the plan, ask questions, suggest changes, and only then approve it.

This matters because AI can write code fast. But writing the *wrong* code fast just means you debug faster. Planning first meant we rarely had to throw code away.

### Phase 3: Implementation with Real-Time Testing

Claude would implement the plan, I'd test in Chrome, report what worked and what didn't. When XML detection failed on XSLT Fiddle output (because HTML5 void elements like `<meta>` aren't valid strict XML), we debugged it together across three iterations until landing on a two-tier detection approach: strict DOMParser first, lenient regex fallback second.

This back-and-forth is where AI development shines. I could describe the *behavior* I saw, and Claude could reason about the *code* causing it.

---

## What We Built: JSON Spot

Seven versions later, here's what JSON Spot does:

- **Auto-detects** JSON and XML in textareas, code editors (Ace, CodeMirror 5/6, Monaco), and contenteditable elements
- **Floating button** appears with one-click format/minify toggle
- **Keyboard shortcut** (Alt+Shift+F) with green toast notification
- **Context menu** integration (right-click to format/minify)
- **Element picker** — inspector-like mode to click any element on the page
- **Syntax highlighting** — picked elements get color-coded output
- **Copy to clipboard** — one-click copy from the success notification
- **Dark mode** popup that follows system theme
- **Badge count** showing formattable elements per page

All in ~1,100 lines of JavaScript, zero dependencies, pure Manifest V3.

---

## What I Learned About AI-Powered Development

### 1. Planning > Prompting

The biggest productivity gain wasn't from Claude writing code faster. It was from Claude helping me **think through the architecture** before coding. The ISOLATED/MAIN world split, the Shadow DOM encapsulation, the postMessage bridge — these architectural decisions made everything else clean.

### 2. AI Is Best at the Boring Parts

Icon generation (7 iterations of SVG design), CSS dark mode rules, regex-based syntax highlighting, Chrome Web Store metadata — these are tedious but important. Claude handled them with zero complaints while I focused on the interesting problems.

### 3. Debugging Is Still Collaborative

When XML detection broke on XSLT Fiddle, I could describe what I saw in the browser. Claude could reason about why strict `DOMParser` rejects `<meta>` without a self-closing slash. Together we landed on the right fix. Neither of us could have done it as fast alone.

### 4. Version Control Discipline Matters More

When your AI partner can produce code at 10x speed, proper versioning, changelogs, and incremental commits become essential. We went from v0.1.0 to v0.7.0 with a clean CHANGELOG tracking every feature and fix.

### 5. The 80/20 Rule Still Applies

Claude wrote maybe 80% of the code. But the 20% I directed — the architecture decisions, the "no, make it flatter" feedback on the icon, the choice to use Shadow DOM, the decision to support XSLT output — that's what made the extension actually good instead of just functional.

---

## The Numbers

- **Time**: ~8 hours from first line to Chrome Web Store submission
- **Lines of code**: ~1,400 across 7 files
- **Dependencies**: 0
- **Extension size**: 24KB zipped
- **Versions**: v0.1.0 through v0.7.0
- **Icon iterations**: 7 (from purple gradient to flat Material green)

---

## Try It

JSON Spot is free, open source (MIT), and on the Chrome Web Store.

- **Chrome Web Store**: [link]
- **GitHub**: https://github.com/vbalko-claimate/json-spot-extension

If you work with JSON or XML in textareas and code editors, give it a try. And if you have feedback — open an issue. The AI is ready for v0.8.0.

---

*Built with Claude Code (Claude Opus 4.6) by Anthropic. The extension contains zero AI features — it's pure JavaScript. The AI was used for development, not runtime.*

---

**Tags**: #chrome-extension #javascript #ai #developer-tools #productivity #claude #ai-coding
