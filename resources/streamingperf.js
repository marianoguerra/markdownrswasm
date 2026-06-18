import { mkToHtml } from "./markdown.js";
import { register } from "./markdownrswasmwc.js";

register();

const toHtml = mkToHtml("./markdownrswasm.js");

const repeatEl = document.getElementById("repeat");
const chunkEl = document.getElementById("chunk");
const rendererEl = document.getElementById("renderer");
const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const statsEl = document.getElementById("stats");
const canvas = document.getElementById("chart");
const ctx = canvas.getContext("2d");

const wcView = document.getElementById("view-incremental");
const naiveEl = document.getElementById("view-naive");

let runToken = 0; // bumping it cancels any in-flight stream

// Load the README so the streamed text is real content. Fall back to a small inline
// doc if it isn't served alongside this page.
async function loadSource() {
  try {
    const res = await fetch("./README.md");
    if (res.ok) return await res.text();
  } catch (_) { /* ignore */ }
  return "# markdownrswasm\n\nREADME.md not found next to this page — using a stub.\n";
}

function showRenderer(which) {
  const incremental = which === "incremental";
  wcView.hidden = !incremental;
  naiveEl.hidden = incremental;
}

// Render one prefix and return how long it took (ms). The incremental path awaits the
// component's render loop so each measurement reflects a real, completed token render.
async function renderPrefix(which, text) {
  const t0 = performance.now();
  performance.mark("render-start");
  if (which === "incremental") {
    wcView.content = text;
    await wcView._loopPromise; // settle this token's render before measuring
  } else {
    naiveEl.innerHTML = await toHtml(text);
  }
  performance.measure("render", "render-start");
  return performance.now() - t0;
}

function drawChart(samples, maxMs) {
  const dpr = self.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (samples.length < 2) return;
  const ceil = Math.max(maxMs, 1);
  ctx.strokeStyle = "#2b7cff";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < samples.length; i++) {
    const x = (i / (samples.length - 1)) * w;
    const y = h - (samples[i] / ceil) * (h - 4) - 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = "#666";
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillText(`${ceil.toFixed(1)} ms`, 4, 12);
  ctx.fillText("0 ms", 4, h - 4);
}

async function run() {
  const token = ++runToken;
  showRenderer(rendererEl.value);

  const repeat = Math.max(1, Number(repeatEl.value) | 0);
  const chunk = Math.max(1, Number(chunkEl.value) | 0);
  const which = rendererEl.value;

  const source = await loadSource();
  const text = (source + "\n\n").repeat(repeat);
  if (token !== runToken) return;

  // Reset renderers.
  wcView.content = "";
  naiveEl.innerHTML = "";

  const total = text.length;
  const samples = [];
  let maxMs = 0;
  let sumMs = 0;
  let updates = 0;
  const wall0 = performance.now();
  startBtn.disabled = true;

  for (let i = chunk; i <= total; i += chunk) {
    if (token !== runToken) break;
    const end = Math.min(i, total);
    const ms = await renderPrefix(which, text.slice(0, end));
    if (token !== runToken) break;

    updates++;
    sumMs += ms;
    if (ms > maxMs) maxMs = ms;
    // Keep at most ~600 chart points so long runs stay cheap to draw.
    if (samples.length < 600) samples.push(ms);
    else samples[Math.floor((end / total) * 599)] = ms;

    if (updates % 25 === 0 || end === total) {
      const wall = performance.now() - wall0;
      statsEl.innerHTML =
        `renderer <b>${which}</b> · ` +
        `<b>${end.toLocaleString()}</b> / ${total.toLocaleString()} chars · ` +
        `updates <b>${updates}</b> · ` +
        `last <b>${ms.toFixed(2)}</b> ms · ` +
        `avg <b>${(sumMs / updates).toFixed(2)}</b> ms · ` +
        `max <b>${maxMs.toFixed(2)}</b> ms · ` +
        `wall <b>${(wall / 1000).toFixed(1)}</b> s`;
      drawChart(samples, maxMs);
      // Yield to the event loop so the UI/stop button stay responsive.
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  if (token === runToken && which === "incremental") await wcView.finalize();
  startBtn.disabled = false;
}

startBtn.addEventListener("click", run);
stopBtn.addEventListener("click", () => {
  runToken++; // cancels the loop
  startBtn.disabled = false;
});
rendererEl.addEventListener("change", () => showRenderer(rendererEl.value));

showRenderer(rendererEl.value);
