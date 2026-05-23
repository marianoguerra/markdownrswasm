import { mkToHtml } from "./markdown.js";

let _toHtml = null;
function getToHtml() {
  if (_toHtml === null) {
    _toHtml = mkToHtml(`${MdView.basePath}markdownrswasm.js`);
  }
  return _toHtml;
}

function makeDefaultStyleSheet() {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`
    :host { display: block; }
    :host textarea { display: none; }
    h1, h2, h3, h4 { margin: 0.8em 0 0.4em; line-height: 1.25; }
    p { margin: 0.5em 0; }
    ul, ol { margin: 0.5em 0; padding-left: 1.5em; }
    pre {
      background: rgba(127, 127, 127, 0.15);
      padding: 0.5em;
      overflow-x: auto;
    }
    code { font-family: ui-monospace, monospace; }
    pre code { background: transparent; padding: 0; }
    blockquote {
      margin: 0.5em 0;
      padding: 0 0.75em;
      border-left: 3px solid rgba(127, 127, 127, 0.4);
      color: rgba(127, 127, 127, 1);
    }
    table { border-collapse: collapse; }
    th, td {
      border: 1px solid rgba(127, 127, 127, 0.4);
      padding: 0.3em 0.6em;
    }
    a { color: inherit; }
  `);
  return sheet;
}

export class MdView extends HTMLElement {
  static basePath = "./";
  static defaultStyleSheet = makeDefaultStyleSheet();

  constructor() {
    super();
    this._content = "";
    this._renderToken = 0;
    this._extraSheets = [];
    const root = this.attachShadow({ mode: "open" });
    this._output = document.createElement("div");
    root.append(this._output);
    this._applySheets();
  }

  _applySheets() {
    this.shadowRoot.adoptedStyleSheets = [
      MdView.defaultStyleSheet,
      ...this._extraSheets,
    ];
  }

  get stylesheets() {
    return this._extraSheets;
  }

  set stylesheets(sheets) {
    this._extraSheets = Array.isArray(sheets) ? sheets : [];
    this._applySheets();
  }

  connectedCallback() {
    if (!this._content) {
      const ta = this.querySelector("textarea");
      if (ta) {
        const md = ta.value;
        ta.remove();
        this.content = md;
        return;
      }
    }
    this._render();
  }

  get content() {
    return this._content;
  }

  set content(md) {
    this._content = md == null ? "" : String(md);
    this._render();
  }

  async _render() {
    const token = ++this._renderToken;
    const md = this._content;
    if (!md) {
      this._output.innerHTML = "";
      return;
    }
    const toHtml = getToHtml();
    const html = await toHtml(md);
    if (token !== this._renderToken) return;
    this._output.innerHTML = html;
  }
}

export function register(name = "md-view") {
  if (!customElements.get(name)) customElements.define(name, MdView);
}
