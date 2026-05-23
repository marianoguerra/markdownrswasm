import { mkToHtml } from "./markdown.js";
import { register } from "./markdownrswasmwc.js";

register();

const EXAMPLES = {
  Basics: `# Hello, *world*!

A quick tour of **markdown**.

- Lists
- With *emphasis*
- And \`inline code\`

[Links](https://example.com) work too.`,
  "Code block": `# Code

Some Rust:

\`\`\`rust
fn main() {
    println!("Hello, world!");
}
\`\`\`

Inline: \`let x = 42;\`.`,
  Table: `# Table

| Name   | Role     | Score |
|--------|----------|-------|
| Alice  | Engineer | 95    |
| Bob    | Designer | 88    |
| Carol  | PM       | 91    |`,
  "Dangerous HTML": `# Dangerous HTML Example

Hello world, this is normal markdown

<script>
  alert("XSS Attack!");
</script>

<img src="x" onerror="alert('Image XSS')">

<a href="javascript:alert('Link XSS')">Click me</a>`,
  Quote: `> "Something insightful"
>
> — Someone important

Regular paragraph after a blockquote.`,
};

const toHtml = mkToHtml("./markdownrswasm.js");

const select = document.getElementById("example");
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");

const fnInput = document.getElementById("input-fn");
const fnPreview = document.getElementById("preview-fn");
const fnStats = document.getElementById("stats-fn");

const wcInput = document.getElementById("input-wc");
const wcView = document.getElementById("preview-wc");
const wcStats = document.getElementById("stats-wc");

for (const name of Object.keys(EXAMPLES)) {
  const opt = document.createElement("option");
  opt.value = name;
  opt.textContent = name;
  select.appendChild(opt);
}

async function renderFn() {
  const t0 = performance.now();
  const html = await toHtml(fnInput.value);
  const ms = performance.now() - t0;
  fnPreview.innerHTML = html;
  fnStats.textContent = `rendered in ${ms.toFixed(2)} ms`;
}

function renderWc() {
  const t0 = performance.now();
  const target = wcView.shadowRoot.lastElementChild;
  const observer = new MutationObserver(() => {
    const ms = performance.now() - t0;
    wcStats.textContent = `rendered in ${ms.toFixed(2)} ms`;
    observer.disconnect();
  });
  observer.observe(target, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  wcView.content = wcInput.value;
}

function loadExample(name) {
  const md = EXAMPLES[name];
  fnInput.value = md;
  wcInput.value = md;
  renderFn();
  renderWc();
}

function activateTab(name) {
  for (const btn of tabButtons) {
    btn.classList.toggle("active", btn.dataset.tab === name);
  }
  for (const panel of tabPanels) {
    panel.classList.toggle("active", panel.dataset.tab === name);
  }
}

select.addEventListener("change", (e) => loadExample(e.target.value));
fnInput.addEventListener("input", renderFn);
wcInput.addEventListener("input", renderWc);

for (const btn of tabButtons) {
  btn.addEventListener("click", () => activateTab(btn.dataset.tab));
}

activateTab("fn");
loadExample(Object.keys(EXAMPLES)[0]);
