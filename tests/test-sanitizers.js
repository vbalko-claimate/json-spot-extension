/**
 * Tests for sanitizeJSON and sanitizeXML.
 * Run with: node tests/test-sanitizers.js
 */
'use strict';

const assert = require('assert');

// ── Extracted from content.js (keep in sync) ──────────────
const INVISIBLE_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x1A\x7F\uFEFF\u200B\u200C\u200D\uFFFE\uFFFD]/g;

function sanitizeJSON(text) {
  if (!text || typeof text !== 'string') return '';
  let s = text.replace(INVISIBLE_RE, '');
  s = s.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m) =>
    (m[0] === '"' || m[0] === "'") ? m : ''
  );
  s = s.replace(/'((?:[^'\\]|\\.)*)'/g, (_, inner) =>
    '"' + inner.replace(/\\'/g, "'").replace(/"/g, '\\"') + '"'
  );
  s = s.replace(/([{,]\s*)([a-zA-Z_$][\w$]*)\s*:/g, '$1"$2":');
  s = s.replace(/,\s*([}\]])/g, '$1');
  return s.trim();
}

function sanitizeXML(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(INVISIBLE_RE, '').trim();
}

// ── Test Helpers ──────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \x1b[32m\u2713\x1b[0m ${name}`);
  } catch (e) {
    failed++;
    console.log(`  \x1b[31m\u2717\x1b[0m ${name}`);
    console.log(`    ${e.message}`);
  }
}

// ── sanitizeJSON ──────────────────────────────────────────
console.log('\nsanitizeJSON');

// -- Edge cases --
test('returns empty string for null/undefined/empty', () => {
  assert.strictEqual(sanitizeJSON(null), '');
  assert.strictEqual(sanitizeJSON(undefined), '');
  assert.strictEqual(sanitizeJSON(''), '');
});

// -- Control characters --
test('strips NUL bytes', () => {
  const result = sanitizeJSON('{"a":\x001}\x00');
  assert.strictEqual(result, '{"a":1}');
});

test('strips EOF (\\x1A)', () => {
  const result = sanitizeJSON('{"a":1}\x1A');
  assert.strictEqual(result, '{"a":1}');
});

test('strips BOM (\\uFEFF)', () => {
  const result = sanitizeJSON('\uFEFF{"a":1}');
  assert.strictEqual(result, '{"a":1}');
});

test('strips zero-width spaces (\\u200B, \\u200C, \\u200D)', () => {
  const result = sanitizeJSON('{\u200B"a"\u200C:\u200D1}');
  assert.strictEqual(result, '{"a":1}');
});

test('strips \\uFFFE and \\uFFFD', () => {
  const result = sanitizeJSON('{"a":1}\uFFFE\uFFFD');
  assert.strictEqual(result, '{"a":1}');
});

test('strips mixed control characters', () => {
  const result = sanitizeJSON('\uFEFF\x00{"key"\x1A: "val"\u200B}\x00');
  assert.strictEqual(result, '{"key": "val"}');
});

// -- Trailing commas --
test('removes trailing comma before }', () => {
  const result = sanitizeJSON('{"a":1,"b":2,}');
  assert.strictEqual(result, '{"a":1,"b":2}');
  JSON.parse(result); // should not throw
});

test('removes trailing comma before ]', () => {
  const result = sanitizeJSON('[1, 2, 3,]');
  assert.strictEqual(result, '[1, 2, 3]');
  JSON.parse(result);
});

test('removes trailing comma with whitespace before }', () => {
  const result = sanitizeJSON('{"a": 1 , }');
  assert.strictEqual(result, '{"a": 1 }');
  JSON.parse(result);
});

test('removes nested trailing commas', () => {
  const result = sanitizeJSON('{"a": [1, 2,], "b": {"c": 3,},}');
  assert.strictEqual(result, '{"a": [1, 2], "b": {"c": 3}}');
  JSON.parse(result);
});

// -- Single-quoted strings --
test('converts single-quoted values to double-quoted', () => {
  const result = sanitizeJSON("{'a': 'hello'}");
  // After single-quote conversion + unquoted key fix (a was inside single quotes first)
  assert.ok(result.includes('"hello"'));
  JSON.parse(result);
});

test('converts single-quoted keys and values', () => {
  const result = sanitizeJSON("{'key': 'value'}");
  JSON.parse(result);
  const parsed = JSON.parse(result);
  assert.strictEqual(parsed.key, 'value');
});

test('handles escaped single quotes inside single-quoted strings', () => {
  const result = sanitizeJSON("{'msg': 'it\\'s ok'}");
  const parsed = JSON.parse(result);
  assert.strictEqual(parsed.msg, "it's ok");
});

test('handles double quotes inside single-quoted strings', () => {
  const result = sanitizeJSON("{'msg': 'say \"hi\"'}");
  const parsed = JSON.parse(result);
  assert.strictEqual(parsed.msg, 'say "hi"');
});

// -- JS-style comments --
test('removes line comments (//) ', () => {
  const input = '{\n  "a": 1, // this is a comment\n  "b": 2\n}';
  const result = sanitizeJSON(input);
  assert.ok(!result.includes('//'));
  JSON.parse(result);
});

test('removes block comments (/* */)', () => {
  const input = '{"a": /* comment */ 1}';
  const result = sanitizeJSON(input);
  assert.ok(!result.includes('/*'));
  assert.ok(!result.includes('*/'));
  JSON.parse(result);
});

test('removes multi-line block comments', () => {
  const input = '{\n  "a": 1,\n  /* this\n     spans\n     lines */\n  "b": 2\n}';
  const result = sanitizeJSON(input);
  assert.ok(!result.includes('/*'));
  JSON.parse(result);
});

test('preserves // inside strings', () => {
  const input = '{"url": "https://example.com"}';
  const result = sanitizeJSON(input);
  assert.strictEqual(result, input);
  const parsed = JSON.parse(result);
  assert.strictEqual(parsed.url, 'https://example.com');
});

test('preserves /* */ inside strings', () => {
  const input = '{"code": "a /* b */ c"}';
  const result = sanitizeJSON(input);
  assert.strictEqual(result, input);
});

// -- Unquoted keys --
test('quotes simple unquoted keys', () => {
  const result = sanitizeJSON('{name: "John"}');
  assert.strictEqual(result, '{"name": "John"}');
  JSON.parse(result);
});

test('quotes multiple unquoted keys', () => {
  const result = sanitizeJSON('{name: "John", age: 30}');
  const parsed = JSON.parse(result);
  assert.strictEqual(parsed.name, 'John');
  assert.strictEqual(parsed.age, 30);
});

test('quotes keys starting with $ or _', () => {
  const result = sanitizeJSON('{$id: 1, _name: "x"}');
  const parsed = JSON.parse(result);
  assert.strictEqual(parsed.$id, 1);
  assert.strictEqual(parsed._name, 'x');
});

test('quotes nested unquoted keys', () => {
  const result = sanitizeJSON('{user: {name: "John", age: 30}}');
  const parsed = JSON.parse(result);
  assert.strictEqual(parsed.user.name, 'John');
  assert.strictEqual(parsed.user.age, 30);
});

test('does not double-quote already-quoted keys', () => {
  const input = '{"name": "John"}';
  const result = sanitizeJSON(input);
  assert.strictEqual(result, input);
});

// -- Combined fixes --
test('handles trailing comma + single quotes + unquoted keys together', () => {
  const input = "{name: 'John', age: 30,}";
  const result = sanitizeJSON(input);
  const parsed = JSON.parse(result);
  assert.strictEqual(parsed.name, 'John');
  assert.strictEqual(parsed.age, 30);
});

test('handles comments + trailing commas + unquoted keys', () => {
  const input = '{\n  name: "John", // the name\n  age: 30, /* years */\n}';
  const result = sanitizeJSON(input);
  const parsed = JSON.parse(result);
  assert.strictEqual(parsed.name, 'John');
  assert.strictEqual(parsed.age, 30);
});

test('handles BOM + comments + trailing comma + single quotes', () => {
  const input = "\uFEFF{\n  // config\n  'host': 'localhost',\n  'port': 8080,\n}";
  const result = sanitizeJSON(input);
  const parsed = JSON.parse(result);
  assert.strictEqual(parsed.host, 'localhost');
  assert.strictEqual(parsed.port, 8080);
});

// -- Passthrough for valid JSON --
test('leaves valid JSON unchanged', () => {
  const input = '{"name":"John","age":30,"items":[1,2,3]}';
  const result = sanitizeJSON(input);
  assert.strictEqual(result, input);
});

test('leaves valid JSON with whitespace unchanged (except trim)', () => {
  const input = '  { "a": 1 }  ';
  const result = sanitizeJSON(input);
  assert.strictEqual(result, '{ "a": 1 }');
});

test('handles arrays with all fixes', () => {
  const input = "[1, 'two', 3,]";
  const result = sanitizeJSON(input);
  const parsed = JSON.parse(result);
  assert.deepStrictEqual(parsed, [1, 'two', 3]);
});

// ── sanitizeXML ───────────────────────────────────────────
console.log('\nsanitizeXML');

test('returns empty string for null/undefined/empty', () => {
  assert.strictEqual(sanitizeXML(null), '');
  assert.strictEqual(sanitizeXML(undefined), '');
  assert.strictEqual(sanitizeXML(''), '');
});

test('strips NUL bytes', () => {
  const result = sanitizeXML('<root>\x00</root>');
  assert.strictEqual(result, '<root></root>');
});

test('strips BOM', () => {
  const result = sanitizeXML('\uFEFF<root/>');
  assert.strictEqual(result, '<root/>');
});

test('strips EOF (\\x1A)', () => {
  const result = sanitizeXML('<root/>\x1A');
  assert.strictEqual(result, '<root/>');
});

test('strips zero-width spaces', () => {
  const result = sanitizeXML('<root\u200B>\u200Ctext\u200D</root>');
  assert.strictEqual(result, '<root>text</root>');
});

test('strips mixed control characters from XML', () => {
  const result = sanitizeXML('\uFEFF\x00<note>\x1A<to>Bob</to>\u200B</note>\uFFFD');
  assert.strictEqual(result, '<note><to>Bob</to></note>');
});

test('leaves valid XML unchanged', () => {
  const input = '<root><item id="1">text</item></root>';
  const result = sanitizeXML(input);
  assert.strictEqual(result, input);
});

test('trims whitespace', () => {
  const result = sanitizeXML('  <root/>  ');
  assert.strictEqual(result, '<root/>');
});

test('preserves XML declaration', () => {
  const input = '<?xml version="1.0"?><root/>';
  const result = sanitizeXML(input);
  assert.strictEqual(result, input);
});

test('preserves CDATA sections', () => {
  const input = '<root><![CDATA[some <data>]]></root>';
  const result = sanitizeXML(input);
  assert.strictEqual(result, input);
});

// ── Summary ───────────────────────────────────────────────
console.log(`\n${passed + failed} tests: \x1b[32m${passed} passed\x1b[0m${failed ? `, \x1b[31m${failed} failed\x1b[0m` : ''}\n`);
process.exit(failed > 0 ? 1 : 0);
