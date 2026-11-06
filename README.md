# markdownrswasm

A small WebAssembly-compiled Markdown renderer. Wraps the Rust [`markdown`
crate](https://crates.io/crates/markdown) with GFM features (tables,
task lists, strikethrough, footnotes, autolinks) enabled and raw HTML
disabled — embedded `<script>`, `<img onerror>`, `javascript:` URLs, etc.
are escaped rather than executed.

Ships three things:

- **WASM core** (`markdownrswasm.js` / `markdownrswasm_bg.wasm`) — the raw
  bindings: `mdToHtml(md) -> html`, plus `mdToAst(md)` and
  `mdToTopLevel(md)`, which return the parsed document as JSON.
- **Function wrapper** (`markdown.js`) — lazy-loads the WASM and exposes
  an `async` `toHtml(md)`.
- **Web component** (`markdownrswasmwc.js`) — a `<md-view>` element that
  renders into a shadow DOM with built-in default styles.

## Build

```
just dist         # runs `wasm-pack build --target web` and copies
                  # markdown.js / markdownrswasmwc.js / usageexample.js /
                  # index.html into pkg/
just smoke-test   # runs tests/smoketest.js and tests/asttest.js
                  # against the built pkg
```

Serve `pkg/` over HTTP (ES modules + WASM won't load from `file://`):

```
python3 -m http.server 8000
# then open http://localhost:8000/pkg/
```

`pkg/index.html` is an interactive demo with a function-API tab and a
web-component tab. `pkg/astplayground.html` shows the `mdToAst` /
`mdToTopLevel` output for whatever you type.

## Usage

### 1. Raw WASM binding

```js
import init, { mdToHtml } from "./markdownrswasm.js";

await init();               // load the .wasm once per page
const html = mdToHtml("## Hi, *world*!");
document.body.innerHTML = html;
```

### 2. Function wrapper (`markdown.js`)

Lazy-loads the WASM on first call. Good when you render markdown from
a few places and don't want to manage `init()` yourself.

```js
import { mkToHtml } from "./markdown.js";

const toHtml = mkToHtml("./markdownrswasm.js");   // path to the WASM glue
const html = await toHtml("# Hello\n\n- a\n- b");
```

`mkToHtml(path)` returns an `async` function. The first call triggers
the dynamic import + `init()`; later calls reuse the same module.

### 3. Web component (`<md-view>`)

Register once, then use anywhere. Content can be set via the `content`
property, or as an initial `<textarea>` child (useful for SSR / no-JS
authoring).

```html
<script type="module">
  import { register } from "./markdownrswasmwc.js";
  register();                 // defines <md-view>, or a custom name:
  // register("markdown-view");
</script>

<!-- property-driven -->
<md-view id="a"></md-view>
<script type="module">
  document.getElementById("a").content = "# Set via property";
</script>

<!-- initial content from a <textarea> child (consumed on connect) -->
<md-view>
  <textarea>
# Hello
This is **rendered** on connect.
  </textarea>
</md-view>
```

`MdView.basePath` (static) controls where the component looks for
`markdownrswasm.js`. Defaults to `"./"`; override if the component is
loaded from a different path than the WASM:

```js
import { MdView, register } from "./markdownrswasmwc.js";
MdView.basePath = "/vendor/markdownrswasm/";
register();
```

### 4. Parsing to an AST

Two more bindings return the parsed document instead of HTML. Both
return a JSON **string** (call `JSON.parse` on it), or `undefined` if
parsing fails. They use the same parse options as `mdToHtml`: GFM is
enabled, and raw HTML, math and MDX are disabled.

#### `mdToAst(md)` — full mdast tree

Returns the whole syntax tree in
[mdast](https://github.com/syntax-tree/mdast) shape, as serialized by
the `markdown` crate. Every node has a `type`, most have `children`,
and every node carries a `position`:

```js
import init, { mdToAst } from "./markdownrswasm.js";

await init();
const ast = JSON.parse(mdToAst("# Hi\n\nsome *text*"));
ast.type;                                  // "root"
ast.children.map((n) => n.type);           // ["heading", "paragraph"]
ast.children[0].depth;                     // 1
ast.children[0].position.start;            // { line: 1, column: 1, offset: 0 }
```

`position.*.offset` is a **UTF-8 byte offset** into the source, not a
JavaScript string index. The two differ once the text contains
non-ASCII characters.

#### `mdToTopLevel(md)` — section outline

Groups the document's top-level blocks into a tree of sections built
from its headings. Body blocks are **not** parsed further; each block
is kept as its original markdown source. This is useful for outlines,
splitting a document by section, or re-rendering one block at a time.

```js
import init, { mdToTopLevel } from "./markdownrswasm.js";

await init();
const top = JSON.parse(mdToTopLevel(`intro

# A

\`\`\`js
x
\`\`\`

## B

- item

# C`));
```

```json
{
  "preamble": [{ "type": "paragraph", "markdown": "intro" }],
  "sections": [
    {
      "type": "section",
      "depth": 1,
      "title": "A",
      "blocks": [{ "type": "code", "markdown": "```js\nx\n```" }],
      "children": [
        {
          "type": "section",
          "depth": 2,
          "title": "B",
          "blocks": [{ "type": "list", "markdown": "- item\n" }],
          "children": []
        }
      ]
    },
    { "type": "section", "depth": 1, "title": "C", "blocks": [], "children": [] }
  ]
}
```

- `preamble` holds the blocks that come before the first heading.
- A heading starts a section. The section collects the blocks that
  follow it until the next heading at the **same or a shallower** depth.
  Deeper headings become nested `children`.
- `title` is the heading's raw inline source without the `#` markers,
  so inline markdown is kept: `## My **Title**` gives `"My **Title**"`.
  An empty heading has an empty title.
- Each block's `type` is its mdast node type (`paragraph`, `list`,
  `code`, `table`, `blockquote`, `thematicBreak`, …).

## Styling the web component

`<md-view>` renders into a shadow DOM, so page styles don't reach it
and its styles don't leak out. Styles are applied via
[`adoptedStyleSheets`](https://developer.mozilla.org/docs/Web/API/Document/adoptedStyleSheets),
which means constructable `CSSStyleSheet` instances — shared cheaply
across instances, mutable at runtime.

### Default stylesheet

The component ships a default sheet covering headings, paragraphs,
lists, code/pre, blockquotes and tables. It's exposed as a static
property:

```js
import { MdView } from "./markdownrswasmwc.js";
MdView.defaultStyleSheet;     // CSSStyleSheet, shared by every <md-view>
```

Because it's a single shared object, mutating it updates every live
instance immediately:

```js
// Tweak one rule
MdView.defaultStyleSheet.insertRule(
  "pre { background: #222; color: #eee; }",
);

// Replace the whole default
MdView.defaultStyleSheet.replaceSync(`
  :host { display: block; font: 15px/1.55 system-ui, sans-serif; }
  h1 { border-bottom: 1px solid #ccc; }
  /* ... */
`);

// Turn defaults off entirely
MdView.defaultStyleSheet.replaceSync("");
```

### Adding styles per instance

Each `<md-view>` has a `stylesheets` property (array of
`CSSStyleSheet`). These are applied *after* the default, so they
override it:

```js
const dark = new CSSStyleSheet();
dark.replaceSync(`
  :host { background: #111; color: #eee; padding: 1em; }
  a { color: #8ab4f8; }
  pre { background: #000; }
`);

const view = document.querySelector("md-view");
view.stylesheets = [dark];
```

Assigning a new array re-applies the adopted sheets immediately. The
default is always kept in front — to drop it for a single instance,
wipe the default globally (see above) or assign a new empty
`CSSStyleSheet` to `MdView.defaultStyleSheet`.

### What doesn't leak

Because everything goes through `adoptedStyleSheets` on the shadow
root:

- Page CSS (e.g. a global `p { margin: 2em }`) does **not** style
  content inside `<md-view>`.
- Styles adopted by `<md-view>` do **not** affect the rest of the
  page.
- CSS custom properties (`--foo`) *do* cross the boundary — use them
  if you want the host page to theme the component.

## Security

`html_flow` / `html_text` / `allow_dangerous_html` /
`allow_dangerous_protocol` are all disabled in `src/lib.rs`. Inline
`<script>`, event-handler attributes (`onerror=`, `onclick=`),
`javascript:` URLs and raw HTML are escaped. See
`tests/smoketest.js` for an XSS smoke test, and the "Dangerous HTML"
example in the demo (`pkg/index.html`).
