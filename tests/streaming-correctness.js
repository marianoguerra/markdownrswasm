// Simulates token-by-token streaming through the incremental renderer and asserts the
// result is identical (DOM-equivalent) to a single full parse. The web component can't
// be imported under bun (no HTMLElement/CSSStyleSheet), so findCommitPoint is mirrored
// here — keep it in sync with resources/markdownrswasmwc.js.
import init, { mdToHtml } from "../pkg/markdownrswasm.js";

await init();

function findCommitPoint(md, from) {
  const fenceRe = /^ {0,3}(`{3,}|~{3,})/;
  const listRe = /^ {0,3}([-*+]|\d{1,9}[.)])([ \t]|$)/;
  const blankRe = /^[ \t]*$/;
  const n = md.length;

  const starts = [];
  let i = from;
  let prevBlank = true;
  let inFence = false;
  let fenceMarker = "";
  while (i < n) {
    let end = md.indexOf("\n", i);
    if (end === -1) end = n;
    const line = md.slice(i, end);
    if (inFence) {
      const m = line.match(fenceRe);
      if (
        m && m[1][0] === fenceMarker[0] && m[1].length >= fenceMarker.length &&
        line.slice(m[0].length).trim() === ""
      ) {
        inFence = false;
      }
      prevBlank = false;
    } else if (blankRe.test(line)) {
      prevBlank = true;
    } else {
      if (prevBlank) starts.push(i);
      prevBlank = false;
      const m = line.match(fenceRe);
      if (m) {
        inFence = true;
        fenceMarker = m[1];
      }
    }
    i = end + 1;
  }

  if (starts.length <= 1) return from;

  const startsWithList = (off) => {
    let end = md.indexOf("\n", off);
    if (end === -1) end = n;
    return listRe.test(md.slice(off, end));
  };

  let j = starts.length - 1;
  while (j >= 1 && startsWithList(starts[j]) && startsWithList(starts[j - 1])) j--;
  return starts[j];
}

// Inter-tag whitespace is irrelevant for block-level DOM equivalence; whitespace inside
// text/code (between text and tags, not between two tags) is preserved.
const norm = (html) => html.replace(/>\s+</g, "><").trim();

// Drive the incremental renderer the way the component does, char by char.
function streamIncremental(text) {
  let committedLen = 0;
  let committedHtml = "";
  for (let len = 1; len <= text.length; len++) {
    const md = text.slice(0, len);
    const p = findCommitPoint(md, committedLen);
    if (p > committedLen) {
      committedHtml += mdToHtml(md.slice(committedLen, p));
      committedLen = p;
    }
  }
  return committedHtml + mdToHtml(text.slice(committedLen));
}

const CASES = {
  "headings + paragraphs": `# Title\n\nFirst paragraph here.\n\nSecond paragraph.\n`,
  "tight list then text": `Intro\n\n- one\n- two\n- three\n\nAfter the list.\n`,
  "loose list (blank-separated)": `Before\n\n- a\n\n- b\n\n- c\n\nAfter.\n`,
  "ordered list": `Steps:\n\n1. first\n2. second\n3. third\n\nDone.\n`,
  "fenced code with blank lines": `Code:\n\n\`\`\`js\nconst a = 1;\n\nconst b = 2;\n\`\`\`\n\nAfter code.\n`,
  "table built row by row": `Data:\n\n| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\n\nEnd.\n`,
  "blockquotes": `> quote one\n>\n> still one\n\n> a second quote\n\nplain.\n`,
  "thematic break + setext": `Para\n\n---\n\nSetext\n======\n\ntail\n`,
  "nested list": `Top\n\n- a\n  - a1\n  - a2\n- b\n\nbottom.\n`,
  "two lists separated by para": `- x\n- y\n\nmiddle\n\n- p\n- q\n\ntail\n`,
};

let failures = 0;
for (const [name, text] of Object.entries(CASES)) {
  const inc = norm(streamIncremental(text));
  const full = norm(mdToHtml(text));
  const ok = inc === full;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) {
    failures++;
    console.log("  incremental:", JSON.stringify(inc));
    console.log("  full parse :", JSON.stringify(full));
  }
}

console.log(`\n${failures === 0 ? "All cases passed" : failures + " case(s) failed"}`);
if (failures > 0) process.exit(1);
