import init, { mdToAst, mdToTopLevel } from "./markdownrswasm.js";

const EXAMPLES = {
  Basics: `# Hello, *world*!

A quick tour of **markdown**.

- Lists
- With *emphasis*
- And \`inline code\`

[Links](https://example.com) work too.`,
  "Nested sections": `intro paragraph before any heading

# Chapter 1

some prose

## Section 1.1

more detail here

## Section 1.2

- a
- b

# Chapter 2

the end`,
  "Code & table": `# Code

\`\`\`rust
fn main() {
    println!("Hello, world!");
}
\`\`\`

| Name  | Score |
|-------|-------|
| Alice | 95    |
| Bob   | 88    |`,
};

const input = document.getElementById("input");
const output = document.getElementById("output");
const stats = document.getElementById("stats");
const select = document.getElementById("example");
const modeButtons = document.querySelectorAll(".mode-btn");

let mode = "ast";

const ready = init();

for (const name of Object.keys(EXAMPLES)) {
  const opt = document.createElement("option");
  opt.value = name;
  opt.textContent = name;
  select.appendChild(opt);
}

async function render() {
  await ready;
  const fn = mode === "ast" ? mdToAst : mdToTopLevel;
  const t0 = performance.now();
  const json = fn(input.value);
  const ms = performance.now() - t0;
  if (json === undefined) {
    stats.textContent = "parse failed — returned undefined";
    stats.classList.add("error");
    output.textContent = "";
    return;
  }
  stats.classList.remove("error");
  output.textContent = JSON.stringify(JSON.parse(json), null, 2);
  stats.textContent = `${mode === "ast" ? "mdToAst" : "mdToTopLevel"} — parsed in ${ms.toFixed(2)} ms, ${json.length} bytes JSON`;
}

function activateMode(name) {
  mode = name;
  for (const btn of modeButtons) {
    btn.classList.toggle("active", btn.dataset.mode === name);
  }
  render();
}

select.addEventListener("change", (e) => {
  input.value = EXAMPLES[e.target.value];
  render();
});
input.addEventListener("input", render);
for (const btn of modeButtons) {
  btn.addEventListener("click", () => activateMode(btn.dataset.mode));
}

input.value = EXAMPLES[Object.keys(EXAMPLES)[0]];
activateMode("ast");
